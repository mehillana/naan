import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket, WebSocketServer} from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ROOMS_STORE_PATH = path.resolve(__dirname, '.naan-rooms.json');
const MAX_MESSAGES_PER_ROOM = 500;
const MAX_PAYLOAD_CHARS = 4_000_000;

interface ServerUserProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  color: string;
}

interface ServerPollOption {
  id: string;
  text: string;
  voterIds: string[];
}

interface ServerPoll {
  id: string;
  question: string;
  allowMultiple: boolean;
  options: ServerPollOption[];
}

interface ServerChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface ServerChecklist {
  id: string;
  title: string;
  items: ServerChecklistItem[];
}

interface ServerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  edited?: boolean;
  deleted?: boolean;
  pinned?: boolean;
  starred?: boolean;
  replyToId?: string;
  reactions: Record<string, string[]>;
  attachments?: unknown[];
  poll?: ServerPoll;
  checklist?: ServerChecklist;
  sticker?: {id: string; emoji: string; label: string; gradient: string};
  effect?: 'confetti' | 'sparkle' | 'pulse';
}

interface ServerRoom {
  code: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  users: Record<string, ServerUserProfile>;
  messages: ServerMessage[];
}

interface ClientSubscription {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
}

const ROOM_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#0D9488',
  '#E11D48',
  '#D97706',
  '#0284C7',
];

const rooms = new Map<string, ServerRoom>();
const roomSockets = new Map<string, Set<ClientSubscription>>();
const clientSubs = new Map<WebSocket, ClientSubscription>();

function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

function pickColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    sum = (sum + seed.charCodeAt(i)) % ROOM_COLORS.length;
  }
  return ROOM_COLORS[sum] ?? '#2563EB';
}

async function loadRoomsFromDisk(): Promise<void> {
  try {
    const raw = await fs.readFile(ROOMS_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ServerRoom[];
    if (Array.isArray(parsed)) {
      for (const room of parsed) {
        if (room && typeof room.code === 'string') {
          rooms.set(normalizeRoomCode(room.code), room);
        }
      }
    }
  } catch {
    // Clean initial boot when store does not exist yet
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSaveRooms(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = Array.from(rooms.values());
    fs.writeFile(ROOMS_STORE_PATH, JSON.stringify(snapshot), 'utf8').catch(() => {
      // Ignore write failures in read-only sandboxes
    });
  }, 400);
}

function getOnlineUserIds(roomCode: string): string[] {
  const subs = roomSockets.get(roomCode);
  if (!subs) return [];
  const ids = new Set<string>();
  for (const sub of subs) {
    if (sub.userId) ids.add(sub.userId);
  }
  return Array.from(ids);
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(
  roomCode: string,
  payload: unknown,
  excludeWs?: WebSocket,
): void {
  const subs = roomSockets.get(roomCode);
  if (!subs) return;
  const serialized = JSON.stringify(payload);
  for (const sub of subs) {
    if (sub.ws !== excludeWs && sub.ws.readyState === WebSocket.OPEN) {
      sub.ws.send(serialized);
    }
  }
}

function sanitizeUser(raw: unknown): ServerUserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Partial<ServerUserProfile>;
  if (typeof u.id !== 'string' || !u.id.trim()) return null;
  const cleanName = typeof u.name === 'string' && u.name.trim() ? u.name.trim().slice(0, 60) : 'Naan User';
  const cleanHandle =
    typeof u.handle === 'string' && u.handle.trim()
      ? (u.handle.trim().startsWith('@') ? u.handle.trim() : `@${u.handle.trim()}`).slice(0, 40)
      : `@${u.id.slice(0, 10)}`;
  return {
    id: u.id.trim().slice(0, 64),
    name: cleanName,
    handle: cleanHandle,
    role: typeof u.role === 'string' ? u.role.trim().slice(0, 50) : 'Online',
    color: typeof u.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(u.color) ? u.color : '#2563EB',
  };
}

function getOrCreateRoom(code: string, name?: string, description?: string): ServerRoom {
  const cleanCode = normalizeRoomCode(code);
  const existing = rooms.get(cleanCode);
  if (existing) return existing;

  const now = Date.now();
  const roomName =
    typeof name === 'string' && name.trim()
      ? name.trim().slice(0, 60)
      : `sala-${cleanCode.toLowerCase()}`;
  const room: ServerRoom = {
    code: cleanCode,
    name: roomName,
    description:
      typeof description === 'string' && description.trim()
        ? description.trim().slice(0, 140)
        : `LIVE · ${cleanCode}`,
    color: pickColor(cleanCode),
    createdAt: now,
    updatedAt: now,
    users: {},
    messages: [],
  };
  rooms.set(cleanCode, room);
  scheduleSaveRooms();
  return room;
}

function handleClientEvent(sub: ClientSubscription, rawText: string): void {
  if (rawText.length > MAX_PAYLOAD_CHARS) {
    sendJson(sub.ws, {type: 'error', message: 'Payload exceeds size limit'});
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return;
  }

  const eventType = typeof parsed.type === 'string' ? parsed.type : '';

  if (eventType === 'ping') {
    sendJson(sub.ws, {type: 'pong', ts: Date.now()});
    return;
  }

  if (eventType === 'room:join') {
    const code = normalizeRoomCode(String(parsed.roomCode ?? ''));
    const user = sanitizeUser(parsed.user);
    if (!code || !user) {
      sendJson(sub.ws, {type: 'error', message: 'Invalid room code or user profile'});
      return;
    }

    const room = getOrCreateRoom(
      code,
      typeof parsed.roomName === 'string' ? parsed.roomName : undefined,
      typeof parsed.roomDescription === 'string' ? parsed.roomDescription : undefined,
    );

    sub.userId = user.id;
    sub.rooms.add(code);

    let set = roomSockets.get(code);
    if (!set) {
      set = new Set();
      roomSockets.set(code, set);
    }
    set.add(sub);

    room.users[user.id] = user;
    room.updatedAt = Date.now();
    scheduleSaveRooms();

    const onlineUserIds = getOnlineUserIds(code);
    sendJson(sub.ws, {
      type: 'room:state',
      room,
      onlineUserIds,
    });
    broadcastToRoom(
      code,
      {
        type: 'room:presence',
        roomCode: code,
        users: Object.values(room.users),
        onlineUserIds,
      },
      sub.ws,
    );
    return;
  }

  if (eventType === 'room:leave') {
    const code = normalizeRoomCode(String(parsed.roomCode ?? ''));
    if (!code) return;
    sub.rooms.delete(code);
    const set = roomSockets.get(code);
    if (set) {
      set.delete(sub);
      if (set.size === 0) roomSockets.delete(code);
    }
    const room = rooms.get(code);
    if (room) {
      broadcastToRoom(code, {
        type: 'room:presence',
        roomCode: code,
        users: Object.values(room.users),
        onlineUserIds: getOnlineUserIds(code),
      });
    }
    return;
  }

  const code = normalizeRoomCode(String(parsed.roomCode ?? ''));
  if (!code) return;
  const room = rooms.get(code);
  if (!room) {
    sendJson(sub.ws, {type: 'error', message: 'Room not found'});
    return;
  }

  if (eventType === 'typing:update') {
    const userId = String(parsed.userId ?? sub.userId ?? '').trim();
    const userName = String(parsed.userName ?? '').trim().slice(0, 60);
    const isTyping = Boolean(parsed.isTyping);
    if (!userId) return;
    broadcastToRoom(
      code,
      {
        type: 'typing:state',
        roomCode: code,
        userId,
        userName: userName || room.users[userId]?.name || 'User',
        isTyping,
      },
      sub.ws,
    );
    return;
  }

  if (eventType === 'message:send') {
    const incoming = parsed.message as Partial<ServerMessage> | undefined;
    if (!incoming || typeof incoming.id !== 'string' || typeof incoming.senderId !== 'string') {
      return;
    }

    const sender = sanitizeUser(parsed.user);
    if (sender) {
      room.users[sender.id] = sender;
    }

    // Idempotent check
    if (room.messages.some((m) => m.id === incoming.id)) {
      return;
    }

    const cleanMsg: ServerMessage = {
      id: incoming.id.slice(0, 80),
      conversationId: `live_${code}`,
      senderId: incoming.senderId.slice(0, 64),
      content: typeof incoming.content === 'string' ? incoming.content.slice(0, 8000) : '',
      createdAt: typeof incoming.createdAt === 'number' ? incoming.createdAt : Date.now(),
      replyToId: typeof incoming.replyToId === 'string' ? incoming.replyToId.slice(0, 80) : undefined,
      reactions: {},
      attachments: Array.isArray(incoming.attachments) ? incoming.attachments.slice(0, 6) : undefined,
      poll: incoming.poll,
      checklist: incoming.checklist,
      sticker: incoming.sticker,
      effect: incoming.effect,
    };

    room.messages.push(cleanMsg);
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
    }
    room.updatedAt = Date.now();
    scheduleSaveRooms();

    broadcastToRoom(code, {
      type: 'message:new',
      roomCode: code,
      message: cleanMsg,
      sender: room.users[cleanMsg.senderId],
    });
    return;
  }

  if (eventType === 'message:edit') {
    const messageId = String(parsed.messageId ?? '');
    const senderId = String(parsed.senderId ?? sub.userId ?? '');
    const content = typeof parsed.content === 'string' ? parsed.content.trim().slice(0, 8000) : '';
    if (!messageId || !content) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== senderId || msg.deleted) return;
    msg.content = content;
    msg.edited = true;
    msg.updatedAt = Date.now();
    room.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
    return;
  }

  if (eventType === 'message:delete') {
    const messageId = String(parsed.messageId ?? '');
    const senderId = String(parsed.senderId ?? sub.userId ?? '');
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== senderId) return;
    msg.deleted = true;
    msg.pinned = false;
    msg.content = '';
    msg.attachments = undefined;
    msg.poll = undefined;
    msg.checklist = undefined;
    msg.sticker = undefined;
    msg.updatedAt = Date.now();
    room.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
    return;
  }

  if (eventType === 'message:pin') {
    const messageId = String(parsed.messageId ?? '');
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || msg.deleted) return;
    msg.pinned = !msg.pinned;
    msg.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
    return;
  }

  if (eventType === 'message:react') {
    const messageId = String(parsed.messageId ?? '');
    const emoji = String(parsed.emoji ?? '').slice(0, 16);
    const userId = String(parsed.userId ?? sub.userId ?? '');
    if (!messageId || !emoji || !userId) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || msg.deleted) return;
    const current = msg.reactions[emoji] ?? [];
    const nextList = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    if (nextList.length === 0) {
      delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = nextList;
    }
    msg.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
    return;
  }

  if (eventType === 'poll:vote') {
    const messageId = String(parsed.messageId ?? '');
    const optionId = String(parsed.optionId ?? '');
    const userId = String(parsed.userId ?? sub.userId ?? '');
    if (!messageId || !optionId || !userId) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || !msg.poll) return;

    msg.poll.options = msg.poll.options.map((opt) => {
      const hasVoted = opt.voterIds.includes(userId);
      if (opt.id === optionId) {
        return {
          ...opt,
          voterIds: hasVoted
            ? opt.voterIds.filter((id) => id !== userId)
            : [...opt.voterIds, userId],
        };
      }
      if (!msg.poll!.allowMultiple && hasVoted) {
        return {
          ...opt,
          voterIds: opt.voterIds.filter((id) => id !== userId),
        };
      }
      return opt;
    });
    msg.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
    return;
  }

  if (eventType === 'checklist:toggle') {
    const messageId = String(parsed.messageId ?? '');
    const itemId = String(parsed.itemId ?? '');
    if (!messageId || !itemId) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || !msg.checklist) return;
    msg.checklist.items = msg.checklist.items.map((item) =>
      item.id === itemId ? {...item, done: !item.done} : item,
    );
    msg.updatedAt = Date.now();
    scheduleSaveRooms();
    broadcastToRoom(code, {type: 'message:updated', roomCode: code, message: msg});
  }
}

async function startServer(): Promise<void> {
  await loadRoomsFromDisk();

  const app = express();
  app.use(express.json({limit: '4mb'}));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Naan-Live-Server', '1');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method === 'HEAD' && (req.path === '/' || req.path === '/api/health')) {
      res.status(200).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      roomsCount: rooms.size,
      activeClients: clientSubs.size,
    });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code);
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({exists: false});
      return;
    }
    res.json({
      exists: true,
      code: room.code,
      name: room.name,
      participantsCount: Object.keys(room.users).length,
      onlineCount: getOnlineUserIds(code).length,
      messagesCount: room.messages.length,
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({server: httpServer, path: '/ws'});

  wss.on('connection', (ws) => {
    const sub: ClientSubscription = {ws, userId: '', rooms: new Set()};
    clientSubs.set(ws, sub);

    ws.on('message', (data) => {
      handleClientEvent(sub, data.toString());
    });

    ws.on('close', () => {
      clientSubs.delete(ws);
      for (const code of sub.rooms) {
        const set = roomSockets.get(code);
        if (set) {
          set.delete(sub);
          if (set.size === 0) roomSockets.delete(code);
        }
        const room = rooms.get(code);
        if (room) {
          broadcastToRoom(code, {
            type: 'room:presence',
            roomCode: code,
            users: Object.values(room.users),
            onlineUserIds: getOnlineUserIds(code),
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true, hmr: false},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Naan server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
