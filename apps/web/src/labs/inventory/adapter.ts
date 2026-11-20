import type { DbState, Hop, NodePanel, RequestRecord, Tone, TraceSpan } from '../../stage/types';
import type { Lang } from './content';

/*
 * Inventory lab → stage. Turns one real request (its X-Lab-Trace spans) into hops.
 * Span names come from apps/api/src/modules/inventory/inventory.service.ts.
 */

const DB_NODE: Record<string, string> = {
  'db.user.find': 'users',
  'db.idempotency.lookup': 'orders',
  'db.product.read': 'products',
  'db.product.update': 'products',
  'db.order.insert': 'orders',
  'db.orderItem.insert': 'orders',
};

const LABEL: Record<string, string> = {
  'db.transaction': 'transaction',
  'db.user.find': 'SELECT user',
  'db.idempotency.lookup': 'SELECT order by key',
  'db.product.read': 'SELECT product',
  'app.stock.check': 'check stock (in JS)',
  'db.product.update': 'UPDATE product stock',
  'db.order.insert': 'INSERT order',
  'db.orderItem.insert': 'INSERT order_item',
  'idempotency.skipped': 'no key: skip lookup',
};

export const spanLabel = (s: TraceSpan) => LABEL[s.name] ?? s.name;

export function statusTone(status: number): Tone {
  if (status === 201) return 'ok';
  if (status === 200) return 'replay';
  return status >= 400 || status === 0 ? 'error' : 'neutral';
}

export function statusText(status: number): string {
  return (
    { 200: 'OK · replayed', 201: 'Created', 400: 'Bad request', 401: 'Unauthorized', 404: 'Not found', 409: 'Conflict', 500: 'Server error' }[
      status
    ] ?? ''
  );
}

export function spanTone(s: TraceSpan): Tone {
  if (s.error) return 'error';
  const d = s.detail ?? {};
  if (s.name === 'db.idempotency.lookup') return d.hit ? 'replay' : 'info';
  if (s.name === 'app.stock.check') return d.ok ? 'ok' : 'error';
  if (s.name === 'db.transaction') return 'neutral';
  if (s.name.startsWith('db.') && s.name !== 'db.user.find' && s.name !== 'db.product.read') return 'ok';
  return 'info';
}

function spanTag(s: TraceSpan, lang: Lang): string {
  const my = lang === 'my';
  const d = (s.detail ?? {}) as Record<string, string | number | boolean | null>;
  if (s.error && s.name === 'db.order.insert') return my ? 'UNIQUE(user, key) ကို တိုက်မိ' : 'UNIQUE(user, key) violated';
  if (s.error) return `${LABEL[s.name] ?? s.name} ${my ? 'မအောင်မြင်' : 'failed'}`;
  switch (s.name) {
    case 'db.user.find': return d.found ? (my ? 'user ရှိတယ်' : 'user found') : (my ? 'user မရှိ' : 'no such user');
    case 'db.idempotency.lookup':
      if (d.hit) return my ? `key မြင်ဖူးပြီ → order #${d.orderId}` : `key seen → order #${d.orderId}`;
      return my ? 'key မမြင်ဖူးသေး' : 'key not seen';
    case 'db.product.read': return `read stock = ${d.stock}`;
    case 'db.product.update': return `write stock = ${d.stock}`;
    case 'db.order.insert': return my ? `order #${d.orderId} ထည့်ပြီ` : `order #${d.orderId} inserted`;
    case 'db.orderItem.insert': return my ? 'order item ထည့်ပြီ' : 'order item inserted';
    case 'app.stock.check': return d.ok ? `${d.stock} ≥ ${d.requested} ✓` : `${d.stock} < ${d.requested} ✗`;
    default: return LABEL[s.name] ?? s.name;
  }
}

/** One request → one lane of hops: client → API → (each query) → API → client. */
export function toLane(r: RequestRecord, lang: Lang = 'en'): Hop[] {
  const clientLink = `${r.actor}-api`;
  const hops: Hop[] = [{ kind: 'travel', link: clientLink, tone: 'neutral', label: 'POST' }];
  const spans = r.trace?.spans ?? [];
  if (!r.trace) hops.push({ kind: 'pulse', node: 'api', tone: 'neutral', tag: 'no trace' });

  for (const s of spans) {
    // the user lookup is always the same and adds nothing to the story: timings table only
    if (s.name === 'db.user.find' && !s.error) continue;
    if (s.name === 'db.transaction') {
      hops.push({ kind: 'pulse', node: 'api', tone: 'neutral', tag: 'BEGIN' });
      continue;
    }
    const node = DB_NODE[s.name];
    const tone = spanTone(s);
    if (!node) {
      hops.push({ kind: 'pulse', node: 'api', tone, tag: spanTag(s, lang) });
      continue;
    }
    const link = `api-${node}`;
    hops.push(
      { kind: 'travel', link, tone: 'info', quick: true },
      { kind: 'pulse', node, tone, tag: spanTag(s, lang), ms: s.ms },
      { kind: 'travel', link, reverse: true, tone, quick: true },
    );
  }

  const tx = spans.find((s) => s.name === 'db.transaction');
  if (tx) {
    hops.push(
      tx.error
        ? { kind: 'pulse', node: 'api', tone: 'error', tag: `ROLLBACK · ${tx.error}`, ms: tx.ms }
        : { kind: 'pulse', node: 'api', tone: 'ok', tag: 'COMMIT', ms: tx.ms, event: 'commit' },
    );
  }

  const tone = statusTone(r.status);
  hops.push(
    { kind: 'travel', link: clientLink, reverse: true, tone, label: String(r.status) },
    { kind: 'pulse', node: r.actor, tone, tag: `${r.status} ${statusText(r.status)}`, ms: r.clientMs },
  );
  return hops;
}

// ── what MySQL holds, pinned to the table nodes ──

const PRODUCT_NAME: Record<string, string> = { 'SNEAKER-LTD-001': 'sneaker', 'TSHIRT-BASIC-001': 'T-shirt' };
const USER_NAME: Record<number, string> = { 1: 'Alice', 2: 'Bob' };
const MAX_ORDER_ROWS = 3;

/**
 * Table contents for the stage. `before` (optional) marks what changed:
 * stock shows "1 → 0", new orders are highlighted.
 */
export function dbPanels(now: DbState, before?: DbState, lang: Lang = 'en'): Record<string, NodePanel> {
  const products: NodePanel = {
    rows: Object.entries(now.stock).map(([sku, stock]) => {
      const was = before?.stock[sku];
      const changed = was !== undefined && was !== stock;
      return { label: PRODUCT_NAME[sku] ?? sku, value: changed ? `${was} → ${stock}` : String(stock), changed };
    }),
  };
  const orders = now.orders ?? [];
  const known = new Set((before?.orders ?? []).map((o) => o.id));
  const shown = orders.slice(-MAX_ORDER_ROWS);
  const ordersPanel: NodePanel = {
    rows: orders.length === 0
      ? [{ label: lang === 'my' ? 'row မရှိသေး' : 'no rows' }]
      : [
        ...(orders.length > shown.length
          ? [{ label: lang === 'my' ? `အဟောင်း +${orders.length - shown.length}` : `+${orders.length - shown.length} older` }]
          : []),
        ...shown.map((o) => ({
          label: `#${o.id} ${USER_NAME[o.userId] ?? `user ${o.userId}`}`,
          value: PRODUCT_NAME[o.sku] ?? o.sku,
          changed: !!before && !known.has(o.id),
        })),
      ],
  };
  return { products, orders: ordersPanel };
}
