import { Module } from '@nestjs/common';
import { resolveDriver } from '../../database/database.types';
import { IndexesController } from './indexes.controller';
import { IndexesService } from './indexes.service';

/**
 * Lab 02 — indexes & EXPLAIN. MySQL-specific (EXPLAIN columns, Handler_read_* counters),
 * so it only exists on DB_DRIVER=mysql.
 */
const enabled = resolveDriver() === 'mysql';

@Module({
  controllers: enabled ? [IndexesController] : [],
  providers: enabled ? [IndexesService] : [],
})
export class IndexesModule {}
