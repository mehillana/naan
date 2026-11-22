import {
  Check,
  CheckCheck,
  CheckSquare,
  Copy,
  Download,
  FileText,
  Pause,
  Pencil,
  Pin,
  Play,
  Reply,
  SmilePlus,
  Square,
  Star,
  Trash2,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useEffect, useRef, useState} from 'react';
import {t} from '../i18n/translations';
import type {NaanThemePreset} from '../themes/themes';
import type {LanguageCode, Message, UserProfile} from '../types/chat';
import {formatBytes, formatTimeShort, stripMarkdownForPreview} from '../utils/chatLogic';
import {Avatar} from './Avatar';
import {MarkdownText} from './MarkdownText';

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '💡', '👏', '🔥'];

function VoiceAttachmentPlayer({
  dataUrl,
  name,
  isOwn,
}: {
  dataUrl: string;
  name: string;
  isOwn: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  return (
    <div
      className={`flex min-w-[210px] items-center gap-2.5 rounded-xl border px-3 py-2 ${
        isOwn
          ? 'border-white/25 bg-white/15 text-white'
          : 'border-slate-200/80 bg-white/75 text-slate-800 dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <audio ref={audioRef} src={dataUrl} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isOwn ? 'bg-white text-slate-900' : 'bg-blue-600 text-white'
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ms-0.5 h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex h-3.5 items-center gap-0.5" aria-hidden="true">
          {[45, 80, 55, 95, 65, 85, 50, 75, 90, 60, 80, 45].map((h, i) => (
            <span
              key={i}
              style={{height: `${h}%`, animationDelay: `${i * 0.07}s`}}
              className={`w-1 rounded-full ${
                playing ? 'animate-wave-bar' : ''
              } ${
                (i / 12) * 100 <= progress
                  ? isOwn
                    ? 'bg-white'
                    : 'bg-blue-600'
                  : isOwn
                    ? 'bg-white/40'
                    : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
        <p className="truncate font-mono text-[10px] opacity-80">{name}</p>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  author?: UserProfile;
  replyTarget?: Message;
  replyAuthor?: UserProfile;
  currentUserId: string;
  theme: NaanThemePreset;
  language: LanguageCode;
  grouped: boolean;
  isHighlighted: boolean;
  searchQuery?: string;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onTogglePin: (messageId: string) => void;
  onToggleStar: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onToggleChecklist: (messageId: string, itemId: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onPreviewImage: (url: string, name: string) => void;
}

export function MessageItem({
  message,
  author,
  replyTarget,
  replyAuthor,
  currentUserId,
  theme,
  language,
  grouped,
  isHighlighted,
  searchQuery,
  onReply,
  onReact,
  onTogglePin,
  onToggleStar,
  onEdit,
  onDelete,
  onVotePoll,
  onToggleChecklist,
  onJumpToMessage,
  onPreviewImage,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftEdit, setDraftEdit] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);

  const isOwn = message.senderId === currentUserId;
  const authorName = author?.name ?? 'Contacte';
  const authorColor = author?.color ?? '#64748B';

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftEdit.trim();
    if (!trimmed) return;
    onEdit(message.id, trimmed);
    setIsEditing(false);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable
    }
  };

  const reactionEntries = Object.entries(message.reactions).filter(
    ([, ids]) => ids.length > 0,
  );

  const isInteractiveCard = Boolean(message.poll || message.checklist);
  const isSticker = Boolean(message.sticker);

  return (
    <motion.article
      id={`msg-${message.id}`}
      data-testid="chat-message"
      initial={{opacity: 0, y: 12, scale: 0.97}}
      animate={{opacity: 1, y: 0, scale: 1}}
      transition={{type: 'spring', stiffness: 360, damping: 28}}
      className={`group relative flex gap-2.5 px-4 sm:px-6 ${
        grouped ? 'py-0.5' : 'pt-3 pb-1'
      } ${isOwn ? 'justify-end' : 'justify-start'} ${
        isHighlighted ? 'rounded-xl bg-blue-500/15' : ''
      }`}
    >
      {/* Peer Avatar */}
      {!isOwn && (
        <div className="flex w-9 shrink-0 justify-center pt-0.5">
          {!grouped ? <Avatar name={authorName} color={authorColor} size="sm" /> : null}
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`relative flex max-w-[85%] flex-col sm:max-w-[74%] ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {!grouped && !isOwn && (
          <div className="mb-1 flex items-baseline gap-2 px-1">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {authorName}
            </span>
            {author?.handle && (
              <span dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400">
                {author.handle}
              </span>
            )}
            {message.pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                <Pin className="h-3 w-3" />
                {t(language, 'pin')}
              </span>
            )}
          </div>
        )}

        {/* Animated Sticker Message */}
        {isSticker && message.sticker && !message.deleted ? (
          <motion.div
            initial={{scale: 0.6, rotate: -8}}
            animate={{scale: 1, rotate: 0}}
            whileHover={{scale: 1.06, rotate: 2}}
            transition={{type: 'spring', stiffness: 420, damping: 18}}
            style={{background: message.sticker.gradient}}
            className="rounded-3xl px-5 py-3.5 text-white shadow-lg"
          >
            <div className="flex items-center gap-3">
              <motion.span
                animate={{rotate: [0, -8, 8, 0]}}
                transition={{duration: 2.2, repeat: Infinity, repeatDelay: 2.5}}
                className="text-3xl"
              >
                {message.sticker.emoji}
              </motion.span>
              <div>
                <p className="text-base font-extrabold tracking-tight">{message.sticker.label}</p>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/85">
                  <time className="font-mono tabular-nums">
                    {formatTimeShort(message.createdAt)}
                  </time>
                  {isOwn && <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Standard / Card Bubble */
          <div
            style={
              isOwn && !message.deleted && !isEditing && !isInteractiveCard
                ? {background: theme.ownBubbleGradient}
                : undefined
            }
            className={`relative rounded-2xl px-3.5 py-2.5 transition-shadow ${
              message.deleted
                ? 'border border-slate-200/70 bg-white/40 italic text-slate-400 dark:border-slate-800 dark:bg-slate-900/40'
                : isEditing || isInteractiveCard
                  ? `${theme.peerBubbleGlass} min-w-[260px] sm:min-w-[340px]`
                  : isOwn
                    ? 'rounded-te-sm text-white shadow-sm'
                    : `${theme.peerBubbleGlass} rounded-ts-sm text-slate-800 dark:text-slate-100`
            }`}
          >
            {/* Quoted Reply */}
            {replyTarget && (
              <button
                type="button"
                onClick={() => onJumpToMessage(replyTarget.id)}
                className={`mb-2 flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-start text-xs transition-colors ${
                  isOwn && !isInteractiveCard
                    ? 'border-white/25 bg-white/15 text-white hover:bg-white/25'
                    : 'border-slate-200/80 bg-white/60 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
                }`}
              >
                <Reply className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0 font-semibold">
                  {replyAuthor?.name ?? 'Missatge'}:
                </span>
                <span className="truncate">
                  {replyTarget.deleted
                    ? t(language, 'deletedMessage')
                    : stripMarkdownForPreview(replyTarget.content)}
                </span>
              </button>
            )}

            {message.deleted ? (
              <p className="text-xs">{t(language, 'deletedMessage')}</p>
            ) : isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-2">
                <textarea
                  value={draftEdit}
                  onChange={(e) => setDraftEdit(e.target.value)}
                  rows={3}
                  aria-label={t(language, 'edit')}
                  className="w-full rounded-xl border border-blue-400 bg-white p-2.5 text-sm text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    style={{background: theme.accentGradient}}
                    className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                  >
                    {t(language, 'saveChanges')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setDraftEdit(message.content);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    {t(language, 'cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {message.content && !message.poll && !message.checklist && (
                  <MarkdownText
                    content={message.content}
                    highlightQuery={searchQuery}
                    inverted={isOwn}
                  />
                )}

                {/* Poll Card */}
                {message.poll && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {message.poll.question}
                    </p>
                    <div className="space-y-1.5">
                      {(() => {
                        const totalVotes = message.poll.options.reduce(
                          (sum, opt) => sum + opt.voterIds.length,
                          0,
                        );
                        return message.poll.options.map((opt) => {
                          const pct =
                            totalVotes > 0
                              ? Math.round((opt.voterIds.length / totalVotes) * 100)
                              : 0;
                          const voted = opt.voterIds.includes(currentUserId);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => onVotePoll(message.id, opt.id)}
                              aria-pressed={voted}
                              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-start text-xs transition-colors ${
                                voted
                                  ? 'border-blue-500 bg-blue-500/10 dark:border-blue-400'
                                  : 'border-slate-200/80 bg-white/70 hover:bg-white dark:border-slate-700 dark:bg-slate-950/60'
                              }`}
                            >
                              <motion.div
                                initial={{width: 0}}
                                animate={{width: `${pct}%`}}
                                transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
                                className="pointer-events-none absolute inset-y-0 start-0 bg-blue-500/15"
                              />
                              <div className="relative flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {voted ? '✓ ' : ''}
                                  {opt.text}
                                </span>
                                <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                  {opt.voterIds.length} ({pct}%)
                                </span>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Interactive Checklist Card */}
                {message.checklist && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {message.checklist.title}
                      </p>
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        {message.checklist.items.filter((i) => i.done).length}/
                        {message.checklist.items.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {message.checklist.items.map((item) => (
                        <li key={item.id}>
                          <motion.button
                            type="button"
                            whileTap={{scale: 0.98}}
                            onClick={() => onToggleChecklist(message.id, item.id)}
                            aria-pressed={item.done}
                            className="flex w-full items-center gap-2 rounded-xl bg-white/60 px-2.5 py-1.5 text-start text-xs transition-colors hover:bg-white dark:bg-slate-950/50 dark:hover:bg-slate-900"
                          >
                            {item.done ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span
                              className={
                                item.done
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-800 dark:text-slate-100'
                              }
                            >
                              {item.text}
                            </span>
                          </motion.button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Attachments (Images, Voice Audio Player, Generic Files) */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((att) => {
                      if (att.mimeType.startsWith('image/')) {
                        return (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => onPreviewImage(att.dataUrl, att.name)}
                            className="overflow-hidden rounded-xl border border-white/40 bg-black/10 text-start"
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              referrerPolicy="no-referrer"
                              className="max-h-56 max-w-xs object-cover transition-transform duration-150 hover:scale-[1.02]"
                            />
                          </button>
                        );
                      }
                      if (att.mimeType.startsWith('audio/')) {
                        return (
                          <VoiceAttachmentPlayer
                            key={att.id}
                            dataUrl={att.dataUrl}
                            name={att.name}
                            isOwn={isOwn && !isInteractiveCard}
                          />
                        );
                      }
                      return (
                        <a
                          key={att.id}
                          href={att.dataUrl}
                          download={att.name}
                          className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                            isOwn
                              ? 'border-white/30 bg-white/15 text-white hover:bg-white/25'
                              : 'border-slate-200 bg-white/80 text-slate-800 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="max-w-[160px] truncate font-medium">{att.name}</span>
                          <span className="font-mono text-[10px] opacity-80 tabular-nums">
                            {formatBytes(att.size)}
                          </span>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Timestamp + Starred + Edited + WhatsApp Double Checkmarks */}
                <div
                  className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                    isOwn && !isInteractiveCard
                      ? 'text-white/80'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {message.starred && (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  )}
                  {message.pinned && isOwn && <Pin className="h-3 w-3" />}
                  {message.edited && <span>{t(language, 'edited')}</span>}
                  <time
                    dateTime={new Date(message.createdAt).toISOString()}
                    className="font-mono tabular-nums"
                  >
                    {formatTimeShort(message.createdAt)}
                  </time>
                  {isOwn && <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                </div>
              </>
            )}
          </div>
        )}

        {/* Reactions Row */}
        {reactionEntries.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 px-1">
            {reactionEntries.map(([emoji, userIds]) => {
              const active = userIds.includes(currentUserId);
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  initial={{scale: 0.7}}
                  animate={{scale: 1}}
                  whileTap={{scale: 0.88}}
                  onClick={() => onReact(message.id, emoji)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs backdrop-blur-md transition-colors ${
                    active
                      ? 'border-blue-400 bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : 'border-white/60 bg-white/75 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-mono text-[11px] font-semibold tabular-nums">
                    {userIds.length}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Hover Action Toolbar */}
        {!message.deleted && !isEditing && (
          <div
            className={`absolute -top-3 ${
              isOwn ? 'start-0 -translate-x-2' : 'end-0 translate-x-2'
            } z-10 flex items-center gap-0.5 rounded-xl border border-white/70 bg-white/90 p-1 shadow-md backdrop-blur-xl transition-opacity dark:border-slate-700 dark:bg-slate-900/95 ${
              emojiMenuOpen
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100'
            }`}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmojiMenuOpen((v) => !v)}
                aria-label={t(language, 'react')}
                title={t(language, 'react')}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {emojiMenuOpen && (
                  <motion.div
                    initial={{opacity: 0, scale: 0.9, y: 4}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.9, y: 4}}
                    className="absolute end-0 bottom-full mb-1 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onReact(message.id, emoji);
                          setEmojiMenuOpen(false);
                        }}
                        className="rounded-lg px-1.5 py-1 text-sm transition-transform hover:scale-115 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => onReply(message)}
              aria-label={t(language, 'reply')}
              title={t(language, 'reply')}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onToggleStar(message.id)}
              aria-label={message.starred ? t(language, 'unstarMessage') : t(language, 'starMessage')}
              title={message.starred ? t(language, 'unstarMessage') : t(language, 'starMessage')}
              className={`rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                message.starred ? 'text-amber-500' : 'text-slate-500'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${message.starred ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => onTogglePin(message.id)}
              aria-label={message.pinned ? t(language, 'unpin') : t(language, 'pin')}
              title={message.pinned ? t(language, 'unpin') : t(language, 'pin')}
              className={`rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                message.pinned ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              aria-label={t(language, 'copy')}
              title={t(language, 'copy')}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {isOwn && (
              <>
                {!isInteractiveCard && !isSticker && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftEdit(message.content);
                      setIsEditing(true);
                    }}
                    aria-label={t(language, 'edit')}
                    title={t(language, 'edit')}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  aria-label={t(language, 'delete')}
                  title={t(language, 'delete')}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
