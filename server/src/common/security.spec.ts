import { isPlaceholderSecret, missingProdSecrets, ctiAuthorize } from './security';

describe('安全纯函数（闸门 C Medium 修复回归）', () => {
  describe('isPlaceholderSecret', () => {
    it('空值/空白视为占位', () => {
      expect(isPlaceholderSecret(undefined)).toBe(true);
      expect(isPlaceholderSecret('   ')).toBe(true);
    });
    it('change-me/your-/xxx 示例值视为占位', () => {
      expect(isPlaceholderSecret('change-me-access-secret')).toBe(true);
      expect(isPlaceholderSecret('your-secret')).toBe(true);
      expect(isPlaceholderSecret('xxxxx')).toBe(true);
    });
    it('真实高强度密钥通过', () => {
      expect(isPlaceholderSecret('a9f3c1e7b2d4f608-strong-random')).toBe(false);
    });
  });

  describe('missingProdSecrets', () => {
    it('非生产环境不检查（返回空）', () => {
      expect(missingProdSecrets({ NODE_ENV: 'development' } as any)).toEqual([]);
    });
    it('生产环境列出所有缺失/占位的关键变量', () => {
      const env = {
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me',
        JWT_REFRESH_SECRET: '',
        CREDENTIAL_KEY: 'real-key',
        DATABASE_URL: 'postgresql://u:p@db/demo',
      } as any;
      expect(missingProdSecrets(env)).toEqual(['JWT_SECRET', 'JWT_REFRESH_SECRET']);
    });
    it('生产环境全部合规时返回空', () => {
      const env = {
        NODE_ENV: 'production',
        JWT_SECRET: 's1', JWT_REFRESH_SECRET: 's2', CREDENTIAL_KEY: 's3', DATABASE_URL: 'pg://x',
      } as any;
      expect(missingProdSecrets(env)).toEqual([]);
    });
  });

  describe('ctiAuthorize', () => {
    it('未配置密钥：非生产放行（离线演示）', () => {
      expect(ctiAuthorize({ provided: '', expected: undefined, isProd: false }).ok).toBe(true);
    });
    it('未配置密钥：生产拒绝并给出原因', () => {
      const r = ctiAuthorize({ provided: '', expected: undefined, isProd: true });
      expect(r).toEqual({ ok: false, reason: 'prod_missing_secret' });
    });
    it('已配置密钥：正确密钥通过', () => {
      expect(ctiAuthorize({ provided: 'abc123', expected: 'abc123', isProd: true }).ok).toBe(true);
    });
    it('错误密钥/长度不符拒绝', () => {
      expect(ctiAuthorize({ provided: 'wrong', expected: 'abc123', isProd: true })).toEqual({ ok: false, reason: 'bad_secret' });
      expect(ctiAuthorize({ provided: 'abc124', expected: 'abc123', isProd: true })).toEqual({ ok: false, reason: 'bad_secret' });
    });
  });
});
