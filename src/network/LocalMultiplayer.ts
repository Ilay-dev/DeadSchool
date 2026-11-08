import Peer, { DataConnection } from 'peerjs';
import { useGameStore, type RemoteActor } from '../store/useGameStore';
import type { WeaponId } from '../game/rules';

export interface NetworkTransformPacket {
  type: 'player:transform';
  playerId: string;
  playerName: string;
  team: 'alpha' | 'bravo';
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number];
  crouching: boolean;
  sliding?: boolean;
  ads: boolean;
  ridingScooter: boolean;
  weaponClass: WeaponId;
}

export interface ActiveRoomSummary {
  roomCode: string;
  mapId: string;
  modeId: string;
  playerCount: number;
  isPublic: boolean;
  status: 'lobby' | 'playing';
}

const GLOBAL_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

class LocalMultiplayerManager {
  private ws: WebSocket | null = null;
  private peer: Peer | null = null;
  private unreliableConnections: Map<string, DataConnection> = new Map();
  private reliableConnections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private tickInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private latestLocalPosition: [number, number, number] = [2.1, 0.15, 32.5];
  private latestLocalVelocity: [number, number, number] = [0, 0, 0];
  private latestLocalRotation: [number, number] = [0, Math.PI];
  public activeRooms: ActiveRoomSummary[] = [];

  public init() {
    this.fetchLanInfo();
    this.connectWebSocket();
    this.setupBroadcastChannel();
    this.startTickLoop();
    const state = useGameStore.getState();
    this.initWebRtcPeer(state.roomCode || 'WORLD', state.isHost);
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async fetchLanInfo(): Promise<ActiveRoomSummary[]> {
    try {
      const res = await fetch('/api/lan-info');
      if (res.ok) {
        const data = await res.json();
        if (data.lanIp) {
          useGameStore.getState().setLanInfo(data.lanIp, 'lan-ws');
        }
        if (Array.isArray(data.activeRooms)) {
          this.activeRooms = data.activeRooms;
        }
      }
    } catch {
      useGameStore.getState().setLanInfo(
        window.location.hostname || '192.168.1.100',
        'offline-lan'
      );
    }
    return this.activeRooms;
  }

  public connectWebSocket(customHostIp?: string) {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      this.ws.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = customHostIp || window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.sendRoomJoinOverWs(useGameStore.getState().isHost);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingPacket(msg);
        } catch {
          // Ignore malformed packet
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.reconnectTimeout = window.setTimeout(() => {
            this.connectWebSocket(customHostIp);
          }, 1800);
        }
      };

      socket.onerror = () => {
        // Fallback to BroadcastChannel / WebRTC DataChannel
      };
    } catch {
      // WebSocket unavailable
    }
  }

  private sendRoomJoinOverWs(asHost: boolean) {
    const state = useGameStore.getState();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: asHost ? 'room:host' : 'room:join',
          roomCode: state.roomCode || 'WORLD',
          playerId: state.playerId,
          playerName: state.playerName,
          team: state.playerTeam,
          weaponClass: state.selectedClass,
          mapId: state.selectedMapId,
          modeId: state.selectedModeId === 'BOTS' ? 'TDM' : state.selectedModeId,
          isPublic: state.isPublicRoom,
        })
      );
    }
  }

  /**
   * Joins or hosts a room across both the Global WebSocket Server (/ws) and WebRTC PeerJS DataChannels
   * so any player anywhere in the world can join via the Global Lobby ("WORLD") or a 5-digit Room Code.
   */
  public initWebRtcPeer(roomCode: string, asHost: boolean) {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.unreliableConnections.clear();
    this.reliableConnections.clear();

    const cleanCode =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    useGameStore.getState().setRoomCode(cleanCode);
    useGameStore.getState().setIsHost(asHost);

    // Immediately switch room on the global WebSocket server (/ws)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRoomJoinOverWs(asHost);
    } else if (!this.ws || this.ws.readyState !== WebSocket.CONNECTING) {
      this.connectWebSocket();
    }

    const peerId = asHost
      ? `deadschool-global-host-${cleanCode}`
      : `deadschool-global-client-${cleanCode}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      const peer = new Peer(peerId, {
        config: { iceServers: GLOBAL_ICE_SERVERS },
      });
      this.peer = peer;

      peer.on('open', (id) => {
        useGameStore.getState().setPeerInfo(id, this.unreliableConnections.size + 1);
        useGameStore.getState().setLanInfo(useGameStore.getState().lanIp, 'webrtc-p2p');

        if (!asHost) {
          const hostPeerId = `deadschool-global-host-${cleanCode}`;
          // Unreliable / Unordered DataChannel for 50Hz movement
          const moveConn = peer.connect(hostPeerId, {
            label: 'movement-unreliable',
            reliable: false,
            serialization: 'json',
          });
          this.registerDataConnection(moveConn, false);

          // Reliable / Ordered DataChannel for chat, kills, stuns, and match events
          const eventConn = peer.connect(hostPeerId, {
            label: 'events-reliable',
            reliable: true,
            serialization: 'json',
          });
          this.registerDataConnection(eventConn, true);
        }
      });

      peer.on('connection', (conn) => {
        const isReliable = conn.label === 'events-reliable' || conn.reliable;
        this.registerDataConnection(conn, isReliable);
      });

      peer.on('error', () => {
        // If another player is already the PeerJS host for `WORLD`, automatically connect as client!
        if (asHost) {
          setTimeout(() => {
            if (useGameStore.getState().roomCode === cleanCode) {
              this.initWebRtcPeer(cleanCode, false);
            }
          }, 300);
        }
      });
    } catch {
      // Ignore PeerJS init failure in isolated sandboxes
    }
  }

  private registerDataConnection(conn: DataConnection, isReliable: boolean) {
    const targetMap = isReliable ? this.reliableConnections : this.unreliableConnections;

    conn.on('open', () => {
      targetMap.set(conn.peer, conn);
      useGameStore
        .getState()
        .setPeerInfo(this.peer?.id || '', this.unreliableConnections.size + 1);

      const s = useGameStore.getState();
      conn.send({
        type: 'player:moved',
        roomCode: s.roomCode,
        playerId: s.playerId,
        playerName: s.playerName,
        team: s.playerTeam,
        position: this.latestLocalPosition,
        velocity: this.latestLocalVelocity,
        rotation: this.latestLocalRotation,
        crouching: s.isCrouching,
        ads: s.isAds,
        ridingScooter: Boolean(s.ridingScooterId),
        weaponClass: s.selectedClass,
      });
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        this.handleIncomingPacket(data as Record<string, unknown>);
        if (useGameStore.getState().isHost) {
          targetMap.forEach((otherConn, peerKey) => {
            if (peerKey !== conn.peer && otherConn.open) {
              otherConn.send(data);
            }
          });
        }
      }
    });

    conn.on('close', () => {
      targetMap.delete(conn.peer);
      useGameStore
        .getState()
        .setPeerInfo(this.peer?.id || '', this.unreliableConnections.size + 1);
    });
  }

  /**
   * Same-machine multi-tab zero-latency LAN bridge via BroadcastChannel.
   */
  private setupBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.broadcastChannel = new BroadcastChannel('deadschool_lan_channel');
    this.broadcastChannel.onmessage = (ev) => {
      if (ev.data && typeof ev.data === 'object') {
        this.handleIncomingPacket(ev.data);
      }
    };
  }

  private handleIncomingPacket(msg: Record<string, any>) {
    const store = useGameStore.getState();

    // Filter packets by roomCode if specified
    if (msg.roomCode && msg.roomCode !== store.roomCode) {
      return;
    }

    if (msg.type === 'room:state' && msg.room) {
      if (msg.lanIp) {
        store.setLanInfo(msg.lanIp);
      }
      const playersMap: Record<string, RemoteActor> = {};
      Object.values(msg.room.players || {}).forEach((p: any, idx: number) => {
        if (p.id !== store.playerId) {
          const spawnFallback =
            store.spawnPoints[(idx + 1) % store.spawnPoints.length]?.position || [
              0, 0.15, 0,
            ];
          playersMap[p.id] = {
            id: p.id,
            name: p.name || `Player_${String(p.id).slice(0, 4)}`,
            team: p.team || 'bravo',
            weaponClass: p.weaponClass || 'assault',
            ready: Boolean(p.ready),
            hp: Number(p.hp) || 100,
            maxHp: Number(p.maxHp) || 100,
            score: Number(p.kills || 0) * 150,
            kills: Number(p.kills) || 0,
            deaths: Number(p.deaths) || 0,
            ping: 14,
            position: p.position || spawnFallback,
            targetPosition: p.position || spawnFallback,
            velocity: p.velocity || [0, 0, 0],
            rotation: p.rotation || [0, 0],
            crouching: Boolean(p.crouching),
            ads: Boolean(p.ads),
            ridingScooter: Boolean(p.ridingScooter),
          };
        }
      });
      store.syncRemotePlayers(playersMap);
    } else if (msg.type === 'player:moved' || msg.type === 'player:transform') {
      if (msg.playerId && msg.playerId !== store.playerId) {
        store.updateRemoteTransform(
          msg.playerId,
          msg.position,
          msg.rotation,
          Boolean(msg.crouching),
          Boolean(msg.ads),
          (msg.weaponClass as WeaponId) || 'assault',
          msg.velocity || [0, 0, 0],
          Boolean(msg.ridingScooter),
          msg.playerName,
          msg.team,
          Boolean(msg.sliding)
        );
      }
    } else if (msg.type === 'combat:event' || msg.type === 'combat:hit') {
      const stunMs = Number(msg.stunDurationMs) || 0;
      if (msg.targetId === store.playerId) {
        if (stunMs > 0) {
          store.applyPlayerStun(stunMs);
        }
        if (Number(msg.damage) > 0) {
          store.applyPlayerDamage(Number(msg.damage) || 20, {
            name: msg.attackerName || 'Online_Player',
            team: msg.attackerTeam || 'bravo',
            hp: 100,
            maxHp: 100,
            weaponClass: (msg.weaponId as WeaponId) || 'assault',
          });
        }
      } else if (msg.targetId) {
        if (stunMs > 0) {
          store.stunRemoteActor(msg.targetId, stunMs, msg.attackerName || 'Online Player');
        }
        if (Number(msg.damage) > 0) {
          store.damageRemoteActor(
            msg.targetId,
            Number(msg.damage) || 25,
            Boolean(msg.isHeadshot),
            msg.attackerName || 'Online Player',
            msg.attackerTeam || 'alpha',
            msg.weaponClass || 'Assault Rifle',
            (msg.weaponId as WeaponId) || 'assault'
          );
        }
      }
    } else if (msg.type === 'chat:message') {
      if (msg.senderName !== store.playerName) {
        store.addChatMessage(msg.senderName || 'Player', msg.team || 'alpha', msg.text || '');
      }
    }
  }

  public updateLocalTransform(
    position: [number, number, number],
    rotation: [number, number],
    velocity: [number, number, number] = [0, 0, 0]
  ) {
    this.latestLocalPosition = position;
    this.latestLocalRotation = rotation;
    this.latestLocalVelocity = velocity;
  }

  /**
   * 50Hz (20ms) network tick rate sending position, velocity, rotation, ADS, slide/crouch, and scooter state.
   */
  private startTickLoop() {
    if (this.tickInterval) window.clearInterval(this.tickInterval);
    this.tickInterval = window.setInterval(() => {
      const store = useGameStore.getState();
      if (store.screen !== 'playing' && store.screen !== 'match_lobby') return;

      const packet: NetworkTransformPacket & { roomCode: string } = {
        type: 'player:transform',
        roomCode: store.roomCode,
        playerId: store.playerId,
        playerName: store.playerName,
        team: store.playerTeam,
        position: this.latestLocalPosition,
        velocity: this.latestLocalVelocity,
        rotation: this.latestLocalRotation,
        crouching: store.isCrouching,
        sliding: store.isSliding,
        ads: store.isAds,
        ridingScooter: Boolean(store.ridingScooterId),
        weaponClass: store.selectedClass,
      };

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(packet));
      }

      this.unreliableConnections.forEach((conn) => {
        if (conn.open) {
          conn.send({ ...packet, type: 'player:moved' });
        }
      });

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ ...packet, type: 'player:moved' });
      }
    }, 20);
  }

  public sendHitscanEvent(
    targetId: string,
    damage: number,
    isHeadshot: boolean,
    weaponName: string,
    weaponId: WeaponId = 'assault',
    stunDurationMs = 0
  ) {
    const store = useGameStore.getState();
    const payload = {
      type: 'combat:hit',
      roomCode: store.roomCode,
      attackerId: store.playerId,
      attackerName: store.playerName,
      attackerTeam: store.playerTeam,
      targetId,
      damage,
      isHeadshot,
      weaponClass: weaponName,
      weaponId,
      stunDurationMs,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }

    const targetConns =
      this.reliableConnections.size > 0
        ? this.reliableConnections
        : this.unreliableConnections;
    targetConns.forEach((conn) => {
      if (conn.open) {
        conn.send({ ...payload, type: 'combat:event' });
      }
    });

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ ...payload, type: 'combat:event' });
    }
  }

  public sendLobbySync() {
    const store = useGameStore.getState();
    const payload = {
      type: 'lobby:update',
      roomCode: store.roomCode,
      playerName: store.playerName,
      mapId: store.selectedMapId,
      modeId: store.selectedModeId,
      isPublic: store.isPublicRoom,
      team: store.playerTeam,
      ready: store.isReady,
      weaponClass: store.selectedClass,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public sendChatMessage(text: string) {
    const store = useGameStore.getState();
    const trimmed = text.trim();
    if (!trimmed) return;
    store.addChatMessage(store.playerName, store.playerTeam, trimmed);

    const payload = {
      type: 'chat:message',
      roomCode: store.roomCode,
      senderName: store.playerName,
      team: store.playerTeam,
      text: trimmed,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
    this.reliableConnections.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
      }
    });
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    }
  }
}

export const multiplayerManager = new LocalMultiplayerManager();

