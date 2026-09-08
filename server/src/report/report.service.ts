import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { RedisService } from '../common/redis.service';

/** 计算接通率等比率（纯函数，便于单测） */
export function rate(part: number, total: number) { return total <= 0 ? 0 : Math.round((part / total) * 1000) / 10; }

@Injectable()
export class ReportService {
  private readonly logger = new Logger('Report');
  constructor(private prisma: PrismaService, private store: TenantStore, private redis: RedisService) {}
  private t() { return this.store.tenantId; }

  /**
   * 报表时间桶缓存（闸门 C Medium 修复）：聚合结果按 租户+参数 缓存短 TTL，
   * 存在 REDIS_URL 时多实例共享，缺省时走进程内内存（同样兑现 TTL）。
   * 缓存读写失败不影响取数，降级为实时聚合。
   */
  private async cached<T>(suffix: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const key = `report:${this.t()}:${suffix}`;
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch (e) { this.logger.warn(`报表缓存读取失败，降级实时聚合：${(e as Error).message}`); }
    const data = await fn();
    try { await this.redis.set(key, JSON.stringify(data), ttlSec); } catch { /* 缓存写失败忽略 */ }
    return data;
  }
  private range(q: any) {
    const where: any = { tenantId: this.t() };
    if (q?.start || q?.end) {
      where.createdAt = {};
      if (q.start) where.createdAt.gte = new Date(q.start);
      if (q.end) where.createdAt.lte = new Date(q.end);
    }
    return where;
  }

  /** 经营概览 KPI（120s 时间桶缓存） */
  overview() {
    return this.cached('overview', 120, () => this.overviewRaw());
  }
  private async overviewRaw() {
    const t = this.t();
    const [leads, customers, opps, wonAgg, calls, connected, online] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId: t } }),
      this.prisma.customer.count({ where: { tenantId: t } }),
      this.prisma.opportunity.count({ where: { tenantId: t } }),
      this.prisma.opportunity.aggregate({ where: { tenantId: t, stage: 'WON' }, _sum: { amount: true } }),
      this.prisma.callSession.count({ where: { tenantId: t } }),
      this.prisma.callSession.count({ where: { tenantId: t, status: 'ENDED', talkSec: { gt: 0 } } }),
      this.prisma.agentStatusLog.count({ where: { tenantId: t, toStatus: { in: ['IDLE', 'ON_CALL', 'ONLINE'] } } }),
    ]);
    return { leads, customers, opps, wonAmount: wonAgg._sum.amount || 0, calls, connectRate: rate(connected, calls), online };
  }

  /** 线索 + 商机双漏斗（120s 时间桶缓存） */
  funnel() {
    return this.cached('funnel', 120, () => this.funnelRaw());
  }
  private async funnelRaw() {
    const t = this.t();
    const leadGroups = await this.prisma.lead.groupBy({ by: ['stage'], where: { tenantId: t }, _count: { _all: true } });
    const oppGroups = await this.prisma.opportunity.groupBy({ by: ['stage'], where: { tenantId: t }, _count: { _all: true }, _sum: { amount: true } });
    return {
      leadFunnel: leadGroups.map((g) => ({ stage: g.stage, count: g._count._all })),
      oppFunnel: oppGroups.map((g) => ({ stage: g.stage, count: g._count._all, amount: g._sum.amount || 0 })),
    };
  }

  /** 通话分析：总量/接通/时长，按方向与结果分布（60s 时间桶缓存，按时间范围分桶） */
  callReport(q: any) {
    const r = `${q?.start ?? ''}_${q?.end ?? ''}`;
    return this.cached(`calls:${r}`, 60, () => this.callReportRaw(q));
  }
  private async callReportRaw(q: any) {
    const where = this.range(q);
    const [total, connected, agg, byDirection, byDisposition] = await Promise.all([
      this.prisma.callSession.count({ where }),
      this.prisma.callSession.count({ where: { ...where, talkSec: { gt: 0 } } }),
      this.prisma.callSession.aggregate({ where, _avg: { talkSec: true }, _sum: { talkSec: true } }),
      this.prisma.callSession.groupBy({ by: ['direction'], where, _count: { _all: true } }),
      this.prisma.callSession.groupBy({ by: ['disposition'], where, _count: { _all: true } }),
    ]);
    return {
      total, connected, connectRate: rate(connected, total),
      avgTalkSec: Math.round(agg._avg.talkSec || 0), totalTalkSec: agg._sum.talkSec || 0,
      byDirection: byDirection.map((g) => ({ k: g.direction, v: g._count._all })),
      byDisposition: byDisposition.map((g) => ({ k: g.disposition || '未标记', v: g._count._all })),
    };
  }

  /** 坐席产能排行（60s 时间桶缓存，按时间范围分桶） */
  agentReport(q: any) {
    const r = `${q?.start ?? ''}_${q?.end ?? ''}`;
    return this.cached(`agents:${r}`, 60, () => this.agentReportRaw(q));
  }
  private async agentReportRaw(q: any) {
    const where = this.range(q);
    const rows = await this.prisma.callSession.groupBy({ by: ['agentId'], where: { ...where, agentId: { not: null } }, _count: { _all: true }, _sum: { talkSec: true } });
    const ids = rows.map((r) => r.agentId!).filter(Boolean);
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, realName: true, username: true } });
    const nameOf = new Map(users.map((u) => [u.id, u.realName || u.username]));
    return rows
      .map((r) => ({ agentId: r.agentId, agentName: nameOf.get(r.agentId!) || '-', calls: r._count._all, talkSec: r._sum.talkSec || 0 }))
      .sort((a, b) => b.calls - a.calls);
  }
}
