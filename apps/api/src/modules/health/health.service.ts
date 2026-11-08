import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { DB_DRIVER, DbDriver, DRIVER_FAMILY } from '../../database/database.types';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DB_DRIVER) private readonly dbDriver: DbDriver,
    private readonly moduleRef: ModuleRef,
  ) {}

  async check() {
    return {
      status: 'ok',
      dbDriver: this.dbDriver,
      db: await this.pingDb(),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** 'up' / 'down: <reason>' for real databases, 'n/a' for memory. */
  private async pingDb(): Promise<string> {
    if (DRIVER_FAMILY[this.dbDriver] !== 'typeorm') return 'n/a';
    try {
      const dataSource = this.moduleRef.get(DataSource, { strict: false });
      await dataSource.query('SELECT 1');
      return 'up';
    } catch (e) {
      return `down: ${(e as Error).message}`;
    }
  }
}
