import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { UserEntity } from './user.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

/** One checkout by one user. Lines live in order_items. */
@Entity('orders')
// Same client retry (same key) can never create a second order.
@Index('uq_orders_user_idempotency', ['userId', 'idempotencyKey'], { unique: true })
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_orders_user')
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_orders_user' })
  user: Relation<UserEntity>;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: string;

  /** Client-generated (e.g. UUID) so a double-click / retry is a no-op. */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: Relation<OrderItemEntity[]>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
