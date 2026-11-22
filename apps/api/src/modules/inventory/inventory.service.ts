import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderEntity, OrderItemEntity, OrderStatus, ProductEntity, UserEntity } from './entities';
import { labTrace } from '../../common/lab-trace/lab-trace';
import { multiply } from './money';
import { SEED_PRODUCTS, SEED_USERS } from './seed-data';

export interface CreateOrderResult {
  order: OrderEntity;
  /** false when an earlier order with the same idempotency key was returned. */
  created: boolean;
}

@Injectable()
export class InventoryService {
  constructor(private readonly dataSource: DataSource) {}

  listProducts() {
    return this.dataSource.getRepository(ProductEntity).find({ order: { id: 'ASC' } });
  }

  /**
   * Dev only: back to the original scenario (orders cleared, sneaker stock = 1).
   * Same effect as `npm run db:seed:inventory`, callable from the UI / Postman.
   */
  async resetDemoData() {
    await this.dataSource.transaction(async (em) => {
      await em.createQueryBuilder().delete().from(OrderItemEntity).execute();
      await em.createQueryBuilder().delete().from(OrderEntity).execute();
      // Raw SQL (same as sql/seed.sql): TypeORM's upsert() on MySQL throws
      // "entity id is not set" when the row already exists.
      for (const u of SEED_USERS) {
        await em.query(
          `INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?) AS new
           ON DUPLICATE KEY UPDATE password_hash = new.password_hash, display_name = new.display_name`,
          [u.email, u.passwordHash, u.displayName],
        );
      }
      for (const p of SEED_PRODUCTS) {
        await em.query(
          `INSERT INTO products (sku, name, price, stock, version) VALUES (?, ?, ?, ?, 1) AS new
           ON DUPLICATE KEY UPDATE name = new.name, price = new.price, stock = new.stock, version = 1`,
          [p.sku, p.name, p.price, p.stock],
        );
      }
    });
    return this.listProducts();
  }

  listOrders(userId: number) {
    return this.dataSource.getRepository(OrderEntity).find({
      where: { userId },
      relations: { items: true },
      order: { id: 'DESC' },
    });
  }

  /**
   * Step 1: one user, one order. Everything happens in ONE transaction, so the
   * stock decrement, the order and its item are committed together or not at all.
   *
   * ⚠️ Deliberately NOT concurrency-safe yet: it reads stock, checks it in JS,
   * then writes the new value (read → check → write). Two simultaneous buyers can
   * both read stock=1 and both succeed. That race is the next step of the lab.
   */
  async createOrder(userId: number, dto: CreateOrderDto): Promise<CreateOrderResult> {
    // labTrace.span/note only record what happens (for the web visualizer); they don't change behaviour.
    return labTrace.span(
      'db.transaction',
      () =>
        this.dataSource.transaction(async (em) => {
          const user = await labTrace.span('db.user.find', () => em.findOneBy(UserEntity, { id: userId }), (u) => ({
            found: !!u,
          }));
          if (!user) throw new NotFoundException(`User ${userId} not found`);

          // lab:snippet inventory/idempotency-lookup
          if (dto.idempotencyKey) {
            const existing = await labTrace.span(
              'db.idempotency.lookup',
              () =>
                em.findOne(OrderEntity, {
                  where: { userId, idempotencyKey: dto.idempotencyKey },
                  relations: { items: true },
                }),
              (o) => ({ hit: !!o, orderId: o?.id ?? null }),
            );
            if (existing) return { order: existing, created: false };
          } else {
            labTrace.note('idempotency.skipped');
          }
          // lab:end

          // read
          const product = await labTrace.span(
            'db.product.read',
            () => em.findOneBy(ProductEntity, { id: dto.productId }),
            (p) => ({ productId: dto.productId, stock: p?.stock ?? null, version: p?.version ?? null }),
          );
          if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);

          // lab:snippet inventory/stock-check
          // check (in application memory — the value may already be stale)
          const enough = product.stock >= dto.quantity;
          labTrace.note('app.stock.check', { stock: product.stock, requested: dto.quantity, ok: enough });
          if (!enough) {
            throw new ConflictException({
              message: 'Insufficient stock',
              productId: product.id,
              requested: dto.quantity,
              available: product.stock,
            });
          }
          // lab:end

          // write: UPDATE products SET stock = <value computed in JS>
          product.stock -= dto.quantity;
          await labTrace.span('db.product.update', () => em.save(product), (p) => ({ stock: p.stock }));

          // lab:snippet inventory/order-insert
          const order = await labTrace.span(
            'db.order.insert',
            () =>
              em.save(
                em.create(OrderEntity, {
                  userId,
                  status: OrderStatus.CONFIRMED,
                  totalAmount: multiply(product.price, dto.quantity),
                  idempotencyKey: dto.idempotencyKey ?? null,
                }),
              ),
            (o) => ({ orderId: o.id }),
          );
          // lab:end
          const item = await labTrace.span('db.orderItem.insert', () =>
            em.save(
              em.create(OrderItemEntity, {
                orderId: order.id,
                productId: product.id,
                quantity: dto.quantity,
                unitPrice: product.price, // price snapshot at purchase time
              }),
            ),
          );

          order.items = [item];
          return { order, created: true };
        }),
      (r) => ({ committed: true, created: r.created }),
    );
  }
}
