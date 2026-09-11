import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { BizException } from '../common/biz.exception';
import { parsePage, pageResult } from '../common/pagination';
import { normalizePhone } from '../common/phone.util';
import { predictiveDialCount } from '../crm/assignment.strategy';
import { PresenceService } from '../telephony/presence.service';
import { CallService } from '../telephony/call.service';

@Injectable()
export class CampaignService {
  constructor(private prisma: PrismaService, private store: TenantStore, private presence: PresenceService, private calls: CallService) {}
  private t() { return this.store.tenantId; }
  private me() { return this.store.user; }

  async list(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t() };
    if (q.status) where.status = q.status;
    const [list, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.campaign.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async create(dto: any) {
    if (!dto?.name) throw BizException.badRequest('外呼活动名称为必填');
    if (dto.strategy && !['MANUAL', 'PREVIEW', 'PREDICTIVE'].includes(dto.strategy)) throw BizException.badRequest('拨号策略取值非法（MANUAL/PREVIEW/PREDICTIVE）');
    return this.prisma.campaign.create({
      data: { tenantId: this.t(), ownerId: this.me().userId, name: dto.name, strategy: (dto.strategy as any) || 'MANUAL', lineId: dto.lineId, groupId: dto.groupId, callerNumber: dto.callerNumber, dailyLimit: dto.dailyLimit ?? 200, concurrency: dto.concurrency ?? 10, predictiveRatio: dto.ratio ?? 1.2, rule: dto.rule },
    });
  }
  async update(id: string, dto: any) { return this.prisma.campaign.update({ where: { id }, data: dto }); }
  async setStatus(id: string, status: string) { return this.prisma.campaign.update({ where: { id }, data: { status: status as any, startAt: status === 'RUNNING' ? new Date() : undefined } }); }

  /** 导入名单（原始号码数组或从客户生成） */
  async importTargets(id: string, rows: Array<{ phone?: string; phoneE164?: string; phoneRaw?: string; customerId?: string; contactId?: string; name?: string; custom?: { name?: string } }>) {
    // 兼容前端 {phoneE164,custom:{name}} 与接口 {phone,name} 两种入参，过滤空号
    const valid = rows.filter((r) => (r.phoneE164 ?? r.phone ?? r.phoneRaw));
    if (!valid.length) throw BizException.badRequest('导入名单为空或号码缺失');
    const data = valid.map((r) => {
      const raw = r.phoneE164 ?? r.phone ?? r.phoneRaw;
      const name = r.name ?? r.custom?.name;
      return { tenantId: this.t(), campaignId: id, phoneE164: normalizePhone(raw as string) || (raw as string), customerId: r.customerId, contactId: r.contactId, custom: name ? { name } : undefined };
    });
    const res = await this.prisma.campaignTarget.createMany({ data, skipDuplicates: true });
    await this.refreshStats(id);
    return { imported: res.count };
  }
  async targets(id: string, q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { campaignId: id };
    if (q.state) where.state = q.state;
    const [list, total] = await Promise.all([this.prisma.campaignTarget.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.campaignTarget.count({ where })]);
    return pageResult(list, total, page, pageSize);
  }
  private async refreshStats(id: string) {
    const g = await this.prisma.campaignTarget.groupBy({ by: ['state'], where: { campaignId: id }, _count: { _all: true } });
    const stats: Record<string, number> = {};
    g.forEach((x) => (stats[x.state] = x._count._all));
    await this.prisma.campaign.update({ where: { id }, data: { stats } });
    return stats;
  }
  async stats(id: string) { return this.refreshStats(id); }

  /**
   * 执行一轮外呼：预测式按空闲坐席×系数计算拨号量；手动/预览每次 1。
   * 返回本轮创建的通话。
   */
  async runBatch(id: string, agentId?: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId: this.t() } });
    if (!campaign) throw BizException.notFound('外呼任务不存在');
    let limit = 1;
    if (campaign.strategy === 'PREDICTIVE' && campaign.groupId) {
      const cands = await this.presence.candidatesOfGroup(this.t(), campaign.groupId);
      const free = cands.filter((c) => c.status === 'IDLE' || c.status === 'ONLINE').length;
      const inProgress = await this.prisma.campaignTarget.count({ where: { campaignId: id, state: 'DIALING' } });
      limit = predictiveDialCount(free, Number(campaign.predictiveRatio || 1.2), inProgress);
    }
    limit = Math.min(limit, campaign.concurrency, campaign.dailyLimit);
    const batch = await this.prisma.campaignTarget.findMany({ where: { campaignId: id, state: { in: ['PENDING', 'QUEUE'] } }, take: limit, orderBy: { nextDialAt: 'asc' } });
    const created: any[] = [];
    for (const t of batch) {
      await this.prisma.campaignTarget.update({ where: { id: t.id }, data: { state: 'DIALING', attempts: { increment: 1 } } });
      const call = await this.calls.agentDial(this.t(), agentId || campaign.ownerId || this.me().userId, { to: t.phoneE164, customerId: t.customerId ?? undefined, contactId: t.contactId ?? undefined, campaignTargetId: t.id });
      await this.prisma.campaignTarget.update({ where: { id: t.id }, data: { state: 'CONNECTED', lastCallId: call.id } });
      created.push(call);
    }
    await this.refreshStats(id);
    return { dialed: created.length, calls: created };
  }
}
