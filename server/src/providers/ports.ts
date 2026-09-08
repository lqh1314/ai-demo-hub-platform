/** 外部能力端口定义：业务层只依赖这些接口，真实供应商实现同样的接口即可替换沙箱 */

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface NluSlot { name: string; value: string; }
export type ChatAction = 'ANSWER' | 'TRANSFER' | 'COLLECT_LEAD' | 'SCRIPT';
export interface ChatResult {
  reply: string;
  intentCode?: string;
  intentName?: string;
  action?: ChatAction;
  slots?: Record<string, string>;
  confidence: number;
}
export interface KbRef { q: string; a: string; keywords?: string[] }
export interface LlmPort {
  readonly code: string;
  chat(input: { messages: ChatMessage[]; knowledge?: KbRef[]; intents?: { code: string; name: string; keywords: string[] }[] }): Promise<ChatResult>;
  summarize(transcript: { speaker: string; text: string }[]): Promise<{ summary: string; nextActions: string[]; sentiment: string }>;
}

export interface AsrPort {
  readonly code: string;
  /** 语音片段 -> 文本（沙箱返回确定性文本，真实返回识别结果） */
  recognize(audioBase64OrRef: string, ctx?: Record<string, unknown>): Promise<{ text: string; confidence: number }>;
}
export interface TtsPort {
  readonly code: string;
  synthesize(text: string): Promise<{ audioRef: string; durationMs: number }>;
}

export interface DialRequest { from: string; to: string; campaignTargetId?: string; lineId?: string; }
export interface DialResult { providerRef: string; status: 'RINGING' | 'CONNECTED' | 'FAILED'; failReason?: string; }
export interface TelephonyPort {
  readonly code: string;
  dial(req: DialRequest): Promise<DialResult>;
  answer(providerRef: string): Promise<void>;
  hangup(providerRef: string, by: string): Promise<void>;
  /** 沙箱：模拟客户说了一句话，驱动机器人对话；真实实现由回调驱动，此处仅占位 */
  simulateUtterance?(providerRef: string, text: string): Promise<void>;
}

export interface ChannelSendRequest { channel: 'SMS' | 'EMAIL' | 'WECHAT'; to: string; content: string; }
export interface ChannelSendResult { providerMsgId: string; status: 'SENT' | 'FAILED'; raw?: unknown; }
export interface ChannelPort {
  readonly code: string;
  send(req: ChannelSendRequest): Promise<ChannelSendResult>;
}

export const PROVIDER_TOKENS = {
  LLM: 'LLM_PORT',
  ASR: 'ASR_PORT',
  TTS: 'TTS_PORT',
  TELEPHONY: 'TELEPHONY_PORT',
  CHANNEL: 'CHANNEL_PORT',
};
