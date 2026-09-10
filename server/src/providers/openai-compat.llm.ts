import { ChatResult, ChatMessage, KbRef, LlmPort } from './ports';
import { extractSlots, summarizeTurns, wantsTransfer } from '../bot/nlu';

/** 供应商预设：兼容 OpenAI Chat Completions 协议即可接入 */
const PRESET_BASE: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  ark: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  'local-demo': { baseUrl: 'http://127.0.0.1:3100/v1', model: 'demo-zh' },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' },
};

export interface LlmCreds {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  /** 企业人设/业务介绍，可选，用于系统提示词 */
  persona?: string;
}

export function resolveEndpoint(code: string, creds: LlmCreds): { baseUrl: string; model: string } {
  const preset = PRESET_BASE[(code || '').toLowerCase()];
  const baseUrl = (creds.baseUrl || preset?.baseUrl || '').replace(/\/+$/, '');
  const model = creds.model || preset?.model || '';
  return { baseUrl, model };
}

/**
 * OpenAI 兼容大模型适配器：任何提供 /chat/completions 的服务（OpenAI/DeepSeek/豆包Ark/通义/Kimi/本地 vLLM、Ollama）
 * 都实现同一 LlmPort；任何异常都由上层 RoutingLlm 兜底回沙箱，保证通话不中断。
 */
export class OpenAiCompatLlm implements LlmPort {
  readonly code: string;
  private readonly baseUrl: string;
  private readonly model: string;
  constructor(code: string, private readonly creds: LlmCreds) {
    this.code = `llm:${code}`;
    const ep = resolveEndpoint(code, creds);
    this.baseUrl = ep.baseUrl;
    this.model = ep.model;
  }

  private async completion(messages: ChatMessage[], temperature = 0.4): Promise<string> {
    if (!this.baseUrl) throw new Error('未配置 baseUrl，无法调用大模型');
    if (!this.model) throw new Error('未配置模型 model（豆包 Ark 需填写推理接入点 ep-xxxx）');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(this.creds.apiKey ? { Authorization: `Bearer ${this.creds.apiKey}` } : {}) },
        body: JSON.stringify({ model: this.model, messages, temperature: this.creds.temperature ?? temperature, stream: false }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`大模型接口 ${resp.status}：${txt.slice(0, 300)}`);
      }
      const data: any = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('大模型返回为空');
      return content.trim();
    } finally {
      clearTimeout(timer);
    }
  }

  private buildSystem(input: Parameters<LlmPort['chat']>[0]): string {
    const intents = (input.intents || []).map((i) => `- ${i.code}：${i.name}（关键词：${(i.keywords || []).join('、')}）`).join('\n');
    const kb = (input.knowledge || []).slice(0, 20).map((k: KbRef) => `- 问：${k.q}\n  答：${k.a}`).join('\n');
    return [
      '你是 To-B SaaS 获客场景的电话接线机器人，通过语音与客户对话，回答要口语化、简短（1~3 句）、直接给客户有用信息。',
      this.creds.persona ? `业务背景：${this.creds.persona}` : '',
      intents ? `可识别意图（命中时在 intentCode 原样返回其编码）：\n${intents}` : '',
      kb ? `知识库（优先据此回答，不要编造）：\n${kb}` : '',
      '客户要求转人工/找真人时 action 设为 TRANSFER；客户留下手机号等联系方式时 action 设为 COLLECT_LEAD 并把号码放入 slots.phone。',
      '只输出一个 JSON 对象，不要输出任何多余文字，格式：{"reply":"给客户的口语化回复","intentCode":"命中的意图编码或空字符串","action":"ANSWER|TRANSFER|COLLECT_LEAD","slots":{"phone":"","name":"","company":""},"confidence":0.0到1.0的数字}',
    ].filter(Boolean).join('\n\n');
  }

  async chat(input: Parameters<LlmPort['chat']>[0]): Promise<ChatResult> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const raw = await this.completion([
      { role: 'system', content: this.buildSystem(input) },
      ...input.messages.slice(-8),
      ...(lastUser ? [] : []),
    ]);
    let parsed: any = null;
    try {
      const jsonStr = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = null;
    }
    const userText = lastUser?.content || '';
    // 规则兜底：即便模型没按 JSON 输出，也保证转人工与手机号槽位不丢
    const localSlots = extractSlots(userText);
    const forceTransfer = wantsTransfer(userText);
    if (parsed && typeof parsed === 'object' && parsed.reply) {
      const slots = { ...localSlots, ...(parsed.slots || {}) };
      const action = forceTransfer ? 'TRANSFER' : (['ANSWER', 'TRANSFER', 'COLLECT_LEAD', 'SCRIPT'].includes(parsed.action) ? parsed.action : 'ANSWER');
      return { reply: String(parsed.reply), intentCode: parsed.intentCode || undefined, action: action as ChatResult['action'], slots, confidence: Number(parsed.confidence) || 0.8 };
    }
    return { reply: raw, action: forceTransfer ? 'TRANSFER' : 'ANSWER', slots: localSlots, confidence: 0.5 };
  }

  async summarize(turns: Parameters<LlmPort['summarize']>[0]) {
    if (!turns.length) return summarizeTurns(turns);
    const convo = turns.map((t) => `${t.speaker}：${t.text}`).join('\n');
    const raw = await this.completion([
      { role: 'system', content: '你是通话质检助手，依据对话输出 JSON：{"summary":"30~80字中文小结","nextActions":["后续动作1","后续动作2"],"sentiment":"正面|中性|负面"}，只输出 JSON。' },
      { role: 'user', content: convo },
    ], 0.2);
    try {
      const j = JSON.parse(raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim());
      return { summary: String(j.summary || ''), nextActions: Array.isArray(j.nextActions) ? j.nextActions.map(String) : [], sentiment: String(j.sentiment || '中性') };
    } catch {
      return summarizeTurns(turns);
    }
  }

  /** 连通性自检：一次最小对话，返回延迟与样例回复 */
  static async ping(code: string, creds: LlmCreds): Promise<{ latencyMs: number; sample: string; model: string }> {
    const llm = new OpenAiCompatLlm(code, creds);
    const start = Date.now();
    const out = await llm.chat({ messages: [{ role: 'user', content: '你好，请用一句话介绍你自己。' }], intents: [], knowledge: [] });
    return { latencyMs: Date.now() - start, sample: out.reply, model: llm.model };
  }
}
