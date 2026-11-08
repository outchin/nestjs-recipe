import { ReferenceImages } from '../components/ReferenceImages';
import { InventoryLab } from '../labs/InventoryLab';

/** /labs/inventory/idempotency — theory first, then the hands-on lab. */
export function IdempotencyPage() {
  return (
    <>
      <h1>Idempotency</h1>
      <p className="lead">
        Doing the same request once or many times has the same effect. The client sends one key per purchase
        attempt; retries re-send that key; the server returns the first result instead of buying again.
      </p>

      <h2>Theory</h2>
      <div className="theory">
        <ReferenceImages topic="idempotency" />
        <ul className="notes">
          <li><b>Why:</b> a timeout doesn't tell the client whether the order happened → it retries → without a key, a second order.</li>
          <li><b>Key = one purchase attempt</b>, not one product. New purchase → new key, so buying the same sneaker again later still works.</li>
          <li><b>Server:</b> <code>UNIQUE(user_id, idempotency_key)</code> on <code>orders</code>; known key → <b>200</b> with the old order, new key → <b>201</b>.</li>
          <li><b>vs. the diagram:</b> the diagram uses a separate <i>Idempotency Store</i> (key → saved response). This lab
            stores the key on the <code>orders</code> row itself and rebuilds the response from it — same idea, one table less.</li>
          <li><b>Limits:</b> a key kept only in memory dies with the app → persist it, or let the server issue it (PENDING → confirm).</li>
        </ul>
      </div>

      <InventoryLab />
    </>
  );
}
