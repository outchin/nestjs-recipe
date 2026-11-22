import type { ChipItem, Lang } from '../../stage/ui';
import { fmtInt } from '../../stage/ui';
import type { Hop, NodePanel, RequestRecord, StepRun, Tone, TraceSpan } from '../../stage/types';
import type { StepVerdict } from '../../stage/LabReportLayout';
import type { ArchiveState, IndexResponse, IndexStep, InsertResponse, QueryResponse } from './run';

/*
 * Lab 02 → stage. Span names come from apps/api/src/modules/indexes/indexes.service.ts.
 * Every query goes API → MySQL. A scan then reads every row of PRIMARY (the table itself);
 * a seek walks the secondary index (email → id) and fetches each row from PRIMARY by id.
 */

const LABEL: Record<string, string> = {
  'db.explain': 'EXPLAIN',
  'db.select': 'SELECT (run 1)',
  'db.rows.read': 'rows read',
  'db.select.repeat': 'SELECT ×4 more',
  'db.index.create': 'CREATE INDEX',
  'db.insert': 'INSERT … SELECT',
};
export const spanLabel = (s: TraceSpan) => LABEL[s.name] ?? s.name;

/** EXPLAIN access type: ALL = every row, ref = index lookup, index = whole index scanned */
export const typeTone = (type: string): Tone => (type === 'ALL' ? 'error' : type === 'ref' || type === 'const' ? 'ok' : 'replay');
export const statusTone = (status: number): Tone => (status === 200 ? 'ok' : 'error');

export function spanTone(s: TraceSpan): Tone {
  if (s.error) return 'error';
  const d = s.detail ?? {};
  if (s.name === 'db.explain' || s.name === 'db.select') return typeTone(String(d.type));
  if (s.name === 'db.rows.read') return Number(d.rowsRead) > 1000 ? 'error' : 'ok';
  if (s.name === 'db.index.create' || s.name === 'db.insert') return 'ok';
  return 'neutral';
}

/** 1,000,003 → "1.0M", 20,000 → "20k", 11 → "11" */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return fmtInt(n);
}

const W = (lang: Lang, en: string, my: string) => (lang === 'my' ? my : en);

/** One request → one lane: you → API → (EXPLAIN, scan or seek, …) → API → you. */
export function toLane(r: RequestRecord, lang: Lang = 'en'): Hop[] {
  const hops: Hop[] = [{ kind: 'travel', link: 'you-api', tone: 'neutral', label: 'POST' }];
  const spans = r.trace?.spans ?? [];
  if (!r.trace) hops.push({ kind: 'pulse', node: 'api', tone: 'neutral', tag: 'no trace' });

  // every query goes API → MySQL first; MySQL then touches the index and/or the rows
  const toMysql = (tone: Tone = 'info', quick = false): Hop => ({ kind: 'travel', link: 'api-mysql', tone, quick });
  const backToApi = (tone: Tone, quick = false): Hop => ({ kind: 'travel', link: 'api-mysql', reverse: true, tone, quick });

  for (const s of spans) {
    const d = (s.detail ?? {}) as Record<string, string | number | null>;
    switch (s.name) {
      case 'db.explain': {
        // EXPLAIN only plans: the optimizer answers from statistics, no rows are read
        const tone = typeTone(String(d.type));
        hops.push(
          toMysql('info', true),
          { kind: 'pulse', node: 'mysql', tone, tag: `EXPLAIN → type=${d.type}${d.key ? ` · key=${d.key}` : ''} · rows≈${compact(Number(d.rows))}`, ms: s.ms },
          backToApi(tone, true),
        );
        break;
      }
      case 'db.select':
        hops.push(toMysql());
        if (d.key) {
          hops.push(
            { kind: 'travel', link: 'mysql-index', tone: 'info' },
            { kind: 'pulse', node: 'index', tone: 'ok', tag: W(lang, `seek email → ${d.rowsReturned} ids`, `email ကို တန်းရှာ → id ${d.rowsReturned} ခု`) },
            { kind: 'travel', link: 'index-table', tone: 'ok', label: 'id' },
            { kind: 'pulse', node: 'table', tone: 'ok', tag: W(lang, `fetch ${d.rowsReturned} rows by id`, `id နဲ့ row ${d.rowsReturned} ခု ယူ`), ms: s.ms },
            { kind: 'travel', link: 'mysql-table', reverse: true, tone: 'ok' },
            backToApi('ok'),
          );
        } else {
          hops.push(
            { kind: 'travel', link: 'mysql-table', tone: 'info' },
            { kind: 'pulse', node: 'table', tone: 'error', tag: W(lang, 'full scan: check every row', 'Full scan: row အားလုံးကို တစ်ခုချင်း စစ်'), ms: s.ms },
            { kind: 'travel', link: 'mysql-table', reverse: true, tone: 'error' },
            backToApi('error'),
          );
        }
        break;
      case 'db.rows.read':
        hops.push({
          kind: 'pulse', node: 'api', tone: Number(d.rowsRead) > 1000 ? 'error' : 'ok',
          tag: W(lang, `read ${compact(Number(d.rowsRead))} rows → returned ${d.rowsReturned}`,
            `row ${compact(Number(d.rowsRead))} ခု ဖတ် → ${d.rowsReturned} ခုပဲ ပြန်ရ`),
        });
        break;
      case 'db.select.repeat':
        hops.push({ kind: 'pulse', node: 'api', tone: 'neutral', tag: W(lang, '×4 more runs (for the median)', 'Median အတွက် ×4 ထပ် run'), ms: s.ms });
        break;
      case 'db.index.create':
        hops.push(
          toMysql(),
          { kind: 'travel', link: 'mysql-table', tone: 'info' },
          { kind: 'pulse', node: 'table', tone: 'info', tag: W(lang, 'read every (email, id), sort it', '(email, id) အားလုံးကို ဖတ်ပြီး စီ') },
          { kind: 'travel', link: 'index-table', reverse: true, tone: 'ok', label: 'id' },
          { kind: 'pulse', node: 'index', tone: 'ok', tag: W(lang, 'B-tree built', 'B-tree ဆောက်ပြီး'), ms: s.ms, event: 'commit' },
          { kind: 'travel', link: 'mysql-index', reverse: true, tone: 'ok' },
          backToApi('ok'),
        );
        break;
      case 'db.insert': {
        const rows = compact(Number(d.rows));
        hops.push(
          toMysql(),
          { kind: 'travel', link: 'mysql-table', tone: 'info' },
          { kind: 'pulse', node: 'table', tone: 'ok', tag: W(lang, `INSERT ${rows} rows`, `row ${rows} ခု INSERT`), ms: s.ms, event: 'commit' },
        );
        if (Number(d.indexes) > 0) {
          hops.push(
            { kind: 'travel', link: 'index-table', reverse: true, tone: 'replay', label: 'id' },
            { kind: 'pulse', node: 'index', tone: 'replay', tag: W(lang, `+${rows} keys into the B-tree`, `B-tree ထဲ key ${rows} ခု ထပ်ထည့်`) },
            { kind: 'travel', link: 'mysql-index', reverse: true, tone: 'ok' },
          );
        } else {
          hops.push({ kind: 'travel', link: 'mysql-table', reverse: true, tone: 'ok' });
        }
        hops.push(backToApi('ok'));
        break;
      }
    }
  }

  const tone = statusTone(r.status);
  hops.push(
    { kind: 'travel', link: 'you-api', reverse: true, tone, label: String(r.status) },
    { kind: 'pulse', node: 'you', tone: r.status === 200 ? resultTone(r) : 'error', tag: resultTag(r, lang) },
  );
  return hops;
}

function resultTone(r: RequestRecord): Tone {
  const q = r.response as Partial<QueryResponse>;
  return q.explain ? typeTone(q.explain.type) : 'ok';
}

function resultTag(r: RequestRecord, lang: Lang): string {
  const body = r.response as Partial<QueryResponse & IndexResponse & InsertResponse>;
  if (r.status !== 200) return `${r.status}`;
  if (body.explain) return `median ${body.medianMs} ms`;
  if (body.state) return `CREATE INDEX ${(Number(body.ms) / 1000).toFixed(1)} s`;
  if (body.rowsPerSec) return W(lang, `${body.ms} ms · ${compact(body.rowsPerSec)} rows/s`, `${body.ms} ms · တစ်စက္ကန့် row ${compact(body.rowsPerSec)}`);
  return '200';
}

// ── the MySQL state, pinned to the table and index nodes ──

export function dbPanels(now: ArchiveState, before: ArchiveState | undefined, lang: Lang): Record<string, NodePanel> {
  const rowsChanged = !!before && before.rows !== now.rows;
  const hasIndex = now.indexes.length > 0;
  const indexNew = !!before && hasIndex && before.indexes.length === 0;
  return {
    table: {
      rows: [
        { label: 'rows', value: rowsChanged ? `${fmtInt(before!.rows)} → ${fmtInt(now.rows)}` : fmtInt(now.rows), changed: rowsChanged },
        { label: 'data', value: `≈ ${Math.round(now.dataMB)} MB` },
      ],
    },
    index: hasIndex
      ? {
        rows: [
          { label: 'email → id', value: 'B-tree', changed: indexNew },
          { label: 'size', value: `≈ ${Math.round(now.indexMB)} MB`, changed: indexNew },
        ],
      }
      : { absent: true, rows: [{ label: W(lang, 'not created yet', 'မဆောက်ရသေးဘူး') }] },
  };
}

// ── theory vs what happened, per step ──

export function verdictOf(step: IndexStep, runs: Record<string, StepRun<ArchiveState>>, lang: Lang): StepVerdict {
  const res = runs[step.id]?.requests[0]?.response;
  switch (step.action) {
    case 'query': {
      const q = res as QueryResponse | undefined;
      const theory: ChipItem[] = [{ label: `type ${step.expect.type}`, tone: typeTone(step.expect.type) }];
      if (!q) return { theory, got: null, match: null };
      return {
        theory,
        got: [
          { label: `type ${q.explain.type}`, tone: typeTone(q.explain.type) },
          { label: W(lang, `read ${compact(q.rowsRead)}`, `ဖတ် ${compact(q.rowsRead)}`), tone: q.rowsRead > 1000 ? 'error' : 'ok' },
          { label: `${q.medianMs} ms`, tone: 'neutral' },
        ],
        match: q.explain.type === step.expect.type,
      };
    }
    case 'index': {
      const ix = res as IndexResponse | undefined;
      const theory: ChipItem[] = [{ label: 'B-tree', tone: 'ok' }];
      if (!ix) return { theory, got: null, match: null };
      return {
        theory,
        got: [{ label: `${(ix.ms / 1000).toFixed(1)} s`, tone: 'neutral' }, { label: `≈ ${Math.round(ix.state.indexMB)} MB`, tone: 'neutral' }],
        match: ix.state.indexes.includes(step.expect.index),
      };
    }
    case 'insert': {
      const ins = res as InsertResponse | undefined;
      const base = step.expect.slowerThan
        ? (runs[step.expect.slowerThan]?.requests[0]?.response as InsertResponse | undefined)
        : undefined;
      const theory: ChipItem[] = step.expect.slowerThan
        ? [{ label: W(lang, 'slower than step 2', 'Step 2 ထက် နှေး'), tone: 'replay' }]
        : [{ label: 'baseline', tone: 'neutral' }];
      if (!ins) return { theory, got: null, match: null };
      const got: ChipItem[] = [{ label: `${ins.ms} ms`, tone: 'neutral' }, { label: `${compact(ins.rowsPerSec)}/s`, tone: 'neutral' }];
      if (!base) return { theory, got, match: null };
      const ratio = ins.ms / base.ms;
      got.push({ label: `×${ratio.toFixed(1)}`, tone: ratio > 1 ? 'replay' : 'ok' });
      return { theory, got, match: ratio > 1 };
    }
  }
}
