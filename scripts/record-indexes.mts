/**
 * Records a REAL run of Lab 02 (indexes & EXPLAIN on ~1M rows) for the published page.
 *
 *   npm run dev:api             (DB_DRIVER=mysql)
 *   npm run record:indexes      → apps/web/src/recordings/indexes/scan-vs-seek.json
 *
 * Resets the lab table first (seeds ~1M rows on the very first run, ~10 s) and leaves it reset.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { request } from '../apps/web/src/stage/http.ts';
import { extractSnippets } from './extract-snippets.mts';
import type { Recording, StepRun } from '../apps/web/src/stage/types.ts';
import { newContext, resetDemo, runStep, type ArchiveState, type IndexScenario } from '../apps/web/src/labs/indexes/run.ts';

const root = new URL('..', import.meta.url);
const base = process.env.API_URL ?? 'http://localhost:3000/api';
const scenario = JSON.parse(readFileSync(new URL('apps/web/src/labs/indexes/scenario.json', root), 'utf8')) as IndexScenario;
const outDir = new URL('apps/web/src/recordings/indexes/', root);

const health = await request(`${base}/health`).catch((e: Error) => {
  console.error(`API not reachable at ${base}: ${e.message}\nStart it with: npm run dev:api`);
  process.exit(1);
});
const { dbDriver, db } = health.data as { dbDriver: string; db: string };
if (dbDriver !== 'mysql' || db !== 'up') {
  console.error(`Lab 02 needs DB_DRIVER=mysql with the DB up (got driver ${dbDriver}, db "${db}").`);
  process.exit(1);
}

const ctx = newContext(base);
console.log('reset (seeds ~1M rows the first time)…');
const initial = await resetDemo(ctx);
const runs: StepRun<ArchiveState>[] = [];
for (const step of scenario.steps) {
  const run = await runStep(ctx, step);
  runs.push(run);
  const body = run.requests[0].response as Record<string, unknown>;
  const summary = 'explain' in body
    ? `type=${(body.explain as { type: string }).type} read=${body.rowsRead} median=${body.medianMs}ms`
    : `${body.ms} ms`;
  console.log(`${step.id.padEnd(10)} ${summary}`);
}
// leave the lab where the page expects to start
await resetDemo(ctx);

const git = (args: string) => execSync(`git ${args}`, { cwd: root }).toString().trim();
const recording: Recording<ArchiveState> = {
  meta: {
    scenario: scenario.id,
    recordedAt: new Date().toISOString(),
    commit: git('rev-parse --short HEAD'),
    // only code that shapes the run counts (not unrelated notes or editor files)
    dirty: git("status --porcelain -- apps scripts package.json ':!apps/web/src/recordings'") !== '',
    node: process.version,
    dbDriver,
    platform: `${os.platform()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
  },
  initial,
  runs,
};

mkdirSync(outDir, { recursive: true });
const out = new URL(`${scenario.id}.json`, outDir);
writeFileSync(out, JSON.stringify(recording, null, 2) + '\n');
console.log(`\nSaved ${fileURLToPath(out)}`);
// the code shown on the page comes from the same commit as the run
extractSnippets();
console.log('Snippets refreshed (npm run snippets)');
