import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { BizException } from '../common/biz.exception';
import { parsePage, pageResult } from '../common/pagination';

@Injectable()
export class ContractService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }

  list(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t() };
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    return Promise.all([this.prisma.contract.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.contract.count({ where })]).then(([list, total]) => pageResult(list, total, page, pageSize));
  }
  create(dto: any) {
    if (!dto.customerId || !dto.opportunityId) throw BizException.badRequest('客户与商机为必填');
    return this.prisma.contract.create({
      data: {
        tenantId: this.t(), ownerId: this.store.user.userId, opportunityId: dto.opportunityId, customerId: dto.customerId,
        code: dto.code || `HT${Date.now()}`, name: dto.name, amount: dto.amount,
        signDate: dto.signDate, startDate: dto.startDate, endDate: dto.endDate, fileUrl: dto.fileUrl, status: 'DRAFT',
      },
    });
  }
  async detail(id: string) {
    const [contract, payments] = await Promise.all([
      this.prisma.contract.findFirst({ where: { id, tenantId: this.t() } }),
      this.prisma.payment.findMany({ where: { contractId: id }, orderBy: { plannedDate: 'asc' } }),
    ]);
    if (!contract) throw BizException.notFound('合同不存在');
    const received = payments.filter((p) => p.status === 'RECEIVED').reduce((s, p) => s + Number(p.amount), 0);
    return { ...contract, receivedAmount: received, payments };
  }
  sign(id: string, dto: any) {
    return this.prisma.contract.update({ where: { id }, data: { status: 'SIGNED', signDate: dto?.signDate || new Date() } });
  }
  update(id: string, dto: any) { return this.prisma.contract.update({ where: { id }, data: dto }); }

  /** 登记一笔回款计划/实收到账 */
  addPayment(contractId: string, dto: any) {
    const paid = !!dto.actualDate || dto.status === 'RECEIVED';
    return this.prisma.payment.create({
      data: {
        tenantId: this.t(), contractId, amount: dto.amount, plannedDate: dto.plannedDate,
        actualDate: dto.actualDate, method: dto.method, remark: dto.remark,
        status: paid ? 'RECEIVED' : dto.status || 'PLANNED',
      },
    }).then((p) => this.recalc(contractId).then(() => p));
  }
  async markPaid(id: string, dto: any) {
    const pay = await this.prisma.payment.update({ where: { id }, data: { status: 'RECEIVED', actualDate: dto?.actualDate || new Date(), method: dto?.method } });
    await this.recalc(pay.contractId);
    return pay;
  }
  private async recalc(contractId: string) {
    const pays = await this.prisma.payment.findMany({ where: { contractId } });
    const received = pays.filter((p) => p.status === 'RECEIVED').reduce((s, p) => s + Number(p.amount), 0);
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    const total = Number(contract?.amount) || 0;
    const status = received <= 0 ? 'SIGNED' : total > 0 && received >= total ? 'COMPLETED' : 'IN_PROGRESS';
    return this.prisma.contract.update({ where: { id: contractId }, data: { status: status as any } });
  }
}
