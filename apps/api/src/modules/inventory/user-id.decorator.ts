import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Who is calling. Stand-in for real login: the caller sends `X-User-Id: 1`.
 * Replaced by an auth guard + JWT later — controllers keep using @UserId().
 */
export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext): number => {
  const raw = ctx.switchToHttp().getRequest<Request>().header('x-user-id');
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id < 1) {
    throw new UnauthorizedException('Missing or invalid X-User-Id header');
  }
  return id;
});
