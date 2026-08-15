import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.GENERATE_OPENAPI === 'true') return;
    await this.$connect();
  }

  async onModuleDestroy() {
    if (process.env.GENERATE_OPENAPI === 'true') return;
    await this.$disconnect();
  }
}
