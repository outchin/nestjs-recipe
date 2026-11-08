// Thin fetch wrapper: returns status + body so the UI can show errors as-is
// (seeing the raw error response is the point of the error labs).
export async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep raw text */ }
  return { status: res.status, data };
}
