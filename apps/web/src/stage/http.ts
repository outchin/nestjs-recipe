import type { Trace } from './types.ts';

// No DOM-only APIs here: also runs in Node (scripts/record-*.mts).

export interface HttpResult {
  status: number;
  data: unknown;
  /** client-measured round trip, ms */
  ms: number;
  /** server-side path, from the X-Lab-Trace header (dev API only) */
  trace?: Trace;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** X-Lab-Trace is base64(JSON) of UTF-8 text. */
export function decodeTrace(header: string | null): Trace | undefined {
  if (!header) return undefined;
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Trace;
  } catch {
    return undefined;
  }
}

/** fetch → status + parsed body (raw text if not JSON) + timing + trace. Never throws on HTTP errors. */
export async function request(
  url: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  const t0 = performance.now();
  const res = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ms = round(performance.now() - t0);
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { status: res.status, data, ms, trace: decodeTrace(res.headers.get('x-lab-trace')) };
}
