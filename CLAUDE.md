# nestjs-recipe (node_allin1)

NestJS learning lab: one lab per topic in `apps/api/src/modules/<topic>`, a Vite + React web app that
shows each lab as an interactive experiment report. See `README.md` and `docs/ARCHITECTURE.md`.

## Lab pages: always follow the lab visualizer framework

How the 2D/3D stage itself is built (to reuse it elsewhere): `docs/STAGE-ENGINE.md`.

Every lab page uses the flow, look and rules in **`docs/LAB-VISUALIZER.md`** (reference: Lab 01,
`apps/web/src/labs/inventory/`). The owner signed this off as the standard; don't ask again about
layout, style, speed, 2D/3D, language or the Live/Recorded model — reuse it. Only ask about what is
genuinely new in the lab (its scenario, nodes, what to measure).

Non-negotiables:
- Real data only: stage animations come from `X-Lab-Trace` spans and MySQL read-backs; the published
  page replays a recording made by `scripts/record-<lab>.mts`. Never script fake packets or type
  numbers into copy.
- Live mode runs only from a DB the page reset itself, steps in order, DB checked before each step.
- Short text on the page; EN + Burmese (Burmese explains, technical terms/status codes stay English).
- Stage first: full width, 3D default with 2D toggle, slow default speed (½× / 1× / 2×).

## Roadmap

`docs/ROADMAP.md` lists candidate topics. The owner chooses which one to build next; don't start
an unchosen topic. Mark status there (▶ in progress, ✅ done) when a lab starts / finishes.

## Commands

```bash
npm run dev:api            # API on :3000 (DB_DRIVER in apps/api/.env; inventory needs mysql)
npm run dev:web            # web on :5173
npm run db:up -- mysql     # MySQL container
npm test && npm run test:e2e
npm run record:inventory   # re-record Lab 01 (resets the demo data)
npm run record:indexes     # re-record Lab 02 (first run seeds ~1M rows, ~10 s)
npm run snippets           # copy `// lab:snippet` code blocks into the lab pages (recorders do it too)
npm run build:pages        # static build for GitHub Pages (Recorded mode only)
npm run build:labs         # build served at zawwaisoe.dev/labs (vercel.json; portfolio rewrites /labs/* here)
```
