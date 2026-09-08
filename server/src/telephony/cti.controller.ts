import { Body, Controller, Get, Post, Query, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { CallService } from './call.service';
import { Public } from '../common/auth.guard';
import { DEFAULT_TENANT_ID } from '../common/constants';
import { ctiAuthorize } from '../common/security';

/**
 * CTI 供应商回调入口（运营商/ASR 侧无登录态）。
 * 安全收口（闸门 C Medium 修复）：
 *  - 配置 CTI_WEBHOOK_SECRET 后，请求必须带匹配的 `x-cti-secret`（常量时间比较）；
 *  - 生产环境（NODE_ENV=production）强制要求该密钥，未配置或不匹配一律 403；
 *  - 非生产（沙箱/本地演示）未配置密钥时放行，保证离线全链路可演示；
 *  - demo-inbound 仅在非生产或显式 ALLOW_DEMO_INBOUND=true 时可用。
 */
@Controller('cti')
export class CtiController {
  constructor(private calls: CallService) {}
  private tenant(t?: string) { return t || DEFAULT_TENANT_ID; }
  private readonly isProd = process.env.NODE_ENV === 'production';

  /** 校验供应商回调密钥；不通过抛 403 */
  private assertCti(req: Request) {
    const provided = String((req.headers as any)['x-cti-secret'] ?? (req.query as any)?.secret ?? '');
    const r = ctiAuthorize({ provided, expected: process.env.CTI_WEBHOOK_SECRET, isProd: this.isProd });
    if (!r.ok) {
      throw new ForbiddenException(
        r.reason === 'prod_missing_secret'
          ? '生产环境必须配置 CTI_WEBHOOK_SECRET 才能开放 CTI 回调'
          : 'CTI 回调密钥校验失败',
      );
    }
  }

  @Public() @Post('inbound') inbound(@Req() req: Request, @Body() b: any) {
    this.assertCti(req);
    return this.calls.inboundCall(this.tenant(b.tenantId), { from: b.from, to: b.to, lineId: b.lineId, groupId: b.groupId });
  }
  @Public() @Post('utter') utter(@Req() req: Request, @Body() b: any) {
    this.assertCti(req);
    return this.calls.customerSay(this.tenant(b.tenantId), b.callId, b.text);
  }
  @Public() @Post('end') end(@Req() req: Request, @Body() b: any) {
    this.assertCti(req);
    return this.calls.endCall(this.tenant(b.tenantId), b.callId, 'CALLER', b.disposition);
  }

  /** 工作台“模拟来电”一键入口：生产默认关闭，避免被当作伪造呼入口 */
  @Public() @Get('demo-inbound') demo(@Req() req: Request, @Query('phone') phone: string, @Query('group') group?: string) {
    if (this.isProd && process.env.ALLOW_DEMO_INBOUND !== 'true') {
      throw new ForbiddenException('演示入口在生产环境已关闭');
    }
    this.assertCti(req);
    return this.calls.inboundCall(DEFAULT_TENANT_ID, { from: phone || '13800138000', groupId: group });
  }
}
