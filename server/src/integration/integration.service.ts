import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { CredentialCrypto } from '../common/crypto.util';
import { BizException } from '../common/biz.exception';
import { RoutingLlm } from '../providers/routing.llm';
import { LlmCreds, OpenAiCompatLlm } from '../providers/openai-compat.llm';

@Injectable()
export class IntegrationService {
  constructor(private prisma: PrismaService, private store: TenantStore, private llmRouter: RoutingLlm) {}
  private t() { return this.store.tenantId; }

  // ---------- 开放 API 密钥 ----------
  listKeys() {
    return this.prisma.apiKey.findMany({ where: { tenantId: this.t() }, select: { id: true, name: true, ak: true, scopes: true, enabled: true, lastUsedAt: true, createdAt: true } });
  }
  async createKey(dto: { name: string; scopes?: string[] }) {
    const ak = `ak_${randomBytes(8).toString('hex')}`;
    const sk = randomBytes(24).toString('hex');
    const skHash = createHash('sha256').update(sk).digest('hex');
    const key = await this.prisma.apiKey.create({ data: { tenantId: this.t(), ownerId: this.store.user.userId, name: dto.name, ak, skHash, scopes: dto.scopes || ['*'] } });
    return { id: key.id, ak, sk, hint: 'sk 仅本次返回，请妥善保存' };
  }
  toggleKey(id: string, enabled: boolean) { return this.prisma.apiKey.update({ where: { id }, data: { enabled } }); }

  // ---------- Webhook（需先创建开放密钥） ----------
  async listWebhooks() {
    const rows = await this.prisma.webhookSubscription.findMany({ where: { tenantId: this.t() }, orderBy: { createdAt: 'desc' } });
    // 前端按 events 数组渲染订阅事件标签，这里为每条订阅补一个虚拟 events 字段
    return rows.map((r: any) => ({ ...r, events: [r.event] }));
  }
  async createWebhook(dto: { apiKeyId?: string; event?: string; events?: string[]; url: string; secret?: string }) {
    if (!dto.url) throw BizException.badRequest('回调地址不能为空');
    // 兼容前端 events 数组（多选）与单个 event 两种入参，每个事件建一条订阅
    const events = (dto.events?.length ? dto.events : dto.event ? [dto.event] : []).map((s) => String(s).trim()).filter(Boolean);
    if (!events.length) throw BizException.badRequest('订阅事件不能为空');
    const apiKeyId = dto.apiKeyId || (await this.prisma.apiKey.findFirst({ where: { tenantId: this.t() } }))?.id;
    if (!apiKeyId) throw BizException.badRequest('请先创建开放密钥');
    const secret = dto.secret || randomBytes(12).toString('hex');
    const rows = await this.prisma.$transaction(
      events.map((event) => this.prisma.webhookSubscription.create({ data: { tenantId: this.t(), apiKeyId, event, url: dto.url, secret } })),
    );
    return { created: rows.length, events, first: rows[0] };
  }
  listDeliveries() { return this.prisma.webhookDelivery.findMany({ take: 100, orderBy: { createdAt: 'desc' } }); }

  // ---------- 供应商配置（凭证 AES-GCM 加密落库） ----------
  listProviders() {
    return this.prisma.providerConfig.findMany({ where: { tenantId: this.t() }, select: { id: true, type: true, code: true, name: true, enabled: true, priority: true, config: true, createdAt: true } });
  }
  async upsertProvider(dto: { type: any; code?: string; provider?: string; name: string; enabled?: boolean; priority?: number; config?: Record<string, any>; credentials?: Record<string, string> }) {
    const code = dto.code || dto.provider;
    if (!code) throw BizException.badRequest('供应商标识不能为空（如 deepseek / doubao / openai）');
    const enc = dto.credentials ? CredentialCrypto.encrypt(JSON.stringify(dto.credentials)) : undefined;
    const existing = await this.prisma.providerConfig.findFirst({ where: { tenantId: this.t(), code } });
    let saved;
    if (existing) {
      saved = await this.prisma.providerConfig.update({ where: { id: existing.id }, data: { type: dto.type, name: dto.name, enabled: dto.enabled, priority: dto.priority, config: dto.config, credentialsEnc: enc ?? existing.credentialsEnc } });
    } else {
      saved = await this.prisma.providerConfig.create({ data: { tenantId: this.t(), type: dto.type, code, name: dto.name, enabled: dto.enabled ?? false, priority: dto.priority ?? 100, config: dto.config, credentialsEnc: enc } });
    }
    this.llmRouter.invalidate(); // 立即按新配置装载
    return saved;
  }
  async revealProvider(id: string) {
    const p = await this.prisma.providerConfig.findUnique({ where: { id } });
    if (!p?.credentialsEnc) return p;
    return { ...p, credentials: JSON.parse(CredentialCrypto.decrypt(p.credentialsEnc as Buffer)) };
  }

  /** 当前运行时实际生效的大模型 */
  activeLlm() { return this.llmRouter.describe(); }

  /** 连通性测试：可传已保存 id，也可直接传草稿（code+credentials/config）先测后存 */
  async testProvider(dto: { id?: string; code?: string; provider?: string; type?: string; credentials?: Record<string, string>; config?: Record<string, any> }) {
    let code = dto.code || dto.provider;
    let creds: LlmCreds = { ...(dto.config || {}), ...(dto.credentials || {}) };
    if (dto.id) {
      const row = await this.prisma.providerConfig.findUnique({ where: { id: dto.id } });
      if (!row) throw BizException.notFound('供应商配置不存在');
      code = row.code;
      const dec = row.credentialsEnc ? JSON.parse(CredentialCrypto.decrypt(row.credentialsEnc as Buffer)) : {};
      creds = { ...(row.config as any), ...dec };
    }
    if (!code) throw BizException.badRequest('缺少供应商标识');
    try {
      const r = await OpenAiCompatLlm.ping(code, creds);
      return { ok: true, code, ...r };
    } catch (e: any) {
      return { ok: false, code, error: e?.message || String(e) };
    }
  }
}
