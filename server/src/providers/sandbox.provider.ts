import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AsrPort, ChannelPort, ChatResult, LlmPort, TelephonyPort, TtsPort, DialResult, ChannelSendResult } from './ports';
import { decideTurn, summarizeTurns } from '../bot/nlu';

@Injectable()
export class SandboxLlm implements LlmPort {
  readonly code = 'sandbox-llm';
  async chat(input: Parameters<LlmPort['chat']>[0]): Promise<ChatResult> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const out = decideTurn({
      text: lastUser?.content || '',
      intents: (input.intents || []).map((i) => ({ code: i.code, name: i.name, keywords: i.keywords })),
      knowledge: (input.knowledge || []).map((k) => ({ q: k.q, a: k.a, keywords: k.keywords || [] })),
      fallback: '抱歉没有完全理解，正在为您转接人工顾问。',
    });
    return { reply: out.reply, intentCode: out.intentCode, intentName: out.intentName, action: out.action, slots: out.slots, confidence: out.confidence };
  }
  async summarize(turns: Parameters<LlmPort['summarize']>[0]) {
    return summarizeTurns(turns);
  }
}

@Injectable()
export class SandboxAsr implements AsrPort {
  readonly code = 'sandbox-asr';
  async recognize(ref: string): Promise<{ text: string; confidence: number }> {
    return { text: ref || '（沙箱识别文本）', confidence: 0.92 };
  }
}

@Injectable()
export class SandboxTts implements TtsPort {
  readonly code = 'sandbox-tts';
  async synthesize(text: string) {
    return { audioRef: `sandbox-tts://${Buffer.from(text).toString('base64').slice(0, 32)}`, durationMs: text.length * 220 };
  }
}

@Injectable()
export class SandboxTelephony implements TelephonyPort {
  readonly code = 'sandbox-telephony';
  readonly events = new EventEmitter();
  private active = new Set<string>();
  async dial(req: { from: string; to: string }): Promise<DialResult> {
    const providerRef = `sbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.active.add(providerRef);
    return { providerRef, status: 'CONNECTED' };
  }
  async answer(ref: string) { this.active.add(ref); }
  async hangup(ref: string) { this.active.delete(ref); this.events.emit('hangup', { ref }); }
  async simulateUtterance(ref: string, text: string) { this.events.emit('utterance', { ref, text }); }
}

@Injectable()
export class SandboxChannel implements ChannelPort {
  readonly code = 'sandbox-channel';
  async send(req: { channel: string; to: string; content: string }): Promise<ChannelSendResult> {
    return { providerMsgId: `sbxmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, status: 'SENT', raw: { sandbox: true, to: req.to } };
  }
}
