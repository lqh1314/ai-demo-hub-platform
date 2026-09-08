import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { ProviderRegistry } from '../providers/provider.registry';
import { parsePage, pageResult } from '../common/pagination';

/** 变量替换：{{姓名}} 等占位符 */
export function renderTemplate(tpl: string, vars: Record<string, any>) {
  return tpl.replace(/\{\{\s*([\w一-龥]+)\s*\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`) as string);
}
const CHANNEL_CODE: Record<string, 'SMS' | 'EMAIL' | 'WECHAT'> = { 短信: 'SMS', 邮件: 'EMAIL', 企微: 'WECHAT' };

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService, private store: TenantStore, private providers: ProviderRegistry) {}
  private t() { return this.store.tenantId; }

  listTemplates(q: any) {
    const where: any = { tenantId: this.t() };
    if (q.channel) where.channel = q.channel;
    return this.prisma.messageTemplate.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }
  createTemplate(dto: any) { return this.prisma.messageTemplate.create({ data: { tenantId: this.t(), name: dto.name, channel: dto.channel, title: dto.title, content: dto.content, variables: dto.variables || [] } }); }
  updateTemplate(id: string, dto: any) { return this.prisma.messageTemplate.update({ where: { id }, data: dto }); }

  listTasks(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    return Promise.all([this.prisma.messageTask.findMany({ where: { tenantId: this.t() }, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.messageTask.count({ where: { tenantId: this.t() } })]).then(([list, total]) => pageResult(list, total, page, pageSize));
  }

  /** 创建并立即发送营销任务（沙箱通道直接返回成功） */
  async dispatch(dto: { templateId: string; channel?: any; audience: { to: string; vars?: Record<string, any> }[]; scheduledAt?: Date }) {
    const tpl = await this.prisma.messageTemplate.findUnique({ where: { id: dto.templateId } });
    if (!tpl) return { sent: 0 };
    const channel = dto.channel || tpl.channel;
    const task = await this.prisma.messageTask.create({
      data: { tenantId: this.t(), templateId: tpl.id, channel, ownerId: this.store.user.userId, status: dto.scheduledAt ? '待发送' : '发送中', scheduledAt: dto.scheduledAt, targetRule: { audience: dto.audience.length } },
    });
    const sender = this.providers.getChannel();
    let success = 0;
    for (const a of dto.audience) {
      const content = renderTemplate(tpl.content, a.vars || {});
      try {
        const r = await sender.send({ channel: CHANNEL_CODE[channel] || 'SMS', to: a.to, content });
        await this.prisma.messageRecord.create({ data: { tenantId: this.t(), taskId: task.id, channel, toAddr: a.to, content, status: r.status === 'SENT' ? 'SENT' : 'FAILED', providerMsgId: r.providerMsgId, sendAt: new Date() } });
        if (r.status === 'SENT') success++;
      } catch {
        await this.prisma.messageRecord.create({ data: { tenantId: this.t(), taskId: task.id, channel, toAddr: a.to, content, status: 'FAILED' } });
      }
    }
    return this.prisma.messageTask.update({
      where: { id: task.id },
      data: { status: '已完成', stats: { total: dto.audience.length, success, fail: dto.audience.length - success } },
    });
  }

  listRecords(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t() };
    if (q.taskId) where.taskId = q.taskId;
    if (q.status) where.status = q.status;
    return Promise.all([this.prisma.messageRecord.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.messageRecord.count({ where })]).then(([list, total]) => pageResult(list, total, page, pageSize));
  }
}
