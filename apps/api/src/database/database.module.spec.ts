import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { DB_DRIVER, resolveDriver } from './database.types';
import { typeOrmOptions } from './drivers/typeorm/typeorm-connection';

abstract class ThingRepository {
  abstract name(): string;
}
class MemoryThingRepository implements ThingRepository {
  name() {
    return 'memory';
  }
}
class TypeOrmThingRepository implements ThingRepository {
  name() {
    return 'typeorm';
  }
}
const impls = { memory: MemoryThingRepository, typeorm: TypeOrmThingRepository };

describe('resolveDriver', () => {
  it('defaults to memory', () => {
    // resolveDriver(undefined) falls back to process.env.DB_DRIVER (from .env), so clear it.
    const saved = process.env.DB_DRIVER;
    delete process.env.DB_DRIVER;
    try {
      expect(resolveDriver()).toBe('memory');
    } finally {
      if (saved !== undefined) process.env.DB_DRIVER = saved;
    }
  });
  it('is case-insensitive', () => expect(resolveDriver('Postgres')).toBe('postgres'));
  it('rejects unknown drivers', () => expect(() => resolveDriver('oracle')).toThrow(/Unknown DB_DRIVER/));
});

describe('DatabaseModule', () => {
  it('forRoot exposes the active driver', async () => {
    const ref = await Test.createTestingModule({ imports: [DatabaseModule.forRoot('memory')] }).compile();
    expect(ref.get(DB_DRIVER)).toBe('memory');
  });

  it('forRoot fails clearly for a driver that is not wired yet', () => {
    expect(() => DatabaseModule.forRoot('neo4j')).toThrow(/not wired yet/);
  });

  it.each([
    ['memory', 'memory'],
    ['postgres', 'typeorm'],
    ['mysql', 'typeorm'],
  ] as const)('forFeature with %s binds the %s repository', async (driver, expected) => {
    const ref = await Test.createTestingModule({
      imports: [DatabaseModule.forFeature(ThingRepository, impls, { driver })],
    }).compile();
    expect(ref.get(ThingRepository).name()).toBe(expected);
  });

  it('forFeature only adds the imports of the active family', () => {
    @Module({})
    class OnlyForTypeOrm {}
    const opts = { imports: { typeorm: [OnlyForTypeOrm] } };
    expect(DatabaseModule.forFeature(ThingRepository, impls, { ...opts, driver: 'memory' }).imports).toEqual([]);
    expect(DatabaseModule.forFeature(ThingRepository, impls, { ...opts, driver: 'postgres' }).imports).toEqual([
      OnlyForTypeOrm,
    ]);
  });

  it('forFeature fails clearly when the lab lacks an implementation', () => {
    expect(() => DatabaseModule.forFeature(ThingRepository, impls, { driver: 'mongodb' })).toThrow(
      /ThingRepository has no "mongoose" implementation/,
    );
  });
});

describe('typeOrmOptions', () => {
  it('maps postgres and mysql to their TypeORM type and URL', () => {
    process.env.POSTGRES_URL = 'postgresql://u:p@h:5432/d';
    process.env.MYSQL_URL = 'mysql://u:p@h:3306/d';
    expect(typeOrmOptions('postgres')).toMatchObject({ type: 'postgres', url: process.env.POSTGRES_URL });
    expect(typeOrmOptions('mysql')).toMatchObject({ type: 'mysql', url: process.env.MYSQL_URL });
  });
});
