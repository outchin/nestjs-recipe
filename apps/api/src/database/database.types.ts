import '../config/env';

/** Concrete database the app talks to. Selected by DB_DRIVER. */
export const DB_DRIVERS = ['memory', 'postgres', 'mysql', 'mongodb', 'neo4j'] as const;
export type DbDriver = (typeof DB_DRIVERS)[number];

/**
 * Data-access technology. Several drivers can share one family
 * (postgres + mysql are both served by TypeORM), so a lab writes one repository
 * per family, not per database.
 */
export type RepoFamily = 'memory' | 'typeorm' | 'mongoose' | 'neo4j';

export const DRIVER_FAMILY: Record<DbDriver, RepoFamily> = {
  memory: 'memory',
  postgres: 'typeorm',
  mysql: 'typeorm',
  mongodb: 'mongoose',
  neo4j: 'neo4j',
};

/** Injection token holding the active DbDriver string. */
export const DB_DRIVER = Symbol('DB_DRIVER');

export function resolveDriver(value = process.env.DB_DRIVER): DbDriver {
  const driver = (value ?? 'memory').toLowerCase();
  if (!(DB_DRIVERS as readonly string[]).includes(driver)) {
    throw new Error(`Unknown DB_DRIVER "${value}". Use one of: ${DB_DRIVERS.join(', ')}`);
  }
  return driver as DbDriver;
}
