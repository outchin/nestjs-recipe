# Architecture

## Goal
Based on the structure of [arielweinberger/nestjs-recipe](https://github.com/arielweinberger/nestjs-recipe)
(module → controller → service → DTO, TypeORM), modernised to NestJS 11.

Not a production system. A **learning lab**: every NestJS concept, common error and
interview question lives next to a small piece of runnable code with tests.
A tiny web UI exists only to hit the API and show responses (including errors).

## Repo layout

```
nestjs-recipe/
├── apps/
│   ├── api/                      NestJS backend (the main thing)
│   │   ├── src/
│   │   │   ├── main.ts           bootstrap: global prefix /api, CORS, global pipes/filters
│   │   │   ├── app.module.ts     root module — only imports lab modules
│   │   │   ├── common/           cross-cutting, reusable across labs
│   │   │   │   ├── filters/      exception filters
│   │   │   │   ├── guards/       auth / role guards
│   │   │   │   ├── interceptors/ logging, transform, timeout
│   │   │   │   ├── pipes/        validation / transform pipes
│   │   │   │   └── decorators/   custom param / metadata decorators
│   │   │   ├── config/           env loading / typed config
│   │   │   ├── database/         swappable DB layer (DatabaseModule, drivers/)
│   │   │   └── modules/          ONE FOLDER PER LAB  ← the core idea
│   │   │       └── <topic>/
│   │   │           ├── <topic>.module.ts
│   │   │           ├── <topic>.controller.ts
│   │   │           ├── <topic>.service.ts
│   │   │           ├── *.spec.ts          unit tests
│   │   │           └── README.md          concept · try it · common errors · interview Qs
│   │   └── test/                 e2e tests (supertest against the real app)
│   └── web/                      Vite + React — a button per endpoint, shows raw response
└── docs/
    ├── ARCHITECTURE.md           this file
    ├── DATABASE.md               database layer design
    ├── interview-questions/      cross-topic Q&A index (links into lab READMEs)
    ├── common-errors/            error catalogue: message → cause → fix → lab link
    └── system-design/            concepts not tied to one lab (caching, queues, scaling…)
```

## Core rules

1. **One lab = one feature module.** Self-contained: module + controller + service +
   tests + README. Delete the folder and the import in `app.module.ts` and nothing else breaks.
2. **Labs never import each other.** Shared code goes to `common/`. This keeps each
   topic readable on its own (and is itself a Nest design lesson).
3. **Every lab ships tests.** Unit spec for the service/controller; e2e for the HTTP contract.
   Error labs assert the *broken* behaviour too, so the failure is reproducible.
4. **Errors are shown, not hidden.** "Broken" endpoints intentionally reproduce a common
   mistake (e.g. circular dependency, missing provider export) next to the fixed version.
5. **Docs are layered.** Lab README = the detail. `docs/*` = indexes + topics that span labs.

## Request flow (what the labs will walk through, in order)

```
HTTP request
  → Middleware
  → Guards           (can I?)
  → Interceptors     (before)
  → Pipes            (validate / transform input)
  → Controller → Service → Providers (DI)
  → Interceptors     (after: transform response)
  → Exception filters (if anything threw)
HTTP response
```

## Frontend ↔ backend
- Web dev server on `:5173` proxies `/api/*` to Nest on `:3000` — no hard-coded URLs, no CORS pain in dev.
- `react-router`: one URL per lab page, linkable directly (e.g. `/labs/inventory/idempotency`).
  Routes in `apps/web/src/App.tsx`; home (`pages/HomePage.tsx`) lists lab pages + endpoint buttons.
- Lab page = theory (images from `src/assets/references/<topic>/`, auto-loaded) + the hands-on component (`src/labs/`).

## Database
Swappable via `DB_DRIVER` (memory · postgres · mysql · mongodb · neo4j) behind a repository
abstraction. TypeORM for SQL, Mongoose for Mongo, neo4j-driver for graph. Details: [DATABASE.md](DATABASE.md).

## Labs
No fixed roadmap — a lab is added when there's an idea to try. Each lab is its own mini
project, testable from the UI.

| Lab | What it shows | Added |
|-----|---------------|-------|
| `health` | template: module/controller/service, unit + e2e test, reports active DB driver | 2026-11-03 |
| `inventory` | MySQL schema (users/products/orders/order_items) for the "2 users, 1 item left" race; constraints + seed | 2026-11-08 |
