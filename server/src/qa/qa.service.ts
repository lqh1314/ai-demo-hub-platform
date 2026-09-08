import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { parsePage, pageResult } from '../common/pagination';
import { scoreCall, QaRuleInput } from './qa.scoring';

@Injectable()
export class QaService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }

  listRules() { return this.prisma.qaRule.findMany({ where: { tenantId: this.t(), enabled: true } }); }
  createRule(dto: any) {
    return this.prisma.qaRule.create({
      data: {
        tenantId: this.t(), name: dto.name, type: dto.type || 'KEYWORD', category: dto.category,
        pattern: Array.isArray(dto.pattern) ? dto.pattern : String(dto.pattern || '').split(/[,，;；\n]+/).filter(Boolean),
        weight: dto.weight ?? 5, mustHit: dto.mustHit ?? true, enabled: dto.enabled ?? true,
      },
    });
  }
  updateRule(id: string, dto: any) { return this.prisma.qaRule.update({ where: { id }, data: dto }); }

  /** 对一通通话执行规则质检，落库记录与命中明细 */
  async evaluate(callId: string) {
    const call = await this.prisma.callSession.findFirst({ where: { id: callId, tenantId: this.t() } });
    if (!call) return null;
    const [segments, rules] = await Promise.all([
      this.prisma.transcriptSegment.findMany({ where: { callId }, orderBy: { seq: 'asc' } }),
      this.prisma.qaRule.findMany({ where: { tenantId: this.t(), enabled: true } }),
    ]);
    const result = scoreCall(segments as any, rules as unknown as QaRuleInput[]);
    const existing = await this.prisma.qaRecord.findUnique({ where: { callId } });
    const record = existing
      ? await this.prisma.qaRecord.update({ where: { id: existing.id }, data: { score: result.score, status: 'AI' } })
      : await this.prisma.qaRecord.create({ data: { tenantId: this.t(), callId, type: 'AUTO', score: result.score, status: 'AI' } });
    await this.prisma.qaHit.deleteMany({ where: { qaRecordId: record.id } });
    if (result.hits.length) {
      await this.prisma.qaHit.createMany({
        data: result.hits.map((h) => ({ tenantId: this.t(), qaRecordId: record.id, ruleId: h.ruleId, matchedText: h.matchedText, deduct: h.deduct })),
      });
    }
    return { ...record, level: result.level, violations: result.violations, hits: result.hits };
  }

  async listRecords(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t() };
    if (q.status) where.status = q.status;
    const [list, total] = await Promise.all([
      this.prisma.qaRecord.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { call: { select: { id: true, agentId: true, fromNo: true, toNo: true, durationSec: true } } } }),
      this.prisma.qaRecord.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  review(id: string, dto: { score?: number; comment?: string }) {
    return this.prisma.qaRecord.update({ where: { id }, data: { score: dto.score, comment: dto.comment, status: 'REVIEWED', reviewerId: this.store.user.userId, reviewedAt: new Date() } });
  }
}
