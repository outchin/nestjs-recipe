import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DRIVER_FAMILY, resolveDriver } from '../../database/database.types';
import { OrderEntity, OrderItemEntity, ProductEntity, UserEntity } from './entities';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

export const INVENTORY_ENTITIES = [UserEntity, ProductEntity, OrderEntity, OrderItemEntity];

/**
 * Inventory store lab: two users race for the last item.
 * It's about SQL transactions and row locks, so it only exists on a TypeORM
 * driver (mysql first). On DB_DRIVER=memory the module is empty.
 */
const enabled = DRIVER_FAMILY[resolveDriver()] === 'typeorm';

@Module({
  imports: enabled ? [TypeOrmModule.forFeature(INVENTORY_ENTITIES)] : [],
  controllers: enabled ? [InventoryController] : [],
  providers: enabled ? [InventoryService] : [],
})
export class InventoryModule {}
