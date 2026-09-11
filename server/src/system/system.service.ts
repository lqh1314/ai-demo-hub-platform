import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { parsePage, pageResult } from '../common/pagination';
import { BizException } from '../common/biz.exception';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }

  // ---------- 数据字典 ----------
  listDicts() { return this.prisma.dict.findMany({ where: { tenantId: this.t() }, include: { items: { orderBy: { sort: 'asc' } } } }); }
  async createDict(dto: any) {
    if (!dto?.code || !dto?.name) throw BizException.badRequest('字典编码与名称为必填');
    const exists = await this.prisma.dict.findFirst({ where: { tenantId: this.t(), code: dto.code } });
    if (exists) throw BizException.badRequest('字典编码已存在');
    return this.prisma.dict.create({ data: { tenantId: this.t(), code: dto.code, name: dto.name } });
  }
  addDictItem(dictId: string, dto: any) { return this.prisma.dictItem.create({ data: { dictId, label: dto.label, value: dto.value, sort: dto.sort ?? 0, enabled: dto.enabled ?? true } }); }

  // ---------- 站内通知 ----------
  listNotifications(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t(), userId: this.store.user.userId };
    return Promise.all([this.prisma.notification.findMany({ where, skip, take, orderBy: { at: 'desc' } }), this.prisma.notification.count({ where })]).then(([list, total]) => pageResult(list, total, page, pageSize));
  }
  async unreadCount() {
    return { count: await this.prisma.notification.count({ where: { tenantId: this.t(), userId: this.store.user.userId, isRead: false } }) };
  }
  read(id: string) { return this.prisma.notification.update({ where: { id }, data: { isRead: true } }); }
  push(dto: { userId: string; type: string; title: string; content?: string; relatedType?: string; relatedId?: string }) {
    return this.prisma.notification.create({ data: { tenantId: this.t(), userId: dto.userId, type: dto.type, title: dto.title, content: dto.content, relatedType: dto.relatedType, relatedId: dto.relatedId } });
  }

  // ---------- 审计日志 ----------
  listAudit(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t() };
    if (q.action) where.action = q.action;
    if (q.objectType) where.objectType = q.objectType;
    return Promise.all([this.prisma.auditLog.findMany({ where, skip, take, orderBy: { at: 'desc' } }), this.prisma.auditLog.count({ where })]).then(([list, total]) => pageResult(list, total, page, pageSize));
  }
}
