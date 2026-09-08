import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma 访问层；软删过滤、连接生命周期统一在此 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');
  constructor() {
    super({
      log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }],
    });
  }
  async onModuleInit() {
    if (process.env.DATABASE_URL) {
      try {
        await this.$connect();
        this.logger.log('数据库已连接');
      } catch (e) {
        this.logger.warn(`数据库连接失败，以无 DB 模式启动（仅可做不依赖库的自检）：${(e as Error).message}`);
      }
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
