import {
  ChevronDown,
  Hash,
  HelpCircle,
  MessageSquarePlus,
  NotebookPen,
  Radio,
  Share2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {CelebrationBurst} from './components/CelebrationBurst';
import {ChatHeader} from './components/ChatHeader';
import {Composer} from './components/Composer';
import {ContactsView} from './components/ContactsView';
import {InspectorDrawer} from './components/InspectorDrawer';
import {LandingView} from './components/LandingView';
import {MessageItem} from './components/MessageItem';
import {
  ChecklistModal,
  HowToChatModal,
  LiveRoomModal,
  NewChatModal,
  PollModal,
  ProfileModal,
  QuickSwitcherModal,
  SketchModal,
  SyncExportModal,
} from './components/Modals';
import {NaanLogo} from './components/NaanLogo';
import {Sidebar} from './components/Sidebar';
import {createSeedWorkspace} from './data/seedData';
import {getLanguageMeta, t} from './i18n/translations';
import {NAAN_THEMES} from './themes/themes';
import type {
  Attachment,
  ChatWorkspaceState,
  Conversation,
  ConversationFilterTab,
  CrossTabEvent,
  LanguageCode,
  LiveConnectionStatus,
  LiveTransportMode,
  Message,
  MessageEffect,
  MessageSticker,
  SyncPacket,
  ThemePresetId,
} from './types/chat';
import {
  addContactToState,
  applyRemotePresence,
  applyRemoteRoomState,
  createId,
  decodeSyncPacket,
  deleteConversationFromState,
  formatDayLabel,
  generateStandaloneArchiveHtml,
  mergeSyncPacket,
  normalizeRoomCode,
  removeContactFromState,
  toggleChecklistItem,
  toggleMessageReaction,
  toggleStarContact,
  toggleStarMessage,
  updateCurrentUserProfile,
  upsertLiveMessageInState,
  voteInPoll,
} from './utils/chatLogic';
import {NaanLiveClient} from './utils/liveClient';
import {
  buildSyncPacket,
  createRealtimeChannel,
  loadPersistedState,
  savePersistedState,
  saveTabPreferences,
  TAB_ID,
} from './utils/storage';

interface RemotePresence {
  userId: string;
  lastSeen: number;
}

interface RemoteTyping {
  userId: string;
  userName: string;
  conversationId: string;
  expiresAt: number;
}

const ENTERED_SESSION_KEY = 'naan_entered_workspace_v2';

export default function App() {
  const [state, setState] = useState<ChatWorkspaceState>(() => createSeedWorkspace());
  const [hydrated, setHydrated] = useState(false);

  const [showLanding, setShowLanding] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('room')) return false;
      if (sessionStorage.getItem(ENTERED_SESSION_KEY) === '1') return false;
    } catch {
      // Ignore
    }
    return true;
  });

  const [activeView, setActiveView] = useState<'chat' | 'contacts'>('chat');
  const [mobileShowMain, setMobileShowMain] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<ConversationFilterTab>('all');

  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const [replyTo, setReplyTo] = useState<Message | undefined>(undefined);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [liveModalTab, setLiveModalTab] = useState<'create' | 'join' | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [sketchModalOpen, setSketchModalOpen] = useState(false);
  const [howToChatOpen, setHowToChatOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<{url: string; name: string} | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [remotePresences, setRemotePresences] = useState<Record<string, RemotePresence>>({});
  const [remoteTyping, setRemoteTyping] = useState<Record<string, RemoteTyping>>({});
  const [liveStatus, setLiveStatus] = useState<LiveConnectionStatus>('disconnected');
  const [liveTransportMode, setLiveTransportMode] = useState<LiveTransportMode>('server');
  const [liveOnlineByRoom, setLiveOnlineByRoom] = useState<Record<string, string[]>>({});

  const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null);
  const liveClientRef = useRef<NaanLiveClient | null>(null);
  const pendingRoomInviteRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const language: LanguageCode = state.language ?? 'ca';
  const themePresetId: ThemePresetId = state.themePreset ?? 'aurora';
  const activeTheme = NAAN_THEMES[themePresetId] ?? NAAN_THEMES.aurora;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const enterWorkspace = useCallback((view: 'chat' | 'contacts' = 'chat') => {
    setShowLanding(false);
    setActiveView(view);
    if (view === 'contacts') setMobileShowMain(true);
    try {
      sessionStorage.setItem(ENTERED_SESSION_KEY, '1');
    } catch {
      // Ignore
    }
  }, []);

  // Load persisted state from IndexedDB/localStorage and inspect #sync= hash
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const saved = await loadPersistedState();
      if (!mounted) return;

      let initial = saved ?? createSeedWorkspace();

      const hash = window.location.hash;
      if (hash.startsWith('#sync=')) {
        const raw = hash.slice(6);
        if (!raw.startsWith('ENC1.')) {
          try {
            const packet = decodeSyncPacket(raw);
            initial = mergeSyncPacket(initial, packet);
            setShowLanding(false);
            showToast('Conversa importada des de l’enllaç #sync.');
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            // Invalid hash ignored
          }
        } else {
          setShowLanding(false);
          setSyncModalOpen(true);
        }
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
          const cleanCode = normalizeRoomCode(roomParam);
          if (cleanCode) {
            pendingRoomInviteRef.current = cleanCode;
            setShowLanding(false);
            setMobileShowMain(true);
          }
        }
      } catch {
        // Ignore URL search parsing error
      }

      setState(initial);
      setHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  // Sync Tailwind dark class + HTML lang/dir (RTL for Arabic)
  useEffect(() => {
    const root = document.documentElement;
    if (activeTheme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const meta = getLanguageMeta(language);
    root.lang = meta.code;
    root.dir = meta.dir;
  }, [activeTheme.mode, language]);

  // Persist workspace state after hydration
  useEffect(() => {
    if (!hydrated) return;
    void savePersistedState(state);
    saveTabPreferences(state.currentUserId, state.activeConversationId);
  }, [state, hydrated]);

  // Live WebSocket client for direct cross-device real-time chat rooms
  useEffect(() => {
    const client = new NaanLiveClient();
    liveClientRef.current = client;

    const unsubStatus = client.onStatusChange((status) => {
      setLiveStatus(status);
    });
    const unsubTransport = client.onTransportChange((mode) => {
      setLiveTransportMode(mode);
    });

    const unsubEvent = client.onEvent((event) => {
      if (event.type === 'room:state') {
        const shouldActivate =
          pendingRoomInviteRef.current === event.room.code;
        if (shouldActivate) {
          pendingRoomInviteRef.current = null;
        }
        setLiveOnlineByRoom((prev) => ({
          ...prev,
          [event.room.code]: event.onlineUserIds,
        }));
        setState((prev) => applyRemoteRoomState(prev, event.room, shouldActivate));
      } else if (event.type === 'room:presence') {
        setLiveOnlineByRoom((prev) => ({
          ...prev,
          [event.roomCode]: event.onlineUserIds,
        }));
        setState((prev) => applyRemotePresence(prev, event.roomCode, event.users));
      } else if (event.type === 'message:new') {
        setState((prev) =>
          upsertLiveMessageInState(prev, event.roomCode, event.message, event.sender),
        );
      } else if (event.type === 'message:updated') {
        setState((prev) =>
          upsertLiveMessageInState(prev, event.roomCode, event.message),
        );
      } else if (event.type === 'typing:state') {
        const key = `ws_${event.roomCode}_${event.userId}`;
        const convId = `live_${event.roomCode}`;
        setRemoteTyping((prev) => {
          if (!event.isTyping) {
            const next = {...prev};
            delete next[key];
            return next;
          }
          return {
            ...prev,
            [key]: {
              userId: event.userId,
              userName: event.userName,
              conversationId: convId,
              expiresAt: Date.now() + 3200,
            },
          };
        });
      } else if (event.type === 'error') {
        showToast(event.message);
      }
    });

    return () => {
      unsubStatus();
      unsubTransport();
      unsubEvent();
      client.destroy();
      liveClientRef.current = null;
    };
  }, [showToast]);

  // Real-time BroadcastChannel & storage-event sync across tabs
  useEffect(() => {
    const channel = createRealtimeChannel((event: CrossTabEvent) => {
      if (event.type === 'state-sync') {
        setState((prev) =>
          mergeSyncPacket(prev, event.packet, {incrementUnreadForOtherUsers: true}),
        );
      } else if (event.type === 'typing') {
        setRemoteTyping((prev) => {
          if (!event.isTyping) {
            const next = {...prev};
            delete next[event.tabId];
            return next;
          }
          return {
            ...prev,
            [event.tabId]: {
              userId: event.userId,
              userName: event.userName,
              conversationId: event.conversationId,
              expiresAt: Date.now() + 3000,
            },
          };
        });
      } else if (event.type === 'presence') {
        setRemotePresences((prev) => ({
          ...prev,
          [event.tabId]: {userId: event.userId, lastSeen: Date.now()},
        }));
      }
    });

    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Heartbeat presence & prune expired typing/presence indicators
  useEffect(() => {
    if (!hydrated) return;

    const sendPresence = () => {
      channelRef.current?.post({
        type: 'presence',
        tabId: TAB_ID,
        userId: state.currentUserId,
        timestamp: Date.now(),
      });
    };

    sendPresence();
    const interval = window.setInterval(() => {
      sendPresence();
      const now = Date.now();
      setRemotePresences((prev) => {
        const next: Record<string, RemotePresence> = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.lastSeen < 10_000) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
      setRemoteTyping((prev) => {
        const next: Record<string, RemoteTyping> = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (v.expiresAt > now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hydrated, state.currentUserId]);

  // Global keyboard shortcuts (Ctrl/Cmd + K and Escape)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSwitcherOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setQuickSwitcherOpen(false);
        setNewChatOpen(false);
        setLiveModalTab(null);
        setPollModalOpen(false);
        setChecklistModalOpen(false);
        setSyncModalOpen(false);
        setProfileModalOpen(false);
        setSketchModalOpen(false);
        setHowToChatOpen(false);
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const broadcastDelta = useCallback(
    (nextState: ChatWorkspaceState, conversationId?: string) => {
      const packet = buildSyncPacket(nextState, conversationId);
      channelRef.current?.post({
        type: 'state-sync',
        tabId: TAB_ID,
        timestamp: Date.now(),
        packet,
      });
    },
    [],
  );

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId],
  );

  const activeConversation = useMemo(
    () =>
      state.conversations.find((c) => c.id === state.activeConversationId) ??
      state.conversations[0],
    [state.conversations, state.activeConversationId],
  );

  const userMap = useMemo(
    () => new Map(state.users.map((u) => [u.id, u])),
    [state.users],
  );

  const activeRemoteUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of Object.values(remotePresences)) {
      if (p.userId !== state.currentUserId) ids.add(p.userId);
    }
    for (const roomUsers of Object.values(liveOnlineByRoom)) {
      for (const uid of roomUsers) {
        if (uid !== state.currentUserId) ids.add(uid);
      }
    }
    return ids;
  }, [remotePresences, liveOnlineByRoom, state.currentUserId]);

  // Auto-join pending ?room= invite and any saved live rooms once hydrated
  useEffect(() => {
    if (!hydrated || !liveClientRef.current || !currentUser) return;
    const liveConvs = state.conversations.filter((c) => c.isLiveRoom && c.roomCode);
    for (const c of liveConvs) {
      liveClientRef.current.joinRoom({
        roomCode: c.roomCode!,
        roomName: c.name.replace(/^#/, ''),
        roomDescription: c.description,
        user: currentUser,
      });
    }
    const pendingCode = pendingRoomInviteRef.current;
    if (pendingCode && !liveConvs.some((c) => c.roomCode === pendingCode)) {
      liveClientRef.current.joinRoom({
        roomCode: pendingCode,
        user: currentUser,
      });
    }
  }, [hydrated, currentUser, state.conversations.length]);

  const conversationMessages = useMemo(() => {
    if (!activeConversation) return [];
    const q = inChatSearchQuery.trim().toLowerCase();
    return state.messages
      .filter((m) => m.conversationId === activeConversation.id)
      .filter((m) => !q || (!m.deleted && m.content.toLowerCase().includes(q)))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [state.messages, activeConversation, inChatSearchQuery]);

  const messageMap = useMemo(
    () => new Map(state.messages.map((m) => [m.id, m])),
    [state.messages],
  );

  const pinnedMessages = useMemo(
    () => conversationMessages.filter((m) => m.pinned && !m.deleted),
    [conversationMessages],
  );

  const typingInActive = useMemo(() => {
    if (!activeConversation) return [];
    return Object.values(remoteTyping)
      .filter(
        (tItem) =>
          tItem.conversationId === activeConversation.id &&
          tItem.userId !== state.currentUserId,
      )
      .map((tItem) => tItem.userName);
  }, [remoteTyping, activeConversation, state.currentUserId]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (!showLanding && activeView === 'chat') {
      scrollToBottom(false);
    }
  }, [activeConversation?.id, activeView, showLanding, scrollToBottom]);

  const handleTimelineScroll = () => {
    const el = timelineRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 180);
  };

  const handleJumpToMessage = useCallback((messageId: string) => {
    const target = document.getElementById(`msg-${messageId}`);
    if (target) {
      target.scrollIntoView({behavior: 'smooth', block: 'center'});
      setHighlightedMessageId(messageId);
      window.setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 2000);
    }
  }, []);

  const handleSelectConversation = (conversationId: string, messageId?: string) => {
    setActiveView('chat');
    setMobileShowMain(true);
    setReplyTo(undefined);
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
    setState((prev) => ({
      ...prev,
      activeConversationId: conversationId,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId ? {...c, unreadCount: 0} : c,
      ),
    }));
    if (messageId) {
      window.setTimeout(() => handleJumpToMessage(messageId), 80);
    }
  };

  const handleSendMessage = (
    content: string,
    attachments: Attachment[],
    options?: {sticker?: MessageSticker; effect?: MessageEffect},
  ) => {
    if (!activeConversation) return;
    const now = Date.now();
    const newMessage: Message = {
      id: createId('m'),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      content,
      createdAt: now,
      replyToId: replyTo?.id,
      reactions: {},
      attachments: attachments.length > 0 ? attachments : undefined,
      sticker: options?.sticker,
      effect: options?.effect,
    };

    if (options?.effect === 'confetti') {
      setBurstKey((k) => k + 1);
    }

    if (activeConversation.isLiveRoom && activeConversation.roomCode) {
      liveClientRef.current?.send({
        type: 'message:send',
        roomCode: activeConversation.roomCode,
        message: newMessage,
        user: currentUser,
      });
    }

    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        messages: [...prev.messages, newMessage],
        conversations: prev.conversations.map((c) =>
          c.id === activeConversation.id
            ? {...c, draft: '', updatedAt: now, unreadCount: 0}
            : c,
        ),
      };
      broadcastDelta(next, activeConversation.id);
      return next;
    });

    setReplyTo(undefined);
    window.setTimeout(() => scrollToBottom(true), 30);
  };

  const handleCreatePoll = (question: string, options: string[], allowMultiple: boolean) => {
    if (!activeConversation) return;
    const now = Date.now();
    const newMessage: Message = {
      id: createId('m'),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      content: question,
      createdAt: now,
      reactions: {},
      poll: {
        id: createId('poll'),
        question,
        allowMultiple,
        options: options.map((text) => ({
          id: createId('opt'),
          text,
          voterIds: [],
        })),
      },
    };

    if (activeConversation.isLiveRoom && activeConversation.roomCode) {
      liveClientRef.current?.send({
        type: 'message:send',
        roomCode: activeConversation.roomCode,
        message: newMessage,
        user: currentUser,
      });
    }

    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        messages: [...prev.messages, newMessage],
        conversations: prev.conversations.map((c) =>
          c.id === activeConversation.id ? {...c, updatedAt: now} : c,
        ),
      };
      broadcastDelta(next, activeConversation.id);
      return next;
    });
    window.setTimeout(() => scrollToBottom(true), 30);
  };

  const handleCreateChecklist = (title: string, items: string[]) => {
    if (!activeConversation) return;
    const now = Date.now();
    const newMessage: Message = {
      id: createId('m'),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      content: title,
      createdAt: now,
      reactions: {},
      checklist: {
        id: createId('chk'),
        title,
        items: items.map((text) => ({
          id: createId('ci'),
          text,
          done: false,
        })),
      },
    };

    if (activeConversation.isLiveRoom && activeConversation.roomCode) {
      liveClientRef.current?.send({
        type: 'message:send',
        roomCode: activeConversation.roomCode,
        message: newMessage,
        user: currentUser,
      });
    }

    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        messages: [...prev.messages, newMessage],
        conversations: prev.conversations.map((c) =>
          c.id === activeConversation.id ? {...c, updatedAt: now} : c,
        ),
      };
      broadcastDelta(next, activeConversation.id);
      return next;
    });
    window.setTimeout(() => scrollToBottom(true), 30);
  };

  const getLiveRoomCodeForMessage = (messageId: string): string | undefined => {
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg) return undefined;
    const conv = state.conversations.find((c) => c.id === msg.conversationId);
    return conv?.isLiveRoom ? conv.roomCode : undefined;
  };

  const handleReact = (messageId: string, emoji: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'message:react',
        roomCode,
        messageId,
        emoji,
        userId: currentUser.id,
      });
    }
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId ? toggleMessageReaction(m, emoji, prev.currentUserId) : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleVotePoll = (messageId: string, optionId: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'poll:vote',
        roomCode,
        messageId,
        optionId,
        userId: currentUser.id,
      });
    }
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId ? voteInPoll(m, optionId, prev.currentUserId) : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleToggleChecklist = (messageId: string, itemId: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'checklist:toggle',
        roomCode,
        messageId,
        itemId,
      });
    }
    setState((prev) => {
      let completedAll = false;
      const nextMessages = prev.messages.map((m) => {
        if (m.id !== messageId) return m;
        const updated = toggleChecklistItem(m, itemId);
        if (
          updated.checklist &&
          updated.checklist.items.length > 0 &&
          updated.checklist.items.every((it) => it.done)
        ) {
          completedAll = true;
        }
        return updated;
      });
      if (completedAll) setBurstKey((k) => k + 1);
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleToggleStarMessage = (messageId: string) => {
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId ? toggleStarMessage(m) : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'message:edit',
        roomCode,
        messageId,
        senderId: currentUser.id,
        content: newContent,
      });
    }
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId
          ? {...m, content: newContent, edited: true, updatedAt: Date.now()}
          : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'message:delete',
        roomCode,
        messageId,
        senderId: currentUser.id,
      });
    }
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              deleted: true,
              pinned: false,
              content: '',
              attachments: undefined,
              poll: undefined,
              checklist: undefined,
              sticker: undefined,
              updatedAt: Date.now(),
            }
          : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleTogglePinMessage = (messageId: string) => {
    const roomCode = getLiveRoomCodeForMessage(messageId);
    if (roomCode) {
      liveClientRef.current?.send({
        type: 'message:pin',
        roomCode,
        messageId,
      });
    }
    setState((prev) => {
      const nextMessages = prev.messages.map((m) =>
        m.id === messageId ? {...m, pinned: !m.pinned, updatedAt: Date.now()} : m,
      );
      const next = {...prev, messages: nextMessages};
      broadcastDelta(next, activeConversation?.id);
      return next;
    });
  };

  const handleDraftChange = (value: string) => {
    if (!activeConversation) return;
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === activeConversation.id ? {...c, draft: value} : c,
      ),
    }));
  };

  const handleTypingSignal = (isTyping: boolean) => {
    if (!activeConversation) return;
    if (activeConversation.isLiveRoom && activeConversation.roomCode) {
      liveClientRef.current?.send({
        type: 'typing:update',
        roomCode: activeConversation.roomCode,
        userId: currentUser.id,
        userName: currentUser.name,
        isTyping,
      });
    }
    channelRef.current?.post({
      type: 'typing',
      tabId: TAB_ID,
      userId: currentUser.id,
      userName: currentUser.name,
      conversationId: activeConversation.id,
      isTyping,
      timestamp: Date.now(),
    });
  };

  const handleJoinOrCreateLiveRoom = ({
    roomCode,
    roomName,
    customServerUrl,
    reconnectTransport,
  }: {
    roomCode: string;
    roomName?: string;
    customServerUrl?: string;
    reconnectTransport?: boolean;
  }) => {
    const code = normalizeRoomCode(roomCode);
    if (!code) return;

    if (customServerUrl || reconnectTransport) {
      liveClientRef.current?.reconnectWithNewUrl();
    }

    const convId = `live_${code}`;
    const cleanName = roomName?.trim()
      ? roomName.trim().startsWith('#')
        ? roomName.trim()
        : `#${roomName.trim()}`
      : `#sala-${code.toLowerCase()}`;

    const wasFirst = state.conversations.length === 0;
    setState((prev) => {
      const existing = prev.conversations.find((c) => c.id === convId);
      if (existing) {
        return {...prev, activeConversationId: convId};
      }
      const newConv: Conversation = {
        id: convId,
        type: 'channel',
        name: cleanName,
        description: `LIVE · ${code}`,
        color: '#0D9488',
        participantIds: [prev.currentUserId],
        unreadCount: 0,
        updatedAt: Date.now(),
        roomCode: code,
        isLiveRoom: true,
      };
      return {
        ...prev,
        conversations: [newConv, ...prev.conversations],
        activeConversationId: convId,
      };
    });

    liveClientRef.current?.joinRoom({
      roomCode: code,
      roomName: cleanName.replace(/^#/, ''),
      roomDescription: `LIVE · ${code}`,
      user: currentUser,
    });

    if (wasFirst) setBurstKey((k) => k + 1);
    setActiveView('chat');
    setMobileShowMain(true);
    showToast(`${cleanName} (${code})`);
  };

  const handleCopyInviteLink = async (roomCode: string) => {
    const relaySuffix = liveTransportMode === 'relay' ? '&relay=1' : '';
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}${relaySuffix}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t(language, 'inviteCopied'));
    } catch {
      showToast(url);
    }
  };

  const handleCreateChannel = (name: string, description: string) => {
    const cleanName = name.startsWith('#') ? name : `#${name}`;
    const conv: Conversation = {
      id: createId('c'),
      type: 'channel',
      name: cleanName,
      description,
      color: '#2563EB',
      participantIds: state.users.map((u) => u.id),
      unreadCount: 0,
      updatedAt: Date.now(),
    };
    const wasFirst = state.conversations.length === 0;
    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        conversations: [conv, ...prev.conversations],
        activeConversationId: conv.id,
      };
      broadcastDelta(next, conv.id);
      return next;
    });
    if (wasFirst) setBurstKey((k) => k + 1);
    setActiveView('chat');
    setMobileShowMain(true);
    showToast(`${cleanName}`);
  };

  const handleCreateNotesSpace = () => {
    const existing = state.conversations.find((c) => c.type === 'notes');
    if (existing) {
      handleSelectConversation(existing.id);
      return;
    }
    const conv: Conversation = {
      id: createId('notes'),
      type: 'notes',
      name: t(language, 'createNotesSpace'),
      description: 'Bloc privat local',
      color: '#0F172A',
      participantIds: [currentUser.id],
      pinned: true,
      unreadCount: 0,
      updatedAt: Date.now(),
    };
    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        conversations: [conv, ...prev.conversations],
        activeConversationId: conv.id,
      };
      broadcastDelta(next, conv.id);
      return next;
    });
    setActiveView('chat');
    setMobileShowMain(true);
    setBurstKey((k) => k + 1);
  };

  const handleStartDm = (userId: string) => {
    const existing = state.conversations.find(
      (c) =>
        c.type === 'dm' &&
        c.participantIds.includes(currentUser.id) &&
        c.participantIds.includes(userId),
    );
    if (existing) {
      handleSelectConversation(existing.id);
      return;
    }

    const target = userMap.get(userId);
    if (!target) return;

    const conv: Conversation = {
      id: createId('dm'),
      type: 'dm',
      name: target.name,
      description: `${target.role}`,
      color: target.color,
      participantIds: [currentUser.id, target.id],
      unreadCount: 0,
      updatedAt: Date.now(),
    };

    setState((prev) => {
      const next: ChatWorkspaceState = {
        ...prev,
        conversations: [conv, ...prev.conversations],
        activeConversationId: conv.id,
      };
      broadcastDelta(next, conv.id);
      return next;
    });
    setActiveView('chat');
    setMobileShowMain(true);
  };

  const handleAddContact = (input: {
    name: string;
    handle: string;
    customId?: string;
    role?: string;
  }) => {
    const {state: updated, contact} = addContactToState(state, input);
    setState(updated);
    broadcastDelta(updated);
    showToast(contact.name);
  };

  const handleCreateUserAndDm = (input: {name: string; handle: string; role: string}) => {
    const {state: updated, contact} = addContactToState(state, input);
    const conv: Conversation = {
      id: createId('dm'),
      type: 'dm',
      name: contact.name,
      description: `${contact.role}`,
      color: contact.color,
      participantIds: [updated.currentUserId, contact.id],
      unreadCount: 0,
      updatedAt: Date.now(),
    };
    const finalState: ChatWorkspaceState = {
      ...updated,
      conversations: [conv, ...updated.conversations],
      activeConversationId: conv.id,
    };
    setState(finalState);
    broadcastDelta(finalState, conv.id);
    setActiveView('chat');
    setMobileShowMain(true);
    showToast(contact.name);
  };

  const handleRemoveContact = (contactId: string) => {
    const target = userMap.get(contactId);
    const next = removeContactFromState(state, contactId);
    setState(next);
    broadcastDelta(next);
    if (target) showToast(`${target.name} · ${t(language, 'delete')}`);
  };

  const handleSelectTheme = (presetId: ThemePresetId) => {
    const preset = NAAN_THEMES[presetId];
    setState((prev) => ({
      ...prev,
      themePreset: presetId,
      theme: preset.mode,
    }));
  };

  const handleSelectLanguage = (lang: LanguageCode) => {
    setState((prev) => ({
      ...prev,
      language: lang,
    }));
  };

  const handleExportStandaloneHtml = (conversationId: string) => {
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    const html = generateStandaloneArchiveHtml(conv, state.messages, state.users);
    const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = conv.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `naan-${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${conv.name}.html`);
  };

  const handleImportPacket = (packet: SyncPacket) => {
    setState((prev) => mergeSyncPacket(prev, packet));
    showToast('OK');
  };

  const handleOpenDuplicateTab = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('autostart', '1');
    window.open(url.toString(), '_blank', 'noopener');
  };

  return (
    <AnimatePresence mode="wait">
      {showLanding ? (
        <LandingView
          key="landing"
          theme={activeTheme}
          language={language}
          onSelectTheme={handleSelectTheme}
          onSelectLanguage={handleSelectLanguage}
          onEnterApp={() => enterWorkspace('chat')}
          onOpenContactsDirect={() => enterWorkspace('contacts')}
        />
      ) : (
        <motion.div
          key="workspace"
          initial={{opacity: 0, scale: 0.99}}
          animate={{opacity: 1, scale: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}
          className="relative flex h-dvh w-screen overflow-hidden text-slate-900 dark:text-slate-100"
          style={{background: activeTheme.canvasBg}}
        >
          <CelebrationBurst triggerKey={burstKey} />

          {/* Ambient Gradient Mesh Orbs behind Frosted Glass Panels */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
            <div
              className="animate-float-slow absolute -top-28 -start-24 h-[480px] w-[480px] rounded-full blur-3xl transition-colors duration-700"
              style={{background: activeTheme.orbOne}}
            />
            <div
              className="animate-float-slow absolute top-1/2 -end-24 h-[460px] w-[460px] rounded-full blur-3xl transition-colors duration-700"
              style={{background: activeTheme.orbTwo, animationDelay: '-4s'}}
            />
            <div
              className="animate-float-slow absolute -bottom-24 start-1/3 h-[420px] w-[420px] rounded-full blur-3xl transition-colors duration-700"
              style={{background: activeTheme.orbThree, animationDelay: '-8s'}}
            />
          </div>

          {/* Left Sidebar */}
          <div
            className={`${
              mobileShowMain ? 'hidden md:flex' : 'flex w-full md:w-auto'
            } relative z-10 h-full shrink-0`}
          >
            <Sidebar
              conversations={state.conversations}
              messages={state.messages}
              users={state.users}
              currentUser={currentUser}
              activeConversationId={activeConversation?.id ?? ''}
              activeView={activeView}
              searchQuery={searchQuery}
              filterTab={filterTab}
              theme={activeTheme}
              language={language}
              activeRemoteUserIds={activeRemoteUserIds}
              onSearchChange={setSearchQuery}
              onFilterTabChange={setFilterTab}
              onSelectConversation={(id) => handleSelectConversation(id)}
              onOpenContacts={() => {
                setActiveView('contacts');
                setMobileShowMain(true);
              }}
              onOpenLanding={() => setShowLanding(true)}
              onOpenNewChat={() => setNewChatOpen(true)}
              onOpenLiveRoom={() => setLiveModalTab('create')}
              onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              onOpenProfileModal={() => setProfileModalOpen(true)}
              onSwitchUser={(userId) => {
                setState((prev) => ({...prev, currentUserId: userId}));
                const picked = userMap.get(userId);
                if (picked) showToast(picked.name);
              }}
              onSelectTheme={handleSelectTheme}
              onSelectLanguage={handleSelectLanguage}
              onOpenDuplicateTab={handleOpenDuplicateTab}
            />
          </div>

      {/* Center Workspace */}
      <main
        className={`${
          mobileShowMain ? 'flex' : 'hidden md:flex'
        } relative z-10 min-w-0 flex-1 flex-col overflow-hidden`}
      >
        {activeView === 'contacts' ? (
          <ContactsView
            users={state.users}
            currentUser={currentUser}
            theme={activeTheme}
            language={language}
            activeRemoteUserIds={activeRemoteUserIds}
            onAddContact={handleAddContact}
            onRemoveContact={handleRemoveContact}
            onToggleStarContact={(cid) =>
              setState((prev) => toggleStarContact(prev, cid))
            }
            onStartDmWithContact={handleStartDm}
            onBackToChat={() => {
              setActiveView('chat');
              setMobileShowMain(false);
            }}
          />
        ) : activeConversation ? (
          <div className="flex h-full min-w-0 flex-1 overflow-hidden">
            <div className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${activeTheme.mainGlass}`}>
              <ChatHeader
                conversation={activeConversation}
                pinnedMessages={pinnedMessages}
                theme={activeTheme}
                language={language}
                inChatSearchOpen={inChatSearchOpen}
                inChatSearchQuery={inChatSearchQuery}
                inspectorOpen={inspectorOpen}
                liveConnectionStatus={liveStatus}
                liveTransportMode={liveTransportMode}
                liveOnlineCount={
                  activeConversation.roomCode
                    ? (liveOnlineByRoom[activeConversation.roomCode]?.length ?? 1)
                    : activeConversation.participantIds.length
                }
                onBackMobile={() => setMobileShowMain(false)}
                onToggleInChatSearch={() => setInChatSearchOpen((v) => !v)}
                onInChatSearchChange={setInChatSearchQuery}
                onToggleInspector={() => setInspectorOpen((v) => !v)}
                onOpenSyncModal={() => setSyncModalOpen(true)}
                onOpenHowToChat={() => setHowToChatOpen(true)}
                onCopyInviteLink={handleCopyInviteLink}
                onJumpToMessage={handleJumpToMessage}
              />

              {/* Message Timeline */}
              <div
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                className="flex-1 overflow-y-auto py-4"
              >
                {conversationMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-500 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                      <MessageSquarePlus className="h-6 w-6" />
                    </div>
                    <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {activeConversation.name}
                    </h2>
                    <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                      {activeConversation.description}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {conversationMessages.map((msg, idx) => {
                      const prev = idx > 0 ? conversationMessages[idx - 1] : undefined;
                      const currentDay = formatDayLabel(msg.createdAt);
                      const prevDay = prev ? formatDayLabel(prev.createdAt) : null;
                      const showDayDivider = currentDay !== prevDay;

                      const isGrouped =
                        !showDayDivider &&
                        Boolean(prev) &&
                        prev!.senderId === msg.senderId &&
                        msg.createdAt - prev!.createdAt < 5 * 60_000 &&
                        !msg.replyToId;

                      const replyTarget = msg.replyToId
                        ? messageMap.get(msg.replyToId)
                        : undefined;
                      const replyAuthor = replyTarget
                        ? userMap.get(replyTarget.senderId)
                        : undefined;

                      return (
                        <div key={msg.id}>
                          {showDayDivider && (
                            <div className="my-4 flex items-center gap-3 px-6">
                              <div className="h-px flex-1 bg-slate-300/60 dark:bg-slate-700/60" />
                              <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                                {currentDay}
                              </span>
                              <div className="h-px flex-1 bg-slate-300/60 dark:bg-slate-700/60" />
                            </div>
                          )}

                          <MessageItem
                            message={msg}
                            author={userMap.get(msg.senderId)}
                            replyTarget={replyTarget}
                            replyAuthor={replyAuthor}
                            currentUserId={currentUser.id}
                            theme={activeTheme}
                            language={language}
                            grouped={isGrouped}
                            isHighlighted={highlightedMessageId === msg.id}
                            searchQuery={inChatSearchQuery}
                            onReply={(m) => setReplyTo(m)}
                            onReact={handleReact}
                            onTogglePin={handleTogglePinMessage}
                            onToggleStar={handleToggleStarMessage}
                            onEdit={handleEditMessage}
                            onDelete={handleDeleteMessage}
                            onVotePoll={handleVotePoll}
                            onToggleChecklist={handleToggleChecklist}
                            onJumpToMessage={handleJumpToMessage}
                            onPreviewImage={(url, name) => setLightboxImage({url, name})}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {showScrollBottom && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  aria-label={t(language, 'scrollToBottom')}
                  className="absolute end-6 bottom-24 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/85 text-slate-700 shadow-lg backdrop-blur-xl transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}

              <Composer
                conversationId={activeConversation.id}
                conversationName={activeConversation.name}
                draft={activeConversation.draft ?? ''}
                theme={activeTheme}
                language={language}
                replyTo={replyTo}
                replyAuthor={replyTo ? userMap.get(replyTo.senderId) : undefined}
                typingUsers={typingInActive}
                onDraftChange={handleDraftChange}
                onTypingSignal={handleTypingSignal}
                onCancelReply={() => setReplyTo(undefined)}
                onOpenPollModal={() => setPollModalOpen(true)}
                onOpenChecklistModal={() => setChecklistModalOpen(true)}
                onOpenSketchModal={() => setSketchModalOpen(true)}
                onSendMessage={handleSendMessage}
              />
            </div>

            {inspectorOpen && (
              <InspectorDrawer
                conversation={activeConversation}
                messages={conversationMessages}
                users={state.users}
                currentUserId={currentUser.id}
                theme={activeTheme}
                language={language}
                activeRemoteUserIds={activeRemoteUserIds}
                onClose={() => setInspectorOpen(false)}
                onTogglePinConversation={(cid) =>
                  setState((prev) => ({
                    ...prev,
                    conversations: prev.conversations.map((c) =>
                      c.id === cid ? {...c, pinned: !c.pinned} : c,
                    ),
                  }))
                }
                onToggleMuteConversation={(cid) =>
                  setState((prev) => ({
                    ...prev,
                    conversations: prev.conversations.map((c) =>
                      c.id === cid ? {...c, muted: !c.muted} : c,
                    ),
                  }))
                }
                onClearConversationMessages={(cid) => {
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.filter((m) => m.conversationId !== cid),
                  }));
                  showToast(t(language, 'clearMessages'));
                }}
                onDeleteConversation={(cid) => {
                  const targetConv = state.conversations.find((c) => c.id === cid);
                  if (targetConv?.isLiveRoom && targetConv.roomCode) {
                    liveClientRef.current?.leaveRoom(targetConv.roomCode, currentUser.id);
                  }
                  setState((prev) => {
                    const next = deleteConversationFromState(prev, cid);
                    broadcastDelta(next);
                    return next;
                  });
                  setInspectorOpen(false);
                  setMobileShowMain(false);
                  showToast(t(language, 'deleteConversation'));
                }}
                onExportStandaloneHtml={handleExportStandaloneHtml}
                onJumpToMessage={handleJumpToMessage}
                onOpenContacts={() => {
                  setActiveView('contacts');
                  setInspectorOpen(false);
                }}
                onSwitchUser={(userId) => {
                  setState((prev) => ({...prev, currentUserId: userId}));
                  const picked = userMap.get(userId);
                  if (picked) showToast(picked.name);
                }}
              />
            )}
          </div>
        ) : (
          /* Clean Empty Workspace Hub (0 predefined contacts/groups) */
          <div className={`flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 ${activeTheme.mainGlass}`}>
            <motion.div
              initial={{opacity: 0, y: 16, scale: 0.97}}
              animate={{opacity: 1, y: 0, scale: 1}}
              transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
              className="w-full max-w-2xl rounded-3xl border border-white/65 bg-white/60 p-6 text-center shadow-xl backdrop-blur-2xl sm:p-8 dark:border-slate-800 dark:bg-slate-900/65"
            >
              <div className="mx-auto flex justify-center">
                <NaanLogo themePreset={activeTheme.id} size="lg" />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                {t(language, 'emptyHubTitle')}
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t(language, 'emptyHubSubtitle')}
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={() => setLiveModalTab('create')}
                  style={{background: activeTheme.accentGradient}}
                  className="flex items-center gap-3 rounded-2xl p-4 text-start text-white shadow-md"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <Radio className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'createLiveRoom')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={() => setLiveModalTab('join')}
                  className="flex items-center gap-3 rounded-2xl border border-emerald-300/70 bg-emerald-50/75 p-4 text-start text-emerald-950 shadow-xs backdrop-blur-xl transition-colors hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/45 dark:text-emerald-100"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    <Radio className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'joinLiveRoom')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={() => setNewChatOpen(true)}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 text-start text-slate-900 shadow-xs backdrop-blur-xl transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/75 dark:text-white"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Hash className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'createFirstChannel')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={() => {
                    setActiveView('contacts');
                    setMobileShowMain(true);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 text-start text-slate-900 shadow-xs backdrop-blur-xl transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/75 dark:text-white"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'landingContactsCta')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={handleCreateNotesSpace}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 text-start text-slate-900 shadow-xs backdrop-blur-xl transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/75 dark:text-white"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <NotebookPen className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'createNotesSpace')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{y: -2, scale: 1.015}}
                  whileTap={{scale: 0.98}}
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 text-start text-slate-900 shadow-xs backdrop-blur-xl transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/75 dark:text-white"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <UserCog className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{t(language, 'editProfile')}</span>
                </motion.button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setHowToChatOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300/70 bg-blue-50/80 px-4 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100/80 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{t(language, 'howToChatBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSyncModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>{t(language, 'importSyncBtn')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Modals */}
      {newChatOpen && (
        <NewChatModal
          users={state.users}
          currentUserId={currentUser.id}
          language={language}
          onClose={() => setNewChatOpen(false)}
          onCreateChannel={handleCreateChannel}
          onStartDm={handleStartDm}
          onCreateUserAndDm={handleCreateUserAndDm}
        />
      )}

      {pollModalOpen && (
        <PollModal
          language={language}
          onClose={() => setPollModalOpen(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}

      {checklistModalOpen && (
        <ChecklistModal
          language={language}
          onClose={() => setChecklistModalOpen(false)}
          onCreateChecklist={handleCreateChecklist}
        />
      )}

      {syncModalOpen && (
        <SyncExportModal
          state={state}
          activeConversation={activeConversation}
          language={language}
          onClose={() => setSyncModalOpen(false)}
          onImportPacket={handleImportPacket}
          onExportStandaloneHtml={handleExportStandaloneHtml}
          onOpenDuplicateTab={handleOpenDuplicateTab}
        />
      )}

      {profileModalOpen && (
        <ProfileModal
          user={currentUser}
          language={language}
          onClose={() => setProfileModalOpen(false)}
          onSaveProfile={(input) => {
            const next = updateCurrentUserProfile(state, input);
            setState(next);
            broadcastDelta(next);
            showToast(input.name);
          }}
        />
      )}

      {sketchModalOpen && (
        <SketchModal
          language={language}
          onClose={() => setSketchModalOpen(false)}
          onSendSketch={(att) => handleSendMessage('', [att], {effect: 'confetti'})}
        />
      )}

      {howToChatOpen && (
        <HowToChatModal
          language={language}
          onClose={() => setHowToChatOpen(false)}
          onOpenLiveRoom={() => setLiveModalTab('create')}
          onOpenDuplicateTab={handleOpenDuplicateTab}
          onOpenSyncModal={() => setSyncModalOpen(true)}
        />
      )}

      {liveModalTab && (
        <LiveRoomModal
          language={language}
          initialTab={liveModalTab}
          onClose={() => setLiveModalTab(null)}
          onJoinOrCreateRoom={handleJoinOrCreateLiveRoom}
        />
      )}

      {quickSwitcherOpen && (
        <QuickSwitcherModal
          conversations={state.conversations}
          messages={state.messages}
          users={state.users}
          language={language}
          onClose={() => setQuickSwitcherOpen(false)}
          onSelectConversation={(cid, mid) => handleSelectConversation(cid, mid)}
        />
      )}

      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.name}
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label={t(language, 'cancel')}
              className="absolute top-3 end-3 rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              referrerPolicy="no-referrer"
              className="max-h-[82vh] rounded-xl object-contain"
            />
            <p className="px-2 pt-2 pb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {lightboxImage.name}
            </p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{opacity: 0, y: 12, scale: 0.94}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 8, scale: 0.94}}
            role="status"
            aria-live="polite"
            className="fixed end-5 bottom-20 z-50 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-xl dark:bg-slate-800/90"
          >
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label={t(language, 'cancel')}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
