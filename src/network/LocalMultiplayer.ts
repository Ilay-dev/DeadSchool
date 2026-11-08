import Peer, { DataConnection } from 'peerjs';
import { useGameStore, type RemoteActor } from '../store/useGameStore';
import type { GameModeId, WeaponId } from '../game/rules';

export interface NetworkTransformPacket {
  type: 'player:transform' | 'player:moved';
  msgId?: string;
  playerId: string;
  peerId?: string;
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
  hp?: number;
  maxHp?: number;
  kills?: number;
  deaths?: number;
  score?: number;
  ready?: boolean;
  modeId?: GameModeId;
  mapId?: string;
  roomCode?: string;
}

export interface ActiveRoomSummary {
  roomCode: string;
  mapId: string;
  modeId: string;
  playerCount: number;
  isPublic: boolean;
  status: 'lobby' | 'playing';
  updatedAt?: number;
}

/**
 * Global STUN + TURN servers (UDP + TCP over port 80 & 443) so WebRTC DataChannels
 * can punch through strict symmetric NATs, school networks, and corporate firewalls.
 */
const GLOBAL_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * Public TLS WebSocket MQTT 3.1.1 Relay Brokers (port 443 / 8084 / 8884).
 * Provides 100% firewall-proof global room synchronization with zero single-host bottleneck.
 */
const GLOBAL_WSS_RELAY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeMqttRemainingLength(len: number): number[] {
  const bytes: number[] = [];
  let x = len;
  do {
    let encodedByte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) {
      encodedByte |= 128;
    }
    bytes.push(encodedByte);
  } while (x > 0);
  return bytes;
}

function buildMqttConnectPacket(clientId: string): ArrayBuffer {
  const idBytes = textEncoder.encode(clientId);
  // Variable header: "MQTT" (0x00, 0x04, 'M','Q','T','T'), level 4 (3.1.1), flags 0x02 (Clean Session), keepalive 30s
  const varHeader = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x1e];
  const payload = [
    (idBytes.length >> 8) & 0xff,
    idBytes.length & 0xff,
    ...Array.from(idBytes),
  ];
  const remLen = varHeader.length + payload.length;
  return new Uint8Array([
    0x10,
    ...encodeMqttRemainingLength(remLen),
    ...varHeader,
    ...payload,
  ]).buffer as ArrayBuffer;
}

function buildMqttSubscribePacket(topic: string, packetId: number): ArrayBuffer {
  const topicBytes = textEncoder.encode(topic);
  const varHeader = [(packetId >> 8) & 0xff, packetId & 0xff];
  const payload = [
    (topicBytes.length >> 8) & 0xff,
    topicBytes.length & 0xff,
    ...Array.from(topicBytes),
    0x00, // QoS 0
  ];
  const remLen = varHeader.length + payload.length;
  return new Uint8Array([
    0x82,
    ...encodeMqttRemainingLength(remLen),
    ...varHeader,
    ...payload,
  ]).buffer as ArrayBuffer;
}

function buildMqttPublishPacket(topic: string, jsonPayload: string): ArrayBuffer {
  const topicBytes = textEncoder.encode(topic);
  const msgBytes = textEncoder.encode(jsonPayload);
  const remLen = 2 + topicBytes.length + msgBytes.length;
  const remBytes = encodeMqttRemainingLength(remLen);
  const out = new Uint8Array(1 + remBytes.length + remLen);
  let offset = 0;
  out[offset++] = 0x30; // PUBLISH QoS 0
  for (let i = 0; i < remBytes.length; i++) {
    out[offset++] = remBytes[i];
  }
  out[offset++] = (topicBytes.length >> 8) & 0xff;
  out[offset++] = topicBytes.length & 0xff;
  out.set(topicBytes, offset);
  offset += topicBytes.length;
  out.set(msgBytes, offset);
  return out.buffer as ArrayBuffer;
}

class LocalMultiplayerManager {
  private ws: WebSocket | null = null;
  private wsAttempts = 0;

  // Global WSS Cloud Relay (MQTT over TLS WebSocket)
  private relayWs: WebSocket | null = null;
  private relayConnected = false;
  private relayBrokerIndex = 0;
  private relaySubscribedRoom: string | null = null;
  private relayPingInterval: number | null = null;
  private relayReconnectTimeout: number | null = null;
  private mqttRxBuffer: Uint8Array = new Uint8Array(0);
  private packetCounter = 1;

  // Direct WebRTC PeerJS Mesh
  private peer: Peer | null = null;
  private myPeerId = '';
  private connections: Map<string, DataConnection> = new Map();
  private pendingDialPeers: Set<string> = new Set();
  private peerToPlayerId: Map<string, string> = new Map();
  private lastSeenMap: Map<string, number> = new Map();
  private processedMsgIds: Set<string> = new Set();
  private processedMsgQueue: string[] = [];

  private broadcastChannel: BroadcastChannel | null = null;
  private tickInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private lastIdleBroadcastAt = 0;
  private lastRoomDirectoryAnnounceAt = 0;

  private latestLocalPosition: [number, number, number] = [2.1, 0.15, 32.5];
  private latestLocalVelocity: [number, number, number] = [0, 0, 0];
  private latestLocalRotation: [number, number] = [0, Math.PI];

  private discoveredRooms: Map<string, ActiveRoomSummary> = new Map();
  public activeRooms: ActiveRoomSummary[] = [];
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    const state = useGameStore.getState();
    const initialRoom = state.roomCode || 'WORLD';
    state.setRoomCode(initialRoom);

    this.setupBroadcastChannel();
    this.connectGlobalWssRelay();
    this.initPermanentWebRtcMesh();
    this.fetchLanInfo();
    this.connectWebSocket();
    this.startTickLoop();
    this.startPeerCleanupLoop();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.broadcastLeavePacket();
      });
    }
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private nextMsgId(): string {
    const s = useGameStore.getState();
    this.packetCounter = (this.packetCounter + 1) % 1000000;
    return `${s.playerId}_${Date.now().toString(36)}_${this.packetCounter.toString(36)}`;
  }

  private isDuplicateMsgId(msgId?: string): boolean {
    if (!msgId) return false;
    if (this.processedMsgIds.has(msgId)) return true;
    this.processedMsgIds.add(msgId);
    this.processedMsgQueue.push(msgId);
    if (this.processedMsgQueue.length > 600) {
      const oldest = this.processedMsgQueue.shift();
      if (oldest) this.processedMsgIds.delete(oldest);
    }
    return false;
  }

  /**
   * Connects to a global TLS WebSocket MQTT 3.1.1 broker so players in the same roomCode
   * ("WORLD" or custom 5-char code) are always connected even behind strict NATs/Firewalls.
   */
  private connectGlobalWssRelay() {
    if (this.relayReconnectTimeout) {
      window.clearTimeout(this.relayReconnectTimeout);
      this.relayReconnectTimeout = null;
    }
    if (this.relayPingInterval) {
      window.clearInterval(this.relayPingInterval);
      this.relayPingInterval = null;
    }
    if (this.relayWs) {
      try {
        this.relayWs.onclose = null;
        this.relayWs.onerror = null;
        this.relayWs.onmessage = null;
        this.relayWs.close();
      } catch {
        // Ignore
      }
      this.relayWs = null;
    }
    this.relayConnected = false;
    this.relaySubscribedRoom = null;
    this.mqttRxBuffer = new Uint8Array(0);

    const brokerUrl =
      GLOBAL_WSS_RELAY_BROKERS[this.relayBrokerIndex % GLOBAL_WSS_RELAY_BROKERS.length];

    try {
      const ws = new WebSocket(brokerUrl, 'mqtt');
      ws.binaryType = 'arraybuffer';
      this.relayWs = ws;

      const connectTimer = window.setTimeout(() => {
        if (!this.relayConnected && this.relayWs === ws) {
          this.relayBrokerIndex++;
          this.connectGlobalWssRelay();
        }
      }, 4500);

      ws.onopen = () => {
        const s = useGameStore.getState();
        const clientId = `ds_${s.playerId.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        ws.send(buildMqttConnectPacket(clientId));
      };

      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return;
        const incoming = new Uint8Array(ev.data);
        const merged = new Uint8Array(this.mqttRxBuffer.length + incoming.length);
        merged.set(this.mqttRxBuffer, 0);
        merged.set(incoming, this.mqttRxBuffer.length);
        this.mqttRxBuffer = merged;

        this.processMqttBuffer(ws, connectTimer);
      };

      ws.onclose = () => {
        window.clearTimeout(connectTimer);
        if (this.relayWs === ws) {
          this.relayConnected = false;
          this.relaySubscribedRoom = null;
          this.relayReconnectTimeout = window.setTimeout(() => {
            this.relayBrokerIndex++;
            this.connectGlobalWssRelay();
          }, 2000);
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose failover
      };
    } catch {
      this.relayReconnectTimeout = window.setTimeout(() => {
        this.relayBrokerIndex++;
        this.connectGlobalWssRelay();
      }, 3000);
    }
  }

  private processMqttBuffer(ws: WebSocket, connectTimer: number) {
    while (this.mqttRxBuffer.length >= 2) {
      const byte0 = this.mqttRxBuffer[0];
      let multiplier = 1;
      let remLen = 0;
      let lenBytes = 0;
      let pos = 1;
      let completeLength = false;

      while (pos < this.mqttRxBuffer.length && lenBytes < 4) {
        const encodedByte = this.mqttRxBuffer[pos++];
        remLen += (encodedByte & 127) * multiplier;
        multiplier *= 128;
        lenBytes++;
        if ((encodedByte & 128) === 0) {
          completeLength = true;
          break;
        }
      }

      if (!completeLength) return; // Wait for more bytes
      const totalPacketLength = 1 + lenBytes + remLen;
      if (this.mqttRxBuffer.length < totalPacketLength) return;

      const packet = this.mqttRxBuffer.slice(0, totalPacketLength);
      this.mqttRxBuffer = this.mqttRxBuffer.slice(totalPacketLength);

      const packetType = byte0 & 0xf0;
      if (packetType === 0x20) {
        // CONNACK
        window.clearTimeout(connectTimer);
        this.relayConnected = true;
        const s = useGameStore.getState();
        s.setLanInfo(s.lanIp || window.location.hostname, 'webrtc-p2p');

        // Subscribe to global room directory and active room
        const currentRoom = s.roomCode || 'WORLD';
        this.subscribeRelayToRoom(currentRoom);
        try {
          ws.send(buildMqttSubscribePacket('deadschool/v3/lobby/rooms', 2));
        } catch {
          // Ignore
        }

        // Send immediate presence & request sync from peers in the room
        this.sendImmediatePresencePacket();
        this.sendLobbySync();

        if (this.relayPingInterval) window.clearInterval(this.relayPingInterval);
        this.relayPingInterval = window.setInterval(() => {
          if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN && this.relayConnected) {
            try {
              this.relayWs.send(new Uint8Array([0xc0, 0x00]).buffer as ArrayBuffer); // PINGREQ
            } catch {
              // Ignore
            }
          }
        }, 20000);
      } else if (packetType === 0x30) {
        // PUBLISH
        let pOffset = 1 + lenBytes;
        if (pOffset + 2 > packet.length) continue;
        const topicLen = (packet[pOffset] << 8) | packet[pOffset + 1];
        pOffset += 2;
        if (pOffset + topicLen > packet.length) continue;
        const topic = textDecoder.decode(packet.subarray(pOffset, pOffset + topicLen));
        pOffset += topicLen;

        const qos = (byte0 >> 1) & 0x03;
        if (qos > 0) {
          pOffset += 2; // Skip Packet Identifier
        }
        if (pOffset >= packet.length) continue;

        const jsonStr = textDecoder.decode(packet.subarray(pOffset));
        try {
          const parsed = JSON.parse(jsonStr);
          if (topic === 'deadschool/v3/lobby/rooms') {
            this.handleRoomDirectoryAnnouncement(parsed);
          } else {
            this.handleIncomingPacket(parsed);
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  }

  private subscribeRelayToRoom(roomCode: string) {
    if (
      !this.relayWs ||
      this.relayWs.readyState !== WebSocket.OPEN ||
      !this.relayConnected
    ) {
      return;
    }
    const clean =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    if (this.relaySubscribedRoom === clean) return;
    this.relaySubscribedRoom = clean;
    try {
      this.relayWs.send(
        buildMqttSubscribePacket(`deadschool/v3/room/${clean}`, 10 + (this.packetCounter % 5000))
      );
    } catch {
      // Ignore
    }
  }

  private publishToRelayRoom(payload: Record<string, any>) {
    if (
      !this.relayWs ||
      this.relayWs.readyState !== WebSocket.OPEN ||
      !this.relayConnected
    ) {
      return;
    }
    const roomCode = (payload.roomCode || useGameStore.getState().roomCode || 'WORLD')
      .replace(/[^A-Z0-9_-]/gi, '')
      .toUpperCase()
      .slice(0, 10);
    this.subscribeRelayToRoom(roomCode);
    try {
      const pkt = buildMqttPublishPacket(
        `deadschool/v3/room/${roomCode}`,
        JSON.stringify(payload)
      );
      this.relayWs.send(pkt);
    } catch {
      // Ignore send error
    }
  }

  private handleRoomDirectoryAnnouncement(data: Record<string, any>) {
    if (!data || typeof data.roomCode !== 'string') return;
    const summary: ActiveRoomSummary = {
      roomCode: data.roomCode,
      mapId: data.mapId || 'timber_campus',
      modeId: data.modeId || 'TDM',
      playerCount: Math.max(1, Number(data.playerCount) || 1),
      isPublic: data.isPublic !== false,
      status: data.status === 'playing' ? 'playing' : 'lobby',
      updatedAt: Date.now(),
    };
    this.discoveredRooms.set(summary.roomCode, summary);
    this.refreshActiveRoomsList();
  }

  private refreshActiveRoomsList() {
    const now = Date.now();
    const list: ActiveRoomSummary[] = [];
    this.discoveredRooms.forEach((room, code) => {
      if (now - (room.updatedAt || 0) < 25000) {
        list.push(room);
      } else {
        this.discoveredRooms.delete(code);
      }
    });

    const store = useGameStore.getState();
    const humanRemoteCount = Object.values(store.remotePlayers).filter((p) => !p.isBot).length;
    const currentCode = store.roomCode || 'WORLD';
    if (!list.some((r) => r.roomCode === currentCode)) {
      list.unshift({
        roomCode: currentCode,
        mapId: store.selectedMapId,
        modeId: store.selectedModeId === 'BOTS' ? 'TDM' : store.selectedModeId,
        playerCount: humanRemoteCount + 1,
        isPublic: store.isPublicRoom,
        status: store.screen === 'playing' ? 'playing' : 'lobby',
        updatedAt: now,
      });
    }
    this.activeRooms = list;
  }

  public async fetchLanInfo(): Promise<ActiveRoomSummary[]> {
    this.refreshActiveRoomsList();
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
          data.activeRooms.forEach((r: ActiveRoomSummary) => {
            this.discoveredRooms.set(r.roomCode, { ...r, updatedAt: Date.now() });
          });
          this.refreshActiveRoomsList();
        }
      }
    } catch {
      useGameStore
        .getState()
        .setLanInfo(window.location.hostname || '192.168.1.100', 'webrtc-p2p');
    }
    return this.activeRooms;
  }

  /**
   * Optional local/LAN WebSocket support when running local dev server.
   * Skipped cleanly on GitHub Pages without console error spam.
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
   * Initializes a permanent, stable PeerJS node for this player with STUN + TURN servers.
   * Never destroys the peer when changing rooms so connections never drop!
   */
  private initPermanentWebRtcMesh() {
    if (this.peer && !this.peer.destroyed) return;

    const state = useGameStore.getState();
    const cleanPlayerId = state.playerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const peerId = `deadschool-mesh-${cleanPlayerId}-${Math.random().toString(36).slice(2, 5)}`;

    try {
      const peer = new Peer(peerId, {
        config: {
          iceServers: GLOBAL_ICE_SERVERS,
        },
      });
      this.peer = peer;

      peer.on('open', (id) => {
        this.myPeerId = id;
        this.updateConnectedPeerCount();
        this.sendImmediatePresencePacket();
      });

      peer.on('connection', (conn) => {
        this.registerDataConnection(conn);
      });

      peer.on('disconnected', () => {
        try {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        } catch {
          // Ignore
        }
      });

      peer.on('error', () => {
        // Individual connection errors are handled gracefully; WSS Relay keeps game synced
      });
    } catch {
      // Ignore in restricted sandboxes
    }
  }

  /**
   * Switches or joins a room ("WORLD" or a 5-character room code) without tearing down
   * the underlying WebRTC Peer or WebSocket transport.
   */
  public initWebRtcPeer(roomCode: string, asHost?: boolean) {
    const cleanCode =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    const state = useGameStore.getState();
    const prevRoom = state.roomCode;

    if (prevRoom && prevRoom !== cleanCode) {
      // Notify previous room that we left and clear stale human remote players from previous room
      this.broadcastLeavePacket(prevRoom);
      Object.values(state.remotePlayers).forEach((actor) => {
        if (!actor.isBot) {
          state.removeRemotePlayer(actor.id);
        }
      });
      this.lastSeenMap.clear();
    }

    state.setRoomCode(cleanCode);
    if (typeof asHost === 'boolean') {
      state.setIsHost(asHost);
    }

    this.initPermanentWebRtcMesh();
    this.subscribeRelayToRoom(cleanCode);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRoomJoinOverWs(asHost ?? state.isHost);
    }

    // Broadcast immediate presence + sync request to all peers in the target room
    this.sendImmediatePresencePacket();
    this.sendLobbySync();
    this.broadcastSyncRequest(cleanCode);
  }

  private dialRemotePeerIfNeeded(remotePeerId?: string, remotePlayerId?: string) {
    if (!remotePeerId || !this.peer || this.peer.destroyed || !this.myPeerId) return;
    if (remotePeerId === this.myPeerId) return;
    if (this.connections.has(remotePeerId) || this.pendingDialPeers.has(remotePeerId)) return;

    const myId = useGameStore.getState().playerId;
    // Deterministic dialer election (or dial if we haven't connected after seeing them)
    if (remotePlayerId && myId > remotePlayerId) {
      return;
    }

    try {
      this.pendingDialPeers.add(remotePeerId);
      const conn = this.peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'json',
      });
      this.registerDataConnection(conn);
      window.setTimeout(() => {
        this.pendingDialPeers.delete(remotePeerId);
      }, 6000);
    } catch {
      this.pendingDialPeers.delete(remotePeerId);
    }
  }

  private registerDataConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.pendingDialPeers.delete(conn.peer);
      this.connections.set(conn.peer, conn);
      this.updateConnectedPeerCount();
      this.sendImmediatePresencePacket();
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        const msg = data as Record<string, any>;
        if (msg.playerId) {
          this.peerToPlayerId.set(conn.peer, msg.playerId);
        }
        this.handleIncomingPacket(msg);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.pendingDialPeers.delete(conn.peer);
      this.peerToPlayerId.delete(conn.peer);
      this.updateConnectedPeerCount();
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.pendingDialPeers.delete(conn.peer);
    });
  }

  private updateConnectedPeerCount() {
    const store = useGameStore.getState();
    const humanRemoteCount = Object.values(store.remotePlayers).filter((p) => !p.isBot).length;
    const total = Math.max(this.connections.size + 1, humanRemoteCount + 1);
    store.setPeerInfo(this.myPeerId || 'wss-relay', total);
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
          this.handleIncomingPacket(ev.data);
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }

  private sendPacketOverAllTransports(payload: Record<string, any>) {
    const packetWithId = {
      ...payload,
      msgId: payload.msgId || this.nextMsgId(),
      peerId: this.myPeerId || undefined,
    };
    this.isDuplicateMsgId(packetWithId.msgId);

    // 1. Global WSS Cloud Relay (works across all networks & firewalls)
    this.publishToRelayRoom(packetWithId);

    // 2. Direct WebRTC P2P Mesh DataChannels
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packetWithId);
        } catch {
          // Ignore
        }
      }
    });

    // 3. Same-PC BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packetWithId);
      } catch {
        // Ignore
      }
    }

    // 4. Optional Local LAN WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(packetWithId));
      } catch {
        // Ignore
      }
    }
  }

  private broadcastSyncRequest(roomCode: string) {
    const s = useGameStore.getState();
    this.sendPacketOverAllTransports({
      type: 'room:sync_request',
      roomCode,
      playerId: s.playerId,
      peerId: this.myPeerId,
    });
  }

  private broadcastLeavePacket(roomOverride?: string) {
    const s = useGameStore.getState();
    this.sendPacketOverAllTransports({
      type: 'player:leave',
      roomCode: roomOverride || s.roomCode || 'WORLD',
      playerId: s.playerId,
    });
  }

  private sendImmediatePresencePacket() {
    const store = useGameStore.getState();
    const packet: NetworkTransformPacket & { roomCode: string } = {
      type: 'player:moved',
      msgId: this.nextMsgId(),
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      peerId: this.myPeerId || undefined,
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
      hp: store.hp,
      maxHp: store.maxHp,
      kills: store.localKills,
      deaths: store.localDeaths,
      score: store.localScore,
      ready: store.isReady,
      modeId: store.selectedModeId,
      mapId: store.selectedMapId,
    };
    this.sendPacketOverAllTransports(packet);
  }

  private handleIncomingPacket(msg: Record<string, any>) {
    if (!msg || typeof msg !== 'object') return;
    const store = useGameStore.getState();

    // Ignore our own echoed packets
    if (msg.playerId && msg.playerId === store.playerId) return;
    if (msg.attackerId && msg.attackerId === store.playerId && msg.type === 'combat:hit') {
      return;
    }

    // Deduplicate packets arriving simultaneously over WebRTC + WSS Relay + BroadcastChannel
    if (msg.msgId && this.isDuplicateMsgId(msg.msgId)) {
      return;
    }

    // Filter packets by roomCode if specified
    if (msg.roomCode && msg.roomCode !== store.roomCode) {
      return;
    }

    if (msg.playerId) {
      this.lastSeenMap.set(msg.playerId, Date.now());
    }

    // Establish direct P2P WebRTC connection if peerId is advertised
    if (msg.peerId && msg.playerId) {
      this.dialRemotePeerIfNeeded(msg.peerId, msg.playerId);
    }

    if (msg.type === 'room:sync_request') {
      // Another player just joined the room — immediately reply with our transform & lobby state!
      this.sendImmediatePresencePacket();
      return;
    }

    if (msg.type === 'player:leave' && msg.playerId) {
      store.removeRemotePlayer(msg.playerId);
      this.lastSeenMap.delete(msg.playerId);
      this.updateConnectedPeerCount();
      return;
    }

    if (msg.type === 'room:state' && msg.room) {
      if (msg.lanIp) {
        store.setLanInfo(msg.lanIp);
      }
      const playersMap: Record<string, RemoteActor> = {};
      Object.values(msg.room.players || {}).forEach((p: any, idx: number) => {
        if (p.id !== store.playerId) {
          this.lastSeenMap.set(p.id, Date.now());
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
      this.updateConnectedPeerCount();
    } else if (msg.type === 'player:moved' || msg.type === 'player:transform') {
      if (msg.playerId && msg.playerId !== store.playerId) {
        const isFirstSeen = !store.remotePlayers[msg.playerId];

        // Auto-balance team in TDM if two players both defaulted to the same team
        let incomingTeam: 'alpha' | 'bravo' =
          store.selectedModeId === 'FFA' ? 'bravo' : msg.team || 'bravo';

        if (store.selectedModeId !== 'FFA') {
          const humanPeers = Object.values(store.remotePlayers).filter((p) => !p.isBot);
          const hasOpposingTeamPlayer = humanPeers.some(
            (p) => p.id !== msg.playerId && p.team !== store.playerTeam
          );
          if (!hasOpposingTeamPlayer && incomingTeam === store.playerTeam) {
            if (store.playerId > msg.playerId) {
              store.switchTeam();
            } else {
              incomingTeam = store.playerTeam === 'alpha' ? 'bravo' : 'alpha';
            }
          }
        }

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
          incomingTeam,
          Boolean(msg.sliding),
          {
            hp: typeof msg.hp === 'number' ? msg.hp : undefined,
            maxHp: typeof msg.maxHp === 'number' ? msg.maxHp : undefined,
            kills: typeof msg.kills === 'number' ? msg.kills : undefined,
            deaths: typeof msg.deaths === 'number' ? msg.deaths : undefined,
            score: typeof msg.score === 'number' ? msg.score : undefined,
            ready: typeof msg.ready === 'boolean' ? msg.ready : undefined,
          }
        );

        if (isFirstSeen) {
          this.updateConnectedPeerCount();
          // Reply immediately so the new peer also sees us right away
          this.sendImmediatePresencePacket();
        }
      }
    } else if (msg.type === 'lobby:update') {
      if (msg.mapId && msg.mapId !== store.selectedMapId) {
        store.setMapId(msg.mapId);
      }
      if (
        msg.modeId &&
        msg.modeId !== 'BOTS' &&
        store.selectedModeId !== 'BOTS' &&
        msg.modeId !== store.selectedModeId
      ) {
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
            team: msg.attackerTeam || (store.playerTeam === 'alpha' ? 'bravo' : 'alpha'),
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
      if (msg.playerId !== store.playerId) {
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
   * Periodically cleans up disconnected peers after 12 seconds of silence
   * (tolerant of background tab throttling and class-selection screens).
   */
  private startPeerCleanupLoop() {
    if (this.cleanupInterval) window.clearInterval(this.cleanupInterval);
    this.cleanupInterval = window.setInterval(() => {
      const store = useGameStore.getState();
      const now = Date.now();
      let removedAny = false;
      Object.values(store.remotePlayers).forEach((actor) => {
        if (!actor.isBot) {
          const lastSeen = this.lastSeenMap.get(actor.id) || 0;
          if (lastSeen > 0 && now - lastSeen > 12000) {
            store.removeRemotePlayer(actor.id);
            this.lastSeenMap.delete(actor.id);
            removedAny = true;
          }
        }
      });
      if (removedAny) {
        this.updateConnectedPeerCount();
      }
    }, 2000);
  }

  /**
   * Network tick loop:
   * - Sends transform updates at 25Hz (40ms) during active gameplay.
   * - Sends presence heartbeats every 400ms across ALL other screens (select_class,
   *   match_lobby, paused, gameover, main_menu) so players NEVER falsely disconnect!
   */
  private startTickLoop() {
    if (this.tickInterval) window.clearInterval(this.tickInterval);
    this.tickInterval = window.setInterval(() => {
      const store = useGameStore.getState();
      const now = Date.now();

      if (store.screen !== 'playing') {
        if (now - this.lastIdleBroadcastAt < 400) return;
        this.lastIdleBroadcastAt = now;
      }

      const packet: NetworkTransformPacket & { roomCode: string } = {
        type: 'player:moved',
        msgId: this.nextMsgId(),
        roomCode: store.roomCode || 'WORLD',
        playerId: store.playerId,
        peerId: this.myPeerId || undefined,
        playerName: store.playerName,
        team: store.playerTeam,
        position: this.latestLocalPosition,
        velocity: store.screen === 'playing' ? this.latestLocalVelocity : [0, 0, 0],
        rotation: this.latestLocalRotation,
        crouching: store.isCrouching,
        sliding: store.isSliding,
        ads: store.isAds,
        ridingScooter: Boolean(store.ridingScooterId),
        weaponClass: store.selectedClass,
        hp: store.hp,
        maxHp: store.maxHp,
        kills: store.localKills,
        deaths: store.localDeaths,
        score: store.localScore,
        ready: store.isReady,
        modeId: store.selectedModeId,
        mapId: store.selectedMapId,
      };

      this.sendPacketOverAllTransports(packet);

      // Periodically announce active room in the global server browser directory
      if (
        this.relayConnected &&
        this.relayWs &&
        this.relayWs.readyState === WebSocket.OPEN &&
        store.isPublicRoom &&
        now - this.lastRoomDirectoryAnnounceAt > 4000
      ) {
        this.lastRoomDirectoryAnnounceAt = now;
        const humanPeers = Object.values(store.remotePlayers).filter((p) => !p.isBot).length;
        const roomAnnouncement: ActiveRoomSummary = {
          roomCode: store.roomCode || 'WORLD',
          mapId: store.selectedMapId,
          modeId: store.selectedModeId === 'BOTS' ? 'TDM' : store.selectedModeId,
          playerCount: humanPeers + 1,
          isPublic: store.isPublicRoom,
          status: store.screen === 'playing' ? 'playing' : 'lobby',
          updatedAt: now,
        };
        this.discoveredRooms.set(roomAnnouncement.roomCode, roomAnnouncement);
        this.refreshActiveRoomsList();
        try {
          this.relayWs.send(
            buildMqttPublishPacket(
              'deadschool/v3/lobby/rooms',
              JSON.stringify(roomAnnouncement)
            )
          );
        } catch {
          // Ignore
        }
      }
    }, 40);
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
      type: 'combat:event',
      msgId: this.nextMsgId(),
      roomCode: store.roomCode || 'WORLD',
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

    this.sendPacketOverAllTransports(payload);
  }

  public sendLobbySync() {
    const store = useGameStore.getState();
    const payload = {
      type: 'lobby:update',
      msgId: this.nextMsgId(),
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      playerName: store.playerName,
      mapId: store.selectedMapId,
      modeId: store.selectedModeId,
      isPublic: store.isPublicRoom,
      team: store.playerTeam,
      ready: store.isReady,
      weaponClass: store.selectedClass,
    };
    this.sendPacketOverAllTransports(payload);
  }

  public sendChatMessage(text: string) {
    const store = useGameStore.getState();
    const trimmed = text.trim();
    if (!trimmed) return;
    store.addChatMessage(store.playerName, store.playerTeam, trimmed);

    const payload = {
      type: 'chat:message',
      msgId: this.nextMsgId(),
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      senderName: store.playerName,
      team: store.playerTeam,
      text: trimmed,
    };
    this.sendPacketOverAllTransports(payload);
  }
}

export const multiplayerManager = new LocalMultiplayerManager();
