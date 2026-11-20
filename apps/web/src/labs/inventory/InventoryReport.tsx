import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReferenceImages } from '../../components/ReferenceImages';
import recordingJson from '../../recordings/inventory/last-sneaker.json';
import '../../stage/report.css';
import { IsoStage } from '../../stage/IsoStage';
import { Stage } from '../../stage/Stage';
import type { DbState, Recording, RequestRecord, Scenario, ScenarioStep, StepRun } from '../../stage/types';
import { usePlayer } from '../../stage/usePlayer';
import { Waterfall } from '../../stage/Waterfall';
import { InventoryLab } from '../InventoryLab';
import { dbPanels, spanLabel, spanTone, statusTone, toLane } from './adapter';
import { CODE_LINKS, QUESTION, REPO, STEP_COPY, THEORY_NOTES, type Lang } from './content';
import { UI } from './ui-text';
import { dbSnapshot, newContext, resetDemo, runStep, sameDb, type RunContext } from './run';
import scenarioJson from './scenario.json';
import { inventoryScene } from './scene';

const recording = recordingJson as unknown as Recording;
const scenario = scenarioJson as unknown as Scenario;

type Mode = 'replay' | 'live';
/** a live run of the scenario since the last reset */
interface LiveSession { resetAt: string; done: number; dirty: boolean }
type View = '3d' | '2d';
const VIEW_KEY = 'lab:view';
const LANG_KEY = 'lab:lang';
const loadLang = (): Lang => {
  try { return localStorage.getItem(LANG_KEY) === 'my' ? 'my' : 'en'; } catch { return 'en'; }
};
const loadView = (): View => {
  try { return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; }
};
const PLAYGROUND = 'playground';

const sameStatuses = (a: number[], b: number[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

type ApiStatus = 'checking' | 'up' | 'no-db' | 'down';

/**
 * Is the dev API there, with a working DB? Re-checks every few seconds in dev, so
 * starting the API later turns Live on without a reload. The published (static)
 * build has no API: it checks once and stays on the recording.
 */
function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');
  useEffect(() => {
    let off = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      let next: ApiStatus = 'down';
      try {
        const r = await fetch('/api/health');
        const d = r.ok ? ((await r.json()) as { db?: string }) : null;
        next = d ? (d.db === 'up' ? 'up' : 'no-db') : 'down';
      } catch {
        /* not running */
      }
      if (off) return;
      setStatus(next);
      if (import.meta.env.DEV) timer = setTimeout(check, next === 'up' ? 15000 : 4000);
    };
    check();
    return () => {
      off = true;
      clearTimeout(timer);
    };
  }, []);
  return status;
}

function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          className={o.value === props.value ? 'is-on' : undefined}
          disabled={o.disabled}
          title={o.title}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Chips = ({ statuses }: { statuses: number[] }) => (
  <span className="chips">
    {statuses.map((st, i) => <span key={i} className={`chip t-${statusTone(st)}`}>{st}</span>)}
  </span>
);

const fmtDate = (iso: string) =>
  // always Latin digits, also in Burmese mode
  new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

export function InventoryReport() {
  const api = useApiStatus();
  const apiUp = api === 'up';
  const [mode, setMode] = useState<Mode>('replay');
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>(loadView);
  const [lang, setLang] = useState<Lang>(loadLang);
  const langRef = useRef(lang);
  langRef.current = lang;
  const changeLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked: this visit only */ }
  };
  const t = UI[lang];
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked: this visit only */ }
  };
  const [selected, setSelected] = useState(scenario.steps[0].id);
  const [liveRuns, setLiveRuns] = useState<Record<string, StepRun>>({});
  const [playground, setPlayground] = useState<RequestRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = usePlayer(speed);

  // ── live session: the scenario only runs from a DB we reset ourselves ──
  // ctx.expected = what MySQL must hold before the next step; checked before every send.
  const ctx = useRef<(RunContext & { expected: DbState; initial: DbState }) | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const updateSession = (next: LiveSession | null) => {
    sessionRef.current = next;
    setSession(next);
  };
  const [playgroundTick, setPlaygroundTick] = useState(0);

  // ── what the table nodes show: MySQL before the step, then after COMMIT ──
  const [db, setDb] = useState<{ now: DbState; before?: DbState } | null>(recording.initial ? { now: recording.initial } : null);
  const playToken = useRef(0);

  const recorded = useMemo(() => Object.fromEntries(recording.runs.map((r) => [r.stepId, r])), []);
  const runs = mode === 'replay' ? recorded : liveRuns;
  const initialDb = mode === 'replay' ? recording.initial : ctx.current?.initial;
  const current: RequestRecord[] =
    selected === PLAYGROUND ? (playground ? [playground] : []) : runs[selected]?.requests ?? [];

  const beforeStep = (stepId: string, all: Record<string, StepRun>, initial?: DbState) => {
    const i = scenario.steps.findIndex((s) => s.id === stepId);
    return i <= 0 ? initial : all[scenario.steps[i - 1].id]?.after;
  };

  /** Animate requests; the tables switch from `before` to `after` at COMMIT (or at the end if nothing committed). */
  const playWithDb = useCallback(
    async (reqs: RequestRecord[], before: DbState | undefined, after: DbState | undefined) => {
      const token = ++playToken.current;
      if (before) setDb({ now: before });
      const showAfter = () => {
        if (token === playToken.current && after) setDb({ now: after, before });
      };
      await player.play(reqs.map((r) => toLane(r, langRef.current)), { onEvent: (e) => e === 'commit' && showAfter() });
      showAfter();
    },
    [player.play],
  );

  // first visit: play step one of the real recording (timer, so StrictMode's mount → unmount → mount plays once)
  useEffect(() => {
    const first = recorded[scenario.steps[0].id];
    if (!first) return;
    const t = setTimeout(() => playWithDb(first.requests, recording.initial, first.after), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(stepId: string) {
    setSelected(stepId);
    const run = runs[stepId];
    if (run) {
      playWithDb(run.requests, beforeStep(stepId, runs, initialDb), run.after);
    } else {
      playToken.current++;
      player.clear();
      if (mode === 'live' && ctx.current) setDb({ now: ctx.current.expected });
    }
  }

  async function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    playToken.current++;
    player.clear();
    setSelected(scenario.steps[0].id);
    if (next === 'replay') {
      setDb(recording.initial ? { now: recording.initial } : null);
      return;
    }
    // live: show what MySQL holds right now, whatever it is
    try {
      setDb({ now: await dbSnapshot(newContext('/api')) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Reset the demo data: the only way to (re)start the live scenario. */
  async function resetLive(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const c = newContext('/api');
      const initial = await resetDemo(c);
      ctx.current = { ...c, expected: initial, initial };
      setLiveRuns({});
      updateSession({ resetAt: new Date().toLocaleTimeString(), done: 0, dirty: false });
      playToken.current++;
      player.clear();
      setSelected(scenario.steps[0].id);
      setDb({ now: initial });
      setPlaygroundTick((t) => t + 1);
      return true;
    } catch (e) {
      setError(`${(e as Error).message}. Is the API running with DB_DRIVER=mysql?`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendLive(step: ScenarioStep): Promise<boolean> {
    const c = ctx.current;
    const sess = sessionRef.current;
    const index = scenario.steps.findIndex((s) => s.id === step.id);
    if (!c || !sess || sess.dirty || index !== sess.done) return false; // the buttons say why
    setBusy(true);
    setError(null);
    try {
      // guard: MySQL must still be exactly where the last step left it
      const before = await dbSnapshot(c);
      if (!sameDb(before, c.expected)) {
        updateSession({ ...sess, dirty: true });
        setDb({ now: before }); // the tables now show what is really there; the status line says why we stopped
        return false;
      }
      const run = await runStep(c, scenario, step);
      c.expected = run.after;
      setLiveRuns((r) => ({ ...r, [step.id]: run }));
      updateSession({ ...sess, done: sess.done + 1 });
      setSelected(step.id);
      setPlaygroundTick((t) => t + 1);
      await playWithDb(run.requests, before, run.after);
      return true;
    } catch (e) {
      setError(`${(e as Error).message}. Is the API running with DB_DRIVER=mysql?`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runAllLive() {
    if (!(await resetLive())) return;
    for (const step of scenario.steps) if (!(await sendLive(step))) return;
  }

  const dbRef = useRef(db);
  dbRef.current = db;
  const onPlaygroundRecord = useCallback(
    async (r: RequestRecord) => {
      setPlayground(r);
      setSelected(PLAYGROUND);
      // the playground writes to the same MySQL: the scenario can't trust it any more
      if (sessionRef.current && !sessionRef.current.dirty) updateSession({ ...sessionRef.current, dirty: true });
      let after: DbState | undefined;
      try {
        after = await dbSnapshot(newContext('/api'));
      } catch {
        /* tables just keep the last state */
      }
      playWithDb([r], dbRef.current?.now, after);
    },
    [playWithDb],
  );

  // ── computed from the data, never typed in ──
  const verdict = (s: ScenarioStep) => {
    const got = runs[s.id]?.requests.map((r) => r.status);
    return { got, match: got ? sameStatuses(got, s.expect) : null };
  };
  const stepIndex = scenario.steps.findIndex((s) => s.id === selected);
  const step = scenario.steps[stepIndex];
  const copy = step ? STEP_COPY[lang][step.id] : undefined;
  const v = step ? verdict(step) : undefined;
  const canSend = mode === 'live' && !!session && !session.dirty && stepIndex === session.done && !busy;
  const sendHint = !session
    ? t.needReset
    : session.dirty
      ? t.needResetDirty
      : stepIndex < session.done
        ? t.alreadyRun
        : stepIndex > session.done
          ? t.runFirst(session.done + 1)
          : undefined;

  const spansOf = (id: string) => runs[id]?.requests[0]?.trace?.spans.filter((s) => s.name.startsWith('db.') && s.depth > 0);
  const buyMs = runs.buy?.requests[0]?.trace?.totalMs;
  const retryMs = runs.retry?.requests[0]?.trace?.totalMs;
  const doubleRun = runs.double;
  const doubleDiffers = runs.double ? verdict(scenario.steps.find((s) => s.id === 'double')!).match === false : false;
  const meta = recording.meta;
  const StageView = view === '3d' ? IsoStage : Stage;

  return (
    <article className="report" lang={lang}>
      <header className="report-hero">
        <p className="eyebrow">Lab 01 · Idempotency</p>
        <h1>{t.title}</h1>
        <p className="hero-lead">{t.lead}</p>
        <div className="hero-meta">
          <span className="pill">NestJS · MySQL</span>
          <span className="pill" title={`${meta.platform} · ${meta.cpu ?? ''} · Node ${meta.node}`}>
            {t.recorded(fmtDate(meta.recordedAt), meta.commit + (meta.dirty ? '+' : ''))}
          </span>
          <span className="spacer" />
          <Segmented<Lang>
            label="Language"
            value={lang}
            onChange={changeLang}
            options={[{ value: 'en', label: 'EN' }, { value: 'my', label: 'မြန်မာ' }]}
          />
        </div>
      </header>

      <section className="stage-panel">
        <div className="stage-toolbar">
          <nav className="step-tabs" aria-label="Scenario steps">
            {scenario.steps.map((s, i) => {
              const sv = verdict(s);
              return (
                <button
                  key={s.id}
                  className={`step-tab${selected === s.id ? ' is-on' : ''}`}
                  aria-current={selected === s.id ? 'step' : undefined}
                  onClick={() => choose(s.id)}
                >
                  <span className="step-tab-no">{i + 1}</span>
                  {STEP_COPY[lang][s.id].short}
                  {sv.match === false && <span className="dot t-error" aria-label="differs from theory" />}
                </button>
              );
            })}
          </nav>
          <div className="row">
            <Segmented<Mode>
              label="Data source"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'replay', label: 'Recorded' },
                {
                  value: 'live', label: 'Live', disabled: !apiUp,
                  title: apiUp ? 'Send real requests to your local API' : 'Live needs the local API (see the hint below)',
                },
              ]}
            />
            <Segmented<View>
              label="View"
              value={view}
              onChange={changeView}
              options={[{ value: '3d', label: '3D' }, { value: '2d', label: '2D' }]}
            />
            <Segmented<number>
              label="Speed"
              value={speed}
              onChange={setSpeed}
              options={[{ value: 0.5, label: '½×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]}
            />
          </div>
        </div>

        {import.meta.env.DEV && mode === 'replay' && api !== 'up' && api !== 'checking' && (
          <p className="live-hint">
            {api === 'down' ? t.hintNoApi : t.hintNoDb}
          </p>
        )}
        {mode === 'live' && !apiUp && api !== 'checking' && (
          <p className="alert">{t.apiStopped}</p>
        )}
        <div className="stage-scroll">
        <StageView
          scene={inventoryScene}
          packets={player.packets}
          marks={player.marks}
          caption={player.caption}
          panels={db ? dbPanels(db.now, db.before, lang) : undefined}
          footer={mode === 'replay' ? t.footerReplay : t.footerLive}
        />
        </div>

        {step && copy && v && (
          <div className="step-bar">
            <p className="step-title">{copy.title}</p>
            <div className="verdict">
              <span className="muted">Theory</span> <Chips statuses={step.expect} />
              <span className="arrow" aria-hidden="true">→</span>
              <span className="muted">{mode === 'replay' ? 'Recorded' : 'Live'}</span>{' '}
              {v.got ? <Chips statuses={v.got} /> : <span className="muted">—</span>}
              {v.match === true && <span className="verdict-ok">✓</span>}
              {v.match === false && <span className="chip t-error">{t.differs}</span>}
            </div>
            <div className="row">
              {runs[step.id] && <button onClick={() => choose(step.id)}>▶ Replay</button>}
              {mode === 'live' && (
                <>
                  <button className="primary" disabled={!canSend} onClick={() => sendLive(step)} title={sendHint}>
                    Send live
                  </button>
                  <button disabled={busy} onClick={runAllLive} title="Reset, then all four steps">Run all</button>
                  <button className={!session || session.dirty ? 'primary' : undefined} disabled={busy} onClick={resetLive}
                    title="POST /api/inventory/dev/reset">Reset DB</button>
                </>
              )}
            </div>
          </div>
        )}
        {mode === 'live' && (
          <p className={`db-status${!session || session.dirty ? ' needs-reset' : ''}`}>
            {!session && t.notReset}
            {session && session.dirty && t.dirty}
            {session && !session.dirty && (
              <>
                {t.resetOk(session.resetAt, session.done, scenario.steps.length)}
                {sendHint && session.done < scenario.steps.length && stepIndex !== session.done ? ` · ${sendHint}` : ''}
              </>
            )}
          </p>
        )}
        {v?.match === false && copy?.whenDifferent && <p className="callout warn">{copy.whenDifferent}</p>}
        {error && <p className="alert">{error}</p>}

        {current.length > 0 && (
          <details className="timings">
            <summary>
              {t.timings}
              <span className="muted mono">
                {current.map((r) => ` · ${r.status} in ${r.clientMs.toFixed(0)} ms`).join('')}
              </span>
            </summary>
            <Waterfall requests={current} label={spanLabel} tone={spanTone} statusTone={statusTone} />
          </details>
        )}
      </section>

      <div className="report-cards">
        <section className="card mini-card">
          <p className="kicker">{t.idea}</p>
          <h3>{QUESTION[lang]}</h3>
          <ul className="notes">{THEORY_NOTES[lang].map((n) => <li key={n}>{n}</li>)}</ul>
          <ReferenceImages topic="idempotency" />
        </section>

        <section className="card mini-card">
          <p className="kicker">{t.dataSays}</p>
          <ul className="facts">
            {buyMs !== undefined && retryMs !== undefined && (
              <li>{t.replayVsBuy(retryMs.toFixed(0), buyMs.toFixed(0), spansOf('retry')?.length, spansOf('buy')?.length)}</li>
            )}
            {doubleRun && (
              <li>{t.oneOrder(doubleRun.after.stock['TSHIRT-BASIC-001'])}</li>
            )}
            {doubleDiffers && (
              <li>{t.race500}</li>
            )}
            <li>{t.nextLab}</li>
          </ul>
        </section>

        <section className="card mini-card">
          <p className="kicker">Code</p>
          <ul className="code-links">
            {CODE_LINKS.map((c) => (
              <li key={c.path}>
                <a href={`${REPO}/${c.path}`} target="_blank" rel="noreferrer" title={c.path}>{c.label}</a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {mode === 'live' && apiUp && (
        <details className="card playground-card">
          <summary>{t.playground}</summary>
          <InventoryLab onRecord={onPlaygroundRecord} refreshKey={playgroundTick} />
        </details>
      )}
    </article>
  );
}
