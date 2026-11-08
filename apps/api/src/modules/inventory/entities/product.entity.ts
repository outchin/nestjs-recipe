import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * A sellable item and its stock. `stock` is the contended value in the
 * "two users, one item left" scenario.
 */
@Entity('products')
// NOTE: TypeORM's MySQL driver ignores @Check (works on postgres). On MySQL these
// constraints are added by sql/seed.sql — check `SHOW CREATE TABLE products`.
@Check('chk_products_stock_non_negative', 'stock >= 0') // last line of defence: DB refuses overselling
@Check('chk_products_price_non_negative', 'price >= 0')
export class ProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('uq_products_sku', { unique: true })
  @Column({ length: 64 })
  sku: string;

  @Column({ length: 200 })
  name: string;

  /** DECIMAL, never FLOAT, for money. mysql2 returns DECIMAL as a string. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Bumped on every TypeORM save(); used by the optimistic-locking variant. */
  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
