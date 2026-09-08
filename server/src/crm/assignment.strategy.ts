/** 纯函数：坐席派单选择策略，无外部依赖、可单测 */

export type AgentStatusCn = 'OFFLINE' | 'ONLINE' | 'IDLE' | 'BUSY' | 'ON_CALL' | 'AFTER' | 'BREAK';
export interface AgentCandidate {
  userId: string;
  status: AgentStatusCn;
  load: number; // 当前进行通话数
  skillLevel: number; // 1-5
}
export type StrategyCn = 'ROUND_ROBIN' | 'LEAST_LOAD' | 'SKILL_MATCH';

export function isIdle(a: AgentCandidate): boolean {
  return a.status === 'IDLE' || a.status === 'ONLINE';
}

/**
 * 选择坐席。
 * @param lastIndex 上一次轮询位置（轮询策略用），调用方持久化
 * @param requiredSkill 技能匹配策略需要的最低技能等级
 */
export function selectAgent(
  candidates: AgentCandidate[],
  strategy: StrategyCn,
  opts: { lastIndex?: number; requiredSkill?: number } = {},
): { userId: string; nextIndex: number } | null {
  const idle = candidates.filter(isIdle);
  if (!idle.length) return null;

  if (strategy === 'LEAST_LOAD') {
    const sorted = [...idle].sort((a, b) => a.load - b.load || b.skillLevel - a.skillLevel);
    return { userId: sorted[0].userId, nextIndex: opts.lastIndex ?? 0 };
  }

  if (strategy === 'SKILL_MATCH') {
    const minSkill = opts.requiredSkill ?? 1;
    const skilled = idle.filter((a) => a.skillLevel >= minSkill);
    const pool = skilled.length ? skilled : idle; // 无人满足技能时降级到全部空闲
    const sorted = [...pool].sort((a, b) => a.load - b.load || b.skillLevel - a.skillLevel);
    return { userId: sorted[0].userId, nextIndex: opts.lastIndex ?? 0 };
  }

  // 轮询：从上一次位置之后环形取下一个空闲坐席
  const start = ((opts.lastIndex ?? -1) + 1) % idle.length;
  const chosen = idle[start];
  return { userId: chosen.userId, nextIndex: start };
}

/** 预测式外呼：根据空闲坐席数与平均通话/后处理时长计算本轮应拨数量（Abad 率控制） */
export function predictiveDialCount(freeAgents: number, ratio: number, dialingInProgress: number): number {
  if (freeAgents <= 0) return 0;
  const target = Math.ceil(freeAgents * ratio) - dialingInProgress;
  return Math.max(0, target);
}
