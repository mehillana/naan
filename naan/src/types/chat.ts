export type ThemeMode = 'light' | 'dark';

export type ThemePresetId =
  | 'aurora'
  | 'sunset'
  | 'obsidian'
  | 'emerald'
  | 'berry'
  | 'minimal';

export type LanguageCode = 'ca' | 'es' | 'en' | 'pt' | 'de' | 'zh' | 'ar';

export type ConversationType = 'channel' | 'dm' | 'notes';

export type ConversationFilterTab = 'all' | 'unread' | 'channel' | 'dm';

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  color: string;
  starred?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface Poll {
  id: string;
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface MessageSticker {
  id: string;
  emoji: string;
  label: string;
  gradient: string;
}

export type MessageEffect = 'confetti' | 'sparkle' | 'pulse';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  edited?: boolean;
  deleted?: boolean;
  replyToId?: string;
  forwardedFrom?: string;
  reactions: Record<string, string[]>;
  attachments?: Attachment[];
  poll?: Poll;
  checklist?: Checklist;
  sticker?: MessageSticker;
  effect?: MessageEffect;
  pinned?: boolean;
  starred?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  description: string;
  color: string;
  participantIds: string[];
  pinned?: boolean;
  muted?: boolean;
  unreadCount: number;
  draft?: string;
  updatedAt: number;
  roomCode?: string;
  isLiveRoom?: boolean;
}

export type LiveConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type LiveTransportMode = 'server' | 'relay';

export interface ServerRoomSnapshot {
  code: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  users: Record<string, UserProfile>;
  messages: Message[];
}

export type LiveServerEvent =
  | {type: 'room:state'; room: ServerRoomSnapshot; onlineUserIds: string[]}
  | {
      type: 'room:presence';
      roomCode: string;
      users: UserProfile[];
      onlineUserIds: string[];
    }
  | {type: 'message:new'; roomCode: string; message: Message; sender?: UserProfile}
  | {type: 'message:updated'; roomCode: string; message: Message}
  | {
      type: 'typing:state';
      roomCode: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }
  | {type: 'pong'; ts: number}
  | {type: 'error'; message: string};

export interface ChatWorkspaceState {
  version: number;
  currentUserId: string;
  activeConversationId: string;
  theme: ThemeMode;
  themePreset?: ThemePresetId;
  language?: LanguageCode;
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
}

export interface SyncPacket {
  version: 1;
  exportedAt: number;
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
}

export interface TypingEvent {
  type: 'typing';
  tabId: string;
  userId: string;
  userName: string;
  conversationId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface SyncBroadcastEvent {
  type: 'state-sync';
  tabId: string;
  timestamp: number;
  packet: SyncPacket;
}

export interface PresenceEvent {
  type: 'presence';
  tabId: string;
  userId: string;
  timestamp: number;
}

export type CrossTabEvent = TypingEvent | SyncBroadcastEvent | PresenceEvent;
