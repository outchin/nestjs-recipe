# Database layer

Goal: switch the database with **one env var** (`DB_DRIVER` in `apps/api/.env`) without
touching lab services or controllers.

## Drivers

| `DB_DRIVER` | Database | Family (data-access tech) | Status |
|---|---|---|---|
| `memory` (default) | in-process array/Map | memory | ✅ wired |
| `postgres` | PostgreSQL | **TypeORM** | ✅ wired |
| `mysql` | MySQL | **TypeORM** | ✅ wired |
| `mongodb` | MongoDB | **Mongoose** | planned |
| `neo4j` | Neo4j (graph DB) | **neo4j-driver** (Cypher) | planned |

`GET /api/health` shows `dbDriver` and `db` (`up` / `down: …` / `n/a` for memory).

## How it fits together

```
Controller ─► Service ─► TasksRepository (abstract class = DI token)
                                │
            DatabaseModule.forFeature picks ONE by DB_DRIVER's family
                ┌───────────────┼──────────────────┐
         MemoryTasksRepo   TypeOrmTasksRepo    MongooseTasksRepo (later)
                                │
                     @InjectRepository(TaskEntity)
                     TypeORM DataSource (postgres | mysql)
```

- `DatabaseModule.forRoot()` — in `AppModule`, once. Opens the connection for the active
  family (`TypeOrmModule.forRootAsync` for postgres/mysql) and exposes `DB_DRIVER` globally.
- `DatabaseModule.forFeature(Token, impls, { imports })` — in a lab module. Binds the abstract
  repository to the class for the active family, and adds that family's imports only
  (so `TypeOrmModule.forFeature([TaskEntity])` is not loaded when running on memory).
- Picking a driver the lab has no implementation for fails **at boot** with a clear message.
- Services inject the abstract class only; repositories return plain domain objects
  (`Task`), not TypeORM entities — that's what keeps them swappable.

## Lab layout with a database (nestjs-recipe style)

```
src/modules/tasks/
  tasks.module.ts
  tasks.controller.ts
  tasks.service.ts                depends on TasksRepository
  task.model.ts                   Task interface + TaskStatus enum
  dto/create-task.dto.ts
  entities/task.entity.ts         @Entity() — TypeORM only
  repositories/
    tasks.repository.ts           abstract class
    memory-tasks.repository.ts
    typeorm-tasks.repository.ts   @InjectRepository(TaskEntity) Repository<TaskEntity>
```

```ts
@Module({
  imports: [
    DatabaseModule.forFeature(
      TasksRepository,
      { memory: MemoryTasksRepository, typeorm: TypeOrmTasksRepository },
      { imports: { typeorm: [TypeOrmModule.forFeature([TaskEntity])] } },
    ),
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

## Why these tools

**TypeORM for SQL (postgres + mysql).** Same tool as the nestjs-recipe course, so the code
matches what's already familiar. One entity class works on both engines; switching is
`DB_DRIVER` + URL. `synchronize: true` (`DB_SYNC`) creates tables from entities in dev —
turn it off and use migrations when a lab is about migrations.
Versions: `typeorm@1`, `@nestjs/typeorm@11` (v12 is ESM-only for NestJS 12).

**Mongoose for MongoDB.** Document modelling fits Mongoose better and `@nestjs/mongoose`
is first-class.

**neo4j-driver for graph.** Raw Cypher is the thing worth learning there.

**Memory as the default.** Every lab runs with zero setup, unit tests stay fast, and it
proves the abstraction actually works.

## GraphQL ≠ graph database
GraphQL is an **API layer** (alternative to REST controllers), not a database. If wanted,
it's added as a transport (`@nestjs/graphql` resolvers calling the same services) and works
with any `DB_DRIVER`. Graph *databases* are the `neo4j` driver above.

## Running a real database locally

Each database has its own Dockerfile and runs as its own container — start **only** the one
the app is using.

```
docker/
  postgres/Dockerfile   FROM postgres:17 + init/ scripts + healthcheck
  mysql/Dockerfile      FROM mysql:8.4  + my.cnf (utf8mb4, UTC) + init/ (grants for migrations)
scripts/db.sh           build / run / stop / reset / shell / logs
```

```bash
npm run db:up -- postgres        # or: ./scripts/db.sh up postgres
npm run db:up -- mysql
npm run db:status
npm run db:shell -- postgres     # psql inside the container
npm run db:down -- mysql         # stop + remove container, data kept
npm run db:reset -- mysql        # also wipe the data volume
```

Then in `apps/api/.env` set `DB_DRIVER=postgres` (or `mysql`).

What `up` runs (postgres shown; mysql is the same shape):

```bash
docker build -t nestjs-recipe/postgres:local docker/postgres
docker run -d --name nestjs-recipe-postgres \
  -p 5432:5432 \
  -v nestjs-recipe-postgres-data:/var/lib/postgresql/data \
  -e POSTGRES_USER=lab -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab \
  --restart unless-stopped \
  nestjs-recipe/postgres:local
```

| | container | host port | volume | URL |
|---|---|---|---|---|
| postgres | `nestjs-recipe-postgres` | 5432 | `nestjs-recipe-postgres-data` | `postgresql://lab:lab@localhost:5432/lab` |
| mysql | `nestjs-recipe-mysql` | 3306 | `nestjs-recipe-mysql-data` | `mysql://lab:lab@localhost:3306/lab` |

Notes
- Credentials are passed at `docker run`, not baked into images. Override with
  `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PG_PORT`, `MYSQL_PORT`.
- `init/*.sql` runs only on the **first** start of an empty volume. Changed it? `db:reset`.
- Port already in use (a locally installed MySQL/Postgres)? `PG_PORT=5433 npm run db:up -- postgres`
  and update the URL in `.env`.
