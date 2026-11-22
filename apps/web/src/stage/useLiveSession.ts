import { useRef, useState } from 'react';

/*
 * The DB guard for Live mode, shared by every lab:
 * - a session starts only from a reset the page did itself,
 * - steps run in order, each once per session,
 * - before each step the DB must still be exactly where the previous step left it,
 * - anything else that writes (playground, another tab) makes the session dirty → reset again.
 * S is the lab's DB snapshot type; `same` decides which fields matter.
 */

export interface LiveSession {
  resetAt: string;
  /** steps run since the reset */
  done: number;
  dirty: boolean;
}

export function useLiveSession<S>(same: (a: S, b: S) => boolean) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const state = useRef<{ session: LiveSession | null; initial?: S; expected?: S }>({ session: null });

  const set = (next: LiveSession | null) => {
    state.current.session = next;
    setSession(next);
  };

  return {
    session,
    /** DB right after the reset (before step one) */
    initial: () => state.current.initial,
    /** what the DB must hold before the next step */
    expected: () => state.current.expected,
    /** may step `index` run now? */
    canRun: (index: number) => {
      const s = state.current.session;
      return !!s && !s.dirty && index === s.done;
    },
    started(initial: S) {
      state.current.initial = initial;
      state.current.expected = initial;
      set({ resetAt: new Date().toLocaleTimeString('en-GB'), done: 0, dirty: false });
    },
    /** compare the DB read just now with what we expect; mismatch → dirty */
    check(now: S): boolean {
      const s = state.current.session;
      const exp = state.current.expected;
      if (!s || exp === undefined) return false;
      if (same(now, exp)) return true;
      set({ ...s, dirty: true });
      return false;
    },
    advanced(after: S) {
      const s = state.current.session;
      state.current.expected = after;
      if (s) set({ ...s, done: s.done + 1 });
    },
    markDirty() {
      const s = state.current.session;
      if (s && !s.dirty) set({ ...s, dirty: true });
    },
    clear() {
      state.current = { session: null };
      set(null);
    },
  };
}

/** Why "Send live" is disabled for step `index` (undefined = it can run). */
export function blockedReason(
  session: LiveSession | null,
  index: number,
  t: { needReset: string; needResetDirty: string; alreadyRun: string; runFirst: (n: number) => string },
): string | undefined {
  if (!session) return t.needReset;
  if (session.dirty) return t.needResetDirty;
  if (index < session.done) return t.alreadyRun;
  if (index > session.done) return t.runFirst(session.done + 1);
  return undefined;
}
