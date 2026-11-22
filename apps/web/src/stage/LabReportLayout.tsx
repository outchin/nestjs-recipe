import type { ReactNode } from 'react';
import { CodePanel, type CodeView } from './CodePanel';
import { COMMON } from './common-text';
import { IsoStage } from './IsoStage';
import './report.css';
import { Stage } from './Stage';
import type { NodePanel, RecordingMeta, RequestRecord, Scene, SnippetFile, TraceSpan, Tone } from './types';
import { Chips, Segmented, fmtDate, type ApiStatus, type ChipItem, type Lang } from './ui';
import { blockedReason } from './useLiveSession';
import type { useLabRunner, Mode } from './useLabRunner';
import { Waterfall } from './Waterfall';

/*
 * The page every lab report renders (see docs/LAB-VISUALIZER.md):
 * hero → stage panel (tabs, toggles, stage, step bar, live status, callout, code, timings) → children (cards, playground).
 * A lab passes its words, its verdict chips and its cards; everything else is here.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Runner = ReturnType<typeof useLabRunner<any, any, any>>;

export interface StepVerdict {
  theory: ChipItem[];
  got: ChipItem[] | null;
  /** true ✓, false "differs", null nothing to compare */
  match: boolean | null;
}

export interface LabReportLayoutProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  view: '3d' | '2d';
  setView: (v: '3d' | '2d') => void;
  speed: number;
  setSpeed: (s: number) => void;
  api: ApiStatus;
  runner: Runner;

  eyebrow: string;
  title: string;
  lead: string;
  pills: string[];
  meta: RecordingMeta;

  tabs: { id: string; label: string; differs: boolean }[];
  scene: Scene;
  panels?: Record<string, NodePanel>;
  /** the selected step: one-line title, verdict, optional "why it differs" */
  stepTitle?: string;
  verdict?: StepVerdict;
  callout?: string;
  resetTitle: string;
  /** the code behind the selected step (snippets from scripts/extract-snippets.mts) */
  snippets?: SnippetFile;
  code?: CodeView;

  waterfall: {
    label: (s: TraceSpan) => string;
    tone: (s: TraceSpan) => Tone;
    statusTone: (status: number) => Tone;
    summary: (r: RequestRecord) => string;
  };
  children?: ReactNode;
}

export function LabReportLayout(p: LabReportLayoutProps) {
  const t = COMMON[p.lang];
  const r = p.runner;
  const apiUp = p.api === 'up';
  const session = r.session;
  const sendHint = blockedReason(session, r.stepIndex, t);
  const StageView = p.view === '3d' ? IsoStage : Stage;
  const total = p.tabs.length;

  return (
    <article className="report" lang={p.lang}>
      <header className="report-hero">
        <p className="eyebrow">{p.eyebrow}</p>
        <h1>{p.title}</h1>
        <p className="hero-lead">{p.lead}</p>
        <div className="hero-meta">
          {p.pills.map((x) => <span key={x} className="pill">{x}</span>)}
          <span className="pill" title={`${p.meta.platform} · ${p.meta.cpu ?? ''} · Node ${p.meta.node}`}>
            {t.recorded(fmtDate(p.meta.recordedAt), p.meta.commit + (p.meta.dirty ? '+' : ''))}
          </span>
          <span className="spacer" />
          <Segmented<Lang> label="Language" value={p.lang} onChange={p.setLang}
            options={[{ value: 'en', label: 'EN' }, { value: 'my', label: 'မြန်မာ' }]} />
        </div>
      </header>

      <section className="stage-panel">
        <div className="stage-toolbar">
          <nav className="step-tabs" aria-label="Scenario steps">
            {p.tabs.map((s, i) => (
              <button key={s.id} className={`step-tab${r.selected === s.id ? ' is-on' : ''}`}
                aria-current={r.selected === s.id ? 'step' : undefined} onClick={() => r.choose(s.id)}>
                <span className="step-tab-no">{i + 1}</span>
                {s.label}
                {s.differs && <span className="dot t-error" aria-label="differs from theory" />}
              </button>
            ))}
          </nav>
          <div className="row">
            <Segmented<Mode> label="Data source" value={r.mode} onChange={r.switchMode}
              options={[
                { value: 'replay', label: 'Recorded' },
                { value: 'live', label: 'Live', disabled: !apiUp,
                  title: apiUp ? 'Send real requests to your local API' : 'Live needs the local API (see the hint below)' },
              ]} />
            <Segmented label="View" value={p.view} onChange={p.setView}
              options={[{ value: '3d', label: '3D' }, { value: '2d', label: '2D' }]} />
            <Segmented<number> label="Speed" value={p.speed} onChange={p.setSpeed}
              options={[{ value: 0.5, label: '½×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]} />
          </div>
        </div>

        {import.meta.env.DEV && r.mode === 'replay' && p.api !== 'up' && p.api !== 'checking' && (
          <p className="live-hint">{p.api === 'down' ? t.hintNoApi : t.hintNoDb}</p>
        )}
        {r.mode === 'live' && !apiUp && p.api !== 'checking' && <p className="alert">{t.apiStopped}</p>}

        <div className="stage-scroll">
          <StageView scene={p.scene} packets={r.player.packets} marks={r.player.marks} caption={r.player.caption}
            panels={p.panels} footer={r.mode === 'replay' ? t.footerReplay : t.footerLive} />
        </div>

        {p.stepTitle && p.verdict && (
          <div className="step-bar">
            <p className="step-title">{p.stepTitle}</p>
            <div className="verdict">
              <span className="muted">Theory</span> <Chips items={p.verdict.theory} />
              <span className="arrow" aria-hidden="true">→</span>
              <span className="muted">{r.mode === 'replay' ? 'Recorded' : 'Live'}</span>{' '}
              {p.verdict.got ? <Chips items={p.verdict.got} /> : <span className="muted">—</span>}
              {p.verdict.match === true && <span className="verdict-ok">✓</span>}
              {p.verdict.match === false && <span className="chip t-error">{t.differs}</span>}
            </div>
            <div className="row">
              {r.step && r.runs[r.step.id] && <button onClick={() => r.choose(r.step!.id)}>▶ Replay</button>}
              {r.mode === 'live' && r.step && (
                <>
                  <button className="primary" disabled={!r.canSend} onClick={() => r.sendLive(r.step!)} title={sendHint}>Send live</button>
                  <button disabled={r.busy} onClick={r.runAllLive} title="Reset, then all steps">Run all</button>
                  <button className={!session || session.dirty ? 'primary' : undefined} disabled={r.busy} onClick={r.resetLive}
                    title={p.resetTitle}>{r.busy && !session ? t.busyReset : 'Reset DB'}</button>
                </>
              )}
            </div>
          </div>
        )}
        {r.mode === 'live' && (
          <p className={`db-status${!session || session.dirty ? ' needs-reset' : ''}`}>
            {!session && t.notReset}
            {session && session.dirty && t.dirty}
            {session && !session.dirty && (
              <>
                {t.resetOk(session.resetAt, session.done, total)}
                {sendHint && session.done < total && r.stepIndex !== session.done ? ` · ${sendHint}` : ''}
              </>
            )}
          </p>
        )}
        {p.callout && <p className="callout warn">{p.callout}</p>}
        {r.error && <p className="alert">{r.error}</p>}
        {p.snippets && p.code && <CodePanel source={p.snippets} view={p.code} title={t.codeTitle} ranLabel={t.codeRan} />}

        {r.current.length > 0 && (
          <details className="timings">
            <summary>
              {t.timings}
              <span className="muted mono">{r.current.map((x) => ` · ${p.waterfall.summary(x)}`).join('')}</span>
            </summary>
            <Waterfall requests={r.current} label={p.waterfall.label} tone={p.waterfall.tone} statusTone={p.waterfall.statusTone} />
          </details>
        )}
      </section>

      {p.children}
    </article>
  );
}
