/** 全局常量：默认单租户（数据层已预留 tenant_id 多租户） */
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
export const BCRYPT_COST = 10;
export const REDIS_KEY = {
  agentStatus: (t: string, id: string) => `presence:${t}:agent:${id}:status`,
  groupIdle: (t: string, g: string) => `presence:${t}:group:${g}:idle`, // zset agent->当前会话数
  agentLoad: (t: string) => `presence:${t}:load`, // zset agent->通话数
};
