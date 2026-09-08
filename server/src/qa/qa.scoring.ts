export interface QaRuleInput {
  id: string;
  name: string;
  category?: string | null;
  /** 关键词 / 正则 / 话术 等，质检打分仅消费“关键词/正则”两类，其余按关键词处理 */
  type: 'KEYWORD' | 'REGEX' | 'SCRIPT' | 'SILENCE' | 'EMOTION' | 'SPEED' | string;
  pattern: string[];
  weight: number;
  /** true=必达项（必须命中，否则扣分）；false=禁忌项（命中即扣分） */
  mustHit: boolean;
}
export interface QaSegInput { speaker: string; text: string }
export interface QaHit { ruleId: string; ruleName: string; category?: string | null; passed: boolean; matchedText?: string; deduct: number }
export interface QaResult { score: number; level: '优秀' | '合格' | '待改进' | '不合格'; hits: QaHit[]; violations: number }

/** 纯函数质检打分：必达项未命中扣分、禁忌项命中扣分，满分 100 */
export function scoreCall(segments: QaSegInput[], rules: QaRuleInput[]): QaResult {
  // 服务规范针对我方话术（机器人/坐席）
  const agentText = segments.filter((s) => s.speaker === 'AGENT' || s.speaker === 'BOT').map((s) => s.text).join('\n');
  const hits: QaHit[] = [];
  let deduct = 0;
  for (const r of rules) {
    let matched = false;
    let matchedText = '';
    for (const p of r.pattern || []) {
      if (!p) continue;
      let hit = false;
      if (r.type === 'REGEX') {
        try { hit = new RegExp(p, 'i').test(agentText); } catch { hit = false; }
      } else {
        hit = agentText.includes(p);
      }
      if (hit) { matched = true; matchedText = p; break; }
    }
    const passed = r.mustHit ? matched : !matched;
    const d = passed ? 0 : Number(r.weight) || 0;
    if (!passed) deduct += d;
    hits.push({ ruleId: r.id, ruleName: r.name, category: r.category, passed, matchedText: matchedText || undefined, deduct: d });
  }
  const score = Math.max(0, Math.min(100, 100 - deduct));
  const level: QaResult['level'] = score >= 90 ? '优秀' : score >= 75 ? '合格' : score >= 60 ? '待改进' : '不合格';
  return { score, level, hits, violations: hits.filter((h) => !h.passed).length };
}
