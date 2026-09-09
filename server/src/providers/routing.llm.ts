import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { CredentialCrypto } from '../common/crypto.util';
import { ChatResult, LlmPort } from './ports';
import { SandboxLlm } from './sandbox.provider';
import { LlmCreds, OpenAiCompatLlm } from './openai-compat.llm';

interface CacheEntry { at: number; adapter: OpenAiCompatLlm | null; code: string; name: string }
const TTL_MS = 15_000;

/**
 * 运行时大模型路由：读取「供应商配置」中启用的 LLM 配置（凭证解密），返回真实适配器；
 * 未配置 / 调用失败 / 超时 时自动回退内置沙箱 NLU，保证演示与通话永不因外部大模型故障而中断。
 */
@Injectable()
export class RoutingLlm implements LlmPort {
  readonly code = 'routing-llm';
  private readonly logger = new Logger('RoutingLlm');
  private cache: CacheEntry | null = null;

  constructor(private prisma: PrismaService, private tenant: TenantStore, private sandbox: SandboxLlm) {}

  /** 供应商配置变更后调用，强制下次重新装载 */
  invalidate() { this.cache = null; }

  private async load(): Promise<CacheEntry> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache;
    const tenantId = this.tenant.get()?.tenantId;
    const rows = await this.prisma.providerConfig.findMany({
      where: { type: 'LLM', enabled: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { priority: 'asc' },
      take: 20,
    });
    // 种子内置行 code=sandbox 代表“用内置沙箱”，不是 HTTP 供应商；真实行优先
    const row = rows.find((r) => (r.code || '').toLowerCase() !== 'sandbox');
    let entry: CacheEntry;
    if (!row) {
      entry = { at: Date.now(), adapter: null, code: this.sandbox.code, name: '内置沙箱' };
    } else {
      let creds: LlmCreds = {};
      try {
        creds = row.credentialsEnc ? JSON.parse(CredentialCrypto.decrypt(row.credentialsEnc as Buffer)) : {};
      } catch {
        creds = {};
      }
      const merged: LlmCreds = { ...(row.config as any), ...creds };
      entry = { at: Date.now(), adapter: new OpenAiCompatLlm(row.code, merged), code: row.code, name: row.name };
    }
    this.cache = entry;
    return entry;
  }

  /** 当前生效的大脑（供管理端展示） */
  async describe() {
    const e = await this.load().catch(() => ({ adapter: null, code: this.sandbox.code, name: '内置沙箱' } as CacheEntry));
    return { activeCode: e.code, activeName: e.name, real: !!e.adapter };
  }

  async chat(input: Parameters<LlmPort['chat']>[0]): Promise<ChatResult> {
    const e = await this.load().catch((err) => { this.logger.warn(`装载大模型配置失败，回退沙箱：${err?.message}`); return null; });
    if (e?.adapter) {
      try {
        return await e.adapter.chat(input);
      } catch (err: any) {
        this.logger.warn(`真实大模型 ${e.code} 调用失败，本次回退沙箱：${err?.message}`);
      }
    }
    return this.sandbox.chat(input);
  }

  async summarize(turns: Parameters<LlmPort['summarize']>[0]) {
    const e = await this.load().catch(() => null);
    if (e?.adapter) {
      try {
        return await e.adapter.summarize(turns);
      } catch (err: any) {
        this.logger.warn(`真实大模型小结失败，回退沙箱：${err?.message}`);
      }
    }
    return this.sandbox.summarize(turns);
  }
}
