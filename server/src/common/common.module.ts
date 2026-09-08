import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { TenantStore } from './tenant.context';

@Global()
@Module({
  providers: [PrismaService, RedisService, TenantStore],
  exports: [PrismaService, RedisService, TenantStore],
})
export class CommonModule {}
