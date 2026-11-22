import { request } from './stage/http';

// Thin fetch wrapper: returns status + body so the UI can show errors as-is
// (seeing the raw error response is the point of the error labs).
// Also returns the client round trip (ms) and the server's X-Lab-Trace, for the stage.
export async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return request(`/api${path}`, method, body, headers);
}
