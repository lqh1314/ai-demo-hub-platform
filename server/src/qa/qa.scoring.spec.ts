import { scoreCall, QaRuleInput, QaSegInput } from './qa.scoring';

const seg = (speaker: string, text: string): QaSegInput => ({ speaker, text });
const rule = (r: Partial<QaRuleInput> & Pick<QaRuleInput, 'id' | 'name'>): QaRuleInput => ({
  type: 'KEYWORD', pattern: [], weight: 5, mustHit: false, ...r,
});

describe('智能质检打分 scoreCall', () => {
  const goodCall = [seg('BOT', '您好，很高兴为您服务'), seg('AGENT', '感谢您的咨询，祝您生活愉快，再见')];

  test('必达项命中不扣分', () => {
    const rules = [
      rule({ id: 'r1', name: '开场', mustHit: true, weight: 10, pattern: ['您好'] }),
      rule({ id: 'r2', name: '结束语', mustHit: true, weight: 10, pattern: ['再见'] }),
    ];
    const r = scoreCall(goodCall, rules);
    expect(r.score).toBe(100);
    expect(r.violations).toBe(0);
    expect(r.level).toBe('优秀');
  });

  test('必达项缺失按权重扣分', () => {
    const rules = [rule({ id: 'r1', name: '开场', mustHit: true, weight: 20, pattern: ['不存在的话术'] })];
    const r = scoreCall(goodCall, rules);
    expect(r.score).toBe(80);
    expect(r.violations).toBe(1);
    expect(r.hits[0].passed).toBe(false);
  });

  test('禁忌项命中即扣分，未命中不扣', () => {
    const rules = [
      rule({ id: 'b1', name: '禁语', mustHit: false, weight: 30, pattern: ['不知道'] }),
    ];
    expect(scoreCall([seg('AGENT', '这个我不知道')], rules).score).toBe(70);
    expect(scoreCall(goodCall, rules).score).toBe(100);
  });

  test('只评估我方（机器人/坐席）话术，客户文本不计入', () => {
    const rules = [rule({ id: 'b1', name: '禁语', mustHit: false, weight: 50, pattern: ['不知道'] })];
    const r = scoreCall([seg('CUSTOMER', '你们是不是不知道怎么做')], rules);
    expect(r.score).toBe(100);
  });

  test('正则规则可命中，非法正则安全降级', () => {
    const rules = [
      rule({ id: 're', name: '工号', type: 'REGEX', mustHit: true, weight: 15, pattern: ['工号\\d{3,}'] }),
      rule({ id: 'bad', name: '坏正则', type: 'REGEX', mustHit: false, weight: 10, pattern: ['('] }),
    ];
    const r = scoreCall([seg('AGENT', '我的工号10086为您服务')], rules);
    expect(r.hits.find((h) => h.ruleId === 're')?.passed).toBe(true);
    // 非法正则不命中禁忌项 => passed(true)，不扣分
    expect(r.hits.find((h) => h.ruleId === 'bad')?.passed).toBe(true);
  });

  test('扣分封顶 0、等级分档正确', () => {
    const rules = [
      rule({ id: 'a', name: 'a', mustHit: true, weight: 80, pattern: ['x'] }),
      rule({ id: 'b', name: 'b', mustHit: false, weight: 80, pattern: ['您好'] }),
    ];
    expect(scoreCall(goodCall, rules).score).toBe(0);
    expect(scoreCall(goodCall, rules).level).toBe('不合格');
  });
});
