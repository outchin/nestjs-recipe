import { useEffect, useState } from 'react';
import { PUBLISHED } from '../site';
import type { Tone } from './types';

/* Small pieces every lab report uses: toggles, chips, API status, remembered choices. */

export type Lang = 'en' | 'my';

export function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          className={o.value === props.value ? 'is-on' : undefined}
          disabled={o.disabled}
          title={o.title}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface ChipItem {
  label: string;
  tone: Tone;
}

export const Chips = ({ items }: { items: ChipItem[] }) => (
  <span className="chips">
    {items.map((c, i) => <span key={i} className={`chip t-${c.tone}`}>{c.label}</span>)}
  </span>
);

export type ApiStatus = 'checking' | 'up' | 'no-db' | 'down';

/**
 * Is the dev API there, with a working DB? Re-checks every few seconds in dev, so
 * starting the API later turns Live on without a reload. The published (static)
 * build has no API: it checks once and stays on the recording.
 */
export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');
  useEffect(() => {
    // published inside the portfolio: no API to ask (its /api is the portfolio's)
    if (PUBLISHED) {
      setStatus('down');
      return;
    }
    let off = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      let next: ApiStatus = 'down';
      try {
        const r = await fetch('/api/health');
        const d = r.ok ? ((await r.json()) as { db?: string }) : null;
        next = d ? (d.db === 'up' ? 'up' : 'no-db') : 'down';
      } catch {
        /* not running */
      }
      if (off) return;
      setStatus(next);
      if (import.meta.env.DEV) timer = setTimeout(check, next === 'up' ? 15000 : 4000);
    };
    check();
    return () => {
      off = true;
      clearTimeout(timer);
    };
  }, []);
  return status;
}

/** A choice remembered in localStorage (per viewer); falls back silently when storage is blocked. */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null;
      return v && allowed.includes(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const change = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* storage blocked: this visit only */
    }
  };
  return [value, change] as const;
}

/** Always Latin digits, also in Burmese mode. */
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
