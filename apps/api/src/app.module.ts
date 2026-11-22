import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { IndexesModule } from './modules/indexes/indexes.module';
import { InventoryModule } from './modules/inventory/inventory.module';

/**
 * Root module. Each lab is a self-contained feature module under
 * src/modules/<lab>/ and is registered here — nothing else.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(), // driver from DB_DRIVER (default: memory)
    HealthModule,
    InventoryModule,
    IndexesModule,
    // labs go here
  ],
})
export class AppModule {}
