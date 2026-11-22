import {
  BarChart2,
  Bold,
  CheckSquare,
  Code,
  Code2,
  Italic,
  Mic,
  Paperclip,
  PenTool,
  Plus,
  Quote,
  Reply,
  SendHorizontal,
  Smile,
  Sparkles,
  Square,
  Strikethrough,
  Type,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useEffect, useRef, useState} from 'react';
import {t} from '../i18n/translations';
import type {NaanThemePreset} from '../themes/themes';
import type {
  Attachment,
  LanguageCode,
  Message,
  MessageEffect,
  MessageSticker,
  UserProfile,
} from '../types/chat';
import {createId, formatBytes, stripMarkdownForPreview} from '../utils/chatLogic';

const COMPOSER_EMOJIS = [
  '😀', '😊', '🎉', '👍', '❤️', '🔥',
  '💡', '✅', '🚀', '👏', '🤔', '🙌',
  '📌', '⚡', '✨', '💬', '📎', '🛠️',
];

const ANIMATED_STICKERS: MessageSticker[] = [
  {
    id: 'stk_party',
    emoji: '🎉',
    label: 'Festa!',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
  },
  {
    id: 'stk_rocket',
    emoji: '🚀',
    label: 'En marxa!',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
  },
  {
    id: 'stk_sparkle',
    emoji: '✨',
    label: 'Brillant!',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
  },
  {
    id: 'stk_fire',
    emoji: '🔥',
    label: 'Top!',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)',
  },
  {
    id: 'stk_love',
    emoji: '💜',
    label: 'Gràcies!',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  },
  {
    id: 'stk_done',
    emoji: '✅',
    label: 'Fet!',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
  },
];

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

interface ComposerProps {
  conversationId: string;
  conversationName: string;
  draft: string;
  theme: NaanThemePreset;
  language: LanguageCode;
  replyTo?: Message;
  replyAuthor?: UserProfile;
  typingUsers: string[];
  onDraftChange: (value: string) => void;
  onTypingSignal: (isTyping: boolean) => void;
  onCancelReply: () => void;
  onOpenPollModal: () => void;
  onOpenChecklistModal: () => void;
  onOpenSketchModal: () => void;
  onSendMessage: (
    content: string,
    attachments: Attachment[],
    options?: {sticker?: MessageSticker; effect?: MessageEffect},
  ) => void;
}

export function Composer({
  conversationId,
  conversationName,
  draft,
  theme,
  language,
  replyTo,
  replyAuthor,
  typingUsers,
  onDraftChange,
  onTypingSignal,
  onCancelReply,
  onOpenPollModal,
  onOpenChecklistModal,
  onOpenSketchModal,
  onSendMessage,
}: ComposerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers'>('emoji');
  const [formatBarOpen, setFormatBarOpen] = useState(false);
  const [celebrateOnSend, setCelebrateOnSend] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setAttachments([]);
    setMenuOpen(false);
    setEmojiOpen(false);
    setAttachError(null);
  }, [conversationId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) window.clearInterval(recordIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);

    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`«${file.name}» > 2 MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Read error'));
        reader.readAsDataURL(file);
      });
      next.push({
        id: createId('att'),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
      });
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  const startVoiceRecording = async () => {
    setAttachError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAttachError('Micròfon no disponible en aquest navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, {type: recorder.mimeType || 'audio/webm'});
        if (blob.size > 0 && blob.size <= MAX_ATTACHMENT_BYTES) {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachments((prev) => [
              ...prev,
              {
                id: createId('voice'),
                name: `nota-veu-${recordSeconds || 1}s.webm`,
                mimeType: blob.type || 'audio/webm',
                size: blob.size,
                dataUrl: String(reader.result),
              },
            ]);
          };
          reader.readAsDataURL(blob);
        }
        setIsRecording(false);
        setRecordSeconds(0);
        if (recordIntervalRef.current) window.clearInterval(recordIntervalRef.current);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setAttachError('Permís de micròfon denegat o no disponible.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordIntervalRef.current) window.clearInterval(recordIntervalRef.current);
    setIsRecording(false);
  };

  const triggerTyping = (hasText: boolean) => {
    onTypingSignal(hasText);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (hasText) {
      typingTimerRef.current = window.setTimeout(() => {
        onTypingSignal(false);
      }, 2200);
    }
  };

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed && attachments.length === 0) return;
    onSendMessage(trimmed, attachments, {
      effect: celebrateOnSend ? 'confetti' : undefined,
    });
    setAttachments([]);
    setEmojiOpen(false);
    setMenuOpen(false);
    setCelebrateOnSend(false);
    onTypingSignal(false);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    textareaRef.current?.focus();
  };

  const handleSendSticker = (sticker: MessageSticker) => {
    onSendMessage(sticker.label, [], {sticker, effect: 'confetti'});
    setEmojiOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const wrapSelection = (before: string, after = before, placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) {
      onDraftChange(`${draft}${before}${placeholder}${after}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end) || placeholder;
    const next = `${draft.slice(0, start)}${before}${selected}${after}${draft.slice(end)}`;
    onDraftChange(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 10);
  };

  const insertCodeTemplate = () => {
    const snippet = draft ? `${draft}\n\`\`\`ts\n\n\`\`\`` : '```ts\n\n```';
    onDraftChange(snippet);
    setMenuOpen(false);
    textareaRef.current?.focus();
  };

  const canSend = Boolean(draft.trim()) || attachments.length > 0;

  return (
    <div
      className={`shrink-0 border-t border-white/40 px-4 pt-2 pb-3.5 sm:px-6 dark:border-slate-800/80 ${theme.headerGlass}`}
    >
      {/* Typing status line */}
      <div className="mb-1 min-h-[16px]">
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.p
              initial={{opacity: 0, y: 4}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 4}}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              <span className="inline-flex gap-0.5" aria-hidden="true">
                {[0, 0.15, 0.3].map((d, i) => (
                  <motion.span
                    key={i}
                    animate={{y: [0, -3, 0]}}
                    transition={{duration: 0.7, repeat: Infinity, delay: d}}
                    className="h-1.5 w-1.5 rounded-full bg-current"
                  />
                ))}
              </span>
              <span>
                {typingUsers.join(', ')}{' '}
                {typingUsers.length === 1 ? t(language, 'typingOne') : t(language, 'typingMany')}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Markdown Quick Formatting Toolbar */}
      <AnimatePresence>
        {formatBarOpen && (
          <motion.div
            initial={{opacity: 0, height: 0, marginBottom: 0}}
            animate={{opacity: 1, height: 'auto', marginBottom: 8}}
            exit={{opacity: 0, height: 0, marginBottom: 0}}
            className="flex flex-wrap items-center gap-1 overflow-hidden rounded-xl border border-white/60 bg-white/70 px-2 py-1 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/75"
          >
            <button
              type="button"
              onClick={() => wrapSelection('**', '**', 'negreta')}
              aria-label="Bold"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*', '*', 'cursiva')}
              aria-label="Italic"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('~~', '~~', 'ratllat')}
              aria-label="Strikethrough"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('`', '`', 'codi')}
              aria-label="Inline code"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('> ', '', 'cita')}
              aria-label="Quote"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 4}}
            className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-xs backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/70"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Reply className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {t(language, 'replyingTo')} {replyAuthor?.name ?? 'missatge'}
                </p>
                <p className="truncate text-slate-500 dark:text-slate-400">
                  {replyTo.deleted
                    ? t(language, 'deletedMessage')
                    : stripMarkdownForPreview(replyTo.content)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label={t(language, 'cancel')}
              className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <motion.div
              key={att.id}
              initial={{opacity: 0, scale: 0.9}}
              animate={{opacity: 1, scale: 1}}
              className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/80 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="max-w-[160px] truncate font-medium text-slate-700 dark:text-slate-200">
                {att.name}
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {formatBytes(att.size)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                }
                aria-label={att.name}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Active Voice Recording Banner */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 6}}
            className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-rose-300/70 bg-rose-50/90 px-3 py-2 text-xs text-rose-700 backdrop-blur-md dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              <span className="font-semibold">{t(language, 'recordingVoice')}</span>
              <div className="flex h-4 items-center gap-0.5" aria-hidden="true">
                {[0, 0.12, 0.24, 0.36, 0.48].map((d, i) => (
                  <span
                    key={i}
                    style={{animationDelay: `${d}s`}}
                    className="animate-wave-bar h-full w-1 rounded-full bg-rose-500"
                  />
                ))}
              </div>
              <span className="font-mono tabular-nums">{recordSeconds}s</span>
            </div>
            <button
              type="button"
              onClick={stopVoiceRecording}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{t(language, 'stopRecording')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {attachError && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {attachError}
        </p>
      )}

      {/* Main Composer Box */}
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-white/70 bg-white/75 p-2 shadow-xs backdrop-blur-xl focus-within:border-blue-500 focus-within:bg-white dark:border-slate-700/80 dark:bg-slate-900/75 dark:focus-within:bg-slate-950">
        {/* + Actions Menu */}
        <div className="relative shrink-0">
          <motion.button
            type="button"
            whileTap={{scale: 0.92}}
            onClick={() => {
              setMenuOpen((v) => !v);
              setEmojiOpen(false);
            }}
            aria-label={t(language, 'attachFile')}
            aria-expanded={menuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Plus className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{opacity: 0, y: 8, scale: 0.95}}
                animate={{opacity: 1, y: 0, scale: 1}}
                exit={{opacity: 0, y: 8, scale: 0.95}}
                transition={{duration: 0.16}}
                className="absolute start-0 bottom-full z-20 mb-2 w-60 rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl dark:border-slate-700 dark:bg-slate-900/95"
              >
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>{t(language, 'attachFile')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSketchModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <PenTool className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  <span>{t(language, 'sketchpad')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenPollModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <BarChart2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t(language, 'createPoll')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenChecklistModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CheckSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>{t(language, 'createChecklist')}</span>
                </button>
                <button
                  type="button"
                  onClick={insertCodeTemplate}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Code2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span>{t(language, 'insertCode')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value);
            triggerTyping(e.target.value.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            if (e.clipboardData.files && e.clipboardData.files.length > 0) {
              void handleFiles(e.clipboardData.files);
            }
          }}
          placeholder={`${t(language, 'writeMessageTo')} ${conversationName}...`}
          aria-label={`${t(language, 'writeMessageTo')} ${conversationName}`}
          className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        {/* Formatting Toolbar Toggle */}
        <button
          type="button"
          onClick={() => setFormatBarOpen((v) => !v)}
          aria-label={t(language, 'formattingTools')}
          aria-pressed={formatBarOpen}
          title={t(language, 'formattingTools')}
          className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:inline-flex ${
            formatBarOpen
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <Type className="h-4 w-4" />
        </button>

        {/* Celebration Effect Toggle */}
        <button
          type="button"
          onClick={() => setCelebrateOnSend((v) => !v)}
          aria-label={t(language, 'celebrationEffect')}
          aria-pressed={celebrateOnSend}
          title={t(language, 'celebrationEffect')}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            celebrateOnSend
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
              : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {/* Voice Note Trigger */}
        <button
          type="button"
          onClick={() => (isRecording ? stopVoiceRecording() : void startVoiceRecording())}
          aria-label={t(language, 'voiceNote')}
          aria-pressed={isRecording}
          title={t(language, 'voiceNote')}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isRecording
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>

        {/* Emoji & Animated Stickers Picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setEmojiOpen((v) => !v);
              setMenuOpen(false);
            }}
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Smile className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {emojiOpen && (
              <motion.div
                initial={{opacity: 0, y: 8, scale: 0.95}}
                animate={{opacity: 1, y: 0, scale: 1}}
                exit={{opacity: 0, y: 8, scale: 0.95}}
                transition={{duration: 0.16}}
                className="absolute end-0 bottom-full z-20 mb-2 w-64 rounded-2xl border border-white/70 bg-white/95 p-2.5 shadow-xl backdrop-blur-2xl dark:border-slate-700 dark:bg-slate-900/95"
              >
                <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setPickerTab('emoji')}
                    className={`rounded-lg py-1 text-[11px] font-semibold ${
                      pickerTab === 'emoji'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    {t(language, 'emojisTab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab('stickers')}
                    className={`rounded-lg py-1 text-[11px] font-semibold ${
                      pickerTab === 'stickers'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    {t(language, 'stickersTab')}
                  </button>
                </div>

                {pickerTab === 'emoji' ? (
                  <div className="grid grid-cols-6 gap-1">
                    {COMPOSER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onDraftChange(`${draft}${emoji}`);
                          setEmojiOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="rounded-lg p-1.5 text-base transition-transform hover:scale-110 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {ANIMATED_STICKERS.map((stk) => (
                      <motion.button
                        key={stk.id}
                        type="button"
                        whileHover={{scale: 1.04}}
                        whileTap={{scale: 0.94}}
                        onClick={() => handleSendSticker(stk)}
                        style={{background: stk.gradient}}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-white shadow-xs"
                      >
                        <span className="text-base">{stk.emoji}</span>
                        <span>{stk.label}</span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          whileHover={canSend ? {scale: 1.03} : undefined}
          whileTap={canSend ? {scale: 0.95} : undefined}
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label={t(language, 'send')}
          style={canSend ? {background: theme.accentGradient} : undefined}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          <SendHorizontal className="h-4 w-4 rtl:rotate-180" />
          <span className="hidden sm:inline">{t(language, 'send')}</span>
        </motion.button>
      </div>
    </div>
  );
}
