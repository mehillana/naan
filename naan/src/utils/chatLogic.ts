import type {
  ChatWorkspaceState,
  Conversation,
  ConversationFilterTab,
  Message,
  SyncPacket,
  UserProfile,
} from '../types/chat';

export type InlineToken =
  | {type: 'text'; value: string}
  | {type: 'bold'; value: string}
  | {type: 'italic'; value: string}
  | {type: 'strike'; value: string}
  | {type: 'code'; value: string}
  | {type: 'link'; label: string; href: string};

export type MarkdownBlock =
  | {type: 'codeblock'; lang: string; code: string}
  | {type: 'quote'; lines: string[]}
  | {type: 'paragraph'; text: string};

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeHandle(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]/g, '');
  return cleaned ? `@${cleaned}` : '';
}

export function filterContacts(
  users: UserProfile[],
  currentUserId: string,
  query: string,
): UserProfile[] {
  const q = query.trim().toLowerCase();
  return users
    .filter((u) => u.id !== currentUserId)
    .filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.handle.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

export function addContactToState(
  state: ChatWorkspaceState,
  input: {name: string; handle: string; customId?: string; role?: string; color?: string},
): {state: ChatWorkspaceState; contact: UserProfile} {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('El nom del contacte és obligatori.');
  }

  const normalizedHandle = normalizeHandle(input.handle || trimmedName);
  if (!normalizedHandle) {
    throw new Error("Cal un nom d'usuari vàlid.");
  }

  const requestedId = input.customId?.trim();
  const id = requestedId || createId('u');

  if (state.users.some((u) => u.id.toLowerCase() === id.toLowerCase())) {
    throw new Error(`Ja existeix un contacte amb l'ID «${id}».`);
  }
  if (state.users.some((u) => u.handle.toLowerCase() === normalizedHandle.toLowerCase())) {
    throw new Error(`Ja existeix un contacte amb l'usuari «${normalizedHandle}».`);
  }

  const palette = ['#2563EB', '#0D9488', '#7C3AED', '#D97706', '#DC2626', '#059669'];
  const color = input.color || palette[state.users.length % palette.length];

  const contact: UserProfile = {
    id,
    name: trimmedName,
    handle: normalizedHandle,
    role: input.role?.trim() || 'Contacte extern',
    color,
  };

  return {
    contact,
    state: {
      ...state,
      users: [...state.users, contact],
    },
  };
}

export function removeContactFromState(
  state: ChatWorkspaceState,
  contactId: string,
): ChatWorkspaceState {
  if (contactId === state.currentUserId) {
    throw new Error('No pots eliminar el perfil actiu en aquesta pestanya.');
  }

  const nextUsers = state.users.filter((u) => u.id !== contactId);
  const nextConversations = state.conversations
    .filter((c) => !(c.type === 'dm' && c.participantIds.includes(contactId)))
    .map((c) => ({
      ...c,
      participantIds: c.participantIds.filter((id) => id !== contactId),
    }));

  const activeStillExists = nextConversations.some(
    (c) => c.id === state.activeConversationId,
  );
  const nextActiveId = activeStillExists
    ? state.activeConversationId
    : nextConversations[0]?.id ?? '';

  return {
    ...state,
    users: nextUsers,
    conversations: nextConversations,
    activeConversationId: nextActiveId,
  };
}

export function getInitials(name: string): string {
  const parts = name
    .trim()
    .replace(/^#/, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatTimeShort(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ca-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDayLabel(timestamp: number, now = Date.now()): string {
  const target = new Date(timestamp);
  const current = new Date(now);
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86_400_000);

  if (diffDays === 0) return 'Avui';
  if (diffDays === 1) return 'Ahir';
  return target.toLocaleDateString('ca-ES', {
    day: 'numeric',
    month: 'short',
    year: target.getFullYear() !== current.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function stripMarkdownForPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [codi] ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern =
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|https?:\/\/[^\s<>()]+(?:\([^\s<>()]*\)[^\s<>()]*)?)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({type: 'text', value: text.slice(lastIndex, match.index)});
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`') && raw.length >= 2) {
      tokens.push({type: 'code', value: raw.slice(1, -1)});
    } else if (raw.startsWith('**') && raw.endsWith('**') && raw.length >= 4) {
      tokens.push({type: 'bold', value: raw.slice(2, -2)});
    } else if (raw.startsWith('*') && raw.endsWith('*') && raw.length >= 2) {
      tokens.push({type: 'italic', value: raw.slice(1, -1)});
    } else if (raw.startsWith('~~') && raw.endsWith('~~') && raw.length >= 4) {
      tokens.push({type: 'strike', value: raw.slice(2, -2)});
    } else if (isSafeHttpUrl(raw)) {
      tokens.push({type: 'link', label: raw, href: raw});
    } else {
      tokens.push({type: 'text', value: raw});
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({type: 'text', value: text.slice(lastIndex)});
  }

  return tokens;
}

export function parseMarkdownBlocks(input: string): MarkdownBlock[] {
  const normalized = input.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({type: 'paragraph', text: paragraphLines.join('\n')});
      paragraphLines = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({type: 'codeblock', lang, code: codeLines.join('\n')});
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith('> ')) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quoteLines.push(lines[i].trimStart().slice(2));
        i += 1;
      }
      blocks.push({type: 'quote', lines: quoteLines});
      continue;
    }

    paragraphLines.push(line);
    i += 1;
  }

  flushParagraph();
  return blocks;
}

export function toggleMessageReaction(
  message: Message,
  emoji: string,
  userId: string,
): Message {
  const existing = message.reactions[emoji] ?? [];
  const hasReacted = existing.includes(userId);
  const nextUsers = hasReacted
    ? existing.filter((id) => id !== userId)
    : [...existing, userId];

  const nextReactions: Record<string, string[]> = {...message.reactions};
  if (nextUsers.length === 0) {
    delete nextReactions[emoji];
  } else {
    nextReactions[emoji] = nextUsers;
  }

  return {
    ...message,
    reactions: nextReactions,
    updatedAt: Date.now(),
  };
}

export function voteInPoll(message: Message, optionId: string, userId: string): Message {
  if (!message.poll) return message;

  const {allowMultiple, options} = message.poll;
  const nextOptions = options.map((opt) => {
    const votedHere = opt.voterIds.includes(userId);
    if (opt.id === optionId) {
      return {
        ...opt,
        voterIds: votedHere
          ? opt.voterIds.filter((id) => id !== userId)
          : [...opt.voterIds, userId],
      };
    }
    if (!allowMultiple && votedHere) {
      return {
        ...opt,
        voterIds: opt.voterIds.filter((id) => id !== userId),
      };
    }
    return opt;
  });

  return {
    ...message,
    poll: {
      ...message.poll,
      options: nextOptions,
    },
    updatedAt: Date.now(),
  };
}

export function toggleChecklistItem(message: Message, itemId: string): Message {
  if (!message.checklist) return message;
  return {
    ...message,
    checklist: {
      ...message.checklist,
      items: message.checklist.items.map((item) =>
        item.id === itemId ? {...item, done: !item.done} : item,
      ),
    },
    updatedAt: Date.now(),
  };
}

export function toggleStarContact(
  state: ChatWorkspaceState,
  contactId: string,
): ChatWorkspaceState {
  return {
    ...state,
    users: state.users.map((u) =>
      u.id === contactId ? {...u, starred: !u.starred} : u,
    ),
  };
}

export function toggleStarMessage(message: Message): Message {
  return {
    ...message,
    starred: !message.starred,
    updatedAt: Date.now(),
  };
}

export function updateCurrentUserProfile(
  state: ChatWorkspaceState,
  input: {name: string; handle: string; role: string; color: string},
): ChatWorkspaceState {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('El nom és obligatori.');
  }
  const normalizedHandle = normalizeHandle(input.handle || trimmedName);
  if (!normalizedHandle) {
    throw new Error("Cal un nom d'usuari vàlid.");
  }
  if (
    state.users.some(
      (u) =>
        u.id !== state.currentUserId &&
        u.handle.toLowerCase() === normalizedHandle.toLowerCase(),
    )
  ) {
    throw new Error(`Ja existeix un contacte amb l'usuari «${normalizedHandle}».`);
  }

  return {
    ...state,
    users: state.users.map((u) =>
      u.id === state.currentUserId
        ? {
            ...u,
            name: trimmedName,
            handle: normalizedHandle,
            role: input.role.trim() || 'Naan Local',
            color: input.color || u.color,
          }
        : u,
    ),
  };
}

export function deleteConversationFromState(
  state: ChatWorkspaceState,
  conversationId: string,
): ChatWorkspaceState {
  const nextConversations = state.conversations.filter((c) => c.id !== conversationId);
  const nextMessages = state.messages.filter((m) => m.conversationId !== conversationId);
  const nextActiveId =
    state.activeConversationId === conversationId
      ? nextConversations[0]?.id ?? ''
      : state.activeConversationId;

  return {
    ...state,
    conversations: nextConversations,
    messages: nextMessages,
    activeConversationId: nextActiveId,
  };
}

export function renameConversationInState(
  state: ChatWorkspaceState,
  conversationId: string,
  name: string,
  description: string,
): ChatWorkspaceState {
  const trimmedName = name.trim();
  if (!trimmedName) return state;
  return {
    ...state,
    conversations: state.conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            name: c.type === 'channel' && !trimmedName.startsWith('#') ? `#${trimmedName}` : trimmedName,
            description: description.trim() || c.description,
            updatedAt: Date.now(),
          }
        : c,
    ),
  };
}

export function mergeSyncPacket(
  current: ChatWorkspaceState,
  packet: SyncPacket,
  options?: {incrementUnreadForOtherUsers?: boolean},
): ChatWorkspaceState {
  const userMap = new Map<string, UserProfile>();
  for (const u of current.users) userMap.set(u.id, u);
  for (const u of packet.users) {
    if (!userMap.has(u.id)) {
      userMap.set(u.id, u);
    }
  }

  const msgMap = new Map<string, Message>();
  for (const m of current.messages) {
    msgMap.set(m.id, m);
  }

  let newIncomingConversationIds = new Set<string>();

  for (const incoming of packet.messages) {
    const existing = msgMap.get(incoming.id);
    if (!existing) {
      msgMap.set(incoming.id, incoming);
      if (incoming.senderId !== current.currentUserId) {
        newIncomingConversationIds.add(incoming.conversationId);
      }
    } else {
      const existingStamp = existing.updatedAt ?? existing.createdAt;
      const incomingStamp = incoming.updatedAt ?? incoming.createdAt;
      if (incomingStamp >= existingStamp) {
        msgMap.set(incoming.id, incoming);
      }
    }
  }

  const mergedMessages = Array.from(msgMap.values()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  const convMap = new Map<string, Conversation>();
  for (const c of current.conversations) {
    convMap.set(c.id, c);
  }
  for (const c of packet.conversations) {
    const existing = convMap.get(c.id);
    if (!existing) {
      convMap.set(c.id, {
        ...c,
        unreadCount:
          options?.incrementUnreadForOtherUsers && c.id !== current.activeConversationId
            ? Math.max(1, c.unreadCount)
            : 0,
      });
    } else {
      const bumpUnread =
        options?.incrementUnreadForOtherUsers &&
        newIncomingConversationIds.has(c.id) &&
        c.id !== current.activeConversationId
          ? 1
          : 0;

      convMap.set(c.id, {
        ...existing,
        name: c.updatedAt > existing.updatedAt ? c.name : existing.name,
        description: c.updatedAt > existing.updatedAt ? c.description : existing.description,
        participantIds: Array.from(
          new Set([...existing.participantIds, ...c.participantIds]),
        ),
        updatedAt: Math.max(existing.updatedAt, c.updatedAt),
        unreadCount: existing.unreadCount + bumpUnread,
      });
    }
  }

  const mergedConversations = Array.from(convMap.values()).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  return {
    ...current,
    users: Array.from(userMap.values()),
    conversations: mergedConversations,
    messages: mergedMessages,
  };
}

export function filterConversations(
  conversations: Conversation[],
  messages: Message[],
  query: string,
  tab: ConversationFilterTab,
): Conversation[] {
  const q = query.trim().toLowerCase();

  return conversations
    .filter((conv) => {
      if (tab === 'unread' && conv.unreadCount <= 0) return false;
      if (tab === 'channel' && conv.type !== 'channel') return false;
      if (tab === 'dm' && conv.type !== 'dm' && conv.type !== 'notes') return false;

      if (!q) return true;
      if (conv.name.toLowerCase().includes(q)) return true;
      if (conv.description.toLowerCase().includes(q)) return true;

      return messages.some(
        (m) =>
          m.conversationId === conv.id &&
          !m.deleted &&
          m.content.toLowerCase().includes(q),
      );
    })
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

export function getLastMessageForConversation(
  messages: Message[],
  conversationId: string,
): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].conversationId === conversationId) {
      return messages[i];
    }
  }
  return undefined;
}

export function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSyncPacket(packet: SyncPacket): string {
  return toBase64Url(JSON.stringify(packet));
}

export function decodeSyncPacket(encoded: string): SyncPacket {
  const trimmed = encoded.trim().replace(/^#?sync=/, '');
  const json = fromBase64Url(trimmed);
  const parsed = JSON.parse(json) as Partial<SyncPacket>;
  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.conversations) ||
    !Array.isArray(parsed.messages) ||
    !Array.isArray(parsed.users)
  ) {
    throw new Error('Format de paquet de sincronització no vàlid');
  }
  return parsed as SyncPacket;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateStandaloneArchiveHtml(
  conversation: Conversation,
  messages: Message[],
  users: UserProfile[],
): string {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const convMessages = messages
    .filter((m) => m.conversationId === conversation.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  const rows = convMessages
    .map((m) => {
      const author = userMap.get(m.senderId)?.name ?? 'Usuari desconegut';
      const time = new Date(m.createdAt).toLocaleString('ca-ES');
      const body = m.deleted
        ? '<em>Missatge suprimit</em>'
        : escapeHtml(m.content).replace(/\n/g, '<br/>');
      return `<article class="msg"><header><strong>${escapeHtml(author)}</strong> <time>${escapeHtml(time)}</time></header><p>${body}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Arxiu de xat — ${escapeHtml(conversation.name)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 2rem 1rem; }
  main { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; }
  h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
  .desc { color: #64748b; margin: 0 0 1.5rem; font-size: 0.9rem; }
  .msg { border-top: 1px solid #f1f5f9; padding: 0.9rem 0; }
  .msg header { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem; }
  .msg time { color: #64748b; font-variant-numeric: tabular-nums; }
  .msg p { margin: 0; line-height: 1.55; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(conversation.name)}</h1>
  <p class="desc">${escapeHtml(conversation.description)} · Exportat el ${escapeHtml(new Date().toLocaleString('ca-ES'))}</p>
  ${rows || '<p>Aquesta conversa encara no té missatges.</p>'}
</main>
</body>
</html>`;
}

export function normalizeRoomCode(input: string): string {
  const cleaned = input.trim().replace(/^.*room=/i, '');
  return cleaned
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function applyRemoteRoomState(
  state: ChatWorkspaceState,
  room: {
    code: string;
    name: string;
    description: string;
    color: string;
    createdAt: number;
    updatedAt: number;
    users: Record<string, UserProfile>;
    messages: Message[];
  },
  activate = false,
): ChatWorkspaceState {
  const convId = `live_${room.code}`;
  const userMap = new Map(state.users.map((u) => [u.id, u]));
  for (const remoteUser of Object.values(room.users)) {
    if (remoteUser.id !== state.currentUserId) {
      userMap.set(remoteUser.id, remoteUser);
    }
  }

  const participantIds = Array.from(
    new Set([state.currentUserId, ...Object.keys(room.users)]),
  );

  const existingConv = state.conversations.find((c) => c.id === convId);
  const nextConv: Conversation = {
    id: convId,
    type: 'channel',
    name: room.name.startsWith('#') ? room.name : `#${room.name}`,
    description: room.description || `LIVE · ${room.code}`,
    color: room.color || '#2563EB',
    participantIds,
    pinned: existingConv?.pinned,
    muted: existingConv?.muted,
    unreadCount: existingConv?.unreadCount ?? 0,
    draft: existingConv?.draft,
    updatedAt: Math.max(existingConv?.updatedAt ?? 0, room.updatedAt),
    roomCode: room.code,
    isLiveRoom: true,
  };

  const otherConvs = state.conversations.filter((c) => c.id !== convId);
  const nextConvs = [nextConv, ...otherConvs].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const msgMap = new Map<string, Message>();
  for (const m of state.messages) {
    if (m.conversationId === convId) {
      msgMap.set(m.id, m);
    }
  }
  for (const remoteMsg of room.messages) {
    const normalized: Message = {
      ...remoteMsg,
      conversationId: convId,
      starred: msgMap.get(remoteMsg.id)?.starred ?? remoteMsg.starred,
    };
    msgMap.set(remoteMsg.id, normalized);
  }
  const otherMsgs = state.messages.filter((m) => m.conversationId !== convId);
  const roomMsgs = Array.from(msgMap.values()).sort((a, b) => a.createdAt - b.createdAt);

  return {
    ...state,
    activeConversationId: activate ? convId : state.activeConversationId || convId,
    users: Array.from(userMap.values()),
    conversations: nextConvs,
    messages: [...otherMsgs, ...roomMsgs],
  };
}

export function applyRemotePresence(
  state: ChatWorkspaceState,
  roomCode: string,
  users: UserProfile[],
): ChatWorkspaceState {
  const convId = `live_${roomCode}`;
  const userMap = new Map(state.users.map((u) => [u.id, u]));
  for (const remoteUser of users) {
    if (remoteUser.id !== state.currentUserId) {
      userMap.set(remoteUser.id, remoteUser);
    }
  }
  const participantIds = Array.from(
    new Set([state.currentUserId, ...users.map((u) => u.id)]),
  );

  return {
    ...state,
    users: Array.from(userMap.values()),
    conversations: state.conversations.map((c) =>
      c.id === convId ? {...c, participantIds} : c,
    ),
  };
}

export function upsertLiveMessageInState(
  state: ChatWorkspaceState,
  roomCode: string,
  message: Message,
  sender?: UserProfile,
): ChatWorkspaceState {
  const convId = `live_${roomCode}`;
  const normalizedMsg: Message = {
    ...message,
    conversationId: convId,
  };

  const userMap = new Map(state.users.map((u) => [u.id, u]));
  if (sender && sender.id !== state.currentUserId) {
    userMap.set(sender.id, sender);
  }

  let found = false;
  const nextMessages = state.messages.map((m) => {
    if (m.id === normalizedMsg.id) {
      found = true;
      return {...normalizedMsg, starred: m.starred};
    }
    return m;
  });
  if (!found) {
    nextMessages.push(normalizedMsg);
    nextMessages.sort((a, b) => a.createdAt - b.createdAt);
  }

  const isOwnOrActive =
    normalizedMsg.senderId === state.currentUserId ||
    state.activeConversationId === convId;

  return {
    ...state,
    users: Array.from(userMap.values()),
    messages: nextMessages,
    conversations: state.conversations.map((c) =>
      c.id === convId
        ? {
            ...c,
            updatedAt: Math.max(c.updatedAt, normalizedMsg.createdAt),
            unreadCount: isOwnOrActive || found ? c.unreadCount : c.unreadCount + 1,
            participantIds: Array.from(new Set([...c.participantIds, normalizedMsg.senderId])),
          }
        : c,
    ),
  };
}

