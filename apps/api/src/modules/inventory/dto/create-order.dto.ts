import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** POST /api/inventory/orders — one product per order for now. */
export class CreateOrderDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  /** Optional client-generated key (e.g. a UUID). Same key again → same order back, no new purchase. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  idempotencyKey?: string;
}
