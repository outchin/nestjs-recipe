import { request } from '../../stage/http.ts';
import type { RequestRecord, StepRun } from '../../stage/types.ts';

/*
 * Lab 02 runner: used by the page (live mode) and scripts/record-indexes.mts,
 * so both send exactly the same requests. Plain TS only (Node runs it with type stripping).
 */

/** What the stage shows about MySQL (GET /api/indexes/state). */
export interface ArchiveState {
  rows: number;
  indexes: string[];
  dataMB: number;
  indexMB: number;
}

export type IndexStep =
  | { id: string; action: 'query'; kind: 'equals' | 'lower'; email: string; expect: { type: string } }
  | { id: string; action: 'insert'; count: number; expect: { slowerThan?: string } }
  | { id: string; action: 'index'; expect: { index: string } };

export interface IndexScenario {
  id: string;
  title: string;
  steps: IndexStep[];
}

/** Response bodies, as the API returns them (apps/api/src/modules/indexes). */
export interface QueryResponse {
  kind: string;
  sql: string;
  explain: { type: string; key: string | null; rows: number; extra: string | null };
  rowsReturned: number;
  rowsRead: number;
  handler: Record<string, number>;
  runsMs: number[];
  medianMs: number;
}
export interface IndexResponse {
  /** the statement MySQL ran (older recordings: missing) */
  sql?: string;
  ms: number;
  state: ArchiveState;
}
export interface InsertResponse {
  rows: number;
  ms: number;
  rowsPerSec: number;
  indexes: string[];
}

export interface RunContext {
  base: string;
  t0: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function newContext(base: string): RunContext {
  return { base, t0: performance.now() };
}

export async function snapshot(ctx: RunContext): Promise<ArchiveState> {
  const r = await request(`${ctx.base}/indexes/state`);
  if (r.status !== 200) throw new Error(`GET /indexes/state → ${r.status} ${JSON.stringify(r.data)}`);
  return r.data as ArchiveState;
}

/** Only what the scenario depends on: row count and which indexes exist (sizes drift a little). */
export function sameArchive(a: ArchiveState, b: ArchiveState): boolean {
  return a.rows === b.rows && a.indexes.join(',') === b.indexes.join(',');
}

/** Back to exactly 1M rows and no secondary index (first call seeds the table: ~10 s). */
export async function resetDemo(ctx: RunContext): Promise<ArchiveState> {
  const r = await request(`${ctx.base}/indexes/dev/reset`, 'POST');
  if (r.status !== 200) throw new Error(`POST /indexes/dev/reset → ${r.status} ${JSON.stringify(r.data)}`);
  ctx.t0 = performance.now();
  return r.data as ArchiveState;
}

function call(step: IndexStep): { path: string; body?: unknown } {
  switch (step.action) {
    case 'query':
      return { path: '/indexes/query', body: { kind: step.kind, email: step.email } };
    case 'insert':
      return { path: '/indexes/insert', body: { count: step.count } };
    case 'index':
      return { path: '/indexes/index' };
  }
}

export async function runStep(ctx: RunContext, step: IndexStep): Promise<StepRun<ArchiveState>> {
  const { path, body } = call(step);
  const startedAt = round(performance.now() - ctx.t0);
  const r = await request(`${ctx.base}${path}`, 'POST', body);
  if (r.status !== 200) throw new Error(`POST ${path} → ${r.status} ${JSON.stringify(r.data)}`);
  const record: RequestRecord = {
    actor: 'you',
    userId: 0,
    method: 'POST',
    path: `/api${path}`,
    body,
    status: r.status,
    response: r.data,
    clientMs: r.ms,
    startedAt,
    trace: r.trace,
  };
  return { stepId: step.id, requests: [record], after: await snapshot(ctx) };
}

/** A one-off query from the playground (reads only: doesn't change the DB). */
export async function runQuery(ctx: RunContext, kind: 'equals' | 'lower', email: string): Promise<RequestRecord> {
  const run = await runStep(ctx, { id: 'extra', action: 'query', kind, email, expect: { type: '' } });
  return run.requests[0];
}
