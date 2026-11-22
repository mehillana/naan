import {Check, Copy} from 'lucide-react';
import {useState} from 'react';
import {parseInlineTokens, parseMarkdownBlocks} from '../utils/chatLogic';

interface MarkdownTextProps {
  content: string;
  highlightQuery?: string;
  inverted?: boolean;
}

function renderHighlightedText(text: string, query?: string) {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={idx}
        className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-500/35 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function InlineLine({
  text,
  highlightQuery,
  inverted,
}: {
  text: string;
  highlightQuery?: string;
  inverted?: boolean;
}) {
  const tokens = parseInlineTokens(text);

  return (
    <>
      {tokens.map((tok, index) => {
        switch (tok.type) {
          case 'bold':
            return (
              <strong
                key={index}
                className={
                  inverted ? 'font-bold text-white' : 'font-semibold text-slate-950 dark:text-white'
                }
              >
                {renderHighlightedText(tok.value, highlightQuery)}
              </strong>
            );
          case 'italic':
            return (
              <em key={index} className="italic">
                {renderHighlightedText(tok.value, highlightQuery)}
              </em>
            );
          case 'strike':
            return (
              <del key={index} className="line-through opacity-75">
                {renderHighlightedText(tok.value, highlightQuery)}
              </del>
            );
          case 'code':
            return (
              <code
                key={index}
                dir="ltr"
                className={`rounded-md px-1.5 py-0.5 font-mono text-[0.84em] ${
                  inverted
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900/5 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {tok.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={index}
                href={tok.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-medium underline underline-offset-2 ${
                  inverted
                    ? 'text-white decoration-white/60 hover:decoration-white'
                    : 'text-blue-600 decoration-blue-600/30 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/40'
                }`}
              >
                {tok.label}
              </a>
            );
          default:
            return <span key={index}>{renderHighlightedText(tok.value, highlightQuery)}</span>;
        }
      })}
    </>
  );
}

function CodeBlock({lang, code}: {lang: string; code: string}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div
      dir="ltr"
      className="my-2 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 text-left text-slate-100 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
        <span className="font-mono">{lang || 'codi'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copia el bloc de codi"
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Copiat</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copia</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownText({content, highlightQuery, inverted = false}: MarkdownTextProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div
      className={`space-y-1.5 text-[14.5px] leading-relaxed break-words ${
        inverted ? 'text-white' : 'text-slate-800 dark:text-slate-100'
      }`}
    >
      {blocks.map((block, idx) => {
        if (block.type === 'codeblock') {
          return <CodeBlock key={idx} lang={block.lang} code={block.code} />;
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className={`rounded-lg border px-3 py-2 text-sm ${
                inverted
                  ? 'border-white/25 bg-white/15 text-white/95'
                  : 'border-slate-200 bg-slate-50/80 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300'
              }`}
            >
              {block.lines.map((line, lIdx) => (
                <div key={lIdx}>
                  <InlineLine text={line} highlightQuery={highlightQuery} inverted={inverted} />
                </div>
              ))}
            </blockquote>
          );
        }

        const lines = block.text.split('\n');
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {lIdx > 0 && '\n'}
                <InlineLine text={line} highlightQuery={highlightQuery} inverted={inverted} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
