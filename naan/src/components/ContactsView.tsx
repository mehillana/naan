import {
  ArrowLeft,
  Check,
  Copy,
  MessageSquare,
  Search,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useMemo, useState} from 'react';
import {t} from '../i18n/translations';
import type {NaanThemePreset} from '../themes/themes';
import type {LanguageCode, UserProfile} from '../types/chat';
import {filterContacts} from '../utils/chatLogic';
import {Avatar} from './Avatar';

interface ContactsViewProps {
  users: UserProfile[];
  currentUser: UserProfile;
  theme: NaanThemePreset;
  language: LanguageCode;
  activeRemoteUserIds: Set<string>;
  onAddContact: (input: {
    name: string;
    handle: string;
    customId?: string;
    role?: string;
  }) => void;
  onRemoveContact: (contactId: string) => void;
  onToggleStarContact: (contactId: string) => void;
  onStartDmWithContact: (contactId: string) => void;
  onBackToChat: () => void;
}

export function ContactsView({
  users,
  currentUser,
  theme,
  language,
  activeRemoteUserIds,
  onAddContact,
  onRemoveContact,
  onToggleStarContact,
  onStartDmWithContact,
  onBackToChat,
}: ContactsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [customId, setCustomId] = useState('');
  const [role, setRole] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const contacts = useMemo(() => {
    const base = filterContacts(users, currentUser.id, searchQuery);
    return onlyStarred ? base.filter((u) => Boolean(u.starred)) : base;
  }, [users, currentUser.id, searchQuery, onlyStarred]);

  const totalContacts = useMemo(
    () => users.filter((u) => u.id !== currentUser.id).length,
    [users, currentUser.id],
  );

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      onAddContact({
        name,
        handle: handle || name,
        customId: customId || undefined,
        role: role || undefined,
      });
      setName('');
      setHandle('');
      setCustomId('');
      setRole('');
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <section
      aria-label={t(language, 'contactsTitle')}
      className={`flex h-full flex-1 flex-col overflow-hidden ${theme.mainGlass}`}
    >
      {/* Header */}
      <header
        className={`flex items-center justify-between gap-4 border-b border-white/40 px-4 py-3.5 sm:px-6 dark:border-slate-800/80 ${theme.headerGlass}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            aria-label={t(language, 'backToLanding')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/70"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg dark:text-white">
              {t(language, 'contactsTitle')}
            </h1>
            <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {totalContacts} {t(language, 'contactsSaved')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowAddForm((v) => !v);
          }}
          style={{background: theme.accentGradient}}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shadow-xs transition-transform hover:scale-[1.02] active:scale-[0.98] sm:text-sm"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          <span>{showAddForm ? t(language, 'closeForm') : t(language, 'addContact')}</span>
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Current profile identity card */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/60 bg-white/65 p-4 backdrop-blur-xl sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/65">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={currentUser.name} color={currentUser.color} size="md" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t(language, 'yourActiveProfile')}
                </p>
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {currentUser.name} ·{' '}
                  <span className="font-normal text-slate-600 dark:text-slate-300">
                    {currentUser.handle}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="rounded-xl border border-white/60 bg-white/80 px-2.5 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                ID: {currentUser.id}
              </code>
              <button
                type="button"
                onClick={() => handleCopyId(currentUser.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copiedId === currentUser.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t(language, 'copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t(language, 'copyId')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Add Contact Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{opacity: 0, y: -10, scale: 0.98}}
                animate={{opacity: 1, y: 0, scale: 1}}
                exit={{opacity: 0, y: -8, scale: 0.98}}
                transition={{duration: 0.2}}
                onSubmit={handleSubmit}
                aria-label={t(language, 'addContact')}
                className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-2xl dark:border-slate-700 dark:bg-slate-900/80"
              >
                <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                  {t(language, 'addContact')}
                </h2>

                {formError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {formError}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t(language, 'fullName')}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Núria Pons"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-handle"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t(language, 'username')}
                    </label>
                    <input
                      id="contact-handle"
                      type="text"
                      required
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@nuria.pons"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-id"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t(language, 'uniqueIdOptional')}
                    </label>
                    <input
                      id="contact-id"
                      type="text"
                      value={customId}
                      onChange={(e) => setCustomId(e.target.value)}
                      placeholder="u_..."
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-role"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t(language, 'roleOptional')}
                    </label>
                    <input
                      id="contact-role"
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Producte"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormError(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {t(language, 'cancel')}
                  </button>
                  <button
                    type="submit"
                    style={{background: theme.accentGradient}}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                  >
                    {t(language, 'saveContact')}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Search & Favorites Segmented Filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(language, 'searchContactsPlaceholder')}
                aria-label={t(language, 'contactsTitle')}
                className="w-full rounded-xl border border-white/60 bg-white/70 py-2.5 pe-4 ps-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:bg-slate-950"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-900/5 p-1 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setOnlyStarred(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !onlyStarred
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t(language, 'allContacts')}
              </button>
              <button
                type="button"
                onClick={() => setOnlyStarred(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  onlyStarred
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t(language, 'starredContacts')}
              </button>
            </div>
          </div>

          {/* Contacts Grid */}
          {contacts.length === 0 ? (
            <div className="rounded-2xl border border-white/60 bg-white/60 px-6 py-12 text-center backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55">
              <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                {searchQuery ? t(language, 'noContactsMatch') : t(language, 'noContactsYet')}
              </h2>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {t(language, 'clearFilters')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  style={{background: theme.accentGradient}}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t(language, 'addContact')}</span>
                </button>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {contacts.map((contact, idx) => {
                const isPresent = activeRemoteUserIds.has(contact.id);
                const isConfirming = confirmRemoveId === contact.id;

                return (
                  <motion.li
                    key={contact.id}
                    initial={{opacity: 0, y: 10}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.22, delay: idx * 0.03}}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-white/65 bg-white/70 p-4 backdrop-blur-xl transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={contact.name}
                          color={contact.color}
                          size="md"
                          activePresence={isPresent}
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {contact.name}
                          </h3>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            <span dir="ltr">{contact.handle}</span> · {contact.role}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <code className="rounded bg-slate-900/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {contact.id}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyId(contact.id)}
                              aria-label={`${t(language, 'copyId')} ${contact.name}`}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              {copiedId === contact.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span>{t(language, 'copied')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>{t(language, 'copy')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleStarContact(contact.id)}
                        aria-label={
                          contact.starred
                            ? t(language, 'unstarContact')
                            : t(language, 'starContact')
                        }
                        aria-pressed={Boolean(contact.starred)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          contact.starred
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${contact.starred ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3 dark:border-slate-800">
                      {isConfirming ? (
                        <>
                          <span className="me-auto text-xs font-medium text-red-600 dark:text-red-400">
                            {t(language, 'removeContactPrompt')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {t(language, 'cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmRemoveId(null);
                              onRemoveContact(contact.id);
                            }}
                            aria-label={`${t(language, 'confirm')} ${t(language, 'delete')} ${contact.name}`}
                            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            {t(language, 'confirm')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(contact.id)}
                            aria-label={`${t(language, 'delete')} ${contact.name}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t(language, 'delete')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartDmWithContact(contact.id)}
                            aria-label={`${t(language, 'message')} ${contact.name}`}
                            style={{background: theme.accentGradient}}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-transform hover:scale-[1.02]"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{t(language, 'message')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
