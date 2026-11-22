import {
  Check,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  Hash,
  HelpCircle,
  Link2,
  Lock,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {motion} from 'motion/react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {t} from '../i18n/translations';
import type {
  Attachment,
  ChatWorkspaceState,
  Conversation,
  LanguageCode,
  Message,
  SyncPacket,
  UserProfile,
} from '../types/chat';
import {
  createId,
  decodeSyncPacket,
  encodeSyncPacket,
  formatTimeShort,
  generateRoomCode,
  normalizeRoomCode,
} from '../utils/chatLogic';
import {
  getSavedCustomServerUrl,
  getSavedLiveModePreference,
  saveCustomServerUrl,
  saveLiveModePreference,
  type LiveModePreference,
} from '../utils/liveClient';
import {
  buildSyncPacket,
  decryptSyncPacket,
  encryptSyncPacket,
} from '../utils/storage';
import {Avatar} from './Avatar';

/* -------------------------------------------------------------------------- */
/* 1. NewChatModal                                                            */
/* -------------------------------------------------------------------------- */

interface NewChatModalProps {
  users: UserProfile[];
  currentUserId: string;
  language: LanguageCode;
  onClose: () => void;
  onCreateChannel: (name: string, description: string) => void;
  onStartDm: (userId: string) => void;
  onCreateUserAndDm: (input: {name: string; handle: string; role: string}) => void;
}

export function NewChatModal({
  users,
  currentUserId,
  language,
  onClose,
  onCreateChannel,
  onStartDm,
  onCreateUserAndDm,
}: NewChatModalProps) {
  const [mode, setMode] = useState<'channel' | 'dm'>('channel');
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  const otherUsers = users.filter((u) => u.id !== currentUserId);

  const handleSubmitChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = channelName.trim();
    if (!trimmed) return;
    onCreateChannel(trimmed, channelDesc.trim() || 'Naan');
    onClose();
  };

  const handleCreateContactDm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onCreateUserAndDm({
        name: newName,
        handle: newHandle || newName,
        role: newRole || 'Contacte',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'newChat')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.95, y: 10}}
        animate={{opacity: 1, scale: 1, y: 0}}
        transition={{duration: 0.18}}
        className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'newChat')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('channel');
              setError(null);
            }}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              mode === 'channel'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t(language, 'tabChannels')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('dm');
              setError(null);
            }}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              mode === 'dm'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t(language, 'tabDirect')}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {mode === 'channel' ? (
          <form onSubmit={handleSubmitChannel} className="mt-4 space-y-3.5">
            <div>
              <label
                htmlFor="new-channel-name"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {t(language, 'fullName')}
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="new-channel-name"
                  type="text"
                  autoFocus
                  required
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="projecte-naan"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-channel-desc"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {t(language, 'roleOptional')}
              </label>
              <input
                id="new-channel-desc"
                type="text"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                placeholder="..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {t(language, 'confirm')}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            {otherUsers.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {otherUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onStartDm(u.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Avatar name={u.name} color={u.color} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {u.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {u.handle} · {u.role}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleCreateContactDm}
              className="space-y-2.5 border-t border-slate-200 pt-3 dark:border-slate-800"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t(language, 'addContact')}</span>
              </p>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t(language, 'fullName')}
                aria-label={t(language, 'fullName')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="@usuari *"
                  aria-label={t(language, 'username')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder={t(language, 'roleOptional')}
                  aria-label={t(language, 'roleOptional')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {t(language, 'saveContact')}
                </button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. PollModal                                                               */
/* -------------------------------------------------------------------------- */

interface PollModalProps {
  language: LanguageCode;
  onClose: () => void;
  onCreatePoll: (question: string, options: string[], allowMultiple: boolean) => void;
}

export function PollModal({language, onClose, onCreatePoll}: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!q || cleanOptions.length < 2) {
      setError('Introdueix una pregunta i com a mínim dues opcions.');
      return;
    }
    onCreatePoll(q, cleanOptions, allowMultiple);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'pollTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'pollTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <input
            id="poll-question"
            type="text"
            autoFocus
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pregunta..."
            aria-label="Pregunta"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Opció ${idx + 1}`}
                  aria-label={`Opció ${idx + 1}`}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                    aria-label={t(language, 'delete')}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Opció</span>
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Multi</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t(language, 'send')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. ChecklistModal                                                          */
/* -------------------------------------------------------------------------- */

interface ChecklistModalProps {
  language: LanguageCode;
  onClose: () => void;
  onCreateChecklist: (title: string, items: string[]) => void;
}

export function ChecklistModal({language, onClose, onCreateChecklist}: ChecklistModalProps) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items.map((i) => i.trim()).filter(Boolean);
    if (!title.trim() || cleanItems.length === 0) {
      setError('Afegeix un títol i almenys una tasca.');
      return;
    }
    onCreateChecklist(title.trim(), cleanItems);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'checklistTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'checklistTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <input
            type="text"
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(language, 'checklistTitle')}
            aria-label={t(language, 'checklistTitle')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = e.target.value;
                    setItems(next);
                  }}
                  placeholder={`#${idx + 1}`}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    aria-label={t(language, 'delete')}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {items.length < 8 && (
              <button
                type="button"
                onClick={() => setItems([...items, ''])}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+</span>
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t(language, 'send')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. SyncExportModal                                                         */
/* -------------------------------------------------------------------------- */

interface SyncExportModalProps {
  state: ChatWorkspaceState;
  activeConversation?: Conversation;
  language: LanguageCode;
  onClose: () => void;
  onImportPacket: (packet: SyncPacket) => void;
  onExportStandaloneHtml: (conversationId: string) => void;
  onOpenDuplicateTab: () => void;
}

export function SyncExportModal({
  state,
  activeConversation,
  language,
  onClose,
  onImportPacket,
  onExportStandaloneHtml,
  onOpenDuplicateTab,
}: SyncExportModalProps) {
  const [tab, setTab] = useState<'sync' | 'archive'>('sync');
  const [passphrase, setPassphrase] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [incomingToken, setIncomingToken] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async (scope: 'active' | 'all') => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const packet = buildSyncPacket(
        state,
        scope === 'active' && activeConversation ? activeConversation.id : undefined,
      );
      const token = passphrase.trim()
        ? await encryptSyncPacket(packet, passphrase.trim())
        : encodeSyncPacket(packet);
      setGeneratedToken(token);
      setStatusMsg(
        passphrase.trim()
          ? 'Paquet xifrat amb AES-GCM generat correctament.'
          : 'Paquet de sincronització generat.',
      );
    } catch {
      setErrorMsg('No s’ha pogut generar el paquet.');
    }
  };

  const handleCopyLink = async () => {
    if (!generatedToken) return;
    const url = `${window.location.origin}${window.location.pathname}#sync=${generatedToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback
    }
  };

  const handleMergeIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const clean = incomingToken.trim().replace(/^.*#sync=/, '');
      const packet = clean.startsWith('ENC1.')
        ? await decryptSyncPacket(clean, importPassphrase.trim())
        : decodeSyncPacket(clean);
      onImportPacket(packet);
      setIncomingToken('');
      setStatusMsg(`Fusionats ${packet.messages.length} missatges sense duplicats.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Format invàlid.');
    }
  };

  const handleDownloadJson = () => {
    const packet = buildSyncPacket(state);
    const blob = new Blob([JSON.stringify(packet, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SyncPacket;
      if (parsed.version !== 1 || !Array.isArray(parsed.messages)) {
        throw new Error('JSON invàlid');
      }
      onImportPacket(parsed);
      setStatusMsg(`Importats ${parsed.messages.length} missatges.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'sync')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Naan · {t(language, 'sync')} & HTML
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GitHub Pages · Zero APIs · BroadcastChannel + AES-GCM
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('sync')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === 'sync'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            #sync=
          </button>
          <button
            type="button"
            onClick={() => setTab('archive')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === 'archive'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            HTML / JSON
          </button>
        </div>

        {statusMsg && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            {statusMsg}
          </p>
        )}
        {errorMsg && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMsg}
          </p>
        )}

        {tab === 'sync' ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-3 text-[11px] leading-relaxed text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
              <p className="font-bold text-slate-900 dark:text-white">
                {t(language, 'howToChatTitle')}
              </p>
              <p className="mt-1">
                <strong className="font-semibold">{t(language, 'modeTabsTitle')}:</strong>{' '}
                {t(language, 'modeTabsSteps')}
              </p>
              <p className="mt-1">
                <strong className="font-semibold">{t(language, 'modeSyncTitle')}:</strong>{' '}
                {t(language, 'modeSyncSteps')}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  BroadcastChannel
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(language, 'newTabTitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenDuplicateTab}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>+ Tab</span>
              </button>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 start-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="AES-GCM passphrase (optional)"
                  aria-label="AES-GCM passphrase"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {activeConversation && (
                  <button
                    type="button"
                    onClick={() => void handleGenerate('active')}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {activeConversation.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleGenerate('all')}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {t(language, 'generateSyncBtn')}
                </button>
              </div>

              {generatedToken && (
                <div className="mt-2 space-y-2">
                  <textarea
                    readOnly
                    rows={3}
                    value={generatedToken}
                    aria-label="Sync packet"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{t(language, 'copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t(language, 'copyFullSyncLink')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <form
              onSubmit={handleMergeIncoming}
              className="space-y-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
            >
              <textarea
                rows={2}
                value={incomingToken}
                onChange={(e) => setIncomingToken(e.target.value)}
                placeholder="#sync=..."
                aria-label="#sync="
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {incomingToken.includes('ENC1.') && (
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  placeholder="AES-GCM passphrase"
                  aria-label="AES-GCM passphrase"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!incomingToken.trim()}
                  className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800"
                >
                  {t(language, 'confirm')}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeConversation && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {activeConversation.name} (.html)
                </h3>
                <button
                  type="button"
                  onClick={() => onExportStandaloneHtml(activeConversation.id)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t(language, 'downloadHtmlArchive')}</span>
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                JSON Backup
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t(language, 'exportBtn')} JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>JSON</span>
                </button>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportJson(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. QuickSwitcherModal                                                      */
/* -------------------------------------------------------------------------- */

interface QuickSwitcherModalProps {
  conversations: Conversation[];
  messages: Message[];
  users: UserProfile[];
  language: LanguageCode;
  onClose: () => void;
  onSelectConversation: (conversationId: string, messageId?: string) => void;
}

export function QuickSwitcherModal({
  conversations,
  messages,
  users,
  language,
  onClose,
  onSelectConversation,
}: QuickSwitcherModalProps) {
  const [query, setQuery] = useState('');
  const convMap = useMemo(
    () => new Map(conversations.map((c) => [c.id, c])),
    [conversations],
  );
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const matchingConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations.slice(0, 6);
    return conversations
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [conversations, query]);

  const matchingMessages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return messages
      .filter((m) => !m.deleted && m.content.toLowerCase().includes(q))
      .slice(-8)
      .reverse();
  }, [messages, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'quickSearch')}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{opacity: 0, y: -12, scale: 0.97}}
        animate={{opacity: 1, y: 0, scale: 1}}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(language, 'searchConversations')}
            aria-label={t(language, 'quickSearch')}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {matchingConversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelectConversation(c.id);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Avatar name={c.name} color={c.color} kind={c.type} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {c.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {c.description}
                </p>
              </div>
            </button>
          ))}

          {matchingMessages.map((m) => {
            const conv = convMap.get(m.conversationId);
            const author = userMap.get(m.senderId);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectConversation(m.conversationId, m.id);
                  onClose();
                }}
                className="w-full rounded-xl px-2.5 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {author?.name ?? ''} · {conv?.name ?? ''}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatTimeShort(m.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                  {m.content}
                </p>
              </button>
            );
          })}

          {matchingConversations.length === 0 && matchingMessages.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {t(language, 'noConversationsFound')}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. ProfileModal                                                            */
/* -------------------------------------------------------------------------- */

const PROFILE_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#EC4899',
  '#0D9488',
  '#059669',
  '#EA580C',
  '#0F172A',
];

interface ProfileModalProps {
  user: UserProfile;
  language: LanguageCode;
  onClose: () => void;
  onSaveProfile: (input: {name: string; handle: string; role: string; color: string}) => void;
}

export function ProfileModal({user, language, onClose, onSaveProfile}: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [role, setRole] = useState(user.role);
  const [color, setColor] = useState(user.color);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onSaveProfile({name, handle, role, color});
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'profileSettings')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.94, y: 12}}
        animate={{opacity: 1, scale: 1, y: 0}}
        transition={{type: 'spring', stiffness: 360, damping: 28}}
        className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'profileSettings')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <Avatar name={name || 'Naan'} color={color} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {name || 'Naan'}
            </p>
            <p dir="ltr" className="truncate text-xs text-slate-500 dark:text-slate-400">
              {handle.startsWith('@') ? handle : `@${handle}`} · {role || 'Naan Local'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {t(language, 'fullName')}
            </label>
            <input
              id="profile-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="profile-handle" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t(language, 'username')}
              </label>
              <input
                id="profile-handle"
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="profile-role" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t(language, 'roleOptional')}
              </label>
              <input
                id="profile-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              {t(language, 'avatarColor')}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={color === c}
                  style={{backgroundColor: c}}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-2 dark:ring-white' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t(language, 'saveChanges')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. SketchModal                                                             */
/* -------------------------------------------------------------------------- */

const BRUSH_COLORS = ['#0F172A', '#2563EB', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];

interface SketchModalProps {
  language: LanguageCode;
  onClose: () => void;
  onSendSketch: (attachment: Attachment) => void;
}

export function SketchModal({language, onClose, onSendSketch}: SketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#2563EB');
  const [brushSize, setBrushSize] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const {x, y} = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const {x, y} = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (historyRef.current.length > 20) historyRef.current.shift();
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    ctx.putImageData(prev, 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const approxSize = Math.round((dataUrl.length * 3) / 4);
    onSendSketch({
      id: createId('sketch'),
      name: `dibuix-naan-${Date.now().toString().slice(-4)}.png`,
      mimeType: 'image/png',
      size: approxSize,
      dataUrl,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'sketchpad')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.94, y: 12}}
        animate={{opacity: 1, scale: 1, y: 0}}
        className="w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'sketchpad')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrushColor(c)}
                aria-label={c}
                style={{backgroundColor: c}}
                className={`h-6 w-6 rounded-full transition-transform ${
                  brushColor === c ? 'scale-115 ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[2, 4, 8].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setBrushSize(sz)}
                aria-label={`Size ${sz}`}
                className={`rounded-lg border px-2 py-1 text-xs font-mono ${
                  brushSize === sz
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="mt-3 w-full cursor-crosshair touch-none rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-700"
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t(language, 'sketchUndo')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>{t(language, 'sketchClear')}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {t(language, 'sketchSend')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. HowToChatModal                                                          */
/* -------------------------------------------------------------------------- */

interface HowToChatModalProps {
  language: LanguageCode;
  onClose: () => void;
  onOpenLiveRoom: () => void;
  onOpenDuplicateTab: () => void;
  onOpenSyncModal: () => void;
}

export function HowToChatModal({
  language,
  onClose,
  onOpenLiveRoom,
  onOpenDuplicateTab,
  onOpenSyncModal,
}: HowToChatModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'howToChatTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.94, y: 12}}
        animate={{opacity: 1, scale: 1, y: 0}}
        transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
        className="w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <HelpCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t(language, 'howToChatTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t(language, 'howToChatSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/75 p-3.5 dark:border-emerald-900/70 dark:bg-emerald-950/35">
            <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
              {t(language, 'liveRoomTitle')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/85">
              {t(language, 'liveRoomDesc')}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLiveRoom();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>{t(language, 'createLiveRoom')}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t(language, 'modeTabsTitle')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t(language, 'modeTabsSteps')}
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenDuplicateTab();
                onClose();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{t(language, 'newTabTitle')} (+ Tab)</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t(language, 'modeSyncTitle')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t(language, 'modeSyncSteps')}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSyncModal();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>{t(language, 'sync')} (#sync=)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. LiveRoomModal                                                           */
/* -------------------------------------------------------------------------- */

interface LiveRoomModalProps {
  language: LanguageCode;
  initialTab?: 'create' | 'join';
  onClose: () => void;
  onJoinOrCreateRoom: (input: {
    roomCode: string;
    roomName?: string;
    customServerUrl?: string;
    reconnectTransport?: boolean;
  }) => void;
}

export function LiveRoomModal({
  language,
  initialTab = 'create',
  onClose,
  onJoinOrCreateRoom,
}: LiveRoomModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [roomName, setRoomName] = useState('');
  const [createdCode, setCreatedCode] = useState(() => generateRoomCode());
  const [joinInput, setJoinInput] = useState('');
  const [customServerUrl, setCustomServerUrl] = useState(() => getSavedCustomServerUrl());
  const [modePref, setModePref] = useState<LiveModePreference>(() =>
    getSavedLiveModePreference(),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urlChanged = customServerUrl !== getSavedCustomServerUrl();
    const modeChanged = modePref !== getSavedLiveModePreference();
    if (urlChanged) {
      saveCustomServerUrl(customServerUrl);
    }
    if (modeChanged) {
      saveLiveModePreference(modePref);
    }
    const reconnectTransport = urlChanged || modeChanged;

    if (tab === 'create') {
      const code = normalizeRoomCode(createdCode) || generateRoomCode();
      onJoinOrCreateRoom({
        roomCode: code,
        roomName: roomName.trim() || `sala-${code.toLowerCase()}`,
        customServerUrl: customServerUrl.trim() || undefined,
        reconnectTransport,
      });
      onClose();
      return;
    }

    const parsedCode = normalizeRoomCode(joinInput);
    if (!parsedCode) return;
    onJoinOrCreateRoom({
      roomCode: parsedCode,
      customServerUrl: customServerUrl.trim() || undefined,
      reconnectTransport,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'liveRoomTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{opacity: 0, scale: 0.94, y: 12}}
        animate={{opacity: 1, scale: 1, y: 0}}
        transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
        className="w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t(language, 'liveRoomTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t(language, 'liveRoomDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'cancel')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === 'create'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t(language, 'createLiveRoom')}
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === 'join'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t(language, 'joinLiveRoom')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {tab === 'create' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t(language, 'roomNamePlaceholder')}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="general-live"
                  aria-label={t(language, 'roomNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t(language, 'liveRoomCode')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdCode}
                    onChange={(e) => setCreatedCode(normalizeRoomCode(e.target.value))}
                    aria-label={t(language, 'liveRoomCode')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-bold tracking-wider text-slate-900 uppercase focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setCreatedCode(generateRoomCode())}
                    aria-label="Regenerate code"
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t(language, 'liveRoomCode')}
              </label>
              <input
                type="text"
                autoFocus
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder={t(language, 'roomCodePlaceholder')}
                aria-label={t(language, 'roomCodePlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {showAdvanced ? '▾ ' : '▸ '}
              {t(language, 'serverUrlOptional')}
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {t(language, 'liveRelayModeLabel')}
                  </label>
                  <select
                    value={modePref}
                    onChange={(e) => setModePref(e.target.value as LiveModePreference)}
                    aria-label={t(language, 'liveRelayModeLabel')}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="auto">{t(language, 'liveModeAuto')}</option>
                    <option value="relay">{t(language, 'liveModeRelay')}</option>
                  </select>
                </div>
                <input
                  type="url"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="https://..."
                  aria-label={t(language, 'serverUrlOptional')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={tab === 'join' && !normalizeRoomCode(joinInput)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>
                {tab === 'create' ? t(language, 'createRoomBtn') : t(language, 'joinRoomBtn')}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}



