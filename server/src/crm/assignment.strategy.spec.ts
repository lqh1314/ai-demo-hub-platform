import { selectAgent, predictiveDialCount, AgentCandidate } from './assignment.strategy';

const c = (userId: string, status: AgentCandidate['status'], load: number, skillLevel = 1): AgentCandidate => ({ userId, status, load, skillLevel });

describe('坐席派单策略 selectAgent', () => {
  test('无空闲坐席返回 null', () => {
    expect(selectAgent([c('a', 'BUSY', 1), c('b', 'ON_CALL', 1)], 'ROUND_ROBIN')).toBeNull();
  });

  test('轮询策略在空闲坐席间环形分配并推进 nextIndex', () => {
    const list = [c('a', 'IDLE', 0), c('b', 'BUSY', 9), c('c', 'ONLINE', 0)];
    const r1 = selectAgent(list, 'ROUND_ROBIN');
    expect(r1?.userId).toBe('a');
    const r2 = selectAgent(list, 'ROUND_ROBIN', { lastIndex: r1!.nextIndex });
    expect(r2?.userId).toBe('c');
    const r3 = selectAgent(list, 'ROUND_ROBIN', { lastIndex: r2!.nextIndex });
    expect(r3?.userId).toBe('a'); // 环形回到第一个空闲
  });

  test('最少负载策略选当前通话数最少、同级选技能高者', () => {
    const list = [c('a', 'IDLE', 3, 1), c('b', 'IDLE', 1, 2), c('c', 'IDLE', 1, 5)];
    expect(selectAgent(list, 'LEAST_LOAD')?.userId).toBe('c');
  });

  test('技能匹配策略优先满足等级，无人达标时降级到全部空闲', () => {
    const list = [c('a', 'IDLE', 0, 1), c('b', 'IDLE', 0, 4)];
    expect(selectAgent(list, 'SKILL_MATCH', { requiredSkill: 3 })?.userId).toBe('b');
    // 无人达到 5 级 -> 降级，按负载/技能选 b
    expect(selectAgent(list, 'SKILL_MATCH', { requiredSkill: 5 })?.userId).toBe('b');
  });
});

describe('预测式外呼 predictiveDialCount', () => {
  test('无空闲坐席不拨号', () => expect(predictiveDialCount(0, 1.5, 2)).toBe(0));
  test('扣除在拨数量并向上取整', () => {
    expect(predictiveDialCount(10, 1.2, 3)).toBe(9); // ceil(12)-3
    expect(predictiveDialCount(2, 1.0, 5)).toBe(0);  // 不会为负
  });
});
