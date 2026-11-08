import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateOrderDto } from './dto/create-order.dto';
import { InventoryService } from './inventory.service';
import { UserId } from './user-id.decorator';

@Controller('inventory')
// Lab-scoped validation: rejects wrong types and unknown fields with 400.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('products')
  listProducts() {
    return this.inventory.listProducts();
  }

  @Get('orders')
  listOrders(@UserId() userId: number) {
    return this.inventory.listOrders(userId);
  }

  /** 201 = new order, 200 = same idempotency key replayed (no second purchase). */
  @Post('orders')
  async createOrder(
    @UserId() userId: number,
    @Body() dto: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { order, created } = await this.inventory.createOrder(userId, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  /** Dev only: reset to the original scenario. Disabled when NODE_ENV=production. */
  @Post('dev/reset')
  @HttpCode(HttpStatus.OK)
  resetDemoData() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException('Reset is disabled in production');
    return this.inventory.resetDemoData();
  }
}
