import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hop, Recording, RequestRecord, StepRun } from './types';
import { useLiveSession } from './useLiveSession';
import { usePlayer } from './usePlayer';

/*
 * Everything a lab report does that isn't layout or words:
 * Recorded ↔ Live, picking / replaying steps, Reset → steps in order (DB guard),
 * Run all, extra requests (playground), and the DB tables that flip at COMMIT.
 *
 * S = the lab's DB snapshot, Step = its scenario step, C = its run context.
 */

export type Mode = 'replay' | 'live';
export const EXTRA = 'extra';

export interface LabRunnerConfig<S, Step extends { id: string }, C> {
  steps: Step[];
  recording: Recording<S>;
  speed: number;
  newContext: () => C;
  reset: (c: C) => Promise<S>;
  snapshot: (c: C) => Promise<S>;
  same: (a: S, b: S) => boolean;
  runStep: (c: C, step: Step) => Promise<StepRun<S>>;
  /** requests → animation lanes (read through a ref, so it may depend on the language) */
  toLanes: (requests: RequestRecord[]) => Hop[][];
  /** shown with the API's own message when a live call fails */
  failHint?: string;
}

export function useLabRunner<S, Step extends { id: string }, C>(config: LabRunnerConfig<S, Step, C>) {
  const cfg = useRef(config);
  cfg.current = config;
  const { steps, recording } = config;

  const player = usePlayer(config.speed);
  const live = useLiveSession<S>(config.same);
  const ctx = useRef<C | null>(null);

  const [mode, setMode] = useState<Mode>('replay');
  const [selected, setSelected] = useState(steps[0].id);
  const [liveRuns, setLiveRuns] = useState<Record<string, StepRun<S>>>({});
  const [extra, setExtra] = useState<RequestRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** bumps whenever this page changed the DB (lets a playground re-read its tables) */
  const [dbTick, setDbTick] = useState(0);

  // tables on the stage: the DB before the step, then (at COMMIT) after it
  const [db, setDb] = useState<{ now: S; before?: S } | null>(recording.initial ? { now: recording.initial } : null);
  const dbRef = useRef(db);
  dbRef.current = db;
  const playToken = useRef(0);

  const recorded = useMemo(() => Object.fromEntries(recording.runs.map((r) => [r.stepId, r])), [recording]);
  const runs = mode === 'replay' ? recorded : liveRuns;
  const initialDb = mode === 'replay' ? recording.initial : live.initial();
  const stepIndex = steps.findIndex((s) => s.id === selected);
  const current: RequestRecord[] = selected === EXTRA ? extra : runs[selected]?.requests ?? [];

  const fail = (e: unknown) => setError(`${(e as Error).message}${cfg.current.failHint ? `. ${cfg.current.failHint}` : ''}`);

  /** Animate; the tables switch from `before` to `after` at the first COMMIT event (or at the end). */
  const playWithDb = useCallback(
    async (reqs: RequestRecord[], before: S | undefined, after: S | undefined) => {
      const token = ++playToken.current;
      if (before !== undefined) setDb({ now: before });
      const showAfter = () => {
        if (token === playToken.current && after !== undefined) setDb({ now: after, before });
      };
      await player.play(cfg.current.toLanes(reqs), { onEvent: (e) => e === 'commit' && showAfter() });
      showAfter();
    },
    [player.play],
  );

  const beforeStep = (stepId: string, all: Record<string, StepRun<S>>, initial?: S) => {
    const i = steps.findIndex((s) => s.id === stepId);
    return i <= 0 ? initial : all[steps[i - 1].id]?.after;
  };

  // first visit: play step one of the recording (timer, so StrictMode's mount → unmount → mount plays once)
  useEffect(() => {
    const first = recorded[steps[0].id];
    if (!first) return;
    const timer = setTimeout(() => playWithDb(first.requests, recording.initial, first.after), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(stepId: string) {
    setSelected(stepId);
    const run = runs[stepId];
    if (run) {
      playWithDb(run.requests, beforeStep(stepId, runs, initialDb), run.after);
      return;
    }
    playToken.current++;
    player.clear();
    const expected = live.expected();
    if (mode === 'live' && expected !== undefined) setDb({ now: expected });
  }

  async function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    playToken.current++;
    player.clear();
    setSelected(steps[0].id);
    if (next === 'replay') {
      setDb(recording.initial ? { now: recording.initial } : null);
      return;
    }
    try {
      setDb({ now: await cfg.current.snapshot(cfg.current.newContext()) }); // what the DB holds right now
    } catch (e) {
      fail(e);
    }
  }

  /** Reset the lab's data: the only way to (re)start the live scenario. */
  async function resetLive(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const c = cfg.current.newContext();
      const initial = await cfg.current.reset(c);
      ctx.current = c;
      live.started(initial);
      setLiveRuns({});
      playToken.current++;
      player.clear();
      setSelected(steps[0].id);
      setDb({ now: initial });
      setDbTick((n) => n + 1);
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendLive(step: Step): Promise<boolean> {
    const c = ctx.current;
    const index = steps.findIndex((s) => s.id === step.id);
    if (!c || !live.canRun(index)) return false;
    setBusy(true);
    setError(null);
    try {
      const before = await cfg.current.snapshot(c);
      if (!live.check(before)) {
        setDb({ now: before }); // show what is really there; the status line says why we stopped
        return false;
      }
      const run = await cfg.current.runStep(c, step);
      live.advanced(run.after);
      setLiveRuns((r) => ({ ...r, [step.id]: run }));
      setSelected(step.id);
      setDbTick((n) => n + 1);
      await playWithDb(run.requests, before, run.after);
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runAllLive() {
    if (!(await resetLive())) return;
    for (const step of steps) if (!(await sendLive(step))) return;
  }

  /** A request made outside the scenario (playground): animate it; if it wrote, the session can't be trusted. */
  async function playExtra(reqs: RequestRecord[], opts: { mutates: boolean }) {
    setExtra(reqs);
    setSelected(EXTRA);
    if (opts.mutates) live.markDirty();
    let after: S | undefined;
    try {
      after = await cfg.current.snapshot(cfg.current.newContext());
    } catch {
      /* the tables keep their last state */
    }
    await playWithDb(reqs, dbRef.current?.now, after);
  }

  return {
    player,
    mode,
    switchMode,
    runs,
    selected,
    stepIndex,
    step: steps[stepIndex] as Step | undefined,
    current,
    choose,
    db,
    busy,
    error,
    session: live.session,
    canSend: mode === 'live' && live.canRun(stepIndex) && !busy,
    resetLive,
    sendLive,
    runAllLive,
    playExtra,
    dbTick,
  };
}
