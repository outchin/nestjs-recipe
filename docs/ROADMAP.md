# Roadmap — topics for future labs

A menu, not a plan: **the owner picks what to build next and in what order.** Nothing here is
started until it is chosen. Each entry is either a **Lab** (runs for real, measured, recorded —
see [LAB-VISUALIZER.md](LAB-VISUALIZER.md)) or **Theory** (an illustrated explainer page, nothing
measured).

The thread through it: one shop system (users, products, orders) that grows lab by lab —
correct → reliable → fast → scaled → deployed and observed.

| Status | Meaning |
|---|---|
| ✅ | done |
| ▶ | chosen, in progress |
| · | idea |

## ① Data correctness

| | Topic | Type | What to show / measure |
|---|---|---|---|
| ✅ | Idempotency keys (Lab 01) | Lab | same key → same order; same-key race → 201 + 500 |
| ▶ | Indexes & EXPLAIN | Lab | ~1M rows: query with / without index — EXPLAIN type, rows read, latency; when an index is *not* used |
| · | Duplicate key → 200 (fix Lab 01's race) | Lab | before/after recording of the double tap |
| · | Row locks vs optimistic locking | Lab | Alice and Bob race for the last sneaker (`version` column already exists) |
| · | Transaction isolation levels | Lab | lost update, dirty / non-repeatable read per level |
| · | N+1 queries | Lab | query count + latency, eager vs lazy loading |

## ② Reliability

| | Topic | Type | What to show / measure |
|---|---|---|---|
| · | Rate limiting (token bucket) | Lab | 429s under burst, tokens refilling |
| · | Timeouts + retry with backoff/jitter | Lab | retry storms with and without jitter |
| · | Circuit breaker | Lab | open / half-open / closed against a failing dependency |
| · | Outbox pattern | Lab | DB write + message in one transaction; crash in between |
| · | Sagas | Theory | orchestration vs choreography, compensation |

## ③ Scaling

| | Topic | Type | What to show / measure |
|---|---|---|---|
| · | Redis cache-aside | Lab | hit rate, DB load, stampede on expiry |
| · | Queue + worker (BullMQ) | Lab | at-least-once, idempotent consumer, DLQ |
| · | 3 instances + Nginx load balancer | Lab | distribution, kill one instance mid-load |
| · | Read replica + replication lag | Lab | read-your-own-write failures |
| · | Sharding & consistent hashing | Theory | key → shard, adding a node |
| · | CAP / consistency models | Theory | partitions, trade-offs |
| · | CQRS / event sourcing | Theory | write model vs read model |
| · | Microservices vs modular monolith | Theory | boundaries, costs |

## ④ Security

| | Topic | Type | What to show / measure |
|---|---|---|---|
| · | JWT + refresh token rotation | Lab | replaces the `X-User-Id` stand-in; stolen refresh token detection |
| · | RBAC guard | Lab | 403 paths |
| · | SQL injection | Lab | unsafe vs parameterised query |
| · | OAuth2 / OIDC | Theory | auth code + PKCE flow |

## ⑤ DevOps & cloud

| | Topic | Type | What to show / measure |
|---|---|---|---|
| · | Docker multi-stage build | Lab | image size, build time before/after |
| · | GitHub Actions CI | Lab | test → build → push |
| · | Deploy to k3d (local k8s) | Lab | readiness/liveness probes, rolling update downtime, pod kill |
| · | HPA autoscaling | Lab | k6 load → pod count |
| · | Observability: OpenTelemetry + Prometheus + Grafana | Lab | grow `labTrace` into standard traces/metrics |
| · | Blue-green / canary | Theory | traffic shifting, rollback |
| · | Terraform / IaC | Theory | plan / apply / state |
| · | Cloud building blocks (LB, managed DB, S3, CDN, SQS) | Theory | what each replaces in this system |

Suggested high-value path (only a suggestion): row locks → Redis cache → queue + worker →
load balancer → k3d + observability.

DevOps labs get their events from k8s / Docker / Prometheus instead of `X-Lab-Trace`: same stage
engine, a new adapter per event source.
