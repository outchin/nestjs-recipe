import { request } from '../../stage/http.ts';
import type { DbOrder, DbState, RequestRecord, Scenario, ScenarioStep, StepRun } from '../../stage/types.ts';

/*
 * Runs scenario steps against a real API. Used by the page (live mode) and by
 * scripts/record-inventory.mts (writes the recording the published page replays),
 * so both always send exactly the same requests.
 * Plain TS only (no enums etc.): Node runs this file with type stripping.
 */

export interface RunContext {
  /** e.g. "/api" in the browser (Vite proxy) or "http://localhost:3000/api" in Node */
  base: string;
  t0: number;
  /** symbolic key ("A") → real idempotency key for this run */
  keys: Record<string, string>;
  /** sku → product id */
  productIds: Record<string, number>;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function newContext(base: string): RunContext {
  return { base, t0: performance.now(), keys: {}, productIds: {} };
}

/** GET products: refreshes sku → id and returns sku → stock. */
export async function stockSnapshot(ctx: RunContext): Promise<Record<string, number>> {
  const r = await request(`${ctx.base}/inventory/products`);
  if (r.status !== 200) throw new Error(`GET /inventory/products → ${r.status} ${JSON.stringify(r.data)}`);
  const list = r.data as { id: number; sku: string; stock: number }[];
  for (const p of list) ctx.productIds[p.sku] = p.id;
  return Object.fromEntries(list.map((p) => [p.sku, p.stock]));
}

/** The demo users (seed data): orders are listed per user, so the snapshot asks for each. */
const USER_IDS = [1, 2];

/** Everything the stage shows about MySQL: stock per product + every order. */
export async function dbSnapshot(ctx: RunContext): Promise<DbState> {
  const stock = await stockSnapshot(ctx);
  const skuById = Object.fromEntries(Object.entries(ctx.productIds).map(([sku, id]) => [id, sku]));
  const orders: DbOrder[] = [];
  for (const userId of USER_IDS) {
    const r = await request(`${ctx.base}/inventory/orders`, 'GET', undefined, { 'X-User-Id': String(userId) });
    if (r.status !== 200) throw new Error(`GET /inventory/orders (user ${userId}) → ${r.status}`);
    for (const o of r.data as { id: number; userId: number; idempotencyKey: string | null; items: { productId: number }[] }[]) {
      orders.push({ id: o.id, userId: o.userId, sku: skuById[o.items[0]?.productId] ?? '?', key: o.idempotencyKey });
    }
  }
  orders.sort((a, b) => a.id - b.id);
  return { stock, orders };
}

/** Same rows? (used to make sure nobody changed the DB between two live steps) */
export function sameDb(a: DbState, b: DbState): boolean {
  const ids = (s: DbState) => (s.orders ?? []).map((o) => o.id).join(',');
  return JSON.stringify(a.stock) === JSON.stringify(b.stock) && ids(a) === ids(b);
}

/** Back to the starting state (orders cleared, sneaker stock 1) and a fresh set of keys. */
export async function resetDemo(ctx: RunContext): Promise<DbState> {
  const r = await request(`${ctx.base}/inventory/dev/reset`, 'POST');
  if (r.status !== 200) throw new Error(`POST /inventory/dev/reset → ${r.status} ${JSON.stringify(r.data)}`);
  ctx.keys = {};
  ctx.t0 = performance.now();
  return dbSnapshot(ctx);
}

export async function runStep(ctx: RunContext, _scenario: Scenario, step: ScenarioStep): Promise<StepRun> {
  if (ctx.productIds[step.product] === undefined) await stockSnapshot(ctx);
  const productId = ctx.productIds[step.product];
  if (productId === undefined) throw new Error(`Unknown product ${step.product} — seed the DB first`);

  // same symbolic key → same real key within a run: that is what makes "retry" a retry.
  // The text is for people reading the orders table (which product, which attempt);
  // the server only compares keys, it never parses them.
  const key = (ctx.keys[step.key] ??= `${step.product.toLowerCase()}-${step.key}-${crypto.randomUUID().slice(0, 8)}`);
  const body = { productId, quantity: 1, idempotencyKey: key };
  const path = '/api/inventory/orders';

  const send = async (): Promise<RequestRecord> => {
    const startedAt = round(performance.now() - ctx.t0);
    const r = await request(`${ctx.base}/inventory/orders`, 'POST', body, { 'X-User-Id': String(step.userId) });
    return {
      actor: step.actor,
      userId: step.userId,
      method: 'POST',
      path,
      body,
      status: r.status,
      response: r.data,
      clientMs: r.ms,
      startedAt,
      trace: r.trace,
    };
  };

  // parallel: fire all at once, don't wait for the first (the double-tap case)
  const requests = await Promise.all(Array.from({ length: step.parallel ?? 1 }, send));
  return { stepId: step.id, requests, after: await dbSnapshot(ctx) };
}
