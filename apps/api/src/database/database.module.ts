import { DynamicModule, Module, Type } from '@nestjs/common';
import { MemoryConnectionModule } from './drivers/memory/memory-connection.module';
import { typeOrmConnection } from './drivers/typeorm/typeorm-connection';
import { DB_DRIVER, DbDriver, DRIVER_FAMILY, RepoFamily, resolveDriver } from './database.types';

type ModuleImport = Type | DynamicModule;

/** Connection per family. Each owns its client lifecycle (connect/close). */
const CONNECTIONS: Partial<Record<RepoFamily, (driver: DbDriver) => ModuleImport>> = {
  memory: () => MemoryConnectionModule,
  typeorm: (driver) => typeOrmConnection(driver), // postgres, mysql
  // mongoose: … — wired when the first Mongo lab needs it
  // neo4j:    … — wired when the first graph lab needs it
};

// Abstract classes can't be `new`-ed, so the token type is "any class shape".
type Token<T> = abstract new (...args: any[]) => T;

export interface FeatureOptions {
  /** Extra imports per family, e.g. { typeorm: [TypeOrmModule.forFeature([TaskEntity])] } */
  imports?: Partial<Record<RepoFamily, ModuleImport[]>>;
  /** Override for tests; defaults to DB_DRIVER. */
  driver?: DbDriver;
}

@Module({})
export class DatabaseModule {
  /**
   * Import once in AppModule. Opens the connection for the selected driver and
   * exposes DB_DRIVER globally.
   */
  static forRoot(driver = resolveDriver()): DynamicModule {
    const family = DRIVER_FAMILY[driver];
    const connection = CONNECTIONS[family];
    if (!connection) {
      throw new Error(`DB_DRIVER="${driver}" (${family}) is not wired yet. See docs/DATABASE.md.`);
    }
    return {
      global: true,
      module: DatabaseModule,
      imports: [connection(driver)],
      providers: [{ provide: DB_DRIVER, useValue: driver }],
      exports: [DB_DRIVER],
    };
  }

  /**
   * Import in a lab module. Binds the lab's abstract repository to the
   * implementation for the active family. Services inject the abstract class
   * and never know which database is behind it.
   *
   *   DatabaseModule.forFeature(
   *     TasksRepository,
   *     { memory: MemoryTasksRepository, typeorm: TypeOrmTasksRepository },
   *     { imports: { typeorm: [TypeOrmModule.forFeature([TaskEntity])] } },
   *   )
   */
  static forFeature<T>(
    token: Token<T>,
    impls: Partial<Record<RepoFamily, Type<T>>>,
    options: FeatureOptions = {},
  ): DynamicModule {
    const driver = options.driver ?? resolveDriver();
    const family = DRIVER_FAMILY[driver];
    const impl = impls[family];
    if (!impl) {
      const have = Object.keys(impls).join(', ') || 'none';
      throw new Error(
        `${token.name} has no "${family}" implementation (DB_DRIVER=${driver}). Available: ${have}.`,
      );
    }
    return {
      module: DatabaseModule,
      imports: options.imports?.[family] ?? [],
      providers: [{ provide: token, useClass: impl }],
      exports: [token],
    };
  }
}
