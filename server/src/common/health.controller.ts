import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth.guard';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

/**
 * 部署探针（08-deployment）：
 *  - GET /api/v1/health/live   进程存活（不依赖外部组件，恒 200）
 *  - GET /api/v1/health/ready  就绪（探测数据库；Redis 为可选项，仅上报模式不阻断）
 */
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  @Public()
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok', ts: Date.now() };
  }

  @Public()
  @Get('ready')
  @HttpCode(200)
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: '依赖未就绪：数据库不可达',
        details: { database: 'down', error: (e as Error).message },
      });
    }
    return { status: 'ok', database: 'up', cache: this.redis.mode, ts: Date.now() };
  }
}
