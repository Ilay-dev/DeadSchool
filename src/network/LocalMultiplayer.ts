import Peer, { DataConnection } from 'peerjs';
import { useGameStore, type RemoteActor } from '../store/useGameStore';
import type { GameModeId, WeaponId } from '../game/rules';

export interface NetworkTransformPacket {
  type: 'player:transform' | 'player:moved';
  msgId?: string;
  seq?: number;
  playerId: string;
  peerId?: string;
  playerName: string;
  team: 'alpha' | 'bravo';
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number];
  crouching: boolean;
  sliding?: boolean;
  isDowned?: boolean;
  downedHp?: number;
  ads: boolean;
  ridingScooter: boolean;
  weaponClass: WeaponId;
  soldierSkin?: string;
  weaponSkin?: string;
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

export interface RemoteShotEvent {
  playerId: string;
  weaponClass: WeaponId;
  muzzlePos: [number, number, number];
  endPoint: [number, number, number];
  hitPlayerId?: string | null;
  ads?: boolean;
}

/**
 * Global STUN + TURN servers (UDP + TCP over port 80 & 443) for Native RTCPeerConnection
 * and PeerJS DataChannels. Works across strict NATs and firewalls.
 */
const GLOBAL_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
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
 * Lightweight WebRTC Signaling Brokers (used ONLY for SDP Offer/Answer, ICE candidates,
 * and 0.4Hz room discovery beacons — NEVER for 60 FPS transform traffic!).
 */
const SIGNALING_BROKERS = [
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
    if (x > 0) encodedByte |= 128;
    bytes.push(encodedByte);
  } while (x > 0);
  return bytes;
}

function buildMqttConnectPacket(clientId: string): ArrayBuffer {
  const idBytes = textEncoder.encode(clientId);
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
    0x00,
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
  out[offset++] = 0x30;
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

interface NativeWebRtcSession {
  remotePlayerId: string;
  pc: RTCPeerConnection;
  fastDc: RTCDataChannel | null;
  reliableDc: RTCDataChannel | null;
  iceQueue: RTCIceCandidateInit[];
  remoteDescSet: boolean;
  outgoingIceBatch: RTCIceCandidateInit[];
  outgoingIceTimer: number | null;
  createdAt: number;
}

class LocalMultiplayerManager {
  // Native RTCPeerConnection + RTCDataChannel Mesh (Primary 60+ FPS Transport)
  private rtcSessions: Map<string, NativeWebRtcSession> = new Map();

  // Secondary PeerJS WebRTC DataChannel Mesh
  private peer: Peer | null = null;
  private myPeerId = '';
  private peerConnections: Map<string, DataConnection> = new Map();
  private pendingPeerDials: Map<string, number> = new Map();

  // Same-PC zero-latency BroadcastChannel
  private broadcastChannel: BroadcastChannel | null = null;

  // Optional local dev server WebSocket
  private ws: WebSocket | null = null;
  private wsAttempts = 0;
  private reconnectTimeout: number | null = null;

  // Lightweight Signaling WebSocket (SDP Offer/Answer + ICE + 0.4Hz Beacon ONLY)
  private sigWs: WebSocket | null = null;
  private sigConnected = false;
  private sigBrokerIndex = 0;
  private sigSubscribedRoom: string | null = null;
  private sigPingInterval: number | null = null;
  private sigReconnectTimeout: number | null = null;
  private mqttRxBuffer: Uint8Array = new Uint8Array(0);

  // Unthrottled 60 FPS Worker / Loop State
  private tickWorker: Worker | null = null;
  private tickInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private beaconInterval: number | null = null;

  private packetCounter = 1;
  private localSeq = 1;
  private lastSeenMap: Map<string, number> = new Map();
  private lastSeqMap: Map<string, number> = new Map();
  private processedMsgIds: Set<string> = new Set();
  private processedMsgQueue: string[] = [];

  private lastTransformSentPerf = 0;
  private lastHandshakeFallbackSentPerf = 0;
  private latestLocalPosition: [number, number, number] = [2.1, 0.15, 32.5];
  private latestLocalVelocity: [number, number, number] = [0, 0, 0];
  private latestLocalRotation: [number, number] = [0, Math.PI];

  private shotListeners: Set<(ev: RemoteShotEvent) => void> = new Set();

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
    this.connectSignalingBroker();
    this.initPeerJsMesh();
    this.fetchLanInfo();
    this.connectWebSocket();
    this.start60FpsStreamingLoop();
    this.startDiscoveryBeaconLoop();
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
    if (this.processedMsgQueue.length > 500) {
      const oldest = this.processedMsgQueue.shift();
      if (oldest) this.processedMsgIds.delete(oldest);
    }
    return false;
  }

  // ============================================================================
  // 1. NATIVE WEBRTC RTCPeerConnection + RTCDataChannel ENGINE (60+ FPS UDP)
  // ============================================================================

  private ensureNativeWebRtcSession(remotePlayerId: string) {
    const myId = useGameStore.getState().playerId;
    if (!remotePlayerId || remotePlayerId === myId) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    const existing = this.rtcSessions.get(remotePlayerId);
    if (existing) {
      const state = existing.pc.connectionState;
      if (state === 'connected' || state === 'connecting') {
        return;
      }
      if (state === 'new' && Date.now() - existing.createdAt < 7000) {
        return;
      }
      this.closeNativeWebRtcSession(remotePlayerId);
    }

    // Strict deterministic initiator election: prevents both peers from creating
    // competing offers at the same time (WebRTC Glare).
    const isInitiator = myId < remotePlayerId;
    if (!isInitiator) {
      // Responder waits for the initiator's 'webrtc:offer' packet (which arrives within ~100ms)
      return;
    }

    this.createNativePeerConnection(remotePlayerId, true);
  }

  private createNativePeerConnection(
    remotePlayerId: string,
    isInitiator: boolean
  ): NativeWebRtcSession {
    this.closeNativeWebRtcSession(remotePlayerId);

    const pc = new RTCPeerConnection({
      iceServers: GLOBAL_ICE_SERVERS,
    });

    const session: NativeWebRtcSession = {
      remotePlayerId,
      pc,
      fastDc: null,
      reliableDc: null,
      iceQueue: [],
      remoteDescSet: false,
      outgoingIceBatch: [],
      outgoingIceTimer: null,
      createdAt: Date.now(),
    };
    this.rtcSessions.set(remotePlayerId, session);

    // Batch outgoing ICE candidates over 80ms so signaling stays ultra-lightweight
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        session.outgoingIceBatch.push(ev.candidate.toJSON());
        if (!session.outgoingIceTimer) {
          session.outgoingIceTimer = window.setTimeout(() => {
            session.outgoingIceTimer = null;
            if (session.outgoingIceBatch.length > 0) {
              const candidates = session.outgoingIceBatch.splice(
                0,
                session.outgoingIceBatch.length
              );
              this.sendSignalingMessage({
                type: 'webrtc:ice-batch',
                targetPlayerId: remotePlayerId,
                candidates,
              });
            }
          }, 80);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateConnectedPeerCount();
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'closed'
      ) {
        if (this.rtcSessions.get(remotePlayerId) === session) {
          this.closeNativeWebRtcSession(remotePlayerId);
        }
      }
    };

    if (isInitiator) {
      // 1. Unordered, 0-retransmit UDP-like DataChannel for 60+ FPS position streaming
      const fastDc = pc.createDataChannel('deadschool_fast', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupDataChannelHandlers(session, fastDc, 'fast');

      // 2. Ordered, reliable DataChannel for combat hits, kills, stun, lobby, and chat
      const reliableDc = pc.createDataChannel('deadschool_reliable', {
        ordered: true,
      });
      this.setupDataChannelHandlers(session, reliableDc, 'reliable');

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            this.sendSignalingMessage({
              type: 'webrtc:offer',
              targetPlayerId: remotePlayerId,
              sdp: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            });
          }
        })
        .catch(() => {});
    } else {
      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        if (dc.label === 'deadschool_fast') {
          this.setupDataChannelHandlers(session, dc, 'fast');
        } else {
          this.setupDataChannelHandlers(session, dc, 'reliable');
        }
      };
    }

    return session;
  }

  private setupDataChannelHandlers(
    session: NativeWebRtcSession,
    dc: RTCDataChannel,
    kind: 'fast' | 'reliable'
  ) {
    if (kind === 'fast') {
      session.fastDc = dc;
    } else {
      session.reliableDc = dc;
    }

    dc.onopen = () => {
      this.updateConnectedPeerCount();
      // Immediately send our current transform over the newly opened WebRTC DataChannel!
      const pkt = this.buildCurrentTransformPacket();
      try {
        dc.send(JSON.stringify(pkt));
      } catch {
        // Ignore
      }
    };

    dc.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const parsed = JSON.parse(ev.data);
          this.handleIncomingPacket(parsed);
        } catch {
          // Ignore malformed packet
        }
      }
    };

    dc.onclose = () => {
      if (kind === 'fast' && session.fastDc === dc) {
        session.fastDc = null;
      } else if (kind === 'reliable' && session.reliableDc === dc) {
        session.reliableDc = null;
      }
      this.updateConnectedPeerCount();
    };
  }

  private closeNativeWebRtcSession(remotePlayerId: string) {
    const existing = this.rtcSessions.get(remotePlayerId);
    if (!existing) return;
    if (existing.outgoingIceTimer) {
      window.clearTimeout(existing.outgoingIceTimer);
    }
    try {
      existing.fastDc?.close();
    } catch {}
    try {
      existing.reliableDc?.close();
    } catch {}
    try {
      existing.pc.close();
    } catch {}
    this.rtcSessions.delete(remotePlayerId);
  }

  private async handleWebRtcSignaling(msg: Record<string, any>) {
    const myId = useGameStore.getState().playerId;
    if (msg.targetPlayerId !== myId || !msg.playerId) return;
    const remoteId = String(msg.playerId);

    try {
      if (msg.type === 'webrtc:offer' && msg.sdp) {
        const session = this.createNativePeerConnection(remoteId, false);
        await session.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        session.remoteDescSet = true;

        // Flush any queued ICE candidates that arrived before the Offer
        while (session.iceQueue.length > 0) {
          const cand = session.iceQueue.shift();
          if (cand) {
            await session.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }

        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        if (session.pc.localDescription) {
          this.sendSignalingMessage({
            type: 'webrtc:answer',
            targetPlayerId: remoteId,
            sdp: {
              type: session.pc.localDescription.type,
              sdp: session.pc.localDescription.sdp,
            },
          });
        }
      } else if (msg.type === 'webrtc:answer' && msg.sdp) {
        const session = this.rtcSessions.get(remoteId);
        if (session && session.pc.signalingState === 'have-local-offer') {
          await session.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          session.remoteDescSet = true;
          while (session.iceQueue.length > 0) {
            const cand = session.iceQueue.shift();
            if (cand) {
              await session.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }
        }
      } else if (msg.type === 'webrtc:ice-batch' && Array.isArray(msg.candidates)) {
        const session = this.rtcSessions.get(remoteId);
        if (session) {
          for (const cand of msg.candidates) {
            if (session.remoteDescSet) {
              await session.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            } else {
              session.iceQueue.push(cand);
            }
          }
        }
      }
    } catch {
      // Ignore transient WebRTC negotiation race
    }
  }

  // ============================================================================
  // 2. SECONDARY PEERJS WEBRTC DATACHANNEL MESH (WITH STRICT INITIATOR ELECTION)
  // ============================================================================

  private initPeerJsMesh() {
    if (this.peer && !this.peer.destroyed) return;

    const state = useGameStore.getState();
    const cleanPlayerId = state.playerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const peerId = `deadschool-v5-${cleanPlayerId}`;

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
        this.sendDiscoveryBeacon();
      });

      peer.on('connection', (conn) => {
        this.registerPeerJsConnection(conn);
      });

      peer.on('disconnected', () => {
        try {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        } catch {}
      });

      peer.on('error', () => {});
    } catch {}
  }

  private dialPeerJsIfNeeded(remotePeerId?: string, remotePlayerId?: string) {
    if (!remotePeerId || !this.peer || this.peer.destroyed || !this.myPeerId) return;
    if (remotePeerId === this.myPeerId) return;

    const existing = this.peerConnections.get(remotePeerId);
    if (existing && existing.open) return;

    const myId = useGameStore.getState().playerId;
    // Strict deterministic initiator election so PeerJS connections never collide!
    if (remotePlayerId && myId > remotePlayerId) {
      return;
    }

    const now = Date.now();
    const lastDial = this.pendingPeerDials.get(remotePeerId) || 0;
    if (now - lastDial < 3500) return;

    try {
      this.pendingPeerDials.set(remotePeerId, now);
      const conn = this.peer.connect(remotePeerId, {
        reliable: false,
      });
      this.registerPeerJsConnection(conn);
    } catch {
      this.pendingPeerDials.delete(remotePeerId);
    }
  }

  private registerPeerJsConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.pendingPeerDials.delete(conn.peer);
      this.peerConnections.set(conn.peer, conn);
      this.updateConnectedPeerCount();
      try {
        conn.send(this.buildCurrentTransformPacket());
      } catch {}
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        this.handleIncomingPacket(data as Record<string, any>);
      } else if (typeof data === 'string') {
        try {
          this.handleIncomingPacket(JSON.parse(data));
        } catch {}
      }
    });

    conn.on('close', () => {
      // ONLY delete if this exact connection instance is still the active one!
      if (this.peerConnections.get(conn.peer) === conn) {
        this.peerConnections.delete(conn.peer);
      }
      this.updateConnectedPeerCount();
    });

    conn.on('error', () => {
      if (this.peerConnections.get(conn.peer) === conn) {
        this.peerConnections.delete(conn.peer);
      }
    });
  }

  // ============================================================================
  // 3. LIGHTWEIGHT SIGNALING & ROOM DISCOVERY BUS (0.4Hz BEACONS ONLY)
  // ============================================================================

  private connectSignalingBroker() {
    if (this.sigReconnectTimeout) {
      window.clearTimeout(this.sigReconnectTimeout);
      this.sigReconnectTimeout = null;
    }
    if (this.sigPingInterval) {
      window.clearInterval(this.sigPingInterval);
      this.sigPingInterval = null;
    }
    if (this.sigWs) {
      try {
        this.sigWs.onclose = null;
        this.sigWs.onerror = null;
        this.sigWs.onmessage = null;
        this.sigWs.close();
      } catch {}
      this.sigWs = null;
    }
    this.sigConnected = false;
    this.sigSubscribedRoom = null;
    this.mqttRxBuffer = new Uint8Array(0);

    const brokerUrl =
      SIGNALING_BROKERS[this.sigBrokerIndex % SIGNALING_BROKERS.length];

    try {
      const ws = new WebSocket(brokerUrl, 'mqtt');
      ws.binaryType = 'arraybuffer';
      this.sigWs = ws;

      const connectTimer = window.setTimeout(() => {
        if (!this.sigConnected && this.sigWs === ws) {
          this.sigBrokerIndex++;
          this.connectSignalingBroker();
        }
      }, 4500);

      ws.onopen = () => {
        const s = useGameStore.getState();
        const clientId = `dssig_${s.playerId.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random()
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

        this.processSignalingMqttBuffer(ws, connectTimer);
      };

      ws.onclose = () => {
        window.clearTimeout(connectTimer);
        if (this.sigWs === ws) {
          this.sigConnected = false;
          this.sigSubscribedRoom = null;
          this.sigReconnectTimeout = window.setTimeout(() => {
            this.sigBrokerIndex++;
            this.connectSignalingBroker();
          }, 2000);
        }
      };

      ws.onerror = () => {};
    } catch {
      this.sigReconnectTimeout = window.setTimeout(() => {
        this.sigBrokerIndex++;
        this.connectSignalingBroker();
      }, 3000);
    }
  }

  private processSignalingMqttBuffer(ws: WebSocket, connectTimer: number) {
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

      if (!completeLength) return;
      const totalPacketLength = 1 + lenBytes + remLen;
      if (this.mqttRxBuffer.length < totalPacketLength) return;

      const packet = this.mqttRxBuffer.slice(0, totalPacketLength);
      this.mqttRxBuffer = this.mqttRxBuffer.slice(totalPacketLength);

      const packetType = byte0 & 0xf0;
      if (packetType === 0x20) {
        // CONNACK
        window.clearTimeout(connectTimer);
        this.sigConnected = true;
        const s = useGameStore.getState();
        s.setLanInfo(s.lanIp || window.location.hostname, 'webrtc-p2p');

        this.subscribeSignalingRoom(s.roomCode || 'WORLD');
        try {
          ws.send(buildMqttSubscribePacket('deadschool/v5/lobby/rooms', 2));
        } catch {}

        // Send initial discovery beacon so all peers open direct WebRTC DataChannels to us
        this.sendDiscoveryBeacon();

        if (this.sigPingInterval) window.clearInterval(this.sigPingInterval);
        this.sigPingInterval = window.setInterval(() => {
          if (this.sigWs && this.sigWs.readyState === WebSocket.OPEN && this.sigConnected) {
            try {
              this.sigWs.send(new Uint8Array([0xc0, 0x00]).buffer as ArrayBuffer);
            } catch {}
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
        if (qos > 0) pOffset += 2;
        if (pOffset >= packet.length) continue;

        const jsonStr = textDecoder.decode(packet.subarray(pOffset));
        try {
          const parsed = JSON.parse(jsonStr);
          if (topic === 'deadschool/v5/lobby/rooms') {
            this.handleRoomDirectoryAnnouncement(parsed);
          } else {
            this.handleIncomingPacket(parsed);
          }
        } catch {}
      }
    }
  }

  private subscribeSignalingRoom(roomCode: string) {
    if (!this.sigWs || this.sigWs.readyState !== WebSocket.OPEN || !this.sigConnected) {
      return;
    }
    const clean =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    if (this.sigSubscribedRoom === clean) return;
    this.sigSubscribedRoom = clean;
    try {
      this.sigWs.send(
        buildMqttSubscribePacket(`deadschool/v5/sig/${clean}`, 10 + (this.packetCounter % 5000))
      );
    } catch {}
  }

  private sendSignalingMessage(payload: Record<string, any>) {
    const store = useGameStore.getState();
    const roomCode = (payload.roomCode || store.roomCode || 'WORLD')
      .replace(/[^A-Z0-9_-]/gi, '')
      .toUpperCase()
      .slice(0, 10);
    const fullPayload = {
      ...payload,
      msgId: payload.msgId || this.nextMsgId(),
      roomCode,
      playerId: store.playerId,
      peerId: this.myPeerId || undefined,
    };
    this.isDuplicateMsgId(fullPayload.msgId);

    // 1. Local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullPayload);
      } catch {}
    }

    // 2. Direct server WebSocket relay (sub-millisecond LAN/central signaling!)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullPayload));
      } catch {}
    }

    // 3. Global WebRTC Signaling Topic (fallback when no central server)
    if (this.sigWs && this.sigWs.readyState === WebSocket.OPEN && this.sigConnected) {
      this.subscribeSignalingRoom(roomCode);
      try {
        this.sigWs.send(
          buildMqttPublishPacket(`deadschool/v5/sig/${roomCode}`, JSON.stringify(fullPayload))
        );
      } catch {}
    }
  }

  private sendDiscoveryBeacon() {
    const store = useGameStore.getState();
    this.sendSignalingMessage({
      type: 'presence:beacon',
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
      isDowned: store.isDowned,
      downedHp: store.downedHp,
      ads: store.isAds,
      ridingScooter: Boolean(store.ridingScooterId),
      weaponClass: store.selectedClass,
      soldierSkin: store.equippedSoldierSkin,
      weaponSkin: store.equippedWeaponSkin,
      hp: Math.round(store.hp),
      maxHp: store.maxHp,
      kills: store.localKills,
      deaths: store.localDeaths,
      score: store.localScore,
      ready: store.isReady,
      modeId: store.selectedModeId,
      mapId: store.selectedMapId,
    });
  }

  private startDiscoveryBeaconLoop() {
    if (this.beaconInterval) window.clearInterval(this.beaconInterval);
    // Low-frequency 0.4Hz (every 2500ms) discovery beacon for WebRTC peer discovery & room listing
    this.beaconInterval = window.setInterval(() => {
      this.sendDiscoveryBeacon();

      const store = useGameStore.getState();
      if (
        this.sigConnected &&
        this.sigWs &&
        this.sigWs.readyState === WebSocket.OPEN &&
        store.isPublicRoom
      ) {
        const humanPeers = Object.values(store.remotePlayers).filter((p) => !p.isBot).length;
        const roomAnnouncement: ActiveRoomSummary = {
          roomCode: store.roomCode || 'WORLD',
          mapId: store.selectedMapId,
          modeId: store.selectedModeId === 'BOTS' ? 'TDM' : store.selectedModeId,
          playerCount: humanPeers + 1,
          isPublic: store.isPublicRoom,
          status: store.screen === 'playing' ? 'playing' : 'lobby',
          updatedAt: Date.now(),
        };
        this.discoveredRooms.set(roomAnnouncement.roomCode, roomAnnouncement);
        this.refreshActiveRoomsList();
        try {
          this.sigWs.send(
            buildMqttPublishPacket(
              'deadschool/v5/lobby/rooms',
              JSON.stringify(roomAnnouncement)
            )
          );
        } catch {}
      }
    }, 2500);
  }

  // ============================================================================
  // 4. 60+ FPS WEBRTC DATACHANNEL STREAMING ENGINE
  // ============================================================================

  private hasOpenWebRtcChannelForAllPeers(): boolean {
    const store = useGameStore.getState();
    const humanIds = Object.values(store.remotePlayers)
      .filter((p) => !p.isBot)
      .map((p) => p.id);
    if (humanIds.length === 0) return false;

    for (const remoteId of humanIds) {
      const nativeSession = this.rtcSessions.get(remoteId);
      const nativeOpen =
        (nativeSession?.fastDc && nativeSession.fastDc.readyState === 'open') ||
        (nativeSession?.reliableDc && nativeSession.reliableDc.readyState === 'open');
      if (!nativeOpen && this.peerConnections.size === 0) {
        return false;
      }
    }
    return true;
  }

  private buildCurrentTransformPacket(): NetworkTransformPacket & { roomCode: string } {
    const store = useGameStore.getState();
    return {
      type: 'player:moved',
      msgId: this.nextMsgId(),
      seq: ++this.localSeq,
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
      isDowned: store.isDowned,
      downedHp: store.downedHp,
      ads: store.isAds,
      ridingScooter: Boolean(store.ridingScooterId),
      weaponClass: store.selectedClass,
      soldierSkin: store.equippedSoldierSkin,
      weaponSkin: store.equippedWeaponSkin,
      hp: Math.round(store.hp),
      maxHp: store.maxHp,
      kills: store.localKills,
      deaths: store.localDeaths,
      score: store.localScore,
      ready: store.isReady,
      modeId: store.selectedModeId,
      mapId: store.selectedMapId,
    };
  }

  private stream60FpsTransformOverDataChannels() {
    const packet = this.buildCurrentTransformPacket();
    this.isDuplicateMsgId(packet.msgId);
    const jsonStr = JSON.stringify(packet);

    let sentOverAnyDataChannel = false;

    // 1. Primary: Native WebRTC RTCDataChannel ('deadschool_fast', ordered: false, maxRetransmits: 0)
    this.rtcSessions.forEach((session) => {
      const dc =
        session.fastDc?.readyState === 'open'
          ? session.fastDc
          : session.reliableDc?.readyState === 'open'
            ? session.reliableDc
            : null;
      if (dc) {
        try {
          dc.send(jsonStr);
          sentOverAnyDataChannel = true;
        } catch {}
      }
    });

    // 2. Secondary: PeerJS WebRTC DataChannel
    this.peerConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
          sentOverAnyDataChannel = true;
        } catch {}
      }
    });

    // 3. Same-PC BroadcastChannel (0ms local multi-tab)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {}
    }

    // 4. Optional local dev server LAN WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(jsonStr);
        sentOverAnyDataChannel = true;
      } catch {}
    }

    // 5. Handshake bridge ONLY during the first ~300ms before WebRTC DataChannel opens
    if (!sentOverAnyDataChannel) {
      const nowPerf = performance.now();
      if (nowPerf - this.lastHandshakeFallbackSentPerf >= 90) {
        this.lastHandshakeFallbackSentPerf = nowPerf;
        this.sendSignalingMessage(packet);
      }
    }
  }

  private sendReliableEventPacket(payload: Record<string, any>) {
    const packetWithId = {
      ...payload,
      msgId: payload.msgId || this.nextMsgId(),
      peerId: this.myPeerId || undefined,
    };
    this.isDuplicateMsgId(packetWithId.msgId);
    const jsonStr = JSON.stringify(packetWithId);

    // 1. Native WebRTC Reliable RTCDataChannel
    this.rtcSessions.forEach((session) => {
      const dc =
        session.reliableDc?.readyState === 'open'
          ? session.reliableDc
          : session.fastDc?.readyState === 'open'
            ? session.fastDc
            : null;
      if (dc) {
        try {
          dc.send(jsonStr);
        } catch {}
      }
    });

    // 2. PeerJS DataChannel
    this.peerConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packetWithId);
        } catch {}
      }
    });

    // 3. Also send reliable events (combat, chat, leave, lobby) over signaling + BroadcastChannel
    this.sendSignalingMessage(packetWithId);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(jsonStr);
      } catch {}
    }
  }

  /**
   * Starts an unthrottled 60+ FPS (16ms) Web Worker clock so WebRTC DataChannels
   * stream continuously at 60 FPS even when testing across unfocused windows on the same PC!
   */
  private start60FpsStreamingLoop() {
    const onTick = () => {
      const nowPerf = performance.now();
      if (nowPerf - this.lastTransformSentPerf >= 15.5) {
        this.lastTransformSentPerf = nowPerf;
        this.stream60FpsTransformOverDataChannels();
      }
    };

    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        const workerCode = `
          let timer = setInterval(() => postMessage('tick'), 16);
          onmessage = (e) => {
            if (e.data === 'stop') clearInterval(timer);
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.tickWorker = new Worker(URL.createObjectURL(blob));
        this.tickWorker.onmessage = onTick;
        return;
      } catch {
        // Fallback to standard setInterval below
      }
    }

    if (this.tickInterval) window.clearInterval(this.tickInterval);
    this.tickInterval = window.setInterval(onTick, 16);
  }

  public updateLocalTransform(
    position: [number, number, number],
    rotation: [number, number],
    velocity: [number, number, number] = [0, 0, 0]
  ) {
    this.latestLocalPosition = [
      Math.round(position[0] * 1000) / 1000,
      Math.round(position[1] * 1000) / 1000,
      Math.round(position[2] * 1000) / 1000,
    ];
    this.latestLocalRotation = [
      Math.round(rotation[0] * 1000) / 1000,
      Math.round(rotation[1] * 1000) / 1000,
    ];
    this.latestLocalVelocity = [
      Math.round(velocity[0] * 100) / 100,
      Math.round(velocity[1] * 100) / 100,
      Math.round(velocity[2] * 100) / 100,
    ];

    // Stream directly from the 60+ FPS useFrame loop over WebRTC DataChannels!
    const nowPerf = performance.now();
    if (nowPerf - this.lastTransformSentPerf >= 15.5) {
      this.lastTransformSentPerf = nowPerf;
      this.stream60FpsTransformOverDataChannels();
    }
  }

  // ============================================================================
  // 5. INCOMING PACKET ROUTER & ROOM MANAGEMENT
  // ============================================================================

  public initWebRtcPeer(roomCode: string, asHost?: boolean) {
    const cleanCode =
      roomCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 10) || 'WORLD';
    const state = useGameStore.getState();
    const prevRoom = state.roomCode;

    if (prevRoom && prevRoom !== cleanCode) {
      this.broadcastLeavePacket(prevRoom);
      this.rtcSessions.forEach((_, remoteId) => {
        this.closeNativeWebRtcSession(remoteId);
      });
      Object.values(state.remotePlayers).forEach((actor) => {
        if (!actor.isBot) {
          state.removeRemotePlayer(actor.id);
        }
      });
      this.lastSeenMap.clear();
      this.lastSeqMap.clear();
    }

    state.setRoomCode(cleanCode);
    if (typeof asHost === 'boolean') {
      state.setIsHost(asHost);
    }

    this.initPeerJsMesh();
    this.subscribeSignalingRoom(cleanCode);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRoomJoinOverWs(asHost ?? state.isHost);
    }

    this.sendDiscoveryBeacon();
    this.sendLobbySync();
  }

  private handleIncomingPacket(msg: Record<string, any>) {
    if (!msg || typeof msg !== 'object') return;
    const store = useGameStore.getState();

    if (msg.playerId && msg.playerId === store.playerId) return;
    if (msg.attackerId && msg.attackerId === store.playerId) {
      return;
    }

    if (msg.msgId && this.isDuplicateMsgId(msg.msgId)) {
      return;
    }

    if (msg.roomCode && msg.roomCode !== store.roomCode) {
      return;
    }

    // Handle WebRTC Signaling messages (SDP Offer, SDP Answer, Batched ICE Candidates)
    if (
      msg.type === 'webrtc:offer' ||
      msg.type === 'webrtc:answer' ||
      msg.type === 'webrtc:ice-batch'
    ) {
      this.handleWebRtcSignaling(msg);
      return;
    }

    if (msg.playerId) {
      this.lastSeenMap.set(msg.playerId, Date.now());
      // Ensure direct native WebRTC RTCPeerConnection + RTCDataChannel is open to this peer!
      this.ensureNativeWebRtcSession(msg.playerId);
    }

    if (msg.peerId && msg.playerId) {
      this.dialPeerJsIfNeeded(msg.peerId, msg.playerId);
    }

    if (msg.type === 'player:leave' && msg.playerId) {
      this.closeNativeWebRtcSession(msg.playerId);
      store.removeRemotePlayer(msg.playerId);
      this.lastSeenMap.delete(msg.playerId);
      this.lastSeqMap.delete(msg.playerId);
      this.updateConnectedPeerCount();
      return;
    }

    if (
      msg.type === 'player:moved' ||
      msg.type === 'player:transform' ||
      msg.type === 'presence:beacon'
    ) {
      if (msg.playerId && msg.playerId !== store.playerId && Array.isArray(msg.position)) {
        // Monotonic sequence protection for high-frequency transform packets
        if (typeof msg.seq === 'number') {
          const prevSeq = this.lastSeqMap.get(msg.playerId) || 0;
          if (msg.seq <= prevSeq && prevSeq - msg.seq < 50000) {
            return;
          }
          this.lastSeqMap.set(msg.playerId, msg.seq);
        }

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
          msg.position as [number, number, number],
          (msg.rotation as [number, number]) || [0, 0],
          Boolean(msg.crouching),
          Boolean(msg.ads),
          (msg.weaponClass as WeaponId) || 'assault',
          (msg.velocity as [number, number, number]) || [0, 0, 0],
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
            isDowned: Boolean(msg.isDowned),
            downedHp: typeof msg.downedHp === 'number' ? msg.downedHp : undefined,
            soldierSkin: msg.soldierSkin,
            weaponSkin: msg.weaponSkin,
          }
        );

        if (isFirstSeen) {
          this.updateConnectedPeerCount();
          this.sendDiscoveryBeacon();
        }
      }
    } else if (msg.type === 'room:state' && msg.room) {
      if (msg.lanIp) {
        store.setLanInfo(msg.lanIp);
      }
      if (typeof msg.room.matchTimeRemaining === 'number') {
        store.setMatchTimeRemaining(msg.room.matchTimeRemaining);
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
            soldierSkin: p.soldierSkin || 'default',
            weaponSkin: p.weaponSkin || 'default',
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
      if (typeof msg.lobbyCountdownSec === 'number' || msg.lobbyCountdownSec === null) {
        store.setLobbyCountdown(msg.lobbyCountdownSec);
      }
      if (typeof msg.matchDurationSec === 'number' && !store.isHost) {
        store.setMatchDurationSec(msg.matchDurationSec);
      }
      if (typeof msg.matchTimeRemaining === 'number' && !store.isHost) {
        store.setMatchTimeRemaining(msg.matchTimeRemaining);
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
    } else if (msg.type === 'combat:revive') {
      if (msg.targetId === store.playerId) {
        if (msg.status === 'complete') {
          store.completeReviveByTeammate();
        } else if (msg.status === 'start') {
          store.setBeingRevived(true, msg.reviverId);
        } else if (msg.status === 'cancel') {
          store.setBeingRevived(false, null);
        }
      } else if (msg.targetId) {
        if (msg.status === 'complete') {
          store.setRemotePlayerRevived(msg.targetId);
        }
      }
    } else if (msg.type === 'player:shot' || msg.type === 'combat:shot') {
      if (
        msg.playerId &&
        msg.playerId !== store.playerId &&
        Array.isArray(msg.muzzlePos) &&
        Array.isArray(msg.endPoint)
      ) {
        const ev: RemoteShotEvent = {
          playerId: msg.playerId,
          weaponClass: (msg.weaponClass as WeaponId) || 'assault',
          muzzlePos: msg.muzzlePos as [number, number, number],
          endPoint: msg.endPoint as [number, number, number],
          hitPlayerId: msg.hitPlayerId || null,
          ads: Boolean(msg.ads),
        };
        this.shotListeners.forEach((fn) => {
          try {
            fn(ev);
          } catch {}
        });
      }
    } else if (msg.type === 'chat:message') {
      if (msg.playerId !== store.playerId) {
        store.addChatMessage(msg.senderName || 'Player', msg.team || 'alpha', msg.text || '');
      }
    }
  }

  private setupBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('deadschool_multiplayer_channel');
      this.broadcastChannel.onmessage = (ev) => {
        if (ev.data && typeof ev.data === 'object') {
          this.handleIncomingPacket(ev.data);
        }
      };
    } catch {}
  }

  private updateConnectedPeerCount() {
    const store = useGameStore.getState();
    const humanRemoteCount = Object.values(store.remotePlayers).filter((p) => !p.isBot).length;
    let openRtcCount = 0;
    this.rtcSessions.forEach((s) => {
      if (s.fastDc?.readyState === 'open' || s.reliableDc?.readyState === 'open') {
        openRtcCount++;
      }
    });
    const total = Math.max(openRtcCount + 1, this.peerConnections.size + 1, humanRemoteCount + 1);
    store.setPeerInfo(this.myPeerId || 'webrtc-dc', total);
  }

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
            this.closeNativeWebRtcSession(actor.id);
            store.removeRemotePlayer(actor.id);
            this.lastSeenMap.delete(actor.id);
            this.lastSeqMap.delete(actor.id);
            removedAny = true;
          }
        }
      });
      if (removedAny) {
        this.updateConnectedPeerCount();
      }
    }, 2000);
  }

  private broadcastLeavePacket(roomOverride?: string) {
    const s = useGameStore.getState();
    this.sendReliableEventPacket({
      type: 'player:leave',
      roomCode: roomOverride || s.roomCode || 'WORLD',
      playerId: s.playerId,
    });
  }

  public onRemoteShot(callback: (event: RemoteShotEvent) => void): () => void {
    this.shotListeners.add(callback);
    return () => this.shotListeners.delete(callback);
  }

  public sendShotEvent(
    muzzlePos: [number, number, number],
    endPoint: [number, number, number],
    weaponClass: WeaponId,
    hitPlayerId?: string | null
  ) {
    const store = useGameStore.getState();
    const packet = {
      type: 'player:shot',
      msgId: this.nextMsgId(),
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      weaponClass,
      muzzlePos,
      endPoint,
      hitPlayerId: hitPlayerId || null,
      ads: store.isAds,
      timestamp: Date.now(),
    };
    this.isDuplicateMsgId(packet.msgId);
    const jsonStr = JSON.stringify(packet);

    // 1. Native WebRTC DataChannels (low latency direct)
    this.rtcSessions.forEach((session) => {
      const dc =
        session.fastDc?.readyState === 'open'
          ? session.fastDc
          : session.reliableDc?.readyState === 'open'
            ? session.reliableDc
            : null;
      if (dc) {
        try {
          dc.send(jsonStr);
        } catch {}
      }
    });

    // 2. PeerJS DataConnections
    this.peerConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch {}
      }
    });

    // 3. Same-PC BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {}
    }

    // 4. WebSocket Server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(jsonStr);
      } catch {}
    }
  }

  public sendReviveEvent(
    targetId: string,
    status: 'start' | 'progress' | 'complete' | 'cancel',
    progress?: number
  ) {
    const store = useGameStore.getState();
    this.sendReliableEventPacket({
      type: 'combat:revive',
      roomCode: store.roomCode || 'WORLD',
      reviverId: store.playerId,
      targetId,
      status,
      progress,
    });
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
    this.sendReliableEventPacket({
      type: 'combat:event',
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
    });
  }

  public sendLobbySync() {
    const store = useGameStore.getState();
    this.sendReliableEventPacket({
      type: 'lobby:update',
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      playerName: store.playerName,
      mapId: store.selectedMapId,
      modeId: store.selectedModeId,
      isPublic: store.isPublicRoom,
      team: store.playerTeam,
      ready: store.isReady,
      weaponClass: store.selectedClass,
      lobbyCountdownSec: store.lobbyCountdownSec,
      matchDurationSec: store.matchDurationSec,
      matchTimeRemaining: store.matchTimeRemaining,
    });
  }

  public sendChatMessage(text: string) {
    const store = useGameStore.getState();
    const trimmed = text.trim();
    if (!trimmed) return;
    store.addChatMessage(store.playerName, store.playerTeam, trimmed);

    this.sendReliableEventPacket({
      type: 'chat:message',
      roomCode: store.roomCode || 'WORLD',
      playerId: store.playerId,
      senderName: store.playerName,
      team: store.playerTeam,
      text: trimmed,
    });
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
    const isLocalOrLan =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1' ||
        window.location.hostname.endsWith('.local') ||
        /^192\.168\.\d+\.\d+$/.test(window.location.hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(window.location.hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(window.location.hostname));

    if (!isLocalOrLan) {
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

  public connectWebSocket(customHostIp?: string) {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const isLocalOrLan =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1' ||
        window.location.hostname.endsWith('.local') ||
        /^192\.168\.\d+\.\d+$/.test(window.location.hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(window.location.hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(window.location.hostname));

    if (!isLocalOrLan && !customHostIp) {
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
        } catch {}
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
}

export const multiplayerManager = new LocalMultiplayerManager();
