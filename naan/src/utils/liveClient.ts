import type {
  LiveConnectionStatus,
  LiveServerEvent,
  LiveTransportMode,
  UserProfile,
} from '../types/chat';
import {MqttRelayTransport} from './mqttRelay';

const CUSTOM_WS_URL_KEY = 'naan_custom_ws_url_v1';
const LIVE_MODE_PREF_KEY = 'naan_live_mode_pref_v1';

export type LiveModePreference = 'auto' | 'relay';

export function getSavedLiveModePreference(): LiveModePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('relay') === '1') return 'relay';
    const raw = localStorage.getItem(LIVE_MODE_PREF_KEY);
    return raw === 'relay' ? 'relay' : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveLiveModePreference(pref: LiveModePreference): void {
  if (typeof window === 'undefined') return;
  try {
    if (pref === 'relay') {
      localStorage.setItem(LIVE_MODE_PREF_KEY, 'relay');
    } else {
      localStorage.removeItem(LIVE_MODE_PREF_KEY);
    }
  } catch {
    // Ignore
  }
}

export function isKnownStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.gitlab.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.vercel.app')
  );
}

export function getDefaultWebSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const custom = localStorage.getItem(CUSTOM_WS_URL_KEY)?.trim();
    if (custom) return toWebSocketUrl(custom);
  } catch {
    // Ignore storage access failure
  }
  if (isKnownStaticHost()) return '';
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${window.location.host}/ws`;
}

export function getSavedCustomServerUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CUSTOM_WS_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveCustomServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(CUSTOM_WS_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_WS_URL_KEY);
    }
  } catch {
    // Ignore
  }
}

export function toWebSocketUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed.endsWith('/ws') ? trimmed : `${trimmed.replace(/\/+$/, '')}/ws`;
  }
  const normalized = trimmed.replace(/^https?:\/\//i, (m) =>
    m.toLowerCase() === 'https://' ? 'wss://' : 'ws://',
  );
  const withProto = normalized.startsWith('ws') ? normalized : `wss://${normalized}`;
  return withProto.endsWith('/ws') ? withProto : `${withProto.replace(/\/+$/, '')}/ws`;
}

interface JoinedRoomEntry {
  roomCode: string;
  roomName?: string;
  roomDescription?: string;
  user: UserProfile;
}

export class NaanLiveClient {
  private ws: WebSocket | null = null;
  private relay: MqttRelayTransport | null = null;
  private transportMode: LiveTransportMode = 'server';
  private status: LiveConnectionStatus = 'disconnected';
  private serverEverOpened = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private connectTimeoutTimer: number | null = null;
  private probingServerPromise: Promise<boolean> | null = null;
  private destroyed = false;

  private joinedRooms = new Map<string, JoinedRoomEntry>();
  private eventListeners = new Set<(ev: LiveServerEvent) => void>();
  private statusListeners = new Set<(status: LiveConnectionStatus) => void>();
  private transportListeners = new Set<(mode: LiveTransportMode) => void>();

  getStatus(): LiveConnectionStatus {
    return this.status;
  }

  getTransportMode(): LiveTransportMode {
    return this.transportMode;
  }

  onEvent(cb: (ev: LiveServerEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  onStatusChange(cb: (status: LiveConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  onTransportChange(cb: (mode: LiveTransportMode) => void): () => void {
    this.transportListeners.add(cb);
    return () => this.transportListeners.delete(cb);
  }

  private emitEvent(ev: LiveServerEvent): void {
    for (const cb of this.eventListeners) {
      cb(ev);
    }
  }

  private setStatus(next: LiveConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const cb of this.statusListeners) {
      cb(next);
    }
  }

  private setTransportMode(next: LiveTransportMode): void {
    if (this.transportMode === next) return;
    this.transportMode = next;
    for (const cb of this.transportListeners) {
      cb(next);
    }
  }

  private shouldUseRelayImmediately(): boolean {
    const custom = getSavedCustomServerUrl().trim();
    if (custom) return false;
    if (getSavedLiveModePreference() === 'relay') return true;
    return !getDefaultWebSocketUrl();
  }

  private probeSameOriginServer(): Promise<boolean> {
    if (this.probingServerPromise) return this.probingServerPromise;
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      return Promise.resolve(false);
    }
    const run = (async (): Promise<boolean> => {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 1400);
      try {
        const probeUrl = `${window.location.origin}${window.location.pathname || '/'}`;
        const res = await fetch(probeUrl, {
          method: 'HEAD',
          cache: 'no-store',
          signal: ctrl.signal,
        });
        return res.ok && res.headers.get('x-naan-live-server') === '1';
      } catch {
        return false;
      } finally {
        window.clearTimeout(timer);
        this.probingServerPromise = null;
      }
    })();
    this.probingServerPromise = run;
    return run;
  }

  private activateRelay(): void {
    if (this.destroyed) return;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimeoutTimer) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.setTransportMode('relay');
    if (!this.relay) {
      this.relay = new MqttRelayTransport(
        (ev) => this.emitEvent(ev),
        (status) => this.setStatus(status),
      );
    }

    for (const entry of this.joinedRooms.values()) {
      this.relay.joinRoom(entry);
    }
    if (this.joinedRooms.size > 0) {
      this.relay.connect();
    }
  }

  connect(): void {
    void this.connectAsync();
  }

  private async connectAsync(): Promise<void> {
    if (this.destroyed) return;

    if (this.shouldUseRelayImmediately() || this.relay) {
      this.activateRelay();
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = getDefaultWebSocketUrl();
    if (!url) {
      this.activateRelay();
      return;
    }

    const hasCustom = Boolean(getSavedCustomServerUrl().trim());
    if (!hasCustom && !this.serverEverOpened) {
      this.setStatus('connecting');
      const serverAlive = await this.probeSameOriginServer();
      if (this.destroyed || this.relay) return;
      if (!serverAlive) {
        this.activateRelay();
        return;
      }
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }
    }

    this.setTransportMode('server');
    this.setStatus('connecting');
    let openedThisSocket = false;

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      if (this.connectTimeoutTimer) window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = window.setTimeout(() => {
        if (!openedThisSocket && !this.serverEverOpened && this.ws === socket) {
          socket.close();
        }
      }, 1800);

      socket.onopen = () => {
        if (this.destroyed) {
          socket.close();
          return;
        }
        openedThisSocket = true;
        this.serverEverOpened = true;
        if (this.connectTimeoutTimer) {
          window.clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        this.reconnectAttempts = 0;
        this.setStatus('connected');

        for (const entry of this.joinedRooms.values()) {
          this.rawSend({
            type: 'room:join',
            roomCode: entry.roomCode,
            roomName: entry.roomName,
            roomDescription: entry.roomDescription,
            user: entry.user,
          });
        }

        if (this.pingTimer) window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => {
          this.rawSend({type: 'ping'});
        }, 25_000);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as LiveServerEvent;
          this.emitEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onerror = () => {
        // Error handler delegates cleanup to onclose
      };

      socket.onclose = () => {
        if (this.connectTimeoutTimer) {
          window.clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        if (this.pingTimer) {
          window.clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.ws = null;
        if (this.destroyed) {
          this.setStatus('disconnected');
          return;
        }

        // If /ws never worked (e.g. static host without Node backend) & no custom server URL, switch to Encrypted Relay!
        const hasCustom = Boolean(getSavedCustomServerUrl().trim());
        if (!openedThisSocket && !this.serverEverOpened && !hasCustom) {
          this.activateRelay();
          return;
        }

        this.setStatus('disconnected');
        if (this.joinedRooms.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch {
      const hasCustom = Boolean(getSavedCustomServerUrl().trim());
      if (!this.serverEverOpened && !hasCustom) {
        this.activateRelay();
        return;
      }
      this.setStatus('disconnected');
      if (this.joinedRooms.size > 0) {
        this.scheduleReconnect();
      }
    }
  }

  reconnectWithNewUrl(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimeoutTimer) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    this.reconnectAttempts = 0;
    this.serverEverOpened = false;
    if (this.relay) {
      this.relay.destroy();
      this.relay = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.destroyed) return;
    const delay = Math.min(1000 * Math.pow(1.6, this.reconnectAttempts), 10_000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private rawSend(payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  joinRoom(entry: JoinedRoomEntry): void {
    const prev = this.joinedRooms.get(entry.roomCode);
    const merged: JoinedRoomEntry = {
      roomCode: entry.roomCode,
      roomName: entry.roomName ?? prev?.roomName,
      roomDescription: entry.roomDescription ?? prev?.roomDescription,
      user: entry.user,
    };
    this.joinedRooms.set(entry.roomCode, merged);
    this.connect();
    if (this.relay) {
      this.relay.joinRoom(merged);
      return;
    }
    this.rawSend({
      type: 'room:join',
      roomCode: merged.roomCode,
      roomName: merged.roomName,
      roomDescription: merged.roomDescription,
      user: merged.user,
    });
  }

  leaveRoom(roomCode: string, userId: string): void {
    this.joinedRooms.delete(roomCode);
    if (this.relay) {
      this.relay.leaveRoom(roomCode, userId);
      return;
    }
    this.rawSend({type: 'room:leave', roomCode, userId});
  }

  send(payload: Record<string, unknown>): boolean {
    if (this.relay) {
      return this.relay.send(payload);
    }
    return this.rawSend(payload);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.connectTimeoutTimer) window.clearTimeout(this.connectTimeoutTimer);
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    this.relay?.destroy();
    this.relay = null;
    this.joinedRooms.clear();
    this.eventListeners.clear();
    this.statusListeners.clear();
    this.transportListeners.clear();
  }
}
