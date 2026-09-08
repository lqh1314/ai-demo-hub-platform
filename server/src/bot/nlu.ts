/** 纯函数 NLU：沙箱大模型的规则化实现，也是真实 LLM 不可用时的兜底；无副作用、可单测 */

export interface IntentRef { code: string; name: string; keywords: string[]; answer?: string | null; action?: string; targetGroupId?: string | null }
export interface KbRef { q: string; a: string; keywords: string[] }

export function overlapScore(text: string, keywords: string[]): { hit: number; words: string[] } {
  const words: string[] = [];
  for (const k of keywords || []) {
    if (k && text.includes(k.trim())) words.push(k.trim());
  }
  return { hit: words.length, words };
}

export function matchIntent(text: string, intents: IntentRef[]): IntentRef | null {
  let best: IntentRef | null = null;
  let bestHit = 0;
  for (const it of intents) {
    const { hit } = overlapScore(text, it.keywords);
    if (hit > bestHit) { bestHit = hit; best = it; }
  }
  return bestHit > 0 ? best : null;
}

export function matchKnowledge(text: string, kb: KbRef[]): KbRef | null {
  let best: KbRef | null = null;
  let bestHit = 0;
  for (const k of kb) {
    const { hit } = overlapScore(text, k.keywords);
    if (hit > bestHit) { bestHit = hit; best = k; }
  }
  return bestHit > 0 ? best : null;
}

/** 抽取留资槽位：手机号、公司、姓氏/称呼 */
export function extractSlots(text: string): Record<string, string> {
  const slots: Record<string, string> = {};
  const phone = text.match(/(?:\+?86)?1[3-9]\d{9}/);
  if (phone) slots.phone = phone[0];
  const company = text.match(/([一-龥A-Za-z0-9（）()]{2,20}(?:公司|集团|有限|科技|工作室))/);
  if (company) slots.company = company[1];
  const name = text.match(/(?:我姓|我叫|称呼我)([一-龥]{1,4})(?:先生|女士|老师|总)?/);
  if (name) slots.name = name[1];
  return slots;
}

const TRANSFER_WORDS = ['人工', '转人工', '真人', '客服', '找顾问', '工作人员'];
export function wantsTransfer(text: string, transferKeywords: string[] = []): boolean {
  return [...TRANSFER_WORDS, ...transferKeywords].some((w) => w && text.includes(w));
}

const POSITIVE = ['感兴趣', '想了解', '多少钱', '价格', '费用', '怎么收费', '试用', '演示', 'demo', '报价', '购买', '开通', '合作'];
export function detectIntentLevel(text: string): 'HIGH' | 'MID' | 'LOW' | 'UNKNOWN' {
  const strong = ['多少钱', '报价', '购买', '开通', '合作', '试用', '签'];
  if (strong.some((w) => text.includes(w))) return 'HIGH';
  if (POSITIVE.some((w) => text.toLowerCase().includes(w.toLowerCase()))) return 'MID';
  return 'UNKNOWN';
}

export interface TurnInput {
  text: string;
  intents: IntentRef[];
  knowledge: KbRef[];
  fallback: string;
  transferKeywords?: string[];
}
export interface TurnOutput {
  reply: string;
  intentCode?: string;
  intentName?: string;
  action: 'ANSWER' | 'TRANSFER' | 'COLLECT_LEAD' | 'SCRIPT';
  slots: Record<string, string>;
  confidence: number;
}

/** 一轮对话决策：转人工 > 命中意图 > 命中知识库 > 收集线索 > 兜底 */
export function decideTurn(input: TurnInput): TurnOutput {
  const text = (input.text || '').trim();
  const slots = extractSlots(text);
  if (wantsTransfer(text, input.transferKeywords)) {
    return { reply: '好的，正在为您转接专属顾问，请稍等。', action: 'TRANSFER', slots, confidence: 0.99 };
  }
  const intent = matchIntent(text, input.intents);
  if (intent) {
    const action = (intent.action as TurnOutput['action']) || 'ANSWER';
    return {
      reply: intent.answer || `已为您记录「${intent.name}」相关需求，稍后由顾问为您详细解答。`,
      intentCode: intent.code,
      intentName: intent.name,
      action,
      slots,
      confidence: 0.86,
    };
  }
  const kb = matchKnowledge(text, input.knowledge);
  if (kb) return { reply: kb.a, action: 'ANSWER', slots, confidence: 0.78 };
  if (Object.keys(slots).length >= 1) {
    return { reply: '感谢您的信息，我已记录。为了更好地为您安排顾问，可以再说下您最关注的功能吗？', action: 'COLLECT_LEAD', slots, confidence: 0.7 };
  }
  return { reply: input.fallback, action: 'TRANSFER', slots, confidence: 0.3 };
}

/** 根据逐句转写生成结构化小结（沙箱：抽取式） */
export function summarizeTurns(turns: { speaker: string; text: string }[]) {
  const customerText = turns.filter((t) => t.speaker === 'CUSTOMER').map((t) => t.text).join(' ');
  const level = detectIntentLevel(customerText);
  const kw = ['价格', '功能', '集成', '试用', '合同', '部署', '培训', '售后'];
  const focus = kw.filter((k) => customerText.includes(k));
  const summary = `客户围绕${focus.length ? focus.join('、') : '产品整体'}进行咨询，意向等级${level}，共对话${turns.length}轮。`;
  const nextActions = level === 'HIGH' ? ['1个工作日内由顾问跟进报价', '发送产品资料与案例'] : ['发送产品介绍', '后续二次跟进'];
  const sentiment = /(投诉|差|生气|骗|退)/.test(customerText) ? '负面' : level === 'HIGH' ? '积极' : '中性';
  return { summary, nextActions, sentiment, intentLevel: level, focus };
}
