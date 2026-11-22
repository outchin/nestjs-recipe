import { useState } from 'react';
import { ReferenceImages } from '../../components/ReferenceImages';
import recordingJson from '../../recordings/inventory/last-sneaker.json';
import snippetsJson from '../../recordings/inventory/snippets.json';
import { COMMON } from '../../stage/common-text';
import { LabReportLayout, type StepVerdict } from '../../stage/LabReportLayout';
import type { DbState, Recording, RequestRecord, Scenario, ScenarioStep, SnippetFile } from '../../stage/types';
import { useApiStatus, useStoredChoice, type Lang } from '../../stage/ui';
import { useLabRunner } from '../../stage/useLabRunner';
import { InventoryLab } from '../InventoryLab';
import { dbPanels, spanLabel, spanTone, statusTone, toLane } from './adapter';
import { CODE_LINKS, QUESTION, REPO, STEP_CODE, STEP_COPY, THEORY_NOTES } from './content';
import { dbSnapshot, newContext, resetDemo, runStep, sameDb } from './run';
import scenarioJson from './scenario.json';
import { inventoryScene } from './scene';
import { UI } from './ui-text';

/** Lab 01 — idempotency. Layout and live/recorded logic come from the stage; this file is the lab's words and verdicts. */

const recording = recordingJson as unknown as Recording<DbState>;
const scenario = scenarioJson as unknown as Scenario;
const snippets = snippetsJson as SnippetFile;

const sameStatuses = (a: number[], b: number[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const statusChips = (statuses: number[]) => statuses.map((s) => ({ label: String(s), tone: statusTone(s) }));

export function InventoryReport() {
  const api = useApiStatus();
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useStoredChoice('lab:view', ['3d', '2d'] as const, '3d');
  const [lang, setLang] = useStoredChoice<Lang>('lab:lang', ['en', 'my'] as const, 'en');
  const t = { ...COMMON[lang], ...UI[lang] };

  const runner = useLabRunner<DbState, ScenarioStep, ReturnType<typeof newContext>>({
    steps: scenario.steps,
    recording,
    speed,
    newContext: () => newContext('/api'),
    reset: resetDemo,
    snapshot: dbSnapshot,
    same: sameDb,
    runStep: (c, step) => runStep(c, scenario, step),
    toLanes: (reqs) => reqs.map((r) => toLane(r, lang)),
    failHint: 'Is the API running with DB_DRIVER=mysql?',
  });
  const { runs } = runner;

  // ── computed from the data, never typed in ──
  const verdictOf = (s: ScenarioStep): StepVerdict => {
    const got = runs[s.id]?.requests.map((r) => r.status) ?? null;
    return { theory: statusChips(s.expect), got: got && statusChips(got), match: got ? sameStatuses(got, s.expect) : null };
  };
  const step = runner.step;
  const copy = step ? STEP_COPY[lang][step.id] : undefined;
  const verdict = step ? verdictOf(step) : undefined;

  const spansOf = (id: string) => runs[id]?.requests[0]?.trace?.spans.filter((s) => s.name.startsWith('db.') && s.depth > 0);
  const buyMs = runs.buy?.requests[0]?.trace?.totalMs;
  const retryMs = runs.retry?.requests[0]?.trace?.totalMs;
  const doubleRun = runs.double;
  // the code panel quotes the run's own trace
  const codeData = (id: string) => {
    const reqs = runs[id]?.requests ?? [];
    const spans = reqs.flatMap((r) => r.trace?.spans ?? []);
    const detail = (name: string) => spans.find((s) => s.name === name)?.detail as Record<string, unknown> | undefined;
    const lookup = reqs.length === 1 ? detail('db.idempotency.lookup') : undefined;
    return {
      hit: lookup?.hit as boolean | undefined,
      orderId: lookup?.orderId as number | null | undefined,
      stock: detail('app.stock.check')?.stock as number | undefined,
      error: spans.find((s) => s.error && s.name !== 'db.transaction')?.error,
      statuses: reqs.length ? reqs.map((r) => r.status) : undefined,
    };
  };
  const doubleDiffers = runs.double ? verdictOf(scenario.steps.find((s) => s.id === 'double')!).match === false : false;

  return (
    <LabReportLayout
      lang={lang} setLang={setLang} view={view} setView={setView} speed={speed} setSpeed={setSpeed} api={api}
      runner={runner}
      eyebrow="Lab 01 · Idempotency"
      title={t.title}
      lead={t.lead}
      pills={['NestJS · MySQL']}
      meta={recording.meta}
      tabs={scenario.steps.map((s) => ({ id: s.id, label: STEP_COPY[lang][s.id].short, differs: verdictOf(s).match === false }))}
      scene={inventoryScene}
      panels={runner.db ? dbPanels(runner.db.now, runner.db.before, lang) : undefined}
      stepTitle={copy?.title}
      verdict={verdict}
      callout={verdict?.match === false ? copy?.whenDifferent : undefined}
      resetTitle="POST /api/inventory/dev/reset"
      snippets={snippets}
      code={step && STEP_CODE[step.id] ? { refs: STEP_CODE[step.id], note: t.codeNote[step.id]?.(codeData(step.id)) } : undefined}
      waterfall={{ label: spanLabel, tone: spanTone, statusTone, summary: (r) => `${r.status} in ${r.clientMs.toFixed(0)} ms` }}
    >
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
            {doubleRun && <li>{t.oneOrder(doubleRun.after.stock['TSHIRT-BASIC-001'])}</li>}
            {doubleDiffers && <li>{t.race500}</li>}
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

      {runner.mode === 'live' && api === 'up' && (
        <details className="card playground-card">
          <summary>{t.playground}</summary>
          <InventoryLab onRecord={(r: RequestRecord) => runner.playExtra([r], { mutates: true })} refreshKey={runner.dbTick} />
        </details>
      )}
    </LabReportLayout>
  );
}
