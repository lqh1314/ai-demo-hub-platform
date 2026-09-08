import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { REDIS_KEY } from '../common/constants';
import { AgentCandidate, AgentStatusCn } from '../crm/assignment.strategy';

/** 坐席实时态：状态与通话负载主存 Redis（无 Redis 时内存兜底），状态变迁落库 */
@Injectable()
export class PresenceService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  private statusKey(t: string, id: string) { return REDIS_KEY.agentStatus(t, id); }
  private loadKey(t: string) { return REDIS_KEY.agentLoad(t); }

  async setStatus(tenantId: string, userId: string, status: AgentStatusCn, callId?: string) {
    const prev = await this.redis.get(this.statusKey(tenantId, userId));
    await this.redis.set(this.statusKey(tenantId, userId), status);
    await this.prisma.agentStatusLog.create({ data: { tenantId, userId, fromStatus: (prev as any) || 'OFFLINE', toStatus: status, callId } }).catch(() => null);
    if (status === 'OFFLINE') await this.redis.zRem(this.loadKey(tenantId), userId);
    return { userId, from: prev, to: status };
  }
  async getStatus(tenantId: string, userId: string): Promise<AgentStatusCn> {
    return ((await this.redis.get(this.statusKey(tenantId, userId))) as AgentStatusCn) || 'OFFLINE';
  }
  async incrLoad(tenantId: string, userId: string) { return this.redis.zIncrBy(this.loadKey(tenantId), 1, userId); }
  async decrLoad(tenantId: string, userId: string) {
    const v = await this.redis.zIncrBy(this.loadKey(tenantId), -1, userId);
    if (v <= 0) await this.redis.zRem(this.loadKey(tenantId), userId);
    return v;
  }

  /** 组装某技能组候选坐席（成员 + 实时状态 + 负载 + 技能等级） */
  async candidatesOfGroup(tenantId: string, groupId: string): Promise<AgentCandidate[]> {
    const members = await this.prisma.skillGroupMember.findMany({ where: { groupId } });
    return Promise.all(members.map(async (m) => {
      const status = await this.getStatus(tenantId, m.userId);
      const load = (await this.redis.zScore(this.loadKey(tenantId), m.userId)) ?? 0;
      return { userId: m.userId, status, load, skillLevel: m.skillLevel };
    }));
  }

  /** 全租户在线坐席快照（管理端监控） */
  async snapshot(tenantId: string) {
    const users = await this.prisma.user.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, realName: true, username: true, roleAlias: true, deptId: true } });
    return Promise.all(users.map(async (u) => {
      const status = await this.getStatus(tenantId, u.id);
      const load = (await this.redis.zScore(this.loadKey(tenantId), u.id)) ?? 0;
      return { ...u, status, load };
    }));
  }
}
