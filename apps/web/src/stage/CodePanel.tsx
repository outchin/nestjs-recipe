import type { ReactNode } from 'react';
import type { Snippet, SnippetFile } from './types';

/*
 * "The code behind this step": real snippets from apps/api/src (copied by scripts/extract-snippets.mts),
 * with the lines that decide the outcome highlighted, and the exact statement the run sent when there is one.
 */

export interface CodeRef {
  /** snippet id inside the lab, e.g. 'create-index' */
  id: string;
  /** lines containing any of these strings are the key lines */
  highlight?: string[];
}
export interface CodeView {
  refs: CodeRef[];
  /** one or two sentences: what this code does to the result (numbers come from the run) */
  note?: ReactNode;
  /** the statement actually sent in this run (e.g. SQL with names resolved) */
  ran?: string;
}

// a tiny highlighter: comments, strings, decorators, keywords, numbers. Good enough for short TS snippets.
const TOKEN = /(\/\/.*$)|(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(@\w+)|\b(const|let|await|async|return|if|else|throw|new|true|false|null|typeof)\b|\b(\d+)\b/g;
const CLASS = ['', 'tk-comment', 'tk-string', 'tk-deco', 'tk-kw', 'tk-num'];

function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const kind = m.slice(1).findIndex((g) => g !== undefined) + 1;
    out.push(<span key={i} className={CLASS[kind]}>{m[0]}</span>);
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function linkFor(s: Snippet, meta: SnippetFile['meta']): string | undefined {
  if (!meta.repo) return undefined;
  // uncommitted code has no permanent URL: link the file on main instead of guessing line numbers
  return meta.dirty ? `${meta.repo}/blob/main/${s.file}` : `${meta.repo}/blob/${meta.commitFull}/${s.file}#L${s.start}-L${s.end}`;
}

export function CodePanel({ source, view, title, ranLabel }: { source: SnippetFile; view: CodeView; title: string; ranLabel: string }) {
  const shown = view.refs.map((r) => ({ ref: r, s: source.snippets[r.id] })).filter((x) => x.s);
  if (shown.length === 0) return null;
  const files = [...new Set(shown.map((x) => x.s.file.split('/').pop()))].join(' · ');

  return (
    <details className="code-panel" open>
      <summary>
        {title}
        <span className="muted mono"> · {files}</span>
      </summary>
      {view.note && <p className="code-note">{view.note}</p>}
      {shown.map(({ ref, s }) => {
        const href = linkFor(s, source.meta);
        const name = `${s.file.split('/').pop()}:${s.start}–${s.end}`;
        return (
          <figure key={ref.id} className="code-snippet">
            <figcaption>
              {href ? <a href={href} target="_blank" rel="noreferrer" title={s.file}>{name}</a> : name}
              <span className="muted"> @ {source.meta.commit}{source.meta.dirty ? '+' : ''}</span>
            </figcaption>
            <pre>
              {s.code.split('\n').map((line, i) => {
                const key = ref.highlight?.some((h) => line.includes(h));
                return (
                  <span key={i} className={`code-line${key ? ' is-key' : ''}`}>
                    <span className="code-no" aria-hidden="true">{s.start + i}</span>
                    <code>{highlightLine(line)}</code>
                  </span>
                );
              })}
            </pre>
          </figure>
        );
      })}
      {view.ran && (
        <div className="code-ran">
          <span className="muted">{ranLabel}</span>
          <pre className="sql">{view.ran}</pre>
        </div>
      )}
    </details>
  );
}
