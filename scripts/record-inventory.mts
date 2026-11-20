/**
 * Records a REAL run of the inventory "last sneaker" scenario for the published page.
 *
 *   npm run dev:api            (DB_DRIVER=mysql, DB up)
 *   npm run record:inventory   → apps/web/src/recordings/inventory/last-sneaker.json
 *
 * The page's replay mode only ever shows what this script captured: real status codes,
 * real timings, the real server path (X-Lab-Trace). Resets the demo data first.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { request } from '../apps/web/src/stage/http.ts';
import type { Recording, Scenario, StepRun } from '../apps/web/src/stage/types.ts';
import { newContext, resetDemo, runStep } from '../apps/web/src/labs/inventory/run.ts';

const root = new URL('..', import.meta.url);
const base = process.env.API_URL ?? 'http://localhost:3000/api';
const scenario = JSON.parse(
  readFileSync(new URL('apps/web/src/labs/inventory/scenario.json', root), 'utf8'),
) as Scenario;
const outDir = new URL('apps/web/src/recordings/inventory/', root);

const health = await request(`${base}/health`).catch((e: Error) => {
  console.error(`API not reachable at ${base}: ${e.message}\nStart it with: npm run dev:api`);
  process.exit(1);
});
const { dbDriver, db } = health.data as { dbDriver: string; db: string };
if (db !== 'up') {
  console.error(`Database is "${db}" (driver ${dbDriver}). The inventory lab needs DB_DRIVER=mysql and npm run db:up -- mysql.`);
  process.exit(1);
}

const ctx = newContext(base);
const initial = await resetDemo(ctx);
const runs: StepRun[] = [];
for (const step of scenario.steps) {
  const run = await runStep(ctx, scenario, step);
  runs.push(run);
  const got = run.requests.map((r) => r.status);
  const ok = JSON.stringify([...got].sort()) === JSON.stringify([...step.expect].sort());
  console.log(`${ok ? '✓' : '≠'} ${step.id.padEnd(7)} expected ${step.expect.join('+')}  got ${got.join('+')}  ` +
    `(${run.requests.map((r) => `${r.clientMs}ms`).join(', ')})`);
}

const git = (args: string) => execSync(`git ${args}`, { cwd: root }).toString().trim();
const recording: Recording = {
  meta: {
    scenario: scenario.id,
    recordedAt: new Date().toISOString(),
    commit: git('rev-parse --short HEAD'),
    // only code that shapes the run counts (not unrelated notes or editor files)
    dirty: git('status --porcelain -- apps scripts package.json') !== '',
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
