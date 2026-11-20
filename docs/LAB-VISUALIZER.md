# Lab visualizer — the framework every lab page follows

Lab 01 (`/labs/inventory/idempotency`) is the reference implementation and was signed off as final
on 2026-11-20. Every new lab page copies its flow, look and rules. Don't redesign per lab — extend.

## The idea

A lab page is an **experiment report**, not a lesson: question → prediction (theory) → real run →
what actually happened → takeaways. Everything on the stage comes from **real requests**: the server
reports its own path (`X-Lab-Trace`), MySQL rows are read back, and a script records the run for the
published page. Nothing is animated from a hand-written script, and no number is typed into the copy.

## Page anatomy (keep this order)

1. **Hero** — eyebrow `Lab NN · <topic>`, one short title, one-line lead, pills
   (stack · `Recorded <date> · <commit>`), **EN | မြန်မာ** toggle on the right.
2. **Stage panel** (the page is the stage — full width)
   - Toolbar: **step tabs** (number + short label, red dot when a step differs from theory),
     **Recorded | Live**, **3D | 2D** (3D default), **½× | 1× | 2×** (1× is slow on purpose).
   - Stage: big caption top-left ("what is happening now", tone-coloured), the current node lifts /
     highlights, tags show each query's result + real ms, **DB tables pinned to their nodes** flip at
     COMMIT (`1 → 0`, new rows flash), footer says where the tables come from.
   - Step bar: one-line step title · `Theory 201 → Recorded 201 ✓ / differs` · Replay / Send live /
     Run all / Reset DB.
   - Live status line (reset time, steps run, why Send is blocked).
   - Callout only when reality differs from theory (one paragraph: why).
   - **Timings** collapsed (waterfall of the server spans + network).
3. **Three mini cards** — The idea (question + ≤3 notes + reference image) · What the data says
   (big numbers computed from the run) · Code (link chips).
4. **Playground** collapsed, Live only.

Text is short on purpose. If something needs a paragraph, it goes in the lab README, not on the page.

## Data flow

```
API service ── labTrace.span/note ──▶ X-Lab-Trace header (dev only)
web run.ts ── request() ──▶ RequestRecord {status, ms, trace} + dbSnapshot() after each step
adapter.ts ── toLane(record) ──▶ Hop[] (travel / pulse, COMMIT pulse carries event:'commit')
usePlayer ── plays lanes (parallel requests = parallel lanes) ──▶ Stage / IsoStage
dbPanels(now, before) ──▶ tables on DB nodes; switch to `after` on the commit event
```

- `scripts/record-<lab>.mts` uses the **same `run.ts`** as Live mode → the recording is exactly what
  Live sends. It stores `meta` (date, commit, dirty, node, cpu), `initial` DB state and every step.
- Re-record after committing so the pill shows a clean commit.

## Live mode rules (DB guard)

- Steps only run from a DB **we reset in this session** (Reset DB / Run all).
- Steps run **in order**; a run step can't be re-run without a reset.
- Before every step, read MySQL and compare with the state the previous step left (`sameDb`).
  Different → block, show the real rows, ask for Reset DB.
- Playground requests mark the session dirty.
- The page polls `/api/health` in dev (4 s down / 15 s up) and explains what to run when Live is off.
- Idempotency keys / ids that people read in the DB must name the real thing: `<sku>-<step key>-<rand>`.

## Language (EN / MY)

- `labs/<lab>/content.ts` — step copy, question, theory notes: `Record<Lang, …>`.
- `labs/<lab>/ui-text.tsx` — status lines, hints, cards.
- Burmese **explains**; technical terms stay English (key, retry, COMMIT, UNIQUE, stock, request,
  MySQL…), status codes and numbers stay Latin digits, button labels stay English.
- Stage captions from the adapter are bilingual too (`toLane(record, lang)`).
- Choice persists in `localStorage` (`lab:lang`); the 2D/3D choice in `lab:view`.

## Look

- Tokens only (`apps/web/src/styles.css`): light, minimal, frosted glass; dark mode via the same tokens.
- Tones: ok = green (201), replay = amber (200), error = red (4xx/5xx), info = blue, neutral = grey.
- 3D (`IsoStage`): dimetric floor, server = rack block, DB = cylinder, client = device block, packets =
  balls with shadows; text stays flat. Use `labelSide: 'left' | 'right'` in the scene to keep labels
  from overlapping; DB columns need ~170+ units between nodes.
- Phones: stage keeps ≥640 px and scrolls sideways instead of shrinking.

## Adding a lab — checklist

1. **API**: the lab module as usual (`apps/api/src/modules/<topic>`), plus
   `@UseInterceptors(LabTraceInterceptor)` on its controller and `labTrace.span/note` around each
   query / decision in the service (names like `db.<table>.<verb>`, `app.<check>`). Add an e2e test
   that asserts the trace path. Provide a dev-only reset endpoint.
2. **Web** — create `apps/web/src/labs/<topic>/`:
   - `scenario.json` — steps with `expect` statuses (the theory), `parallel` for races
   - `scene.ts` — nodes (`kind`, `x/y`, `labelSide`), links, groups
   - `run.ts` — reset, step runner, `dbSnapshot`, `sameDb` (plain TS: Node runs it)
   - `adapter.ts` — span → hop/tag mapping, `dbPanels`, bilingual tags
   - `content.ts` + `ui-text.tsx` — EN/MY words
   - `<Topic>Report.tsx` — start by copying `InventoryReport.tsx`
3. **Recorder**: `scripts/record-<topic>.mts` + `npm run record:<topic>`; record a real run into
   `apps/web/src/recordings/<topic>/`.
4. Route + home list entry; links in the lab README.
5. Check: typecheck, unit + e2e tests, Live end-to-end (Reset → steps → guard), desktop / dark / 390 px.

When lab 02 is built, move what both reports share (Segmented, API status hook, live-session guard,
page shell) from `InventoryReport.tsx` into `apps/web/src/stage/` instead of copying it a third time.

## Engine files (lab-agnostic)

| File | Role |
|---|---|
| `stage/types.ts` | Trace, RequestRecord, DbState, Scene, Hop, NodePanel |
| `stage/http.ts` | fetch + timing + trace decode (also used by Node) |
| `stage/usePlayer.ts` | plays lanes; caption; `onEvent` (commit); speed (1× = slow) |
| `stage/motion.ts` | moves packets along SVG paths |
| `stage/Stage.tsx` / `IsoStage.tsx` | 2D / 3D views, same props |
| `stage/Waterfall.tsx` | real timings |
| `stage/stage.css`, `iso.css`, `report.css` | engine + layout styles |
| `apps/api/src/common/lab-trace/` | `labTrace` + `LabTraceInterceptor` |
