import {
  Bell,
  BellOff,
  Download,
  FileText,
  Pin,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {useState} from 'react';
import {t} from '../i18n/translations';
import type {NaanThemePreset} from '../themes/themes';
import type {Attachment, Conversation, LanguageCode, Message, UserProfile} from '../types/chat';
import {formatBytes, formatTimeShort, stripMarkdownForPreview} from '../utils/chatLogic';
import {Avatar} from './Avatar';

interface InspectorDrawerProps {
  conversation: Conversation;
  messages: Message[];
  users: UserProfile[];
  currentUserId: string;
  theme: NaanThemePreset;
  language: LanguageCode;
  activeRemoteUserIds: Set<string>;
  onClose: () => void;
  onTogglePinConversation: (conversationId: string) => void;
  onToggleMuteConversation: (conversationId: string) => void;
  onClearConversationMessages: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onExportStandaloneHtml: (conversationId: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onOpenContacts: () => void;
  onSwitchUser: (userId: string) => void;
}

export function InspectorDrawer({
  conversation,
  messages,
  users,
  currentUserId,
  theme,
  language,
  activeRemoteUserIds,
  onClose,
  onTogglePinConversation,
  onToggleMuteConversation,
  onClearConversationMessages,
  onDeleteConversation,
  onExportStandaloneHtml,
  onJumpToMessage,
  onOpenContacts,
  onSwitchUser,
}: InspectorDrawerProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const participants = conversation.participantIds
    .map((id) => userMap.get(id))
    .filter((u): u is UserProfile => Boolean(u));

  const pinnedMessages = messages.filter((m) => m.pinned && !m.deleted);
  const starredMessages = messages.filter((m) => m.starred && !m.deleted);
  const sharedAttachments: Attachment[] = [];
  for (const m of messages) {
    if (!m.deleted && m.attachments) {
      sharedAttachments.push(...m.attachments);
    }
  }

  return (
    <aside
      aria-label={t(language, 'details')}
      className={`animate-fade-up fixed inset-0 z-30 flex h-full w-full shrink-0 flex-col border-s border-white/40 md:static md:inset-auto md:z-auto md:w-[320px] dark:border-slate-800/80 ${theme.sidebarGlass}`}
    >
      <div className="flex items-center justify-between border-b border-white/40 px-4 py-3.5 dark:border-slate-800/80">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t(language, 'details')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t(language, 'cancel')}
          className="rounded-xl p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={conversation.name}
            color={conversation.color}
            kind={conversation.type}
            size="lg"
          />
          <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
            {conversation.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {conversation.description}
          </p>

          <div className="mt-4 flex w-full gap-2">
            <button
              type="button"
              onClick={() => onTogglePinConversation(conversation.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                conversation.pinned
                  ? 'border-blue-300 bg-blue-50/90 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-white/60 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              <span>
                {conversation.pinned ? t(language, 'pinnedChat') : t(language, 'pinChat')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onToggleMuteConversation(conversation.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                conversation.muted
                  ? 'border-amber-300 bg-amber-50/90 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'border-white/60 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200'
              }`}
            >
              {conversation.muted ? (
                <BellOff className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              <span>
                {conversation.muted ? t(language, 'muted') : t(language, 'mute')}
              </span>
            </button>
          </div>
        </div>

        {/* Participants */}
        <section className="border-t border-white/40 pt-4 dark:border-slate-800/80">
          <div className="mb-2.5 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t(language, 'participants')} ({participants.length})
            </h4>
            <button
              type="button"
              onClick={onOpenContacts}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <Users className="h-3 w-3" />
              <span>{t(language, 'contacts')}</span>
            </button>
          </div>

          <ul className="space-y-1.5">
            {participants.map((p) => {
              const isMe = p.id === currentUserId;
              const isRemote = !isMe && activeRemoteUserIds.has(p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/65 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={p.name}
                      color={p.color}
                      size="sm"
                      activePresence={isRemote}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {p.name} {isMe ? '•' : ''}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {p.handle} · {p.role}
                      </p>
                    </div>
                  </div>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => onSwitchUser(p.id)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {t(language, 'useProfile')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Pinned messages */}
        <section className="border-t border-white/40 pt-4 dark:border-slate-800/80">
          <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t(language, 'pinnedMessages')} ({pinnedMessages.length})
          </h4>
          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
          ) : (
            <ul className="space-y-1.5">
              {pinnedMessages.map((pm) => (
                <li key={pm.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(pm.id)}
                    className="w-full rounded-xl border border-white/60 bg-white/70 p-2.5 text-start text-xs transition-colors hover:bg-white dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <p className="line-clamp-2 text-slate-700 dark:text-slate-200">
                      {stripMarkdownForPreview(pm.content)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">
                      {formatTimeShort(pm.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Shared Files */}
        <section className="border-t border-white/40 pt-4 dark:border-slate-800/80">
          <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t(language, 'sharedFiles')} ({sharedAttachments.length})
          </h4>
          {sharedAttachments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
          ) : (
            <ul className="space-y-1.5">
              {sharedAttachments.map((att) => (
                <li key={att.id}>
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/60 bg-white/70 px-2.5 py-2 text-xs hover:bg-white dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {att.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                      {formatBytes(att.size)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Starred messages */}
        <section className="border-t border-white/40 pt-4 dark:border-slate-800/80">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span>
              {t(language, 'starredMessages')} ({starredMessages.length})
            </span>
          </h4>
          {starredMessages.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
          ) : (
            <ul className="space-y-1.5">
              {starredMessages.map((sm) => (
                <li key={sm.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(sm.id)}
                    className="w-full rounded-xl border border-white/60 bg-white/70 p-2.5 text-start text-xs transition-colors hover:bg-white dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <p className="line-clamp-2 text-slate-700 dark:text-slate-200">
                      {stripMarkdownForPreview(sm.content)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Export, Clear & Delete */}
        <section className="space-y-2 border-t border-white/40 pt-4 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => onExportStandaloneHtml(conversation.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t(language, 'downloadHtmlArchive')}</span>
          </button>

          <button
            type="button"
            onClick={() => onClearConversationMessages(conversation.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t(language, 'clearMessages')}</span>
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  onDeleteConversation(conversation.id);
                }}
                className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                {t(language, 'confirm')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t(language, 'deleteConversation')}</span>
            </button>
          )}
        </section>
      </div>
    </aside>
  );
}
