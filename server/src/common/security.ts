/**
 * 安全纯函数（无 Nest/IO 依赖，便于单测回归）。
 * 闸门 C Medium 修复：生产密钥闸门 + CTI 回调密钥判定。
 */

/** 判断一个环境变量值是否缺失或仍是示例占位 */
export function isPlaceholderSecret(v: string | undefined): boolean {
  const s = String(v ?? '').trim();
  return !s || s.includes('change-me') || s.includes('your-') || s.includes('xxx');
}

/**
 * 生产环境关键密钥检查：仅在 isProd 时生效。
 * 返回仍不合规的变量名列表（空数组表示通过）。
 */
export function missingProdSecrets(env: NodeJS.ProcessEnv, keys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CREDENTIAL_KEY', 'DATABASE_URL']): string[] {
  if (env.NODE_ENV !== 'production') return [];
  return keys.filter((k) => isPlaceholderSecret(env[k]));
}

export interface CtiAuthInput {
  /** 请求方提供的密钥（header/query） */
  provided: string;
  /** 服务端配置的 CTI_WEBHOOK_SECRET（未配置为 undefined） */
  expected: string | undefined;
  isProd: boolean;
}
export interface CtiAuthResult {
  ok: boolean;
  /** 拒绝原因，ok=true 时为 undefined */
  reason?: 'prod_missing_secret' | 'bad_secret';
}

/**
 * CTI 回调授权判定（常量时间比较由调用方完成，这里只做策略与长度预判）：
 * - 未配置 expected：生产拒绝，非生产放行（离线演示）；
 * - 已配置 expected：provided 必须等长且逐字节一致。
 */
export function ctiAuthorize({ provided, expected, isProd }: CtiAuthInput): CtiAuthResult {
  if (!expected) return isProd ? { ok: false, reason: 'prod_missing_secret' } : { ok: true };
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, reason: 'bad_secret' };
  // 逐字节比较（长度相等前提下），避免提前返回泄露长度之外的信息
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? { ok: true } : { ok: false, reason: 'bad_secret' };
}
