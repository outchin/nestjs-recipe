import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A shopper who can log in and place orders. */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('uq_users_email', { unique: true })
  @Column({ length: 255 })
  email: string;

  /** Never the raw password. Format: scrypt$<salt hex>$<hash hex> (see sql/seed.sql). */
  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
