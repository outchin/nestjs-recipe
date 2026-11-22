import { Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { DataSource, QueryRunner } from 'typeorm';
import { labTrace } from '../../common/lab-trace/lab-trace';

/*
 * Lab 02 — indexes & EXPLAIN on ~1M rows.
 *
 * The table is created with raw SQL on purpose (no TypeORM entity): with DB_SYNC=true,
 * schema sync would drop an index it doesn't know about, and creating / dropping the
 * index by hand IS the experiment.
 */

export const TABLE = 'orders_archive';
export const INDEX = 'idx_email';
/** rows after setup / reset; ids 1..SEED_ROWS */
export const SEED_ROWS = 1_000_000;
/** user0..user99999 → ~10 orders per customer */
export const CUSTOMERS = 100_000;

export type QueryKind = 'equals' | 'lower';

export interface ArchiveState {
  rows: number;
  indexes: string[];
  /** approximate, from information_schema after ANALYZE */
  dataMB: number;
  indexMB: number;
}

export interface ExplainRow {
  type: string;
  key: string | null;
  rows: number;
  extra: string | null;
}

export interface QueryResult {
  kind: QueryKind;
  sql: string;
  explain: ExplainRow;
  rowsReturned: number;
  /** InnoDB row reads during the first run (Handler_read_* delta) */
  rowsRead: number;
  handler: Record<string, number>;
  runsMs: number[];
  medianMs: number;
}

const DIGIT = `(SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)`;
/** 0 .. 10^n - 1, built from a cross join of digit tables (fast, no recursion limit) */
const numbers = (n: number) =>
  `(SELECT ${Array.from({ length: n }, (_, i) => `d${i}.d * ${10 ** i}`).join(' + ')} AS n FROM ${Array.from(
    { length: n },
    (_, i) => `${DIGIT} d${i}`,
  ).join(', ')})`;

// lab:snippet indexes/query
const QUERY: Record<QueryKind, string> = {
  equals: `SELECT id, customer_email, status, total FROM ${TABLE} WHERE customer_email = ?`,
  // a function on the column: the B-tree is sorted by customer_email, not by LOWER(customer_email)
  lower: `SELECT id, customer_email, status, total FROM ${TABLE} WHERE LOWER(customer_email) = ?`,
};
// lab:end

const RUNS = 5;
const round = (n: number) => Math.round(n * 100) / 100;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

@Injectable()
export class IndexesService {
  constructor(private readonly dataSource: DataSource) {}

  /** One connection for a whole operation: session variables and Handler_* counters are per connection. */
  private async withRunner<T>(fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query('SET SESSION information_schema_stats_expiry = 0');
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  private async ensureTable(qr: QueryRunner) {
    await qr.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      customer_email VARCHAR(120) NOT NULL,
      status VARCHAR(16) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      created_at DATETIME NOT NULL
    ) ENGINE=InnoDB`);
  }

  private async count(qr: QueryRunner): Promise<number> {
    return Number((await qr.query(`SELECT COUNT(*) AS c FROM ${TABLE}`))[0].c);
  }

  private async indexes(qr: QueryRunner): Promise<string[]> {
    const rows: { name: string }[] = await qr.query(
      `SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME <> 'PRIMARY' ORDER BY name`,
      [TABLE],
    );
    return rows.map((r) => r.name);
  }

  private async readState(qr: QueryRunner): Promise<ArchiveState> {
    const [size] = await qr.query(
      `SELECT DATA_LENGTH AS d, INDEX_LENGTH AS i FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [TABLE],
    );
    const mb = (b: unknown) => round(Number(b ?? 0) / 1024 / 1024);
    return { rows: await this.count(qr), indexes: await this.indexes(qr), dataMB: mb(size?.d), indexMB: mb(size?.i) };
  }

  state(): Promise<ArchiveState> {
    return this.withRunner(async (qr) => {
      await this.ensureTable(qr);
      return this.readState(qr);
    });
  }

  /** Make sure exactly SEED_ROWS rows exist (seeds on first use: ~10 s). */
  private async seedIfNeeded(qr: QueryRunner) {
    await this.ensureTable(qr);
    const [{ m }] = await qr.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${TABLE} WHERE id <= ?`, [SEED_ROWS]);
    if (Number(m) === SEED_ROWS && (await this.count(qr)) >= SEED_ROWS) return;
    await qr.query(`TRUNCATE TABLE ${TABLE}`); // also resets AUTO_INCREMENT, so seed ids are 1..SEED_ROWS
    await qr.query(
      `INSERT INTO ${TABLE} (customer_email, status, total, created_at)
       SELECT CONCAT('user', n % ${CUSTOMERS}, '@shop.test'), ELT(1 + n % 3, 'PAID', 'SHIPPED', 'REFUNDED'),
              (n % 500) + 0.99, NOW() - INTERVAL (n % 365) DAY
       FROM ${numbers(6)} t`,
    );
  }

  /** Dev only: back to the starting point — exactly SEED_ROWS rows, no secondary index. */
  reset(): Promise<ArchiveState> {
    return this.withRunner(async (qr) => {
      await this.seedIfNeeded(qr);
      await qr.query(`DELETE FROM ${TABLE} WHERE id > ?`, [SEED_ROWS]);
      for (const name of await this.indexes(qr)) await qr.query(`DROP INDEX \`${name}\` ON ${TABLE}`);
      await qr.query(`ANALYZE TABLE ${TABLE}`);
      return this.readState(qr);
    });
  }

  /** EXPLAIN, then RUNS timed executions; rows read come from the Handler_read_* delta of the first run. */
  query(kind: QueryKind, email: string): Promise<QueryResult> {
    const sql = QUERY[kind];
    return this.withRunner(async (qr) => {
      type RawExplain = { type: string; key: string | null; rows: number | string; Extra: string | null };
      const [ex] = await labTrace.span(
        'db.explain',
        (): Promise<RawExplain[]> => qr.query(`EXPLAIN ${sql}`, [email]),
        (r) => ({ type: r[0]?.type, key: r[0]?.key ?? null, rows: Number(r[0]?.rows ?? 0) }),
      );
      const explain: ExplainRow = { type: ex.type, key: ex.key ?? null, rows: Number(ex.rows), extra: ex.Extra ?? null };

      const handlerNow = async () => {
        const rows: { Variable_name: string; Value: string }[] = await qr.query(`SHOW SESSION STATUS LIKE 'Handler_read%'`);
        return Object.fromEntries(rows.map((r) => [r.Variable_name.replace('Handler_read_', ''), Number(r.Value)]));
      };

      const before = await handlerNow();
      const runsMs: number[] = [];
      let rowsReturned = 0;
      const first = await labTrace.span(
        'db.select',
        async () => {
          const t0 = performance.now();
          const rows: unknown[] = await qr.query(sql, [email]);
          runsMs.push(round(performance.now() - t0));
          rowsReturned = rows.length;
          return rows;
        },
        () => ({ kind, type: explain.type, key: explain.key, rowsReturned }),
      );
      const after = await handlerNow();
      const handler = Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - (before[k] ?? 0)]));
      const rowsRead = Object.values(handler).reduce((s, v) => s + v, 0);
      labTrace.note('db.rows.read', { rowsRead, rowsReturned: first.length, type: explain.type });

      await labTrace.span(
        'db.select.repeat',
        async () => {
          for (let i = 1; i < RUNS; i++) {
            const t0 = performance.now();
            await qr.query(sql, [email]);
            runsMs.push(round(performance.now() - t0));
          }
        },
        () => ({ runs: RUNS - 1 }),
      );

      return { kind, sql, explain, rowsReturned, rowsRead, handler, runsMs, medianMs: median(runsMs) };
    });
  }

  /** CREATE INDEX on customer_email (timed; the whole table is read and sorted into a B-tree). */
  createIndex(): Promise<{ ms: number; sql: string; state: ArchiveState }> {
    return this.withRunner(async (qr) => {
      // lab:snippet indexes/create-index
      const sql = `CREATE INDEX ${INDEX} ON ${TABLE} (customer_email)`;
      const t0 = performance.now();
      await labTrace.span('db.index.create', () => qr.query(sql), () => ({ index: INDEX }));
      // lab:end
      const ms = round(performance.now() - t0);
      await qr.query(`ANALYZE TABLE ${TABLE}`);
      return { ms, sql, state: await this.readState(qr) };
    });
  }

  /** Insert `count` new rows in one statement: the cost of keeping every index up to date. */
  insert(count: number): Promise<{ rows: number; ms: number; rowsPerSec: number; indexes: string[] }> {
    return this.withRunner(async (qr) => {
      const indexes = await this.indexes(qr);
      const t0 = performance.now();
      // lab:snippet indexes/insert
      await labTrace.span(
        'db.insert',
        () =>
          qr.query(
            `INSERT INTO ${TABLE} (customer_email, status, total, created_at)
             SELECT CONCAT('new', n % ${CUSTOMERS}, '@shop.test'), 'PAID', 9.99, NOW()
             FROM ${numbers(5)} t WHERE n < ?`,
            [count],
          ),
        () => ({ rows: count, indexes: indexes.length }),
      );
      // lab:end
      const ms = round(performance.now() - t0);
      return { rows: count, ms, rowsPerSec: Math.round((count / ms) * 1000), indexes };
    });
  }
}
