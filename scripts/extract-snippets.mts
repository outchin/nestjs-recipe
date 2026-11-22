/**
 * Copies the code that matters into the lab pages, so the page never shows code that isn't real.
 *
 * In apps/api/src, wrap a block in markers (the marker lines themselves are not copied):
 *
 *     // lab:snippet indexes/create-index      ← <lab>/<snippet id>
 *     const sql = `CREATE INDEX …`;
 *     // lab:end
 *
 *   npm run snippets   → apps/web/src/recordings/<lab>/snippets.json (also run by every record:<lab>)
 *
 * Each snippet keeps its file, line numbers and the commit, so the page links to the exact lines.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Snippet, SnippetFile } from '../apps/web/src/stage/types.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = 'apps/api/src';
const START = /^\s*\/\/ lab:snippet ([\w-]+)\/([\w-]+)\s*$/;
const END = /^\s*\/\/ lab:end\s*$/;

function* tsFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* tsFiles(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

/** drop the common indentation so a block from deep inside a method reads naturally */
function dedent(lines: string[]): string[] {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent));
}

/** "git@github.com:me/repo.git" / "https://github.com/me/repo.git" → "https://github.com/me/repo" */
function repoUrl(remote: string): string | undefined {
  const m = remote.match(/github\.com[:/](.+?)(\.git)?$/);
  return m ? `https://github.com/${m[1]}` : undefined;
}

export function extractSnippets(): Record<string, SnippetFile> {
  const git = (args: string) => execSync(`git ${args}`, { cwd: root }).toString().trim();
  const byLab: Record<string, Record<string, Snippet>> = {};

  for (const abs of tsFiles(path.join(root, SRC))) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const lines = readFileSync(abs, 'utf8').split('\n');
    let open: { lab: string; id: string; from: number } | null = null;
    lines.forEach((line, i) => {
      const start = line.match(START);
      if (start) {
        if (open) throw new Error(`${file}:${i + 1}: lab:snippet inside ${open.lab}/${open.id}`);
        open = { lab: start[1], id: start[2], from: i + 1 };
        return;
      }
      if (END.test(line)) {
        if (!open) throw new Error(`${file}:${i + 1}: lab:end without lab:snippet`);
        const { lab, id, from } = open;
        const body = lines.slice(from, i);
        byLab[lab] ??= {};
        if (byLab[lab][id]) throw new Error(`${file}:${from}: snippet ${lab}/${id} is defined twice`);
        // line numbers are 1-based and point at the first / last copied line
        byLab[lab][id] = { file, start: from + 1, end: i, code: dedent(body).join('\n') };
        open = null;
      }
    });
    if (open) throw new Error(`${file}: lab:snippet ${(open as { lab: string }).lab}/${(open as { id: string }).id} has no lab:end`);
  }

  const meta = {
    extractedAt: new Date().toISOString(),
    commit: git('rev-parse --short HEAD'),
    commitFull: git('rev-parse HEAD'),
    dirty: git(`status --porcelain -- ${SRC}`) !== '',
    repo: repoUrl(git('remote get-url origin')),
  };
  const out: Record<string, SnippetFile> = {};
  for (const [lab, snippets] of Object.entries(byLab)) {
    out[lab] = { meta, snippets };
    const dir = path.join(root, 'apps/web/src/recordings', lab);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'snippets.json'), JSON.stringify(out[lab], null, 2) + '\n');
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [lab, f] of Object.entries(extractSnippets())) {
    console.log(`${lab}: ${Object.keys(f.snippets).join(', ')} @ ${f.meta.commit}${f.meta.dirty ? '+' : ''}`);
  }
}
