import type {
  ChatWorkspaceState,
  CrossTabEvent,
  SyncPacket,
} from '../types/chat';
import {fromBase64Url, toBase64Url} from './chatLogic';

const DB_NAME = 'naan_chat_db_v3';
const STORE_NAME = 'workspace';
const DB_KEY = 'state';
const LS_FALLBACK_KEY = 'naan_chat_state_v3';
const SESSION_USER_KEY = 'naan_tab_current_user_v3';
const SESSION_ACTIVE_CONV_KEY = 'naan_tab_active_conv_v3';
const CHANNEL_NAME = 'naan_chat_realtime_v3';

export const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open error'));
  });
}

export async function loadPersistedState(): Promise<ChatWorkspaceState | null> {
  let state: ChatWorkspaceState | null = null;

  try {
    const db = await openDatabase();
    state = await new Promise<ChatWorkspaceState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DB_KEY);
      req.onsuccess = () => resolve((req.result as ChatWorkspaceState | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage below
  }

  if (!state) {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) {
        state = JSON.parse(raw) as ChatWorkspaceState;
      }
    } catch {
      state = null;
    }
  }

  if (!state) return null;

  try {
    const tabUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (tabUser && state.users.some((u) => u.id === tabUser)) {
      state = {...state, currentUserId: tabUser};
    }
    const tabConv = sessionStorage.getItem(SESSION_ACTIVE_CONV_KEY);
    if (tabConv && state.conversations.some((c) => c.id === tabConv)) {
      state = {...state, activeConversationId: tabConv};
    }
  } catch {
    // Ignore sessionStorage restrictions
  }

  return state;
}

export function saveTabPreferences(currentUserId: string, activeConversationId: string): void {
  try {
    sessionStorage.setItem(SESSION_USER_KEY, currentUserId);
    sessionStorage.setItem(SESSION_ACTIVE_CONV_KEY, activeConversationId);
  } catch {
    // Ignore
  }
}

export async function savePersistedState(state: ChatWorkspaceState): Promise<void> {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or restricted storage
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable; localStorage already written
  }
}

export function createRealtimeChannel(onEvent: (event: CrossTabEvent) => void) {
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev: MessageEvent<CrossTabEvent>) => {
      if (ev.data && ev.data.tabId !== TAB_ID) {
        onEvent(ev.data);
      }
    };
  }

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === 'brisa_broadcast_relay' && ev.newValue) {
      try {
        const parsed = JSON.parse(ev.newValue) as CrossTabEvent;
        if (parsed && parsed.tabId !== TAB_ID) {
          onEvent(parsed);
        }
      } catch {
        // Ignore malformed relay event
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  const post = (event: CrossTabEvent) => {
    try {
      bc?.postMessage(event);
    } catch {
      // Ignore
    }
    try {
      localStorage.setItem('brisa_broadcast_relay', JSON.stringify(event));
    } catch {
      // Ignore
    }
  };

  const close = () => {
    bc?.close();
    window.removeEventListener('storage', handleStorage);
  };

  return {post, close};
}

export function buildSyncPacket(state: ChatWorkspaceState, conversationId?: string): SyncPacket {
  const conversations = conversationId
    ? state.conversations.filter((c) => c.id === conversationId)
    : state.conversations;
  const convIds = new Set(conversations.map((c) => c.id));
  const messages = state.messages.filter((m) => convIds.has(m.conversationId));

  return {
    version: 1,
    exportedAt: Date.now(),
    users: state.users,
    conversations,
    messages,
  };
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSyncPacket(packet: SyncPacket, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(packet));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, plaintext),
  );

  const payload = {
    enc: 1,
    s: toBase64Url(String.fromCharCode(...salt)),
    i: toBase64Url(String.fromCharCode(...iv)),
    d: toBase64Url(
      Array.from(ciphertext)
        .map((b) => String.fromCharCode(b))
        .join(''),
    ),
  };
  return `ENC1.${toBase64Url(JSON.stringify(payload))}`;
}

export async function decryptSyncPacket(token: string, passphrase: string): Promise<SyncPacket> {
  const clean = token.trim().replace(/^#?sync=/, '');
  if (!clean.startsWith('ENC1.')) {
    throw new Error('Aquest paquet no està xifrat amb ENC1.');
  }
  const rawJson = fromBase64Url(clean.slice(5));
  const parsed = JSON.parse(rawJson) as {enc: number; s: string; i: string; d: string};

  const toBytes = (b64: string) => {
    const str = fromBase64Url(b64);
    const out = new Uint8Array(str.length);
    for (let k = 0; k < str.length; k += 1) out[k] = str.charCodeAt(k);
    return out;
  };

  const salt = toBytes(parsed.s);
  const iv = toBytes(parsed.i);
  const data = toBytes(parsed.d);
  const key = await deriveAesKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, data);
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as SyncPacket;
}
