import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { LabTraceInterceptor } from '../../common/lab-trace/lab-trace.interceptor';
import { IndexesService, type QueryKind } from './indexes.service';

export class QueryDto {
  @IsIn(['equals', 'lower'])
  kind: QueryKind;

  @IsString()
  @Length(3, 120)
  email: string;
}

export class InsertDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  count: number;
}

/** Everything here changes the schema or bulk data: lab / dev only. */
function devOnly() {
  if (process.env.NODE_ENV === 'production') throw new ForbiddenException('Lab endpoints are disabled in production');
}

@Controller('indexes')
@UseInterceptors(LabTraceInterceptor)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class IndexesController {
  constructor(private readonly indexes: IndexesService) {}

  @Get('state')
  state() {
    return this.indexes.state();
  }

  /** Back to ~1M rows and no secondary index (seeds on first call, ~10 s). */
  @Post('dev/reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    devOnly();
    return this.indexes.reset();
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  query(@Body() dto: QueryDto) {
    devOnly();
    return this.indexes.query(dto.kind, dto.email);
  }

  @Post('index')
  @HttpCode(HttpStatus.OK)
  createIndex() {
    devOnly();
    return this.indexes.createIndex();
  }

  @Post('insert')
  @HttpCode(HttpStatus.OK)
  insert(@Body() dto: InsertDto) {
    devOnly();
    return this.indexes.insert(dto.count);
  }
}
