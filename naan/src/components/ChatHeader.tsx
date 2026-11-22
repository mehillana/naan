import {
  ArrowLeft,
  Check,
  HelpCircle,
  Link2,
  PanelRight,
  Pin,
  Radio,
  Search,
  Share2,
  X,
} from 'lucide-react';
import {useState} from 'react';
import {t} from '../i18n/translations';
import type {NaanThemePreset} from '../themes/themes';
import type {
  Conversation,
  LanguageCode,
  LiveConnectionStatus,
  LiveTransportMode,
  Message,
} from '../types/chat';
import {stripMarkdownForPreview} from '../utils/chatLogic';
import {Avatar} from './Avatar';

interface ChatHeaderProps {
  conversation: Conversation;
  pinnedMessages: Message[];
  theme: NaanThemePreset;
  language: LanguageCode;
  inChatSearchOpen: boolean;
  inChatSearchQuery: string;
  inspectorOpen: boolean;
  liveConnectionStatus?: LiveConnectionStatus;
  liveTransportMode?: LiveTransportMode;
  liveOnlineCount?: number;
  onBackMobile: () => void;
  onToggleInChatSearch: () => void;
  onInChatSearchChange: (q: string) => void;
  onToggleInspector: () => void;
  onOpenSyncModal: () => void;
  onOpenHowToChat: () => void;
  onCopyInviteLink?: (roomCode: string) => void;
  onJumpToMessage: (messageId: string) => void;
}

export function ChatHeader({
  conversation,
  pinnedMessages,
  theme,
  language,
  inChatSearchOpen,
  inChatSearchQuery,
  inspectorOpen,
  liveConnectionStatus = 'disconnected',
  liveTransportMode = 'server',
  liveOnlineCount = 0,
  onBackMobile,
  onToggleInChatSearch,
  onInChatSearchChange,
  onToggleInspector,
  onOpenSyncModal,
  onOpenHowToChat,
  onCopyInviteLink,
  onJumpToMessage,
}: ChatHeaderProps) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const latestPinned = pinnedMessages[pinnedMessages.length - 1];
  const subtitle = conversation.isLiveRoom && conversation.roomCode
    ? `${conversation.roomCode} · ${Math.max(1, liveOnlineCount)} ${t(language, 'onlineNow')}`
    : conversation.type === 'channel'
      ? `${conversation.participantIds.length} ${t(language, 'participants').toLowerCase()}`
      : conversation.description;

  return (
    <div
      className={`shrink-0 border-b border-white/40 dark:border-slate-800/80 ${theme.headerGlass}`}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label={t(language, 'backToLanding')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white/60 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </button>

          <Avatar
            name={conversation.name}
            color={conversation.color}
            kind={conversation.type}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1
                dir={conversation.type === 'channel' ? 'ltr' : 'auto'}
                className="truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white"
              >
                {conversation.name}
              </h1>
              {conversation.isLiveRoom && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase sm:px-2 ${
                    liveConnectionStatus === 'connected'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : liveConnectionStatus === 'connecting'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  <span className="hidden sm:inline">
                    {liveConnectionStatus === 'connected'
                      ? liveTransportMode === 'relay'
                        ? t(language, 'liveRelayBadge')
                        : t(language, 'liveConnected')
                      : liveConnectionStatus === 'connecting'
                        ? t(language, 'liveConnecting')
                        : t(language, 'liveOffline')}
                  </span>
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {conversation.isLiveRoom && conversation.roomCode && onCopyInviteLink && (
            <button
              type="button"
              onClick={() => {
                onCopyInviteLink(conversation.roomCode!);
                setInviteCopied(true);
                window.setTimeout(() => setInviteCopied(false), 1800);
              }}
              aria-label={t(language, 'copyInviteLink')}
              title={t(language, 'copyInviteLink')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100/80 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              {inviteCopied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {inviteCopied ? t(language, 'inviteCopied') : conversation.roomCode}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleInChatSearch}
            aria-label={t(language, 'searchInChat')}
            aria-pressed={inChatSearchOpen}
            title={t(language, 'searchInChat')}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              inChatSearchOpen
                ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenHowToChat}
            aria-label={t(language, 'howToChatBtn')}
            title={t(language, 'howToChatBtn')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            aria-label={t(language, 'sync')}
            title={t(language, 'sync')}
            className="hidden h-9 items-center gap-1.5 rounded-xl border border-white/60 bg-white/60 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-white sm:inline-flex dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{t(language, 'sync')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            aria-label={t(language, 'details')}
            aria-pressed={inspectorOpen}
            title={t(language, 'details')}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              inspectorOpen
                ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* In-chat search bar */}
      {inChatSearchOpen && (
        <div className="flex items-center gap-2 border-t border-white/40 bg-white/50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={inChatSearchQuery}
            onChange={(e) => onInChatSearchChange(e.target.value)}
            placeholder={t(language, 'searchInChat')}
            aria-label={t(language, 'searchInChat')}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              onInChatSearchChange('');
              onToggleInChatSearch();
            }}
            aria-label={t(language, 'cancel')}
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pinned message strip */}
      {latestPinned && !latestPinned.deleted && (
        <button
          type="button"
          onClick={() => onJumpToMessage(latestPinned.id)}
          className="flex w-full items-center gap-2.5 border-t border-white/40 bg-white/40 px-4 py-2 text-start transition-colors hover:bg-white/70 sm:px-5 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
            {t(language, 'pinnedMessage')}
            {pinnedMessages.length > 1 ? ` (${pinnedMessages.length})` : ''}:
          </span>
          <span className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
            {stripMarkdownForPreview(latestPinned.content)}
          </span>
        </button>
      )}
    </div>
  );
}
