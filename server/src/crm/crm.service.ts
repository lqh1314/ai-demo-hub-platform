import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { BizException } from '../common/biz.exception';
import { parsePage, pageResult } from '../common/pagination';
import { normalizePhone } from '../common/phone.util';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }
  private me() { return this.store.user; }

  // ---------------- 线索 ----------------
  async listLeads(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const kw = q.kw ?? q.keyword;
    const where: any = { tenantId: this.t(), deletedAt: null };
    if (q.stage) where.stage = q.stage;
    if (q.intentLevel) where.intentLevel = q.intentLevel;
    if (q.source) where.source = q.source;
    if (q.mine === '1') where.ownerId = this.me().userId;
    if (q.ownerId) where.ownerId = q.ownerId;
    if (kw) where.OR = [{ name: { contains: kw } }, { company: { contains: kw } }, { phoneRaw: { contains: kw } }, { phoneE164: { contains: kw } }];
    const [list, total] = await Promise.all([
      this.prisma.lead.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.lead.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async getLead(id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId: this.t() } });
    if (!lead) throw BizException.notFound('线索不存在');
    const activities = await this.prisma.activity.findMany({ where: { relatedType: 'LEAD', relatedId: id }, orderBy: { happenedAt: 'desc' }, take: 50 });
    return { ...lead, activities };
  }
  async createLead(dto: any) {
    const tenantId = this.t();
    const phone = dto.phoneRaw ?? dto.phone;
    return this.prisma.lead.create({
      data: {
        tenantId,
        name: dto.name, company: dto.company, email: dto.email,
        phoneRaw: phone, phoneE164: normalizePhone(phone),
        source: (dto.source as any) || 'MANUAL', intentLevel: (dto.intentLevel as any) || 'UNKNOWN',
        intentTags: dto.intentTags || [], ownerId: dto.ownerId || this.me().userId, groupId: dto.groupId,
        rawPayload: dto.raw || undefined, stage: 'NEW',
      },
    });
  }
  /** 编辑线索（仅允许业务字段，租户隔离） */
  async updateLead(id: string, dto: any) {
    await this.getLead(id);
    const phone = dto.phoneRaw ?? dto.phone;
    const data: any = {};
    for (const k of ['name', 'company', 'email', 'source', 'intentLevel', 'intentTags', 'ownerId', 'groupId', 'stage']) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (phone !== undefined) { data.phoneRaw = phone; data.phoneE164 = normalizePhone(phone); }
    return this.prisma.lead.update({ where: { id }, data });
  }
  /** 删除线索（软删，列表默认过滤 deletedAt） */
  async removeLead(id: string) {
    await this.getLead(id);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
  async assignLead(id: string, dto: { ownerId?: string; groupId?: string }) {
    await this.getLead(id);
    await this.prisma.lead.update({ where: { id }, data: { ownerId: dto.ownerId, groupId: dto.groupId } });
    return this.prisma.activity.create({ data: { tenantId: this.t(), creatorId: this.me().userId, type: 'SYSTEM', relatedType: 'LEAD', relatedId: id, content: `线索已分配给坐席 ${dto.ownerId || '—'}` } }).then(() => ({ ok: true }));
  }
  /** 线索转化：生成/关联 客户 + 主联系人 + 商机 */
  async convertLead(id: string, dto: { customerName?: string; oppName?: string; amount?: number } = {}) {
    const lead = await this.getLead(id);
    if (lead.stage === 'CONVERTED' && lead.customerId) return this.prisma.customer.findUnique({ where: { id: lead.customerId } });
    const customer = await this.prisma.customer.create({
      data: {
        tenantId: this.t(), ownerId: lead.ownerId || this.me().userId,
        name: dto.customerName || lead.company || lead.name || '未命名客户',
        source: lead.source, level: 'MIDDLE',
      },
    });
    const contact = lead.phoneE164 || lead.name ? await this.prisma.contact.create({
      data: { tenantId: this.t(), customerId: customer.id, name: lead.name || '主联系人', phoneRaw: lead.phoneRaw, phoneE164: lead.phoneE164, email: lead.email, isPrimary: true },
    }) : null;
    const opp = await this.prisma.opportunity.create({
      data: {
        tenantId: this.t(), customerId: customer.id, contactId: contact?.id, ownerId: lead.ownerId || this.me().userId,
        name: dto.oppName || `${customer.name}-合作商机`, stage: 'NEED_CONFIRM', amount: dto.amount, probability: 20,
        source: lead.source,
      },
    });
    await this.prisma.lead.update({ where: { id }, data: { stage: 'CONVERTED', customerId: customer.id, contactId: contact?.id, convertedAt: new Date() } });
    await this.prisma.activity.create({ data: { tenantId: this.t(), creatorId: this.me().userId, type: 'STAGE', relatedType: 'LEAD', relatedId: id, stageFrom: 'NEW', stageTo: 'CONVERTED', content: `线索转化为客户「${customer.name}」并创建商机` } });
    return { customer, contact, opp };
  }

  // ---------------- 客户 / 联系人 ----------------
  async listCustomers(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const kw = q.kw ?? q.keyword;
    const where: any = { tenantId: this.t(), deletedAt: null };
    if (q.mine === '1') where.ownerId = this.me().userId;
    if (q.level) where.level = q.level;
    if (kw) where.OR = [{ name: { contains: kw } }, { industry: { contains: kw } }];
    const [list, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { contacts: true, opportunities: true } } } }),
      this.prisma.customer.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async getCustomer(id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: this.t() } });
    if (!customer) throw BizException.notFound('客户不存在');
    const [contacts, opportunities, activities] = await Promise.all([
      this.prisma.contact.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { isPrimary: 'desc' } }),
      this.prisma.opportunity.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { updatedAt: 'desc' } }),
      this.timeline('CUSTOMER', id),
    ]);
    return { ...customer, contacts, opportunities, activities };
  }
  async createCustomer(dto: any) {
    if (!dto?.name) throw BizException.badRequest('客户名称为必填');
    if (dto.level && !['KA', 'BIG', 'MIDDLE', 'SMALL'].includes(dto.level)) throw BizException.badRequest('客户等级取值非法');
    return this.prisma.customer.create({
      data: {
        tenantId: this.t(), ownerId: dto.ownerId || this.me().userId, name: dto.name, industry: dto.industry,
        scale: dto.scale as any, level: dto.level as any, website: dto.website, area: dto.area, address: dto.address,
        source: (dto.source as any) || 'MANUAL',
      },
    });
  }
  async updateCustomer(id: string, dto: any) {
    await this.getCustomer(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
  async createContact(dto: any) {
    if (!dto?.customerId) throw BizException.badRequest('联系人必须归属某个客户（customerId 必填）');
    if (!dto?.name) throw BizException.badRequest('联系人姓名为必填');
    return this.prisma.contact.create({ data: { tenantId: this.t(), customerId: dto.customerId, name: dto.name, title: dto.title, phoneRaw: dto.phone, phoneE164: normalizePhone(dto.phone), email: dto.email, wechat: dto.wechat, decisionRole: dto.decisionRole as any, isPrimary: !!dto.isPrimary } });
  }
  async listContacts(q: any) {
    const where: any = { tenantId: this.t(), deletedAt: null };
    if (q.customerId) where.customerId = q.customerId;
    if (q.phone) where.phoneE164 = normalizePhone(q.phone);
    return this.prisma.contact.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
  }
  /** 来电弹屏：按号码聚合画像 */
  async screenPop(phone: string) {
    const e164 = normalizePhone(phone);
    const contact = await this.prisma.contact.findFirst({ where: { tenantId: this.t(), phoneE164: e164 }, include: { customer: true } });
    const lead = await this.prisma.lead.findFirst({ where: { tenantId: this.t(), phoneE164: e164 }, orderBy: { createdAt: 'desc' } });
    let customer = contact?.customer || null;
    if (!customer && lead?.customerId) customer = await this.prisma.customer.findUnique({ where: { id: lead.customerId } });
    const opportunities = customer ? await this.prisma.opportunity.findMany({ where: { customerId: customer.id, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } } }) : [];
    return { phone: e164, contact: contact || null, lead: lead || null, customer, openOpportunities: opportunities };
  }

  // ---------------- 商机 ----------------
  async listOpportunities(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const kw = q.kw ?? q.keyword;
    const where: any = { tenantId: this.t(), deletedAt: null };
    if (q.stage) where.stage = q.stage;
    if (q.mine === '1') where.ownerId = this.me().userId;
    if (q.customerId) where.customerId = q.customerId;
    if (kw) where.name = { contains: kw };
    const [list, total] = await Promise.all([
      this.prisma.opportunity.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' }, include: { customer: { select: { name: true } } } }),
      this.prisma.opportunity.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async createOpportunity(dto: any) {
    if (!dto?.customerId) throw BizException.badRequest('商机必须归属某个客户（customerId 必填）');
    if (!dto?.name) throw BizException.badRequest('商机名称为必填');
    return this.prisma.opportunity.create({ data: { tenantId: this.t(), customerId: dto.customerId, contactId: dto.contactId, ownerId: dto.ownerId || this.me().userId, name: dto.name, stage: (dto.stage as any) || 'NEED_CONFIRM', amount: dto.amount, probability: dto.probability ?? 20, expectedClose: dto.expectedClose, source: dto.source as any } });
  }
  async advanceStage(id: string, dto: { stage: string; reason?: string; amount?: number }) {
    const opp = await this.prisma.opportunity.findFirst({ where: { id, tenantId: this.t() } });
    if (!opp) throw BizException.notFound('商机不存在');
    const from = opp.stage;
    const probMap: Record<string, number> = { 需求确认: 20, 需求挖掘: 35, 方案: 55, 报价: 70, 谈判: 85, 赢单: 100, 输单: 0 };
    await this.prisma.opportunity.update({ where: { id }, data: { stage: dto.stage as any, probability: probMap[dto.stage] ?? opp.probability, stageChangedAt: new Date(), amount: dto.amount ?? opp.amount, winReason: dto.stage === 'WON' ? dto.reason : undefined, lostReason: dto.stage === 'LOST' ? dto.reason : undefined } });
    await this.prisma.activity.create({ data: { tenantId: this.t(), creatorId: this.me().userId, type: 'STAGE', relatedType: 'OPPORTUNITY', relatedId: id, stageFrom: from as string, stageTo: dto.stage, content: `商机阶段由「${from}」推进到「${dto.stage}」${dto.reason ? '：' + dto.reason : ''}` } });
    return { ok: true, from, to: dto.stage };
  }

  // ---------------- 动态 / 待办 ----------------
  async timeline(type: string, id: string) {
    return this.prisma.activity.findMany({ where: { relatedType: type, relatedId: id }, orderBy: { happenedAt: 'desc' }, take: 100 });
  }
  async appendActivity(dto: any) {
    if (!dto?.relatedType || !dto?.relatedId) throw BizException.badRequest('动态必须关联业务对象（relatedType、relatedId 必填）');
    return this.prisma.activity.create({ data: { tenantId: this.t(), creatorId: this.me().userId, type: (dto.type as any) || 'NOTE', relatedType: dto.relatedType, relatedId: dto.relatedId, content: dto.content, durationSec: dto.durationSec, direction: dto.direction, happenedAt: dto.happenedAt ? new Date(dto.happenedAt) : new Date() } });
  }
  async myTasks(status = 'TODO') {
    return this.prisma.todoTask.findMany({ where: { tenantId: this.t(), ownerId: this.me().userId, status: status as any }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 100 });
  }
  async createTask(dto: any) {
    return this.prisma.todoTask.create({ data: { tenantId: this.t(), ownerId: dto.ownerId || this.me().userId, creatorId: this.me().userId, relatedType: dto.relatedType, relatedId: dto.relatedId, title: dto.title, content: dto.content, priority: (dto.priority as any) || 'NORMAL', dueAt: dto.dueAt ? new Date(dto.dueAt) : null, remindAt: dto.remindAt ? new Date(dto.remindAt) : null } });
  }
  async completeTask(id: string, result?: string) {
    const task = await this.prisma.todoTask.findFirst({ where: { id, tenantId: this.t() } });
    if (!task) throw BizException.notFound('任务不存在');
    await this.prisma.todoTask.update({ where: { id }, data: { status: 'DONE', finishedAt: new Date(), result } });
    if (task.relatedType && task.relatedId) {
      await this.prisma.activity.create({ data: { tenantId: this.t(), creatorId: this.me().userId, type: 'SYSTEM', relatedType: task.relatedType, relatedId: task.relatedId, content: `完成待办：${task.title}${result ? '（' + result + '）' : ''}` } });
    }
    return { ok: true };
  }
}
