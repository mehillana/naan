import {
  BellOff,
  ExternalLink,
  Globe,
  Palette,
  Pencil,
  Pin,
  Plus,
  Radio,
  Search,
  Share2,
  UserCog,
  Users,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useMemo, useState} from 'react';
import {LANGUAGES, t} from '../i18n/translations';
import {THEME_LIST, type NaanThemePreset} from '../themes/themes';
import type {
  Conversation,
  ConversationFilterTab,
  LanguageCode,
  Message,
  ThemePresetId,
  UserProfile,
} from '../types/chat';
import {
  filterConversations,
  formatTimeShort,
  getLastMessageForConversation,
  stripMarkdownForPreview,
} from '../utils/chatLogic';
import {Avatar} from './Avatar';
import {NaanLogo} from './NaanLogo';

interface SidebarProps {
  conversations: Conversation[];
  messages: Message[];
  users: UserProfile[];
  currentUser: UserProfile;
  activeConversationId: string;
  activeView: 'chat' | 'contacts';
  searchQuery: string;
  filterTab: ConversationFilterTab;
  theme: NaanThemePreset;
  language: LanguageCode;
  activeRemoteUserIds: Set<string>;
  onSearchChange: (value: string) => void;
  onFilterTabChange: (tab: ConversationFilterTab) => void;
  onSelectConversation: (id: string) => void;
  onOpenContacts: () => void;
  onOpenLanding: () => void;
  onOpenNewChat: () => void;
  onOpenLiveRoom: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenSyncModal: () => void;
  onOpenProfileModal: () => void;
  onSwitchUser: (userId: string) => void;
  onSelectTheme: (presetId: ThemePresetId) => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onOpenDuplicateTab: () => void;
}

export function Sidebar({
  conversations,
  messages,
  users,
  currentUser,
  activeConversationId,
  activeView,
  searchQuery,
  filterTab,
  theme,
  language,
  activeRemoteUserIds,
  onSearchChange,
  onFilterTabChange,
  onSelectConversation,
  onOpenContacts,
  onOpenLanding,
  onOpenNewChat,
  onOpenLiveRoom,
  onOpenQuickSwitcher,
  onOpenSyncModal,
  onOpenProfileModal,
  onSwitchUser,
  onSelectTheme,
  onSelectLanguage,
  onOpenDuplicateTab,
}: SidebarProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const visibleConversations = useMemo(
    () => filterConversations(conversations, messages, searchQuery, filterTab),
    [conversations, messages, searchQuery, filterTab],
  );

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  const filterTabs: {id: ConversationFilterTab; label: string}[] = [
    {id: 'all', label: t(language, 'tabAll')},
    {id: 'unread', label: t(language, 'tabUnread')},
    {id: 'channel', label: t(language, 'tabChannels')},
    {id: 'dm', label: t(language, 'tabDirect')},
  ];

  return (
    <aside
      aria-label={t(language, 'searchConversations')}
      className={`relative flex h-full w-full flex-col border-e border-white/40 md:w-[330px] lg:w-[350px] dark:border-slate-800/80 ${theme.sidebarGlass}`}
    >
      {/* Top workspace header */}
      <div className="flex items-center justify-between gap-1.5 border-b border-white/40 px-3 py-3 dark:border-slate-800/80">
        <button
          type="button"
          onClick={onOpenLanding}
          title={t(language, 'backToLanding')}
          className="flex shrink-0 items-center gap-2 rounded-xl py-0.5 text-start transition-opacity hover:opacity-85"
        >
          <NaanLogo themePreset={theme.id} size="sm" />
          <span className="text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap dark:text-white">
            Naan
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenContacts}
            aria-label={t(language, 'contacts')}
            aria-pressed={activeView === 'contacts'}
            title={t(language, 'contacts')}
            className={`inline-flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeView === 'contacts'
                ? 'bg-white/90 text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[78px] truncate">{t(language, 'contacts')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenQuickSwitcher}
            aria-label={t(language, 'quickSearch')}
            title={t(language, 'quickSearch')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Theme Studio Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((v) => !v)}
              aria-label={t(language, 'themes')}
              aria-expanded={themeMenuOpen}
              title={t(language, 'themes')}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
            >
              <Palette className="h-4 w-4" />
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{opacity: 0, y: -6, scale: 0.95}}
                  animate={{opacity: 1, y: 0, scale: 1}}
                  exit={{opacity: 0, y: -6, scale: 0.95}}
                  transition={{duration: 0.16}}
                  className="absolute end-0 top-full z-40 mt-2 w-60 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-xl backdrop-blur-2xl dark:border-slate-700 dark:bg-slate-900/95"
                >
                  <p className="mb-2 text-xs font-bold text-slate-900 dark:text-white">
                    {t(language, 'themes')}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {THEME_LIST.map((preset) => {
                      const active = preset.id === theme.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onSelectTheme(preset.id);
                            setThemeMenuOpen(false);
                          }}
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium transition-colors ${
                            active
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-white/40"
                            style={{background: preset.swatchGradient}}
                          />
                          <span className="truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onOpenLiveRoom}
            aria-label={t(language, 'createLiveRoom')}
            title={t(language, 'createLiveRoom')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-700 transition-transform hover:scale-105 active:scale-95 dark:text-emerald-300"
          >
            <Radio className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNewChat}
            aria-label={t(language, 'newChat')}
            title={t(language, 'newChat')}
            style={{background: theme.accentGradient}}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="space-y-2.5 border-b border-white/40 px-3.5 py-3 dark:border-slate-800/80">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(language, 'searchConversations')}
            aria-label={t(language, 'searchConversations')}
            className="w-full rounded-xl border border-white/60 bg-white/70 py-2 pe-3 ps-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filtra converses"
          className="flex items-center gap-1 rounded-xl bg-slate-900/5 p-1 dark:bg-slate-950/50"
        >
          {filterTabs.map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onFilterTabChange(tab.id)}
                className={`relative flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-tab-pill"
                    transition={{type: 'spring', stiffness: 400, damping: 30}}
                    className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-slate-800"
                  />
                )}
                <span className="relative z-10">
                  {tab.label}
                  {tab.id === 'unread' && totalUnread > 0 ? ` (${totalUnread})` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <nav aria-label="Converses" className="flex-1 overflow-y-auto px-2 py-2">
        {visibleConversations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t(language, 'noConversationsFound')}
            </p>
            {searchQuery || filterTab !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onFilterTabChange('all');
                }}
                className="mt-3 rounded-xl border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {t(language, 'clearFilters')}
              </button>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onOpenLiveRoom}
                  style={{background: theme.accentGradient}}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>{t(language, 'createLiveRoom')}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenNewChat}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/60 bg-white/75 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t(language, 'createFirstChannel')}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenContacts}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/60 bg-white/75 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{t(language, 'contacts')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {visibleConversations.map((conv) => {
              const isActive = conv.id === activeConversationId && activeView === 'chat';
              const lastMsg = getLastMessageForConversation(messages, conv.id);
              const lastAuthor = lastMsg ? userMap.get(lastMsg.senderId) : undefined;
              const otherDmUserId =
                conv.type === 'dm'
                  ? conv.participantIds.find((id) => id !== currentUser.id)
                  : undefined;
              const isRemotePresent = otherDmUserId
                ? activeRemoteUserIds.has(otherDmUserId)
                : false;

              let preview = conv.description;
              if (conv.draft && conv.draft.trim()) {
                preview = `${t(language, 'draftPrefix')}: ${conv.draft.trim()}`;
              } else if (lastMsg) {
                const body = lastMsg.deleted
                  ? t(language, 'deletedMessage')
                  : lastMsg.poll
                    ? `${lastMsg.poll.question}`
                    : lastMsg.checklist
                      ? `${lastMsg.checklist.title}`
                      : lastMsg.attachments?.length && !lastMsg.content
                        ? lastMsg.attachments[0].name
                        : stripMarkdownForPreview(lastMsg.content);
                const prefix =
                  conv.type === 'channel' && lastAuthor
                    ? `${lastAuthor.name.split(' ')[0]}: `
                    : lastMsg.senderId === currentUser.id && conv.type !== 'notes'
                      ? '✓✓ '
                      : '';
                preview = `${prefix}${body}`;
              }

              return (
                <li key={conv.id}>
                  <motion.button
                    type="button"
                    whileHover={{x: 2}}
                    transition={{duration: 0.14}}
                    onClick={() => onSelectConversation(conv.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors ${
                      isActive
                        ? 'bg-white/85 text-slate-950 shadow-xs backdrop-blur-md dark:bg-slate-800/85 dark:text-white'
                        : 'text-slate-700 hover:bg-white/45 dark:text-slate-300 dark:hover:bg-slate-800/45'
                    }`}
                  >
                    <Avatar
                      name={conv.name}
                      color={conv.color}
                      kind={conv.type}
                      activePresence={isRemotePresent}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          <span
                            dir={conv.type === 'channel' ? 'ltr' : 'auto'}
                            className="truncate"
                          >
                            {conv.name}
                          </span>
                          {conv.isLiveRoom && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              LIVE
                            </span>
                          )}
                          {conv.pinned && (
                            <Pin className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          )}
                          {conv.muted && (
                            <BellOff className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          {formatTimeShort(lastMsg?.createdAt ?? conv.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-xs ${
                            conv.draft?.trim()
                              ? 'font-medium text-blue-600 dark:text-blue-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {preview}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span
                            style={{background: theme.accentGradient}}
                            className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white"
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Bottom identity, language selector & sync footer */}
      <div className="space-y-2.5 border-t border-white/40 bg-white/45 p-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/55">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={currentUser.name} color={currentUser.color} size="sm" />
            <div className="min-w-0">
              <label htmlFor="profile-switcher" className="sr-only">
                {t(language, 'yourActiveProfile')}
              </label>
              <div className="flex items-center gap-1">
                <select
                  id="profile-switcher"
                  value={currentUser.id}
                  onChange={(e) => onSwitchUser(e.target.value)}
                  className="max-w-[138px] cursor-pointer truncate bg-transparent text-sm font-semibold text-slate-900 focus:outline-none dark:text-white"
                >
                  {users.map((u) => (
                    <option
                      key={u.id}
                      value={u.id}
                      className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {u.name}
                    </option>
                  ))}
                </select>
                <UserCog className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                <span dir="ltr">{currentUser.handle}</span> · {currentUser.role}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenProfileModal}
              title={t(language, 'editProfile')}
              aria-label={t(language, 'editProfile')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/60 bg-white/75 text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenDuplicateTab}
              title={t(language, 'newTabTitle')}
              aria-label={t(language, 'newTabTitle')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/60 bg-white/75 text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenSyncModal}
              title={t(language, 'exportBtn')}
              aria-label={t(language, 'exportBtn')}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/60 bg-white/75 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{t(language, 'exportBtn')}</span>
            </button>
          </div>
        </div>

        {/* Compact 7-Language Switcher Row */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Globe className="h-3.5 w-3.5" />
            <span>{t(language, 'languageLabel')}</span>
          </span>
          <select
            aria-label={t(language, 'languageLabel')}
            value={language}
            onChange={(e) => onSelectLanguage(e.target.value as LanguageCode)}
            className="cursor-pointer bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-100"
          >
            {LANGUAGES.map((l) => (
              <option
                key={l.code}
                value={l.code}
                className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
              >
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
