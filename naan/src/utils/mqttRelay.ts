import type {
  LiveConnectionStatus,
  LiveServerEvent,
  Message,
  ServerRoomSnapshot,
  UserProfile,
} from '../types/chat';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const PUBLIC_WSS_MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
] as const;

const ROOM_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#0D9488',
  '#E11D48',
  '#D97706',
  '#0284C7',
];

function pickColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    sum = (sum + seed.charCodeAt(i)) % ROOM_COLORS.length;
  }
  return ROOM_COLORS[sum] ?? '#2563EB';
}

/* -------------------------------------------------------------------------- */
/* Minimal Pure-TS MQTT 3.1.1 Binary Codec                                    */
/* -------------------------------------------------------------------------- */

export function encodeMqttRemainingLength(len: number): Uint8Array {
  const bytes: number[] = [];
  let x = Math.max(0, len);
  do {
    let encodedByte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) encodedByte |= 128;
    bytes.push(encodedByte);
  } while (x > 0);
  return new Uint8Array(bytes);
}

function encodeMqttString(str: string): Uint8Array {
  const utf8 = textEncoder.encode(str);
  const out = new Uint8Array(2 + utf8.length);
  out[0] = (utf8.length >> 8) & 0xff;
  out[1] = utf8.length & 0xff;
  out.set(utf8, 2);
  return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function encodeMqttConnect(clientId: string, keepAliveSec = 30): Uint8Array {
  const protocolName = encodeMqttString('MQTT');
  const flagsAndKeepAlive = new Uint8Array([
    0x04, // Protocol level 4 (MQTT 3.1.1)
    0x02, // Clean Session
    (keepAliveSec >> 8) & 0xff,
    keepAliveSec & 0xff,
  ]);
  const clientIdBytes = encodeMqttString(clientId);
  const variableAndPayload = concatBytes(protocolName, flagsAndKeepAlive, clientIdBytes);
  const remLen = encodeMqttRemainingLength(variableAndPayload.length);
  return concatBytes(new Uint8Array([0x10]), remLen, variableAndPayload);
}

export function encodeMqttSubscribe(packetId: number, topics: string[]): Uint8Array {
  const idBytes = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const topicChunks: Uint8Array[] = [];
  for (const topic of topics) {
    topicChunks.push(encodeMqttString(topic), new Uint8Array([0x00])); // QoS 0
  }
  const variableAndPayload = concatBytes(idBytes, ...topicChunks);
  const remLen = encodeMqttRemainingLength(variableAndPayload.length);
  return concatBytes(new Uint8Array([0x82]), remLen, variableAndPayload);
}

export function encodeMqttPublish(
  topic: string,
  payload: Uint8Array,
  retain = false,
): Uint8Array {
  const topicBytes = encodeMqttString(topic);
  const variableAndPayload = concatBytes(topicBytes, payload);
  const remLen = encodeMqttRemainingLength(variableAndPayload.length);
  const headerByte = retain ? 0x31 : 0x30; // QoS 0
  return concatBytes(new Uint8Array([headerByte]), remLen, variableAndPayload);
}

export function encodeMqttPingreq(): Uint8Array {
  return new Uint8Array([0xc0, 0x00]);
}

export interface DecodedMqttPacket {
  packetType: number;
  flags: number;
  topic?: string;
  payload: Uint8Array;
}

export class MqttPacketReader {
  private buffer: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): DecodedMqttPacket[] {
    if (chunk.length === 0) return [];
    this.buffer = concatBytes(this.buffer, chunk);
    const packets: DecodedMqttPacket[] = [];

    while (this.buffer.length >= 2) {
      const header = this.buffer[0];
      const packetType = (header >> 4) & 0x0f;
      const flags = header & 0x0f;

      let multiplier = 1;
      let remLength = 0;
      let lenBytes = 0;
      let completeHeader = false;

      for (let i = 1; i < this.buffer.length && i <= 4; i += 1) {
        const b = this.buffer[i];
        remLength += (b & 0x7f) * multiplier;
        lenBytes = i;
        if ((b & 0x80) === 0) {
          completeHeader = true;
          break;
        }
        multiplier *= 128;
      }

      if (!completeHeader) break;

      const totalPacketLen = 1 + lenBytes + remLength;
      if (this.buffer.length < totalPacketLen) break;

      const body = this.buffer.subarray(1 + lenBytes, totalPacketLen);
      this.buffer = this.buffer.subarray(totalPacketLen);

      if (packetType === 3) {
        // PUBLISH
        if (body.length < 2) continue;
        const topicLen = (body[0] << 8) | body[1];
        if (2 + topicLen > body.length) continue;
        const topic = textDecoder.decode(body.subarray(2, 2 + topicLen));
        const qos = (flags >> 1) & 0x03;
        const payloadStart = 2 + topicLen + (qos > 0 ? 2 : 0);
        const payload = body.subarray(Math.min(payloadStart, body.length));
        packets.push({packetType, flags, topic, payload});
      } else {
        packets.push({packetType, flags, payload: body});
      }
    }

    return packets;
  }
}

/* -------------------------------------------------------------------------- */
/* Web Crypto AES-GCM Room Encryption + Topic Hashing                         */
/* -------------------------------------------------------------------------- */

const aesKeyCache = new Map<string, Promise<CryptoKey>>();
const topicPrefixCache = new Map<string, Promise<string>>();

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(input),
  );
  return new Uint8Array(digest);
}

export async function deriveRelayTopicPrefix(roomCode: string): Promise<string> {
  const clean = roomCode.trim().toUpperCase();
  const cached = topicPrefixCache.get(clean);
  if (cached) return cached;

  const promise = sha256Bytes(`naan-relay-topic-v1:${clean}`).then((bytes) => {
    let hex = '';
    for (let i = 0; i < 12; i += 1) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return `naan/r1/${hex}`;
  });
  topicPrefixCache.set(clean, promise);
  return promise;
}

async function getRoomAesKey(roomCode: string): Promise<CryptoKey> {
  const clean = roomCode.trim().toUpperCase();
  const cached = aesKeyCache.get(clean);
  if (cached) return cached;

  const promise = sha256Bytes(`naan-relay-aes-v1:${clean}`).then((raw) =>
    globalThis.crypto.subtle.importKey(
      'raw',
      raw.buffer as ArrayBuffer,
      {name: 'AES-GCM'},
      false,
      ['encrypt', 'decrypt'],
    ),
  );
  aesKeyCache.set(clean, promise);
  return promise;
}

export async function encryptRelayJson(
  roomCode: string,
  payload: unknown,
): Promise<Uint8Array> {
  const key = await getRoomAesKey(roomCode);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = textEncoder.encode(JSON.stringify(payload));
  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    {name: 'AES-GCM', iv},
    key,
    plain,
  );
  const cipher = new Uint8Array(cipherBuffer);
  const out = new Uint8Array(1 + 12 + cipher.length);
  out[0] = 0x01; // Version 1 envelope
  out.set(iv, 1);
  out.set(cipher, 13);
  return out;
}

function toBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes as Uint8Array<ArrayBuffer>;
  }
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

export async function decryptRelayJson<T>(
  roomCode: string,
  bytes: Uint8Array,
): Promise<T> {
  if (bytes.length < 14 || bytes[0] !== 0x01) {
    throw new Error('Invalid encrypted relay frame');
  }
  const key = await getRoomAesKey(roomCode);
  const iv = toBufferView(bytes.subarray(1, 13));
  const cipher = toBufferView(bytes.subarray(13));
  const plainBuffer = await globalThis.crypto.subtle.decrypt(
    {name: 'AES-GCM', iv},
    key,
    cipher,
  );
  return JSON.parse(textDecoder.decode(plainBuffer)) as T;
}

/* -------------------------------------------------------------------------- */
/* Encrypted Decentralized Relay Room Transport                               */
/* -------------------------------------------------------------------------- */

export interface RelayJoinedRoomEntry {
  roomCode: string;
  roomName?: string;
  roomDescription?: string;
  user: UserProfile;
}

type RelayEnvelope =
  | {
      kind: 'presence:join';
      clientId: string;
      user: UserProfile;
      roomName?: string;
      roomDescription?: string;
      ts: number;
    }
  | {kind: 'presence:ping'; clientId: string; user: UserProfile; ts: number}
  | {kind: 'presence:leave'; clientId: string; userId: string; ts: number}
  | {
      kind: 'room:snapshot';
      clientId: string;
      room: ServerRoomSnapshot;
      onlineUserIds: string[];
      ts: number;
    }
  | {
      kind: 'typing:update';
      clientId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
      ts: number;
    }
  | {
      kind: 'message:send';
      clientId: string;
      message: Message;
      user?: UserProfile;
      ts: number;
    }
  | {
      kind: 'message:edit';
      clientId: string;
      messageId: string;
      senderId: string;
      content: string;
      updatedAt: number;
    }
  | {
      kind: 'message:delete';
      clientId: string;
      messageId: string;
      senderId: string;
      updatedAt: number;
    }
  | {
      kind: 'message:pin';
      clientId: string;
      messageId: string;
      pinned: boolean;
      updatedAt: number;
    }
  | {
      kind: 'message:react';
      clientId: string;
      messageId: string;
      emoji: string;
      userId: string;
      updatedAt: number;
    }
  | {
      kind: 'poll:vote';
      clientId: string;
      messageId: string;
      optionId: string;
      userId: string;
      updatedAt: number;
    }
  | {
      kind: 'checklist:toggle';
      clientId: string;
      messageId: string;
      itemId: string;
      updatedAt: number;
    };

interface LocalRelayRoom {
  room: ServerRoomSnapshot;
  onlinePeers: Map<string, number>; // userId -> lastSeenMs
  evTopic: string;
  snapTopic: string;
}

const PEER_TTL_MS = 35_000;
const MAX_SNAP_BYTES = 180_000;

export class MqttRelayTransport {
  private readonly clientId = `naan_${Math.random().toString(36).slice(2, 10)}`;
  private ws: WebSocket | null = null;
  private reader = new MqttPacketReader();
  private packetSeq = 1;
  private brokerIndex = 0;
  private brokerFailures = 0;
  private destroyed = false;
  private status: LiveConnectionStatus = 'disconnected';
  private connAckReceived = false;

  private pingTimer: number | null = null;
  private presenceTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private connectTimeoutTimer: number | null = null;

  private joinedEntries = new Map<string, RelayJoinedRoomEntry>();
  private roomStates = new Map<string, LocalRelayRoom>();
  private subscribedRooms = new Set<string>();
  private topicToRoom = new Map<string, {roomCode: string; kind: 'ev' | 'snap'}>();

  private readonly onEventCb: (ev: LiveServerEvent) => void;
  private readonly onStatusCb: (status: LiveConnectionStatus) => void;

  constructor(
    onEvent: (ev: LiveServerEvent) => void,
    onStatus: (status: LiveConnectionStatus) => void,
  ) {
    this.onEventCb = onEvent;
    this.onStatusCb = onStatus;
  }

  getStatus(): LiveConnectionStatus {
    return this.status;
  }

  private setStatus(next: LiveConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.onStatusCb(next);
  }

  connect(): void {
    if (this.destroyed) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const brokerUrl =
      PUBLIC_WSS_MQTT_BROKERS[this.brokerIndex % PUBLIC_WSS_MQTT_BROKERS.length];
    this.setStatus('connecting');
    this.connAckReceived = false;
    this.reader = new MqttPacketReader();

    try {
      const socket = new WebSocket(brokerUrl, 'mqtt');
      socket.binaryType = 'arraybuffer';
      this.ws = socket;

      if (this.connectTimeoutTimer) window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = window.setTimeout(() => {
        if (!this.connAckReceived && this.ws === socket) {
          socket.close();
        }
      }, 8000);

      socket.onopen = () => {
        if (this.destroyed) {
          socket.close();
          return;
        }
        socket.send(toBufferView(encodeMqttConnect(this.clientId, 30)));
      };

      socket.onmessage = (ev) => {
        if (typeof ev.data === 'string') return;
        const bytes = new Uint8Array(ev.data as ArrayBuffer);
        const packets = this.reader.push(bytes);
        for (const pkt of packets) {
          if (pkt.packetType === 2) {
            // CONNACK
            const rc = pkt.payload[1] ?? 0;
            if (rc === 0) {
              this.connAckReceived = true;
              this.brokerFailures = 0;
              if (this.connectTimeoutTimer) {
                window.clearTimeout(this.connectTimeoutTimer);
                this.connectTimeoutTimer = null;
              }
              this.setStatus('connected');
              this.startTimers();
              void this.resubscribeAll();
            } else {
              socket.close();
            }
          } else if (pkt.packetType === 3 && pkt.topic) {
            void this.handleIncomingPublish(pkt.topic, pkt.payload);
          }
        }
      };

      socket.onerror = () => {
        // Handled by onclose
      };

      socket.onclose = () => {
        if (this.connectTimeoutTimer) {
          window.clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        this.stopTimers();
        this.ws = null;
        this.connAckReceived = false;
        this.subscribedRooms.clear();
        if (this.destroyed) {
          this.setStatus('disconnected');
          return;
        }
        this.setStatus('disconnected');
        if (this.joinedEntries.size > 0) {
          this.brokerFailures += 1;
          if (this.brokerFailures >= 2) {
            this.brokerFailures = 0;
            this.brokerIndex = (this.brokerIndex + 1) % PUBLIC_WSS_MQTT_BROKERS.length;
          }
          this.scheduleReconnect();
        }
      };
    } catch {
      this.setStatus('disconnected');
      if (this.joinedEntries.size > 0) {
        this.brokerFailures += 1;
        if (this.brokerFailures >= 2) {
          this.brokerFailures = 0;
          this.brokerIndex = (this.brokerIndex + 1) % PUBLIC_WSS_MQTT_BROKERS.length;
        }
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.destroyed) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1200);
  }

  private startTimers(): void {
    this.stopTimers();
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(toBufferView(encodeMqttPingreq()));
      }
    }, 20_000);

    this.presenceTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [code, entry] of this.joinedEntries.entries()) {
        const local = this.roomStates.get(code);
        if (!local) continue;
        local.onlinePeers.set(entry.user.id, now);
        let pruned = false;
        for (const [uid, lastSeen] of local.onlinePeers.entries()) {
          if (uid !== entry.user.id && now - lastSeen > PEER_TTL_MS) {
            local.onlinePeers.delete(uid);
            pruned = true;
          }
        }
        if (pruned) {
          this.emitPresence(code, local);
        }
        void this.publishEncrypted(code, local.evTopic, {
          kind: 'presence:ping',
          clientId: this.clientId,
          user: entry.user,
          ts: now,
        });
      }
    }, 12_000);
  }

  private stopTimers(): void {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.presenceTimer) {
      window.clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  private async ensureRoomState(entry: RelayJoinedRoomEntry): Promise<LocalRelayRoom> {
    const existing = this.roomStates.get(entry.roomCode);
    const prefix = await deriveRelayTopicPrefix(entry.roomCode);
    const evTopic = `${prefix}/ev`;
    const snapTopic = `${prefix}/snap`;
    this.topicToRoom.set(evTopic, {roomCode: entry.roomCode, kind: 'ev'});
    this.topicToRoom.set(snapTopic, {roomCode: entry.roomCode, kind: 'snap'});

    if (existing) {
      existing.room.users[entry.user.id] = entry.user;
      if (entry.roomName && existing.room.name === `sala-${entry.roomCode.toLowerCase()}`) {
        existing.room.name = entry.roomName;
      }
      existing.onlinePeers.set(entry.user.id, Date.now());
      return existing;
    }

    const now = Date.now();
    const room: ServerRoomSnapshot = {
      code: entry.roomCode,
      name: entry.roomName || `sala-${entry.roomCode.toLowerCase()}`,
      description: entry.roomDescription || `LIVE · ${entry.roomCode}`,
      color: pickColor(entry.roomCode),
      createdAt: now,
      updatedAt: now,
      users: {[entry.user.id]: entry.user},
      messages: [],
    };
    const local: LocalRelayRoom = {
      room,
      onlinePeers: new Map([[entry.user.id, now]]),
      evTopic,
      snapTopic,
    };
    this.roomStates.set(entry.roomCode, local);
    return local;
  }

  private async resubscribeAll(): Promise<void> {
    for (const entry of this.joinedEntries.values()) {
      await this.subscribeAndAnnounce(entry);
    }
  }

  private async subscribeAndAnnounce(entry: RelayJoinedRoomEntry): Promise<void> {
    const local = await this.ensureRoomState(entry);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connAckReceived) {
      return;
    }
    const alreadySub = this.subscribedRooms.has(entry.roomCode);
    if (!alreadySub) {
      this.subscribedRooms.add(entry.roomCode);
      this.packetSeq = (this.packetSeq % 65_000) + 1;
      this.ws.send(
        toBufferView(encodeMqttSubscribe(this.packetSeq, [local.snapTopic, local.evTopic])),
      );
      this.onEventCb({
        type: 'room:state',
        room: this.cloneRoom(local.room),
        onlineUserIds: Array.from(local.onlinePeers.keys()),
      });
    }

    await this.publishEncrypted(entry.roomCode, local.evTopic, {
      kind: 'presence:join',
      clientId: this.clientId,
      user: entry.user,
      roomName: entry.roomName,
      roomDescription: entry.roomDescription,
      ts: Date.now(),
    });
  }

  private async publishEncrypted(
    roomCode: string,
    topic: string,
    envelope: RelayEnvelope,
    retain = false,
  ): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connAckReceived) {
      return false;
    }
    const encrypted = await encryptRelayJson(roomCode, envelope);
    if (retain && encrypted.length > MAX_SNAP_BYTES) {
      return false;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(toBufferView(encodeMqttPublish(topic, encrypted, retain)));
    return true;
  }

  private async publishRetainedSnapshot(roomCode: string): Promise<void> {
    const local = this.roomStates.get(roomCode);
    if (!local) return;
    // Keep last 40 compact messages in retained snapshot for async latecomers
    const compactMsgs = local.room.messages.slice(-40).map((m) => {
      if (!m.attachments || m.attachments.length === 0) return m;
      const totalChars = JSON.stringify(m.attachments).length;
      if (totalChars > 48_000) {
        return {...m, attachments: undefined};
      }
      return m;
    });
    const snapRoom: ServerRoomSnapshot = {
      ...local.room,
      users: {...local.room.users},
      messages: compactMsgs,
    };
    await this.publishEncrypted(
      roomCode,
      local.snapTopic,
      {
        kind: 'room:snapshot',
        clientId: this.clientId,
        room: snapRoom,
        onlineUserIds: Array.from(local.onlinePeers.keys()),
        ts: Date.now(),
      },
      true,
    );
  }

  private cloneRoom(room: ServerRoomSnapshot): ServerRoomSnapshot {
    return {
      ...room,
      users: {...room.users},
      messages: [...room.messages],
    };
  }

  private emitPresence(roomCode: string, local: LocalRelayRoom): void {
    this.onEventCb({
      type: 'room:presence',
      roomCode,
      users: Object.values(local.room.users),
      onlineUserIds: Array.from(local.onlinePeers.keys()),
    });
  }

  private mergeRoomSnapshot(
    local: LocalRelayRoom,
    remoteRoom: ServerRoomSnapshot,
  ): void {
    const fallbackName = `sala-${local.room.code.toLowerCase()}`;
    if (
      remoteRoom.name &&
      remoteRoom.name !== fallbackName &&
      local.room.name === fallbackName
    ) {
      local.room.name = remoteRoom.name;
    }
    if (remoteRoom.description && !local.room.description) {
      local.room.description = remoteRoom.description;
    }
    for (const u of Object.values(remoteRoom.users ?? {})) {
      if (u && u.id) {
        local.room.users[u.id] = u;
      }
    }
    const msgMap = new Map(local.room.messages.map((m) => [m.id, m]));
    for (const rm of remoteRoom.messages ?? []) {
      const cur = msgMap.get(rm.id);
      if (!cur) {
        msgMap.set(rm.id, rm);
      } else {
        const curStamp = cur.updatedAt ?? cur.createdAt;
        const rmStamp = rm.updatedAt ?? rm.createdAt;
        if (rmStamp >= curStamp) {
          msgMap.set(rm.id, rm);
        }
      }
    }
    local.room.messages = Array.from(msgMap.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-400);
    local.room.updatedAt = Math.max(local.room.updatedAt, remoteRoom.updatedAt ?? 0);
  }

  private async handleIncomingPublish(
    topic: string,
    rawPayload: Uint8Array,
  ): Promise<void> {
    const meta = this.topicToRoom.get(topic);
    if (!meta) return;
    const local = this.roomStates.get(meta.roomCode);
    if (!local) return;

    let env: RelayEnvelope;
    try {
      env = await decryptRelayJson<RelayEnvelope>(meta.roomCode, rawPayload);
    } catch {
      return;
    }

    if (!env || env.clientId === this.clientId) return;

    const now = Date.now();

    if (env.kind === 'presence:join') {
      local.room.users[env.user.id] = env.user;
      local.onlinePeers.set(env.user.id, now);
      if (
        env.roomName &&
        local.room.name === `sala-${meta.roomCode.toLowerCase()}`
      ) {
        local.room.name = env.roomName;
      }
      this.emitPresence(meta.roomCode, local);
      // Reply with current room snapshot so newcomer syncs immediately
      void this.publishEncrypted(meta.roomCode, local.evTopic, {
        kind: 'room:snapshot',
        clientId: this.clientId,
        room: this.cloneRoom(local.room),
        onlineUserIds: Array.from(local.onlinePeers.keys()),
        ts: now,
      });
      return;
    }

    if (env.kind === 'presence:ping') {
      local.room.users[env.user.id] = env.user;
      local.onlinePeers.set(env.user.id, now);
      this.emitPresence(meta.roomCode, local);
      return;
    }

    if (env.kind === 'presence:leave') {
      local.onlinePeers.delete(env.userId);
      this.emitPresence(meta.roomCode, local);
      return;
    }

    if (env.kind === 'room:snapshot') {
      this.mergeRoomSnapshot(local, env.room);
      if (meta.kind === 'ev') {
        for (const uid of env.onlineUserIds ?? []) {
          local.onlinePeers.set(uid, now);
        }
      }
      this.onEventCb({
        type: 'room:state',
        room: this.cloneRoom(local.room),
        onlineUserIds: Array.from(local.onlinePeers.keys()),
      });
      return;
    }

    if (env.kind === 'typing:update') {
      this.onEventCb({
        type: 'typing:state',
        roomCode: meta.roomCode,
        userId: env.userId,
        userName: env.userName,
        isTyping: env.isTyping,
      });
      return;
    }

    if (env.kind === 'message:send') {
      if (env.user) {
        local.room.users[env.user.id] = env.user;
        local.onlinePeers.set(env.user.id, now);
      }
      if (!local.room.messages.some((m) => m.id === env.message.id)) {
        local.room.messages.push(env.message);
        local.room.messages.sort((a, b) => a.createdAt - b.createdAt);
      }
      local.room.updatedAt = Math.max(local.room.updatedAt, env.message.createdAt);
      this.onEventCb({
        type: 'message:new',
        roomCode: meta.roomCode,
        message: env.message,
        sender: env.user ?? local.room.users[env.message.senderId],
      });
      return;
    }

    const msg = local.room.messages.find((m) => m.id === env.messageId);
    if (!msg) return;

    if (env.kind === 'message:edit' && msg.senderId === env.senderId && !msg.deleted) {
      msg.content = env.content;
      msg.edited = true;
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    } else if (env.kind === 'message:delete' && msg.senderId === env.senderId) {
      msg.deleted = true;
      msg.pinned = false;
      msg.content = '';
      msg.attachments = undefined;
      msg.poll = undefined;
      msg.checklist = undefined;
      msg.sticker = undefined;
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    } else if (env.kind === 'message:pin' && !msg.deleted) {
      msg.pinned = env.pinned;
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    } else if (env.kind === 'message:react' && !msg.deleted) {
      const current = msg.reactions[env.emoji] ?? [];
      const nextList = current.includes(env.userId)
        ? current.filter((id) => id !== env.userId)
        : [...current, env.userId];
      if (nextList.length === 0) delete msg.reactions[env.emoji];
      else msg.reactions[env.emoji] = nextList;
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    } else if (env.kind === 'poll:vote' && msg.poll) {
      msg.poll = {
        ...msg.poll,
        options: msg.poll.options.map((opt) => {
          const voted = opt.voterIds.includes(env.userId);
          if (opt.id === env.optionId) {
            return {
              ...opt,
              voterIds: voted
                ? opt.voterIds.filter((id) => id !== env.userId)
                : [...opt.voterIds, env.userId],
            };
          }
          if (!msg.poll!.allowMultiple && voted) {
            return {
              ...opt,
              voterIds: opt.voterIds.filter((id) => id !== env.userId),
            };
          }
          return opt;
        }),
      };
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    } else if (env.kind === 'checklist:toggle' && msg.checklist) {
      msg.checklist = {
        ...msg.checklist,
        items: msg.checklist.items.map((it) =>
          it.id === env.itemId ? {...it, done: !it.done} : it,
        ),
      };
      msg.updatedAt = env.updatedAt;
      this.onEventCb({type: 'message:updated', roomCode: meta.roomCode, message: {...msg}});
    }
  }

  joinRoom(entry: RelayJoinedRoomEntry): void {
    const prev = this.joinedEntries.get(entry.roomCode);
    const merged: RelayJoinedRoomEntry = {
      roomCode: entry.roomCode,
      roomName: entry.roomName ?? prev?.roomName,
      roomDescription: entry.roomDescription ?? prev?.roomDescription,
      user: entry.user,
    };
    this.joinedEntries.set(entry.roomCode, merged);
    this.connect();
    if (this.connAckReceived) {
      if (this.subscribedRooms.has(entry.roomCode)) {
        const local = this.roomStates.get(entry.roomCode);
        const profileChanged =
          !prev ||
          prev.user.name !== entry.user.name ||
          prev.user.handle !== entry.user.handle ||
          prev.user.role !== entry.user.role ||
          prev.user.color !== entry.user.color;
        if (local && profileChanged) {
          local.room.users[entry.user.id] = entry.user;
          void this.publishEncrypted(entry.roomCode, local.evTopic, {
            kind: 'presence:ping',
            clientId: this.clientId,
            user: entry.user,
            ts: Date.now(),
          });
        }
        return;
      }
      void this.subscribeAndAnnounce(merged);
    }
  }

  leaveRoom(roomCode: string, userId: string): void {
    this.joinedEntries.delete(roomCode);
    this.subscribedRooms.delete(roomCode);
    const local = this.roomStates.get(roomCode);
    if (local) {
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'presence:leave',
        clientId: this.clientId,
        userId,
        ts: Date.now(),
      });
    }
    this.roomStates.delete(roomCode);
  }

  send(payload: Record<string, unknown>): boolean {
    const type = String(payload.type ?? '');
    const roomCode = String(payload.roomCode ?? '').trim().toUpperCase();
    if (!roomCode) return false;
    const local = this.roomStates.get(roomCode);
    if (!local) return false;

    const now = Date.now();

    if (type === 'typing:update') {
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'typing:update',
        clientId: this.clientId,
        userId: String(payload.userId ?? ''),
        userName: String(payload.userName ?? ''),
        isTyping: Boolean(payload.isTyping),
        ts: now,
      });
      return true;
    }

    if (type === 'message:send') {
      const msg = payload.message as Message | undefined;
      if (!msg) return false;
      const user = payload.user as UserProfile | undefined;
      if (user) {
        local.room.users[user.id] = user;
        local.onlinePeers.set(user.id, now);
      }
      if (!local.room.messages.some((m) => m.id === msg.id)) {
        local.room.messages.push(msg);
      }
      local.room.updatedAt = Math.max(local.room.updatedAt, msg.createdAt);
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'message:send',
        clientId: this.clientId,
        message: msg,
        user,
        ts: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    const messageId = String(payload.messageId ?? '');
    const msg = local.room.messages.find((m) => m.id === messageId);

    if (type === 'message:edit') {
      const senderId = String(payload.senderId ?? '');
      const content = String(payload.content ?? '');
      if (msg && msg.senderId === senderId && !msg.deleted) {
        msg.content = content;
        msg.edited = true;
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'message:edit',
        clientId: this.clientId,
        messageId,
        senderId,
        content,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    if (type === 'message:delete') {
      const senderId = String(payload.senderId ?? '');
      if (msg && msg.senderId === senderId) {
        msg.deleted = true;
        msg.pinned = false;
        msg.content = '';
        msg.attachments = undefined;
        msg.poll = undefined;
        msg.checklist = undefined;
        msg.sticker = undefined;
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'message:delete',
        clientId: this.clientId,
        messageId,
        senderId,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    if (type === 'message:pin') {
      const nextPinned = msg ? !msg.pinned : true;
      if (msg && !msg.deleted) {
        msg.pinned = nextPinned;
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'message:pin',
        clientId: this.clientId,
        messageId,
        pinned: nextPinned,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    if (type === 'message:react') {
      const emoji = String(payload.emoji ?? '');
      const userId = String(payload.userId ?? '');
      if (msg && !msg.deleted) {
        const cur = msg.reactions[emoji] ?? [];
        const nextList = cur.includes(userId)
          ? cur.filter((id) => id !== userId)
          : [...cur, userId];
        if (nextList.length === 0) delete msg.reactions[emoji];
        else msg.reactions[emoji] = nextList;
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'message:react',
        clientId: this.clientId,
        messageId,
        emoji,
        userId,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    if (type === 'poll:vote') {
      const optionId = String(payload.optionId ?? '');
      const userId = String(payload.userId ?? '');
      if (msg?.poll) {
        msg.poll = {
          ...msg.poll,
          options: msg.poll.options.map((opt) => {
            const voted = opt.voterIds.includes(userId);
            if (opt.id === optionId) {
              return {
                ...opt,
                voterIds: voted
                  ? opt.voterIds.filter((id) => id !== userId)
                  : [...opt.voterIds, userId],
              };
            }
            if (!msg.poll!.allowMultiple && voted) {
              return {
                ...opt,
                voterIds: opt.voterIds.filter((id) => id !== userId),
              };
            }
            return opt;
          }),
        };
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'poll:vote',
        clientId: this.clientId,
        messageId,
        optionId,
        userId,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    if (type === 'checklist:toggle') {
      const itemId = String(payload.itemId ?? '');
      if (msg?.checklist) {
        msg.checklist = {
          ...msg.checklist,
          items: msg.checklist.items.map((it) =>
            it.id === itemId ? {...it, done: !it.done} : it,
          ),
        };
        msg.updatedAt = now;
      }
      void this.publishEncrypted(roomCode, local.evTopic, {
        kind: 'checklist:toggle',
        clientId: this.clientId,
        messageId,
        itemId,
        updatedAt: now,
      });
      void this.publishRetainedSnapshot(roomCode);
      return true;
    }

    return false;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.connectTimeoutTimer) window.clearTimeout(this.connectTimeoutTimer);
    this.stopTimers();
    this.ws?.close();
    this.ws = null;
    this.joinedEntries.clear();
    this.roomStates.clear();
    this.topicToRoom.clear();
  }
}
