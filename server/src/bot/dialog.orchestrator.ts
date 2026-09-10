import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProviderRegistry } from '../providers/provider.registry';
import { normalizePhone } from '../common/phone.util';

export interface TurnResult {
  reply: string;
  action: 'ANSWER' | 'TRANSFER' | 'COLLECT_LEAD' | 'SCRIPT';
  intentCode?: string;
  slots: Record<string, string>;
  leadId?: string | null;
}

/** 对话编排器：ASR 文本 -> 理解(LLM 端口) -> 知识库/意图 -> 留资/转人工决策 -> 落库。显式传租户，供公开 CTI 回调复用 */
@Injectable()
export class DialogOrchestrator {
  constructor(private prisma: PrismaService, private providers: ProviderRegistry) {}

  private async conversation(tenantId: string, callId: string) {
    return this.prisma.botSession.upsert({
      where: { callId },
      create: { tenantId, callId, turnCount: 0 },
      update: {},
    });
  }

  async welcome(tenantId: string, callId: string) {
    const cfg = await this.prisma.botConfig.findUnique({ where: { tenantId } });
    const reply = cfg?.welcomeText || '您好，这里是客户服务中心，请问有什么可以帮您？';
    await this.appendSegment(tenantId, callId, 0, 'BOT', reply);
    await this.conversation(tenantId, callId);
    return reply;
  }

  async turn(tenantId: string, call: { id: string; leadId?: string | null; phoneE164?: string | null }, userText: string, baseSeq: number): Promise<TurnResult> {
    const [cfg, intents, kb] = await Promise.all([
      this.prisma.botConfig.findUnique({ where: { tenantId } }),
      this.prisma.intent.findMany({ where: { tenantId, enabled: true } }),
      this.prisma.knowledgeItem.findMany({ where: { tenantId, status: 'PUBLISHED' }, take: 40 }),
    ]);
    // 先取历史（此时尚未写入本轮客户句），让大模型具备多轮上下文记忆，承接“然后呢/太贵了/行吧”等
    const priorSegs = await this.prisma.transcriptSegment.findMany({ where: { tenantId, callId: call.id }, orderBy: { seq: 'asc' } });
    const history = priorSegs
      .filter((s) => s.speaker === 'CUSTOMER' || s.speaker === 'BOT')
      .slice(-10)
      .map((s) => ({ role: (s.speaker === 'CUSTOMER' ? 'user' : 'assistant') as 'user' | 'assistant', content: s.text }));
    await this.appendSegment(tenantId, call.id, baseSeq, 'CUSTOMER', userText);
    const chat = await this.providers.getLlm().chat({
      messages: [...history, { role: 'user', content: userText }],
      intents: intents.map((i) => ({ code: i.code, name: i.name, keywords: i.keywords })),
      knowledge: kb.map((k) => ({ q: k.question, a: k.answer, keywords: k.keywords })),
    });
    await this.appendSegment(tenantId, call.id, baseSeq + 1, 'BOT', chat.reply);

    const conv = await this.conversation(tenantId, call.id);
    const prevSlots = (conv.slots as Record<string, string>) || {};
    const slots = { ...prevSlots, ...(chat.slots || {}) };
    let leadId = call.leadId;
    // 收集到手机号 -> 自动留资建档
    if (!leadId && (slots.phone || call.phoneE164)) {
      const phone = normalizePhone(slots.phone) || call.phoneE164;
      const lead = await this.prisma.lead.create({
        data: {
          tenantId, name: slots.name, company: slots.company, phoneE164: phone, phoneRaw: slots.phone,
          source: 'BOT', intentLevel: 'MIDDLE', stage: 'NEW', firstCallId: call.id, lastCallId: call.id,
          groupId: intents.find((i) => i.code === chat.intentCode)?.targetGroupId,
        },
      });
      leadId = lead.id;
      await this.prisma.callSession.update({ where: { id: call.id }, data: { leadId } });
    }
    const action = (chat.action || 'ANSWER') as TurnResult['action'];
    const outcome = action === 'TRANSFER' ? 'TO_HUMAN' : action === 'COLLECT_LEAD' ? 'LEFT_INFO' : conv.outcome;
    await this.prisma.botSession.update({
      where: { callId: call.id },
      data: { turnCount: { increment: 1 }, recognizedIntent: chat.intentCode, slots, outcome: outcome as any, summary: chat.intentName },
    });
    return { reply: chat.reply, action, intentCode: chat.intentCode, slots, leadId };
  }

  private async appendSegment(tenantId: string, callId: string, seq: number, speaker: 'BOT' | 'CUSTOMER' | 'AGENT', text: string) {
    await this.prisma.transcriptSegment.create({ data: { tenantId, callId, seq, speaker, text, startMs: seq * 3000, endMs: seq * 3000 + 2800, confidence: speaker === 'BOT' ? 1 : 0.9 } });
  }
}
