import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { CredentialCrypto } from '../common/crypto.util';
import { BizException } from '../common/biz.exception';

@Injectable()
export class IntegrationService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
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
  listWebhooks() { return this.prisma.webhookSubscription.findMany({ where: { tenantId: this.t() } }); }
  async createWebhook(dto: { apiKeyId?: string; event: string; url: string; secret?: string }) {
    const apiKeyId = dto.apiKeyId || (await this.prisma.apiKey.findFirst({ where: { tenantId: this.t() } }))?.id;
    if (!apiKeyId) throw BizException.badRequest('请先创建开放密钥');
    return this.prisma.webhookSubscription.create({ data: { tenantId: this.t(), apiKeyId, event: dto.event, url: dto.url, secret: dto.secret || randomBytes(12).toString('hex') } });
  }
  listDeliveries() { return this.prisma.webhookDelivery.findMany({ take: 100, orderBy: { createdAt: 'desc' } }); }

  // ---------- 供应商配置（凭证 AES-GCM 加密落库） ----------
  listProviders() {
    return this.prisma.providerConfig.findMany({ where: { tenantId: this.t() }, select: { id: true, type: true, code: true, name: true, enabled: true, priority: true, config: true, createdAt: true } });
  }
  async upsertProvider(dto: { type: any; code: string; name: string; enabled?: boolean; priority?: number; config?: Record<string, any>; credentials?: Record<string, string> }) {
    const enc = dto.credentials ? CredentialCrypto.encrypt(JSON.stringify(dto.credentials)) : undefined;
    const existing = await this.prisma.providerConfig.findFirst({ where: { tenantId: this.t(), code: dto.code } });
    if (existing) {
      return this.prisma.providerConfig.update({ where: { id: existing.id }, data: { type: dto.type, name: dto.name, enabled: dto.enabled, priority: dto.priority, config: dto.config, credentialsEnc: enc ?? existing.credentialsEnc } });
    }
    return this.prisma.providerConfig.create({ data: { tenantId: this.t(), type: dto.type, code: dto.code, name: dto.name, enabled: dto.enabled ?? false, priority: dto.priority ?? 100, config: dto.config, credentialsEnc: enc } });
  }
  async revealProvider(id: string) {
    const p = await this.prisma.providerConfig.findUnique({ where: { id } });
    if (!p?.credentialsEnc) return p;
    return { ...p, credentials: JSON.parse(CredentialCrypto.decrypt(p.credentialsEnc as Buffer)) };
  }
}
