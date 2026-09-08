/**
 * 数据库种子：默认租户 + 组织/角色权限 + 技能组 + 坐席 + 机器人配置/意图/知识库
 * + 线路 + 沙箱供应商 + 数据字典 + 质检规则 + 演示线索/客户/商机。
 * 幂等：全部按固定主键 upsert，可重复执行。
 * 运行：npm run prisma:seed （需先 migrate / db push）
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_TENANT_ID, BCRYPT_COST } from '../src/common/constants';
import { CredentialCrypto } from '../src/common/crypto.util';

const prisma = new PrismaClient();

// 固定主键，保证可重复 upsert 与相互引用稳定
const ID = {
  dept: '10000000-0000-0000-0000-000000000001',
  groupSales: '20000000-0000-0000-0000-000000000001',
  groupService: '20000000-0000-0000-0000-000000000002',
  roleAdmin: '30000000-0000-0000-0000-000000000001',
  roleManager: '30000000-0000-0000-0000-000000000002',
  roleAgent: '30000000-0000-0000-0000-000000000003',
  userAdmin: '40000000-0000-0000-0000-000000000001',
  userManager: '40000000-0000-0000-0000-000000000002',
  userAgent1: '40000000-0000-0000-0000-000000000003',
  userAgent2: '40000000-0000-0000-0000-000000000004',
  line: '50000000-0000-0000-0000-000000000001',
  kb: '60000000-0000-0000-0000-000000000001',
  customer1: '70000000-0000-0000-0000-000000000001',
  customer2: '70000000-0000-0000-0000-000000000002',
};

async function main() {
  const t = DEFAULT_TENANT_ID;
  const passwordHash = await bcrypt.hash('Aihub@123456', BCRYPT_COST);

  // 1) 租户
  await prisma.tenant.upsert({
    where: { id: t },
    update: { name: '演示科技（默认租户）' },
    create: { id: t, name: '演示科技（默认租户）', plan: 'enterprise', status: 'ENABLED', locale: 'zh-CN' },
  });

  // 2) 部门
  await prisma.dept.upsert({
    where: { id: ID.dept },
    update: {},
    create: { id: ID.dept, tenantId: t, name: '营销中心', path: '/营销中心', sort: 1 },
  });

  // 3) 技能组
  await prisma.skillGroup.upsert({
    where: { id: ID.groupSales },
    update: {},
    create: { id: ID.groupSales, tenantId: t, name: '售前顾问组', strategy: 'LEAST_LOAD', priority: 100, overflowSeconds: 30 },
  });
  await prisma.skillGroup.upsert({
    where: { id: ID.groupService },
    update: {},
    create: { id: ID.groupService, tenantId: t, name: '客户成功组', strategy: 'ROUND_ROBIN', priority: 90 },
  });

  // 4) 角色 + 权限
  const roleDefs = [
    { id: ID.roleAdmin, code: 'SYS_ADMIN', name: '系统管理员' },
    { id: ID.roleManager, code: 'SYS_MANAGER', name: '销售主管' },
    { id: ID.roleAgent, code: 'SYS_AGENT', name: '电销坐席' },
  ];
  for (const r of roleDefs) {
    await prisma.role.upsert({ where: { code: r.code }, update: { name: r.name }, create: { id: r.id, tenantId: t, code: r.code, name: r.name, isSystem: true } });
  }
  const permDefs = [
    ['iam', 'read', '组织查看'], ['iam', 'write', '组织管理'],
    ['crm', 'read', '客户查看'], ['crm', 'write', '客户管理'],
    ['telephony', 'use', '话务操作'], ['bot', 'write', '机器人配置'],
    ['outbound', 'use', '外呼任务'], ['qa', 'read', '质检查看'], ['qa', 'review', '质检复检'],
    ['contract', 'write', '合同管理'], ['message', 'send', '消息触达'], ['report', 'read', '报表查看'],
    ['integration', 'write', '集成配置'], ['system', 'write', '系统设置'],
  ] as const;
  const permIds: Record<string, string> = {};
  for (const [mod, act, name] of permDefs) {
    const code = `${mod}:${act}`;
    const row = await prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name, module: mod, action: act } });
    permIds[code] = row.id;
  }
  // 管理员拥有全部权限；主管除系统/集成外拥有；坐席仅基础操作
  const grant = async (roleId: string, codes: string[]) => {
    for (const code of codes) {
      const pid = permIds[code];
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId: pid } }, update: {}, create: { roleId, permissionId: pid } });
    }
  };
  const all = permDefs.map(([m, a]) => `${m}:${a}`);
  await grant(ID.roleAdmin, all);
  await grant(ID.roleManager, all.filter((c) => !['integration:write', 'system:write'].includes(c)));
  await grant(ID.roleAgent, ['crm:read', 'crm:write', 'telephony:use', 'outbound:use', 'qa:read']);

  // 5) 坐席账号
  const users = [
    { id: ID.userAdmin, username: 'admin', realName: '平台管理员', roleAlias: 'ADMIN' as const, deptId: ID.dept, mobile: '13800000001' },
    { id: ID.userManager, username: 'manager', realName: '王主管', roleAlias: 'MANAGER' as const, deptId: ID.dept, mobile: '13800000002' },
    { id: ID.userAgent1, username: 'agent01', realName: '李晓', roleAlias: 'AGENT' as const, deptId: ID.dept, mobile: '13800000003' },
    { id: ID.userAgent2, username: 'agent02', realName: '张阳', roleAlias: 'AGENT' as const, deptId: ID.dept, mobile: '13800000004' },
  ];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    await prisma.user.upsert({
      where: { id: u.id },
      update: { realName: u.realName, roleAlias: u.roleAlias, status: 'ACTIVE', passwordHash },
      create: {
        id: u.id, tenantId: t, deptId: u.deptId, username: u.username, passwordHash, realName: u.realName,
        roleAlias: u.roleAlias, status: 'ACTIVE', jobNo: `A${1000 + i}`, mobile: u.mobile,
        managerId: u.roleAlias === 'AGENT' ? ID.userManager : null,
      },
    });
    const roleId = u.roleAlias === 'ADMIN' ? ID.roleAdmin : u.roleAlias === 'MANAGER' ? ID.roleManager : ID.roleAgent;
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId } }, update: {}, create: { userId: u.id, roleId } });
  }
  // 技能组成员
  for (const [gid, uid, lvl] of [
    [ID.groupSales, ID.userAgent1, 3], [ID.groupSales, ID.userAgent2, 2],
    [ID.groupService, ID.userAgent1, 1],
  ] as const) {
    await prisma.skillGroupMember.upsert({ where: { groupId_userId: { groupId: gid, userId: uid } }, update: { skillLevel: lvl }, create: { groupId: gid, userId: uid, skillLevel: lvl } });
  }

  // 6) 机器人配置
  await prisma.botConfig.upsert({
    where: { tenantId: t },
    update: {},
    create: {
      tenantId: t, name: '智能接线员小助', enabled: true,
      welcomeText: '您好，欢迎咨询企业增长云，请问您是想了解产品功能还是报价呢？',
      fallbackText: '抱歉没有完全理解，我为您转接专属顾问，请稍等。',
      transferKeywords: ['人工', '转人工', '真人', '找顾问'], idleTimeoutSec: 12, maxBotTurns: 20,
      model: { provider: 'sandbox', temperature: 0.3 }, voice: { provider: 'sandbox', voiceName: '知性女声' },
      workingHours: { weekdays: '1-5', start: '09:00', end: '21:00' }, afterHoursAction: 'QUEUE',
    },
  });

  // 7) 意图
  const intents = [
    { code: 'PRICE_INQUIRY', name: '价格咨询', keywords: ['价格', '多少钱', '费用', '收费', '报价'], examples: ['你们怎么收费', '一年多少钱', '报个价'], action: 'COLLECT' as const, answer: '我们按坐席数订阅，具体方案我安排顾问为您报价，可以留个手机号吗？', priority: 100 },
    { code: 'PRODUCT_DEMO', name: '产品演示', keywords: ['演示', '试用', '功能', '看看', 'demo'], examples: ['能演示一下吗', '怎么试用', '有哪些功能'], action: 'COLLECT' as const, answer: '可以的，顾问会为您安排一对一演示，请问怎么联系您？', priority: 90 },
    { code: 'TO_HUMAN', name: '转人工', keywords: ['人工', '真人', '客服', '找顾问'], examples: ['转人工', '我要找人', '真人说话'], action: 'TRANSFER' as const, targetGroupId: ID.groupSales, priority: 200 },
    { code: 'AFTER_SALE', name: '售后问题', keywords: ['故障', '报错', '登录不上', '售后', '投诉'], examples: ['系统登不上', '出故障了'], action: 'TRANSFER' as const, targetGroupId: ID.groupService, priority: 180 },
  ];
  for (const it of intents) {
    const exist = await prisma.intent.findFirst({ where: { tenantId: t, code: it.code } });
    if (exist) await prisma.intent.update({ where: { id: exist.id }, data: it });
    else await prisma.intent.create({ data: { tenantId: t, enabled: true, ...it } });
  }

  // 8) 知识库
  await prisma.knowledgeBase.upsert({ where: { id: ID.kb }, update: {}, create: { id: ID.kb, tenantId: t, name: '产品标准问答库', description: '接线机器人默认知识库' } });
  const kbs = [
    { question: '企业增长云是什么？', answer: '企业增长云是一套「智能接线 + 电销工作台」一体化平台，覆盖呼入机器人、意向识别、派单、坐席工作台、外呼、商机漏斗与质检报表。', keywords: ['是什么', '介绍', '功能'] },
    { question: '支持多少坐席？', answer: '单套环境支持 200+ 坐席并发在线，技能组级智能派单，并可横向扩展。', keywords: ['坐席', '并发', '多少人'] },
    { question: '如何收费？', answer: '按坐席账号数按年订阅，含平台使用费与线路/模型资源费，具体由顾问根据规模报价。', keywords: ['收费', '价格', '多少钱'] },
    { question: '能否对接现有线路和大模型？', answer: '支持标准 Provider 适配层，可接入主流语音线路、ASR/TTS 与大模型，未配置时使用内置沙箱离线演示。', keywords: ['对接', '线路', '模型', '集成'] },
  ];
  for (let i = 0; i < kbs.length; i++) {
    const k = kbs[i];
    const exist = await prisma.knowledgeItem.findFirst({ where: { kbId: ID.kb, question: k.question } });
    if (!exist) await prisma.knowledgeItem.create({ data: { id: `61000000-0000-0000-0000-00000000000${i + 1}`, tenantId: t, kbId: ID.kb, status: 'PUBLISHED', publishedAt: new Date(), ...k } });
  }

  // 9) 电话线路
  await prisma.phoneLine.upsert({
    where: { id: ID.line },
    update: {},
    create: { id: ID.line, tenantId: t, provider: 'sandbox', numberE164: '+8640012345678', label: '全国服务热线（沙箱）', groupId: ID.groupSales, concurrencyLimit: 200, enabled: true },
  });

  // 10) 沙箱供应商配置（凭证加密占位；切真时在管理端替换）
  const providers = [
    { type: 'LLM' as const, code: 'sandbox', name: '内置沙箱大模型' },
    { type: 'ASR' as const, code: 'sandbox', name: '内置沙箱语音识别' },
    { type: 'TTS' as const, code: 'sandbox', name: '内置沙箱语音合成' },
    { type: 'TELEPHONY' as const, code: 'sandbox', name: '内置沙箱语音线路' },
    { type: 'SMS' as const, code: 'sandbox', name: '内置沙箱短信通道' },
  ];
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const exist = await prisma.providerConfig.findFirst({ where: { tenantId: t, type: p.type, code: p.code } });
    const data = { enabled: true, priority: 100 - i, config: { sandbox: true, note: '离线沙箱实现，配置真实密钥后切换为商用供应商' }, credentialsEnc: CredentialCrypto.encrypt(JSON.stringify({ sandbox: true })) };
    if (exist) await prisma.providerConfig.update({ where: { id: exist.id }, data });
    else await prisma.providerConfig.create({ data: { id: `80000000-0000-0000-0000-00000000000${i + 1}`, tenantId: t, ...p, ...data } });
  }

  // 11) 质检规则
  const qaRules = [
    { name: '开场规范', type: 'SCRIPT' as const, category: '服务规范', pattern: ['您好', '很高兴为您服务'], weight: 8, mustHit: true },
    { name: '禁忌用语', type: 'KEYWORD' as const, category: '合规红线', pattern: ['不知道', '不归我管', '你自己看'], weight: 12, mustHit: false },
    { name: '结束语规范', type: 'SCRIPT' as const, category: '服务规范', pattern: ['感谢', '再见', '祝您'], weight: 6, mustHit: true },
    { name: '情绪负向词', type: 'EMOTION' as const, category: '情绪管理', pattern: ['烦', '投诉', '生气'], weight: 6, mustHit: false },
  ];
  for (let i = 0; i < qaRules.length; i++) {
    const r = qaRules[i];
    const exist = await prisma.qaRule.findFirst({ where: { tenantId: t, name: r.name } });
    if (!exist) await prisma.qaRule.create({ data: { id: `90000000-0000-0000-0000-00000000000${i + 1}`, tenantId: t, ...r } });
  }

  // 12) 数据字典
  const dicts = [
    { code: 'lead_source', name: '线索来源', items: [['热线', '热线'], ['机器人接入', '机器人接入'], ['官网', '官网'], ['广告', '广告'], ['外呼', '外呼'], ['转介绍', '转介绍']] },
    { code: 'intent_level', name: '意向等级', items: [['高', '高'], ['中', '中'], ['低', '低'], ['未知', '未知']] },
    { code: 'opp_stage', name: '商机阶段', items: [['需求确认', '需求确认'], ['需求挖掘', '需求挖掘'], ['方案', '方案'], ['报价', '报价'], ['谈判', '谈判'], ['赢单', '赢单'], ['输单', '输单']] },
  ];
  for (const d of dicts) {
    const dict = await prisma.dict.upsert({ where: { tenantId_code: { tenantId: t, code: d.code } }, update: { name: d.name }, create: { tenantId: t, code: d.code, name: d.name } });
    for (let i = 0; i < d.items.length; i++) {
      const [label, value] = d.items[i];
      const exist = await prisma.dictItem.findFirst({ where: { dictId: dict.id, value } });
      if (!exist) await prisma.dictItem.create({ data: { dictId: dict.id, label, value, sort: i, enabled: true } });
    }
  }

  // 13) 演示客户 / 联系人 / 商机 / 线索（让报表与漏斗开箱有数据）
  await prisma.customer.upsert({
    where: { id: ID.customer1 }, update: {},
    create: { id: ID.customer1, tenantId: t, ownerId: ID.userAgent1, name: '星河制造有限公司', industry: '智能制造', scale: 'SCALE_C', level: 'BIG', source: 'HOTLINE', area: '华东', stage: 'FOLLOWING' },
  });
  await prisma.customer.upsert({
    where: { id: ID.customer2 }, update: {},
    create: { id: ID.customer2, tenantId: t, ownerId: ID.userAgent2, name: '云帆互联网科技', industry: '互联网', scale: 'SCALE_D', level: 'MIDDLE', source: 'WEB', area: '华南', stage: 'NEW' },
  });
  const opp1 = await prisma.opportunity.findFirst({ where: { tenantId: t, customerId: ID.customer1 } });
  if (!opp1) await prisma.opportunity.create({ data: { tenantId: t, customerId: ID.customer1, ownerId: ID.userAgent1, name: '星河制造-200坐席采购项目', stage: 'QUOTE', amount: 360000, probability: 70, expectedClose: new Date(Date.now() + 30 * 864e5), source: 'HOTLINE' } });
  const lead1 = await prisma.lead.findFirst({ where: { tenantId: t, phoneE164: '+8613911112222' } });
  if (!lead1) await prisma.lead.create({ data: { tenantId: t, name: '赵经理', company: '星河制造有限公司', phoneRaw: '13911112222', phoneE164: '+8613911112222', source: 'HOTLINE', intentLevel: 'HIGH', ownerId: ID.userAgent1, groupId: ID.groupSales, stage: 'CONVERTED', customerId: ID.customer1, convertedAt: new Date() } });

  console.log('✔ 种子数据写入完成：默认租户 / 4 个账号（admin/manager/agent01/agent02，密码均为 Aihub@123456）/ 意图 / 知识库 / 线路 / 沙箱供应商 / 质检规则 / 演示客户');
}

main()
  .catch((e) => {
    console.error('✘ 种子写入失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
