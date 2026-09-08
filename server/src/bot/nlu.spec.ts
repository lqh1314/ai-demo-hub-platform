import {
  overlapScore, matchIntent, matchKnowledge, extractSlots, wantsTransfer,
  detectIntentLevel, decideTurn, summarizeTurns,
} from './nlu';

describe('NLU 纯函数', () => {
  test('overlapScore 统计命中关键词', () => {
    const r = overlapScore('我想了解价格和功能', ['价格', '功能', '售后']);
    expect(r.hit).toBe(2);
    expect(r.words).toEqual(['价格', '功能']);
  });

  test('matchIntent 取命中关键词最多的意图', () => {
    const intents = [
      { code: 'A', name: '甲', keywords: ['售后'] },
      { code: 'B', name: '乙', keywords: ['价格', '报价'] },
    ];
    expect(matchIntent('请问价格和报价', intents)?.code).toBe('B');
    expect(matchIntent('无关内容', intents)).toBeNull();
  });

  test('matchKnowledge 命中知识库', () => {
    const kb = [{ q: '收费?', a: '按年订阅', keywords: ['收费', '价格'] }];
    expect(matchKnowledge('怎么收费', kb)?.a).toBe('按年订阅');
  });

  test('extractSlots 抽取手机号/公司/称呼', () => {
    const s = extractSlots('我姓李，来自星河制造有限公司，手机13912345678');
    expect(s.phone).toBe('13912345678');
    expect(s.company).toContain('星河制造有限公司');
    expect(s.name).toBe('李');
    expect(extractSlots('你好').phone).toBeUndefined();
  });

  test('wantsTransfer 识别转人工诉求', () => {
    expect(wantsTransfer('我要找真人')).toBe(true);
    expect(wantsTransfer('转人工客服')).toBe(true);
    expect(wantsTransfer('随便看看产品', ['客户经理'])).toBe(false);
  });

  test('detectIntentLevel 强意向/中意向/未知', () => {
    expect(detectIntentLevel('这个多少钱，想购买')).toBe('HIGH');
    expect(detectIntentLevel('有点感兴趣想了解')).toBe('MID');
    expect(detectIntentLevel('嗯嗯')).toBe('UNKNOWN');
  });

  test('decideTurn 优先级：转人工 > 意图 > 知识库 > 留资 > 兜底', () => {
    const intents = [{ code: 'PRICE', name: '价格咨询', keywords: ['价格'], action: 'COLLECT_LEAD', answer: '请留手机号' }];
    const kb = [{ q: '规模', a: '支持200+坐席', keywords: ['坐席', '规模'] }];
    // 转人工最高优先
    expect(decideTurn({ text: '找人工', intents, knowledge: kb, fallback: 'fb' }).action).toBe('TRANSFER');
    // 命中意图
    const t2 = decideTurn({ text: '价格多少', intents, knowledge: kb, fallback: 'fb' });
    expect(t2.action).toBe('COLLECT_LEAD');
    expect(t2.intentCode).toBe('PRICE');
    // 命中知识库
    expect(decideTurn({ text: '支持多少坐席规模', intents: [], knowledge: kb, fallback: 'fb' }).action).toBe('ANSWER');
    // 抽到槽位 -> 收集线索
    const t4 = decideTurn({ text: '我电话13800001111', intents: [], knowledge: [], fallback: 'fb' });
    expect(t4.action).toBe('COLLECT_LEAD');
    expect(t4.slots.phone).toBe('13800001111');
    // 兜底转人工
    expect(decideTurn({ text: '啊', intents: [], knowledge: [], fallback: 'fb' })).toMatchObject({ action: 'TRANSFER', reply: 'fb' });
  });

  test('summarizeTurns 输出小结/后续动作/情绪', () => {
    const r = summarizeTurns([
      { speaker: 'CUSTOMER', text: '这个多少钱，想购买试用' },
      { speaker: 'AGENT', text: '为您介绍' },
    ]);
    expect(r.intentLevel).toBe('HIGH');
    expect(r.sentiment).toBe('积极');
    expect(r.nextActions.length).toBeGreaterThan(0);
    expect(r.summary).toContain('2轮');
    const neg = summarizeTurns([{ speaker: 'CUSTOMER', text: '我要投诉，太差了' }]);
    expect(neg.sentiment).toBe('负面');
  });
});
