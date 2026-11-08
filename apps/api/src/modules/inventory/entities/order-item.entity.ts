import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from './product.entity';

/** A line in an order. unit_price is copied at purchase time (price history). */
@Entity('order_items')
@Index('uq_order_items_order_product', ['orderId', 'productId'], { unique: true })
@Check('chk_order_items_quantity_positive', 'quantity > 0')
export class OrderItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: 'fk_order_items_order' })
  order: Relation<OrderEntity>;

  @Index('idx_order_items_product')
  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'fk_order_items_product' })
  product: Relation<ProductEntity>;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: string;
}
