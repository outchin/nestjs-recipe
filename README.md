# nestjs-recipe

A small NestJS repo that collects **concepts, common errors, interview questions and
system design notes** in one place — each backed by runnable code and tests.
A minimal React UI is included only to call the API.

## Quick start

```bash
npm install
npm run dev:api     # http://localhost:3000/api/health
npm run dev:web     # http://localhost:5173
npm test            # unit tests
npm run test:e2e    # e2e tests
```

Default database is in-memory. For a real one: `npm run db:up -- postgres` (or `mysql`)
and set `DB_DRIVER` in `apps/api/.env` (see `docs/DATABASE.md`).

## Where things are
- `apps/api/src/modules/<topic>/` — one lab per topic (code + tests + README)
- `docs/ARCHITECTURE.md` — design + lab index
- `docs/DATABASE.md` — switching databases (`DB_DRIVER`), TypeORM/Mongoose/Neo4j
- `docs/interview-questions/`, `docs/common-errors/`, `docs/system-design/`
- `apps/web/src/stage/` — lab visualizer engine (stage, packets, waterfall, glass theme); lab-agnostic
- `apps/web/src/labs/<topic>/` — one lab's report: `scenario.json`, scene, adapter, copy
- `apps/web/src/recordings/<topic>/` — real runs the page replays (`npm run record:inventory`, API + MySQL up)
- `apps/api/src/common/lab-trace/` — `X-Lab-Trace` header: what each request did inside the server (dev only)

## Adding a lab
1. Copy `apps/api/src/modules/health` → `modules/<topic>`, rename.
2. Import the module in `app.module.ts`.
3. Write the spec(s) and the README sections.
4. Web: the lab page follows **[`docs/LAB-VISUALIZER.md`](docs/LAB-VISUALIZER.md)** (scenario, scene, adapter,
   EN/MY copy, recorder) → `pages/<Topic>Page.tsx` + a `<Route>` in `App.tsx` + an entry in `labPages`.
   Theory images → `apps/web/src/assets/references/<topic>/`.
5. Add a row to the lab table in `docs/ARCHITECTURE.md`; link questions/errors from `docs/`.
