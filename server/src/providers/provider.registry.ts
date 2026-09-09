import { Injectable } from '@nestjs/common';
import { AsrPort, ChannelPort, LlmPort, TelephonyPort, TtsPort } from './ports';
import { SandboxAsr, SandboxChannel, SandboxTelephony, SandboxTts } from './sandbox.provider';
import { RoutingLlm } from './routing.llm';

/**
 * 供应商注册中心：LLM 走运行时路由（配置了真实大模型即用真实，否则沙箱兜底）；
 * ASR/TTS/语音线路/消息通道当前仍为沙箱，接入真实供应商时在此按同样方式扩展。
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    readonly llmRouter: RoutingLlm,
    readonly asr: SandboxAsr,
    readonly tts: SandboxTts,
    readonly telephony: SandboxTelephony,
    readonly channel: SandboxChannel,
  ) {}
  getLlm(): LlmPort { return this.llmRouter; }
  getAsr(): AsrPort { return this.asr; }
  getTts(): TtsPort { return this.tts; }
  getTelephony(): TelephonyPort { return this.telephony; }
  getChannel(): ChannelPort { return this.channel; }
  /** 当前各能力的供应商标识（前端据此提示“演示模式/真实模式”） */
  async activeMode() {
    const llm = await this.llmRouter.describe();
    return { llm: llm.activeCode, llmName: llm.activeName, llmReal: llm.real, asr: this.asr.code, tts: this.tts.code, telephony: this.telephony.code, channel: this.channel.code, sandbox: !llm.real };
  }
}
