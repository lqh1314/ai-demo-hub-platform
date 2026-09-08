import { Injectable } from '@nestjs/common';
import { AsrPort, ChannelPort, LlmPort, TelephonyPort, TtsPort } from './ports';
import { SandboxAsr, SandboxChannel, SandboxLlm, SandboxTelephony, SandboxTts } from './sandbox.provider';

/**
 * 供应商注册中心：默认返回沙箱实现；接入真实供应商时，
 * 依据「供应商配置」在此返回真实实现（业务层无感知）。
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    readonly llm: SandboxLlm,
    readonly asr: SandboxAsr,
    readonly tts: SandboxTts,
    readonly telephony: SandboxTelephony,
    readonly channel: SandboxChannel,
  ) {}
  getLlm(): LlmPort { return this.llm; }
  getAsr(): AsrPort { return this.asr; }
  getTts(): TtsPort { return this.tts; }
  getTelephony(): TelephonyPort { return this.telephony; }
  getChannel(): ChannelPort { return this.channel; }
  /** 当前是否全部为沙箱（前端据此提示“演示模式”） */
  activeMode() {
    return { llm: this.llm.code, asr: this.asr.code, tts: this.tts.code, telephony: this.telephony.code, channel: this.channel.code, sandbox: true };
  }
}
