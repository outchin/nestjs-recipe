import { useState } from 'react';
import recordingJson from '../../recordings/indexes/scan-vs-seek.json';
import snippetsJson from '../../recordings/indexes/snippets.json';
import { COMMON } from '../../stage/common-text';
import { LabReportLayout } from '../../stage/LabReportLayout';
import type { Recording, SnippetFile } from '../../stage/types';
import { useApiStatus, useStoredChoice, type Lang } from '../../stage/ui';
import { useLabRunner } from '../../stage/useLabRunner';
import { compact, dbPanels, spanLabel, spanTone, statusTone, toLane, verdictOf } from './adapter';
import { CODE_LINKS, QUESTION, REPO, STEP_CODE, STEP_COPY, THEORY_NOTES } from './content';
import {
  newContext, resetDemo, runQuery, runStep, sameArchive, snapshot,
  type ArchiveState, type IndexResponse, type IndexScenario, type IndexStep, type InsertResponse, type QueryResponse,
} from './run';
import scenarioJson from './scenario.json';
import { indexesScene } from './scene';
import { UI } from './ui-text';

/** Lab 02 — indexes & EXPLAIN on ~1M rows. Layout and live/recorded logic come from the stage. */

const recording = recordingJson as unknown as Recording<ArchiveState>;
const scenario = scenarioJson as unknown as IndexScenario;
const snippets = snippetsJson as SnippetFile;

export function IndexesReport() {
  const api = useApiStatus();
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useStoredChoice('lab:view', ['3d', '2d'] as const, '3d');
  const [lang, setLang] = useStoredChoice<Lang>('lab:lang', ['en', 'my'] as const, 'en');
  const t = { ...COMMON[lang], ...UI[lang] };

  const runner = useLabRunner<ArchiveState, IndexStep, ReturnType<typeof newContext>>({
    steps: scenario.steps,
    recording,
    speed,
    newContext: () => newContext('/api'),
    reset: resetDemo,
    snapshot,
    same: sameArchive,
    runStep,
    toLanes: (reqs) => reqs.map((r) => toLane(r, lang)),
    failHint: 'Is the API running with DB_DRIVER=mysql?',
  });
  const { runs } = runner;

  // playground: any email, either query shape (reads only, so the scenario stays trustworthy)
  const [email, setEmail] = useState('user77@shop.test');
  const [kind, setKind] = useState<'equals' | 'lower'>('equals');
  const [pgBusy, setPgBusy] = useState(false);
  async function runPlayground() {
    setPgBusy(true);
    try {
      const rec = await runQuery(newContext('/api'), kind, email);
      await runner.playExtra([rec], { mutates: false });
    } finally {
      setPgBusy(false);
    }
  }

  // ── computed from the data, never typed in ──
  const step = runner.step;
  const copy = step ? STEP_COPY[lang][step.id] : undefined;
  const verdict = step ? verdictOf(step, runs, lang) : undefined;
  const res = <T,>(id: string) => runs[id]?.requests[0]?.response as T | undefined;
  const scan = res<QueryResponse>('scan');
  const seek = res<QueryResponse>('seek');
  const gotcha = res<QueryResponse>('gotcha');
  const created = res<IndexResponse>('create');
  const w1 = res<InsertResponse>('write-base');
  const w2 = res<InsertResponse>('write-cost');
  const codeData = {
    scanType: scan?.explain.type, scanRead: scan && compact(scan.rowsRead),
    seekType: seek?.explain.type, seekRead: seek && compact(seek.rowsRead),
    gotchaRead: gotcha && compact(gotcha.rowsRead),
    inserted: w1 && compact(w1.rows),
    ratio: w1 && w2 ? (w2.ms / w1.ms).toFixed(1) : undefined,
  };
  // the exact statement this run sent (query steps and CREATE INDEX report it)
  const ran = step ? (res<{ sql?: string }>(step.id)?.sql) : undefined;

  return (
    <LabReportLayout
      lang={lang} setLang={setLang} view={view} setView={setView} speed={speed} setSpeed={setSpeed} api={api}
      runner={runner}
      eyebrow="Lab 02 · Indexes & EXPLAIN"
      title={t.title}
      lead={t.lead}
      pills={['NestJS · MySQL 8', ...(recording.initial ? [`${compact(recording.initial.rows)} rows`] : [])]}
      meta={recording.meta}
      tabs={scenario.steps.map((s) => ({ id: s.id, label: STEP_COPY[lang][s.id].short, differs: verdictOf(s, runs, lang).match === false }))}
      scene={indexesScene}
      panels={runner.db ? dbPanels(runner.db.now, runner.db.before, lang) : undefined}
      stepTitle={copy?.title}
      verdict={verdict}
      callout={verdict?.match === false ? copy?.whenDifferent : undefined}
      resetTitle="POST /api/indexes/dev/reset (first time: seeds ~1M rows)"
      snippets={snippets}
      code={step && STEP_CODE[step.id] ? { refs: STEP_CODE[step.id], note: t.codeNote[step.id]?.(codeData), ran } : undefined}
      waterfall={{
        label: spanLabel, tone: spanTone, statusTone,
        summary: (r) => {
          const q = r.response as Partial<QueryResponse>;
          return q.explain ? `type ${q.explain.type} · median ${q.medianMs} ms` : `${r.status} in ${r.clientMs.toFixed(0)} ms`;
        },
      }}
    >
      <div className="report-cards">
        <section className="card mini-card">
          <p className="kicker">{t.idea}</p>
          <h3>{QUESTION[lang]}</h3>
          <ul className="notes">{THEORY_NOTES[lang].map((n) => <li key={n}>{n}</li>)}</ul>
        </section>

        <section className="card mini-card">
          <p className="kicker">{t.dataSays}</p>
          <ul className="facts">
            {scan && seek && <li>{t.speedup(Math.round(scan.medianMs / seek.medianMs).toLocaleString('en-US'), scan.medianMs, seek.medianMs)}</li>}
            {scan && seek && <li>{t.rowsRead(compact(scan.rowsRead), compact(seek.rowsRead), seek.rowsReturned)}</li>}
            {gotcha && <li>{t.gotcha(gotcha.medianMs)}</li>}
            {w1 && w2 && <li>{t.writeCost((w2.ms / w1.ms).toFixed(1))}</li>}
            {created && <li>{t.indexSize(Math.round(created.state.indexMB), Math.round(created.state.dataMB), (created.ms / 1000).toFixed(1))}</li>}
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
          <p className="muted">{t.playgroundHint}</p>
          <div className="row playground-query">
            <input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="email" spellCheck={false} />
            <select value={kind} onChange={(e) => setKind(e.target.value as 'equals' | 'lower')} aria-label="query shape">
              <option value="equals">WHERE customer_email = ?</option>
              <option value="lower">WHERE LOWER(customer_email) = ?</option>
            </select>
            <button className="primary" disabled={pgBusy || email.length < 3} onClick={runPlayground}>{t.run}</button>
          </div>
        </details>
      )}
    </LabReportLayout>
  );
}
