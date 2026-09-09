import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProviderRegistry } from '../providers/provider.registry';
import { DialogOrchestrator } from '../bot/dialog.orchestrator';
import { PresenceService } from './presence.service';
import { QueueService } from './queue.service';
import { RealtimeBus } from './realtime.bus';
import { CrmService } from '../crm/crm.service';
import { normalizePhone } from '../common/phone.util';
import { parsePage, pageResult } from '../common/pagination';
import { BizException } from '../common/biz.exception';

@Injectable()
export class CallService {
  constructor(
    private prisma: PrismaService,
    private providers: ProviderRegistry,
    private dialog: DialogOrchestrator,
    private presence: PresenceService,
    private queue: QueueService,
    private bus: RealtimeBus,
    private crm: CrmService,
  ) {}

  /** 一通呼入：机器人接听 + 欢迎语 + 来电画像 */
  async inboundCall(tenantId: string, dto: { from: string; to?: string; lineId?: string; groupId?: string }) {
    const phone = normalizePhone(dto.from);
    const pop = await this.crm.screenPop(dto.from).catch(() => null);
    const call = await this.prisma.callSession.create({
      data: {
        tenantId, lineId: dto.lineId, direction: 'INBOUND', fromNo: dto.from, toNo: dto.to, phoneE164: phone,
        customerId: pop?.customer?.id, contactId: pop?.contact?.id, leadId: pop?.lead?.id, groupId: dto.groupId,
        status: 'BOT', isBotHandled: true, queueEnterAt: new Date(), providerRef: `sbx_in_${Date.now()}`,
      },
    });
    const welcome = await this.dialog.welcome(tenantId, call.id);
    this.bus.publish(`tenant:${tenantId}`, 'call.bot_started', { callId: call.id, phone, welcome });
    return { call, welcome, screenPop: pop };
  }

  /** 客户说话（ASR 回调/沙箱模拟）：机器人理解与应答，必要时转人工 */
  async customerSay(tenantId: string, callId: string, text: string) {
    const call = await this.prisma.callSession.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw BizException.notFound('通话不存在');
    const segCount = await this.prisma.transcriptSegment.count({ where: { callId } });
    const turn = await this.dialog.turn(tenantId, call, text, segCount);
    this.bus.publish(`tenant:${tenantId}`, 'call.transcript.segment', { callId, customer: text, bot: turn.reply, action: turn.action });
    if (turn.leadId) await this.prisma.callSession.update({ where: { id: callId }, data: { leadId: turn.leadId } });
    let routed: any = null;
    if (turn.action === 'TRANSFER') routed = await this.routeToHuman(tenantId, callId, turn.intentCode);
    return { ...turn, routed };
  }

  /** 转人工：确定技能组并入队派单 */
  async routeToHuman(tenantId: string, callId: string, _intentCode?: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call) return { assigned: false };
    let groupId = call.groupId;
    if (!groupId) {
      const line = call.lineId ? await this.prisma.phoneLine.findUnique({ where: { id: call.lineId } }) : null;
      groupId = line?.groupId || (await this.prisma.skillGroup.findFirst({ where: { tenantId } }))?.id || null;
    }
    if (!groupId) return { assigned: false, reason: 'NO_SKILL_GROUP' };
    await this.prisma.callSession.update({ where: { id: callId }, data: { status: 'QUEUE', transferred: true, isBotHandled: false } });
    return this.queue.enqueue(tenantId, { callId, leadId: call.leadId || undefined, phone: call.phoneE164 || undefined, groupId: groupId!, strategy: 'ROUND_ROBIN' });
  }

  /** 坐席手动外呼 */
  async agentDial(tenantId: string, agentId: string, dto: { to: string; customerId?: string; contactId?: string; campaignTargetId?: string }) {
    const line = await this.prisma.phoneLine.findFirst({ where: { tenantId, enabled: true } });
    const dial = await this.providers.getTelephony().dial({ from: line?.numberE164 || '400-000-0000', to: dto.to });
    const call = await this.prisma.callSession.create({
      data: {
        tenantId, lineId: line?.id, providerRef: dial.providerRef, direction: 'OUTBOUND', fromNo: line?.numberE164, toNo: dto.to,
        phoneE164: normalizePhone(dto.to), customerId: dto.customerId, contactId: dto.contactId, campaignTargetId: dto.campaignTargetId,
        agentId, status: 'AGENT_TALK', answerAt: new Date(),
      },
    });
    await this.presence.setStatus(tenantId, agentId, 'ON_CALL', call.id);
    await this.presence.incrLoad(tenantId, agentId);
    this.bus.publish(`agent:${agentId}`, 'call.status', { callId: call.id, status: 'AGENT_TALK' });
    return call;
  }

  async agentSay(tenantId: string, callId: string, speaker: 'AGENT' | 'CUSTOMER', text: string) {
    const n = await this.prisma.transcriptSegment.count({ where: { callId } });
    const seg = await this.prisma.transcriptSegment.create({ data: { tenantId, callId, seq: n, speaker, text, confidence: 0.95 } });
    this.bus.publish(`tenant:${tenantId}`, 'call.transcript.segment', { callId, speaker, text });
    return seg;
  }

  /** 结束通话：计时、AI 小结、写跟进动态、释放坐席 */
  async endCall(tenantId: string, callId: string, by = 'CALLER', disposition?: string) {
    const call = await this.prisma.callSession.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw BizException.notFound('通话不存在');
    // 幂等：已结束的通话直接返回当前记录，避免重复生成小结与跟进动态
    if (call.status === 'ENDED') return call;
    const now = new Date();
    const start = call.answerAt || call.queueEnterAt || call.createdAt;
    const duration = Math.max(0, Math.round((now.getTime() - start.getTime()) / 1000));
    const segments = await this.prisma.transcriptSegment.findMany({ where: { callId }, orderBy: { seq: 'asc' } });
    const ai = await this.providers.getLlm().summarize(segments.map((s) => ({ speaker: s.speaker, text: s.text })));
    const transcriptText = segments.map((s) => `${s.speaker === 'BOT' ? '机器人' : s.speaker === 'AGENT' ? '坐席' : '客户'}：${s.text}`).join('\n');
    const updated = await this.prisma.callSession.update({
      where: { id: callId },
      data: {
        status: 'ENDED', endAt: now, durationSec: duration, talkSec: duration, hangupBy: by,
        disposition: (disposition as any) || call.disposition, transcriptText,
        aiSummary: { ...ai }, sentiment: ai.sentiment,
      },
    });
    if (call.agentId) {
      await this.presence.decrLoad(tenantId, call.agentId);
      await this.presence.setStatus(tenantId, call.agentId, 'AFTER', callId);
    }
    if (call.customerId) {
      await this.prisma.activity.create({ data: { tenantId, creatorId: call.agentId, type: 'CALL', relatedType: 'CUSTOMER', relatedId: call.customerId, callId, direction: call.direction, durationSec: duration, content: ai.summary, happenedAt: now } });
    }
    this.bus.publish(`tenant:${tenantId}`, 'call.ai_summary', { callId, ai });
    this.bus.publish(`tenant:${tenantId}`, 'call.status', { callId, status: 'ENDED' });
    return updated;
  }

  async wrapUp(tenantId: string, callId: string, dto: { disposition?: string; note?: string }) {
    const call = await this.prisma.callSession.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw BizException.notFound('通话不存在');
    await this.prisma.callSession.update({ where: { id: callId }, data: { status: 'ENDED', disposition: dto.disposition as any, aiSummary: { ...(call.aiSummary as any), note: dto.note } } });
    if (call.agentId) await this.presence.setStatus(tenantId, call.agentId, 'IDLE');
    return { ok: true };
  }

  async listCalls(tenantId: string, q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId };
    if (q.agentId) where.agentId = q.agentId;
    if (q.mine === '1') where.agentId = q.__me;
    if (q.direction) where.direction = q.direction;
    if (q.status) where.status = q.status;
    const [list, total] = await Promise.all([
      this.prisma.callSession.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.callSession.count({ where }),
    ]);
    return pageResult(list, total, page, pageSize);
  }
  async detail(tenantId: string, id: string) {
    const call = await this.prisma.callSession.findFirst({ where: { id, tenantId } });
    if (!call) throw BizException.notFound('通话不存在');
    const segments = await this.prisma.transcriptSegment.findMany({ where: { callId: id }, orderBy: { seq: 'asc' } });
    const qa = await this.prisma.qaRecord.findMany({ where: { callId: id } });
    return { ...call, segments, qa };
  }

  async listLines(tenantId: string) { return this.prisma.phoneLine.findMany({ where: { tenantId } }); }
  async createLine(tenantId: string, dto: any) {
    return this.prisma.phoneLine.create({ data: { tenantId, numberE164: normalizePhone(dto.number) || dto.number, label: dto.label, provider: dto.provider || 'sandbox', concurrencyLimit: dto.concurrencyLimit || 50, groupId: dto.groupId } });
  }
}
