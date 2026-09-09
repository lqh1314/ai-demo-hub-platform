import { CrmService } from './crm.service';

/**
 * 回归：新建线索必须保存前端提交的 phoneRaw（历史缺陷：后端只读 dto.phone，导致手机号丢失）；
 * 列表搜索需同时兼容 kw / keyword 两个参数名。
 */
describe('CrmService 线索字段映射（回归）', () => {
  const created: any = { id: 'l-1' };
  const leadMock: any = {
    create: jest.fn(async ({ data }: any) => ({ ...created, ...data })),
    update: jest.fn(async ({ data }: any) => ({ ...created, ...data })),
    findFirst: jest.fn(async () => ({ id: 'l-1', stage: 'NEW' })),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  };
  const prisma: any = { lead: leadMock, activity: { create: jest.fn(), findMany: jest.fn(async () => []) }, customer: {}, contact: {}, opportunity: {} };
  const store: any = { tenantId: 't-1', get user() { return { userId: 'u-1' }; } };
  let svc: CrmService;

  beforeEach(() => { jest.clearAllMocks(); svc = new CrmService(prisma, store); });

  it('createLead 使用 dto.phoneRaw 保存原始号码并归一化', async () => {
    const r = await svc.createLead({ name: '张总', phoneRaw: '13611112222', source: 'MANUAL' });
    const data = leadMock.create.mock.calls[0][0].data;
    expect(data.phoneRaw).toBe('13611112222');
    expect(data.phoneE164).toBe('+8613611112222');
    expect(r.phoneRaw).toBe('13611112222');
  });

  it('createLead 兼容旧字段名 dto.phone', async () => {
    await svc.createLead({ name: '李总', phone: '13700007777' });
    const data = leadMock.create.mock.calls[0][0].data;
    expect(data.phoneRaw).toBe('13700007777');
    expect(data.phoneE164).toBe('+8613700007777');
  });

  it('listLeads 的 keyword 与 kw 等价，都能生成 OR 模糊查询', async () => {
    await svc.listLeads({ keyword: '星河', page: 1, pageSize: 10 });
    const where1 = leadMock.findMany.mock.calls[0][0].where;
    expect(where1.OR?.some((c: any) => c.company?.contains === '星河')).toBe(true);
    await svc.listLeads({ kw: '星河', page: 1, pageSize: 10 });
    const where2 = leadMock.findMany.mock.calls[1][0].where;
    expect(where2.OR?.length).toBe(where1.OR.length);
  });

  it('removeLead 走软删（写 deletedAt）而非物理删除', async () => {
    await svc.removeLead('l-1');
    const data = leadMock.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
  });
});
