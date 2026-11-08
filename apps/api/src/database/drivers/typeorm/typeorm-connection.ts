import { DynamicModule } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DbDriver } from '../../database.types';

/** TypeORM options for the SQL drivers. URLs come from apps/api/.env. */
export function typeOrmOptions(driver: DbDriver): TypeOrmModuleOptions {
  const common = {
    // Entities registered via TypeOrmModule.forFeature([...]) in labs are picked up automatically.
    autoLoadEntities: true,
    // Dev convenience (same as the course): create/alter tables from entities.
    // Set DB_SYNC=false once a lab moves to migrations.
    synchronize: process.env.DB_SYNC !== 'false',
    logging: process.env.DB_LOGGING === 'true',
    retryAttempts: 3,
    retryDelay: 1000,
  };

  switch (driver) {
    case 'postgres':
      return { type: 'postgres', url: requireEnv('POSTGRES_URL'), ...common };
    case 'mysql':
      // The server runs in UTC (docker/mysql/my.cnf). mysql2 defaults to the Node
      // process's local zone, which shifts every DATETIME by the host offset.
      return { type: 'mysql', url: requireEnv('MYSQL_URL'), timezone: 'Z', ...common };
    default:
      throw new Error(`TypeORM is not configured for DB_DRIVER="${driver}"`);
  }
}

export function typeOrmConnection(driver: DbDriver): DynamicModule {
  return TypeOrmModule.forRootAsync({ useFactory: () => typeOrmOptions(driver) });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see apps/api/.env.example)`);
  return value;
}
