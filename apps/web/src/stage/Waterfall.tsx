import type { RequestRecord, TraceSpan, Tone } from './types';

/*
 * Real timings of one request: the server's own spans (X-Lab-Trace) as bars on a
 * shared time axis, plus the part the server can't see (network + framework).
 */

export interface WaterfallProps {
  requests: RequestRecord[];
  /** span name → human label, e.g. "db.product.read" → "SELECT product" */
  label: (span: TraceSpan) => string;
  /** span → bar colour */
  tone: (span: TraceSpan) => Tone;
  statusTone: (status: number) => Tone;
}

export function Waterfall({ requests, label, tone, statusTone }: WaterfallProps) {
  return (
    <div className="waterfall">
      {requests.map((r, i) => {
        const total = r.trace?.totalMs ?? 0;
        const scale = Math.max(total, 0.01);
        return (
          <section key={i} className="wf-request">
            <header className="wf-head">
              <span className={`chip t-${statusTone(r.status)}`}>{r.status}</span>
              <span className="wf-who">{r.actor}</span>
              <span className="wf-time">
                server <b>{total.toFixed(1)}</b> ms · client <b>{r.clientMs.toFixed(1)}</b> ms
              </span>
            </header>
            {!r.trace && <p className="wf-empty">No trace on this response (production API?).</p>}
            {r.trace && (
              <ol className="wf-rows">
                {r.trace.spans.map((s, j) => (
                  <li key={j} className={`wf-row t-${tone(s)}`} style={{ ['--depth' as string]: s.depth }}>
                    <span className="wf-label" title={s.name}>{label(s)}</span>
                    <span className="wf-track">
                      {s.ms === 0 ? (
                        <i className="wf-note" style={{ left: `${(s.at / scale) * 100}%` }} />
                      ) : (
                        <i
                          className="wf-bar"
                          style={{ left: `${(s.at / scale) * 100}%`, width: `${Math.max((s.ms / scale) * 100, 0.8)}%` }}
                        />
                      )}
                    </span>
                    <span className="wf-ms">{s.ms === 0 ? '·' : s.ms.toFixed(1)}</span>
                  </li>
                ))}
                <li className="wf-row t-neutral wf-outside">
                  <span className="wf-label">network + framework</span>
                  <span className="wf-track" />
                  <span className="wf-ms">{Math.max(0, r.clientMs - total).toFixed(1)}</span>
                </li>
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
