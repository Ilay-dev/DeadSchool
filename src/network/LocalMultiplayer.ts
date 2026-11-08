import Peer, { DataConnection } from 'peerjs';
import { useGameStore, type RemoteActor } from '../store/useGameStore';
import type { WeaponId } from '../game/rules';

export interface NetworkTransformPacket {
  type: 'player:transform' | 'player:moved';
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
  roomCode?: string;
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
  private wsAttempts = 0;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  private lastSeenMap: Map<string, number> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private tickInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private hostTimeout: number | null = null;
  private latestLocalPosition: [number, number, number] = [2.1, 0.15, 32.5];
  private latestLocalVelocity: [number, number, number] = [0, 0, 0];
  private latestLocalRotation: [number, number] = [0, Math.PI];
  public activeRooms: ActiveRoomSummary[] = [];

  public init() {
    this.fetchLanInfo();
    this.connectWebSocket();
    this.setupBroadcastChannel();
    this.startTickLoop();
    this.startPeerCleanupLoop();
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
    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') ||
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('netlify.app') ||
        window.location.protocol === 'file:');

    if (isStaticHost) {
      useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
      return this.activeRooms;
    }

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
      useGameStore
        .getState()
        .setLanInfo(window.location.hostname || '192.168.1.100', 'offline-lan');
    }
    return this.activeRooms;
  }

  /**
   * Connects to a local/LAN Node WebSocket server if one exists.
   * On static hosts (like GitHub Pages) or after 2 failed attempts, WebSocket connection
   * is skipped cleanly without flooding the browser console with errors.
   */
  public connectWebSocket(customHostIp?: string) {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') ||
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('netlify.app') ||
        window.location.protocol === 'file:');

    if (isStaticHost && !customHostIp) {
      // GitHub Pages is a static file host with no backend. WebRTC P2P + BroadcastChannel is used.
      useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
      return;
    }

    if (this.wsAttempts >= 2 && !customHostIp) {
      useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
      return;
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
      this.wsAttempts++;

      socket.onopen = () => {
        this.wsAttempts = 0;
        useGameStore.getState().setLanInfo(host, 'lan-ws');
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
          if (this.wsAttempts < 2) {
            this.reconnectTimeout = window.setTimeout(() => {
              this.connectWebSocket(customHostIp);
            }, 3000);
          } else {
            useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
          }
        }
      };

      socket.onerror = () => {
        // Fallback cleanly to WebRTC PeerJS
        useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
      };
    } catch {
      useGameStore.getState().setLanInfo(window.location.hostname, 'webrtc-p2p');
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
   * Resilient, serverless WebRTC PeerJS DataChannel multiplayer:
   * Works anywhere in the world on GitHub Pages or LAN.
   * Auto-promotes host or joins existing room seamlessly.
   */
  public initWebRtcPeer(roomCode: string, asHost?: boolean) {
    if (this.hostTimeout) {
      window.clearTimeout(this.hostTimeout);
      this.hostTimeout = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.peerToPlayerId.clear();

    const cleanCode =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    const state = useGameStore.getState();
    state.setRoomCode(cleanCode);

    const hostPeerId = `deadschool-room-${cleanCode}`;
    const clientPeerId = `deadschool-p2p-${cleanCode}-${state.playerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)}`;
    const shouldHost = asHost ?? state.isHost;

    state.setIsHost(shouldHost);

    // If WS is available, sync room
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRoomJoinOverWs(shouldHost);
    }

    const currentPeerId = shouldHost ? hostPeerId : clientPeerId;

    try {
      const peer = new Peer(currentPeerId, {
        config: { iceServers: GLOBAL_ICE_SERVERS },
      });
      this.peer = peer;

      peer.on('open', (id) => {
        state.setPeerInfo(id, this.connections.size + 1);
        state.setLanInfo(state.lanIp, 'webrtc-p2p');

        if (!shouldHost) {
          // Connect to the room host
          const conn = peer.connect(hostPeerId, {
            reliable: true,
            serialization: 'json',
          });
          this.registerDataConnection(conn);

          // If the host isn't open after 1500ms, become the room host automatically!
          this.hostTimeout = window.setTimeout(() => {
            if (this.connections.size === 0 && !state.isHost) {
              this.initWebRtcPeer(cleanCode, true);
            }
          }, 1500);
        }
      });

      peer.on('connection', (conn) => {
        this.registerDataConnection(conn);
      });

      peer.on('error', (err: any) => {
        // If 'unavailable-id' happened while attempting to host, someone else is already hosting!
        // Immediately connect as client!
        if (shouldHost && err?.type === 'unavailable-id') {
          setTimeout(() => {
            if (useGameStore.getState().roomCode === cleanCode) {
              this.initWebRtcPeer(cleanCode, false);
            }
          }, 200);
        }
      });
    } catch {
      // Ignore in sandbox environments
    }
  }

  private registerDataConnection(conn: DataConnection) {
    conn.on('open', () => {
      if (this.hostTimeout) {
        window.clearTimeout(this.hostTimeout);
        this.hostTimeout = null;
      }
      this.connections.set(conn.peer, conn);
      useGameStore
        .getState()
        .setPeerInfo(this.peer?.id || '', this.connections.size + 1);

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
        sliding: s.isSliding,
        ads: s.isAds,
        ridingScooter: Boolean(s.ridingScooterId),
        weaponClass: s.selectedClass,
      });

      // If this node is host, advertise room settings
      if (s.isHost) {
        conn.send({
          type: 'lobby:update',
          roomCode: s.roomCode,
          playerName: s.playerName,
          mapId: s.selectedMapId,
          modeId: s.selectedModeId,
          isPublic: s.isPublicRoom,
          team: s.playerTeam,
          ready: s.isReady,
          weaponClass: s.selectedClass,
        });
      }
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        const msg = data as Record<string, any>;
        if (msg.playerId) {
          this.peerToPlayerId.set(conn.peer, msg.playerId);
          this.lastSeenMap.set(msg.playerId, Date.now());
        }
        this.handleIncomingPacket(msg);

        // Host relays packets to all other open peer connections
        if (useGameStore.getState().isHost) {
          this.connections.forEach((otherConn, peerKey) => {
            if (peerKey !== conn.peer && otherConn.open) {
              otherConn.send(data);
            }
          });
        }
      }
    });

    conn.on('close', () => {
      const remotePlayerId = this.peerToPlayerId.get(conn.peer);
      if (remotePlayerId) {
        useGameStore.getState().removeRemotePlayer(remotePlayerId);
        this.lastSeenMap.delete(remotePlayerId);
        this.peerToPlayerId.delete(conn.peer);
      }
      this.connections.delete(conn.peer);
      useGameStore
        .getState()
        .setPeerInfo(this.peer?.id || '', this.connections.size + 1);
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
    });
  }

  /**
   * Same-machine multi-tab zero-latency LAN bridge via BroadcastChannel.
   */
  private setupBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('deadschool_multiplayer_channel');
      this.broadcastChannel.onmessage = (ev) => {
        if (ev.data && typeof ev.data === 'object') {
          if (ev.data.playerId) {
            this.lastSeenMap.set(ev.data.playerId, Date.now());
          }
          this.handleIncomingPacket(ev.data);
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }

  private handleIncomingPacket(msg: Record<string, any>) {
    const store = useGameStore.getState();

    // Filter packets by roomCode if specified
    if (msg.roomCode && msg.roomCode !== store.roomCode) {
      return;
    }

    if (msg.type === 'player:leave' && msg.playerId) {
      store.removeRemotePlayer(msg.playerId);
      this.lastSeenMap.delete(msg.playerId);
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
            team: p.team || (store.selectedModeId === 'FFA' ? 'bravo' : 'alpha'),
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
          store.selectedModeId === 'FFA' ? 'bravo' : msg.team,
          Boolean(msg.sliding)
        );
      }
    } else if (msg.type === 'lobby:update') {
      if (msg.mapId && msg.mapId !== store.selectedMapId) {
        store.setMapId(msg.mapId);
      }
      if (msg.modeId && msg.modeId !== store.selectedModeId) {
        store.setModeId(msg.modeId);
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
   * Periodically cleans up disconnected peers so ghost players never remain in the arena.
   */
  private startPeerCleanupLoop() {
    if (this.cleanupInterval) window.clearInterval(this.cleanupInterval);
    this.cleanupInterval = window.setInterval(() => {
      const store = useGameStore.getState();
      const now = Date.now();
      Object.values(store.remotePlayers).forEach((actor) => {
        if (!actor.isBot) {
          const lastSeen = this.lastSeenMap.get(actor.id) || 0;
          if (lastSeen > 0 && now - lastSeen > 4500) {
            store.removeRemotePlayer(actor.id);
            this.lastSeenMap.delete(actor.id);
          }
        }
      });
    }, 1000);
  }

  /**
   * 40Hz (25ms) network tick rate sending position, velocity, rotation, ADS, slide/crouch, and scooter state.
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

      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send({ ...packet, type: 'player:moved' });
        }
      });

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ ...packet, type: 'player:moved' });
      }
    }, 25);
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

    this.connections.forEach((conn) => {
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
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
      }
    });
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
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
    this.connections.forEach((conn) => {
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
