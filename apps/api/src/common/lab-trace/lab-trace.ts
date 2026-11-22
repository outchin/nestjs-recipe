import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

/**
 * Lab trace: records what one request actually did inside the server
 * (which queries ran, idempotency hit/miss, stock seen, how long each took),
 * so the web visualizer can draw the real path instead of a scripted one.
 *
 * Context is per request (AsyncLocalStorage), started by LabTraceInterceptor.
 * Outside a request (unit tests, scripts) every call is a cheap no-op.
 */
export interface TraceSpan {
  /** e.g. "db.product.read" — the web adapter maps names to stage nodes. */
  name: string;
  /** ms since the request entered the handler. */
  at: number;
  /** duration in ms (0 for a note). */
  ms: number;
  /** nesting level: spans inside db.transaction have depth 1. */
  depth: number;
  detail?: Record<string, unknown>;
  error?: string;
}

interface TraceStore {
  start: number;
  depth: number;
  spans: TraceSpan[];
}

const als = new AsyncLocalStorage<TraceStore>();
const round = (n: number) => Math.round(n * 100) / 100;

export const labTrace = {
  /** Start a trace context for everything `fn` triggers (sync or async). */
  run<T>(fn: () => T): T {
    return als.run({ start: performance.now(), depth: 0, spans: [] }, fn);
  },

  /** Time `fn`; `detail` turns its result into small, JSON-safe facts for the UI. */
  async span<T>(name: string, fn: () => Promise<T>, detail?: (result: T) => Record<string, unknown>): Promise<T> {
    const store = als.getStore();
    if (!store) return fn();
    const span: TraceSpan = { name, at: round(performance.now() - store.start), ms: 0, depth: store.depth };
    store.spans.push(span); // pushed first so spans stay in start order
    const t0 = performance.now();
    store.depth++;
    try {
      const result = await fn();
      if (detail) span.detail = detail(result);
      return result;
    } catch (err) {
      span.error = err instanceof Error ? err.constructor.name : String(err);
      throw err;
    } finally {
      store.depth--;
      span.ms = round(performance.now() - t0);
    }
  },

  /** A zero-duration event, e.g. a check done in application memory. */
  note(name: string, detail?: Record<string, unknown>) {
    const store = als.getStore();
    if (!store) return;
    store.spans.push({ name, at: round(performance.now() - store.start), ms: 0, depth: store.depth, detail });
  },

  /** Spans recorded so far in the current request, or undefined outside one. */
  spans(): { totalMs: number; spans: TraceSpan[] } | undefined {
    const store = als.getStore();
    if (!store) return undefined;
    return { totalMs: round(performance.now() - store.start), spans: store.spans };
  },
};
