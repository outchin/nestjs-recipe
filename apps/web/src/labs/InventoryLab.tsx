import { useCallback, useEffect, useState } from 'react';
import { call } from '../api';

interface Product { id: number; sku: string; name: string; price: string; stock: number; version: number }
interface Order { id: number; status: string; totalAmount: string; idempotencyKey: string | null; items: { productId: number; quantity: number }[] }
interface LogEntry { at: string; user: string; product: string; key: string; status: number; text: string; tone: Tone }
type Tone = 'ok' | 'replay' | 'error';

const USERS = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];

/*
 * Idempotency key rules (same as the theory):
 *  - one key per PURCHASE ATTEMPT, per user + product
 *  - clicking Buy again re-sends the SAME key → server returns the same order (200), buys nothing
 *  - "New purchase" throws the key away → next Buy is a genuinely new order
 * Keys are kept in localStorage so a page reload still re-sends the same key
 * (the "persist the key on the client" layer we discussed).
 */
const STORAGE = 'inventory-lab:keys';
const loadKeys = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? '{}'); } catch { return {}; }
};
const saveKeys = (keys: Record<string, string>) => {
  try { localStorage.setItem(STORAGE, JSON.stringify(keys)); } catch { /* storage blocked: memory only */ }
};
const slot = (userId: number, productId: number) => `${userId}:${productId}`;

export function InventoryLab() {
  const [userId, setUserId] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>(loadKeys);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const userName = USERS.find((u) => u.id === userId)!.name;

  const refresh = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        call('GET', '/inventory/products'),
        call('GET', '/inventory/orders', undefined, { 'X-User-Id': String(userId) }),
      ]);
      if (p.status !== 200) throw new Error(`products → ${p.status} ${JSON.stringify(p.data)}`);
      setProducts(p.data as Product[]);
      setOrders(o.status === 200 ? (o.data as Order[]) : []);
      setError(null);
    } catch (e) {
      setError(`${(e as Error).message} — is the API running with DB_DRIVER=mysql?`);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const setKey = (s: string, key: string | undefined) =>
    setKeys((prev) => {
      const next = { ...prev };
      if (key) next[s] = key; else delete next[s];
      saveKeys(next);
      return next;
    });

  /** Back to the original scenario: DB reset (orders cleared, stock restored) + forget all keys. */
  async function resetDemo() {
    const r = await call('POST', '/inventory/dev/reset');
    if (r.status !== 200) {
      setError(`Reset failed → ${r.status} ${JSON.stringify(r.data)}`);
      return;
    }
    setKeys(() => { saveKeys({}); return {}; });
    setLog([]);
    await refresh();
  }

  async function buy(product: Product) {
    const s = slot(userId, product.id);
    if (busy[s]) return; // in-flight guard: a double-click can't fire two requests at once
    const key = keys[s] ?? crypto.randomUUID(); // reuse the attempt's key, or start a new attempt
    setKey(s, key);
    setBusy((b) => ({ ...b, [s]: true }));
    try {
      const r = await call('POST', '/inventory/orders', { productId: product.id, quantity: 1, idempotencyKey: key },
        { 'X-User-Id': String(userId) });
      const body = r.data as Order & { message?: string | string[]; available?: number };
      const [text, tone]: [string, Tone] =
        r.status === 201 ? [`Order #${body.id} created — ${product.name} bought`, 'ok']
        : r.status === 200 ? [`Already purchased — same key, same order #${body.id}. Nothing bought again.`, 'replay']
        : r.status === 409 ? [`Out of stock (available: ${body.available})`, 'error']
        : [`${r.status}: ${Array.isArray(body.message) ? body.message.join(', ') : body.message ?? JSON.stringify(body)}`, 'error'];
      setLog((l) => [{ at: new Date().toLocaleTimeString(), user: userName, product: product.sku, key, status: r.status, text, tone }, ...l].slice(0, 30));
    } catch (e) {
      setLog((l) => [{ at: new Date().toLocaleTimeString(), user: userName, product: product.sku, key, status: 0, text: `Network error: ${(e as Error).message} — retry re-sends the same key`, tone: 'error' as Tone }, ...l]);
    } finally {
      setBusy((b) => ({ ...b, [s]: false }));
      refresh();
    }
  }

  return (
    <section>
      <h2>Try it — inventory store</h2>
      <p className="lead">
        First <b>Buy</b> creates an order (<span className="tone-ok mono">201</span>). Clicking <b>Buy</b> again re-sends
        the same idempotency key → the server returns the same order (<span className="tone-replay mono">200</span>) and
        buys nothing. <b>New purchase</b> discards the key. <b>Reset DB</b> puts everything back.
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted">Acting as</span>
        {USERS.map((u) => (
          <button key={u.id} onClick={() => setUserId(u.id)} className={u.id === userId ? 'selected' : undefined}>
            {u.name} <span className="mono muted">X-User-Id: {u.id}</span>
          </button>
        ))}
        <span className="spacer" />
        <button onClick={refresh}>↻ Refresh</button>
        <button onClick={resetDemo} className="danger"
          title="POST /api/inventory/dev/reset — clears orders, restores stock, forgets idempotency keys">
          ⟲ Reset DB
        </button>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product</th><th>Price</th><th>Stock</th><th>Ver</th><th>{userName}&apos;s key</th><th /></tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const s = slot(userId, p.id);
              const key = keys[s];
              return (
                <tr key={p.id}>
                  <td>{p.name}<div className="mono muted">{p.sku}</div></td>
                  <td className="num">{p.price}</td>
                  <td className={`num${p.stock === 0 ? ' zero' : ''}`}>{p.stock}</td>
                  <td className="num">{p.version}</td>
                  <td className="mono muted">{key ? `${key.slice(0, 8)}…` : '— new on Buy'}</td>
                  <td className="actions">
                    <button className="primary" onClick={() => buy(p)} disabled={busy[s]}>
                      {busy[s] ? 'Buying…' : 'Buy 1'}
                    </button>{' '}
                    <button onClick={() => setKey(s, undefined)} disabled={!key || busy[s]}
                      title="Discard key: next Buy is a new order">
                      New purchase
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div>
          <h3>Attempts <span className="muted">(newest first)</span></h3>
          {log.length === 0 && <p className="empty">Click Buy.</p>}
          {log.map((e, i) => (
            <div key={i} className={`entry tone-${e.tone}`}>
              <div className="meta">
                <span className={`badge tone-${e.tone}`}>{e.status || 'ERR'}</span> {e.at} · {e.user} · {e.product} ·
                key {e.key.slice(0, 8)}…
              </div>
              <div className="text">{e.text}</div>
            </div>
          ))}
        </div>
        <div>
          <h3>{userName}&apos;s orders <span className="muted">(from DB)</span></h3>
          {orders.length === 0 && <p className="empty">None.</p>}
          {orders.map((o) => (
            <div key={o.id} className="order">
              <b className="mono">#{o.id}</b> <span className="tone-ok mono">{o.status}</span> · {o.totalAmount} ·
              product {o.items.map((i) => i.productId).join(', ')}
              <div className="mono muted">key {o.idempotencyKey ? `${o.idempotencyKey.slice(0, 8)}…` : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
