import { Module } from '@nestjs/common';

/**
 * In-memory "connection". Nothing to open — memory repositories keep their own
 * Map. Default driver so every lab runs with zero setup and tests stay fast.
 */
@Module({})
export class MemoryConnectionModule {}
