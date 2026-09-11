import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { BizException } from '../common/biz.exception';
import { parsePage, pageResult } from '../common/pagination';

@Injectable()
export class BotService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }

  async getConfig() {
    const t = this.t();
    let cfg = await this.prisma.botConfig.findUnique({ where: { tenantId: t } });
    if (!cfg) {
      cfg = await this.prisma.botConfig.create({ data: { tenantId: t, transferKeywords: ['人工', '转人工', '真人'] } });
    }
    return cfg;
  }
  async updateConfig(dto: any) {
    await this.getConfig();
    return this.prisma.botConfig.update({ where: { tenantId: this.t() }, data: dto });
  }

  async listIntents(q: any = {}) {
    const where: any = { tenantId: this.t() };
    if (q.enabled !== undefined) where.enabled = q.enabled === '1' || q.enabled === true;
    return this.prisma.intent.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
  }
  async createIntent(dto: any) {
    return this.prisma.intent.create({ data: { tenantId: this.t(), name: dto.name, code: dto.code || `intent_${Date.now()}`, examples: dto.examples || [], keywords: dto.keywords || [], slots: dto.slots, action: (dto.action as any) || 'ANSWER', answer: dto.answer, targetGroupId: dto.targetGroupId, priority: dto.priority ?? 100, enabled: dto.enabled ?? true } });
  }
  async updateIntent(id: string, dto: any) {
    await this.ensureIntent(id);
    // 仅白名单字段落库，避免整行回填时混入 id/tenantId/createdAt 等非更新字段导致 Prisma 报错
    const allow = ['name', 'code', 'examples', 'keywords', 'slots', 'action', 'answer', 'targetGroupId', 'nextIntent', 'enabled', 'priority'];
    const data: any = {};
    for (const k of allow) if (dto[k] !== undefined) data[k] = k === 'action' ? (dto.action as any) : dto[k];
    return this.prisma.intent.update({ where: { id }, data });
  }
  async deleteIntent(id: string) { await this.ensureIntent(id); await this.prisma.intent.delete({ where: { id } }); return { ok: true }; }
  private async ensureIntent(id: string) {
    const x = await this.prisma.intent.findFirst({ where: { id, tenantId: this.t() } });
    if (!x) throw BizException.notFound('意图不存在');
  }

  async listKb(q: any = {}) {
    const { skip, take, page, pageSize } = parsePage({ pageSize: 50, ...q });
    const where: any = { tenantId: this.t() };
    if (q.status) where.status = q.status;
    if (q.kw) where.question = { contains: q.kw };
    const [list, total] = await Promise.all([
      this.prisma.knowledgeItem.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.knowledgeItem.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async createKb(dto: any) {
    const t = this.t();
    let kbId = dto.kbId;
    if (!kbId) {
      const kb = await this.prisma.knowledgeBase.findFirst({ where: { tenantId: t } });
      kbId = kb?.id || (await this.prisma.knowledgeBase.create({ data: { tenantId: t, name: '默认知识库' } })).id;
    }
    return this.prisma.knowledgeItem.create({ data: { tenantId: t, kbId, question: dto.question, answer: dto.answer, keywords: dto.keywords || [dto.question], tags: dto.tags || [], status: (dto.status as any) || 'PUBLISHED', publishedAt: new Date() } });
  }
  async updateKb(id: string, dto: any) {
    return this.prisma.knowledgeItem.update({ where: { id }, data: { ...dto, status: dto.status as any, version: { increment: 1 } } });
  }
  async publishKb(id: string) {
    return this.prisma.knowledgeItem.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date(), version: { increment: 1 } } });
  }
  async deleteKb(id: string) { await this.prisma.knowledgeItem.delete({ where: { id } }); return { ok: true }; }
  /** 供对话编排调用：取已发布知识条目 */
  async publishedKnowledge(limit = 30) {
    return this.prisma.knowledgeItem.findMany({ where: { tenantId: this.t(), status: 'PUBLISHED' }, take: limit });
  }
  async listKnowledgeBases() { return this.prisma.knowledgeBase.findMany({ where: { tenantId: this.t() } }); }
}
