import { AsyncLocalStorage } from 'async_hooks';

export interface AuthContext {
  tenantId: string;
  userId: string;
  realName: string;
  roleAlias: string;
  permissions: string[];
  deptId?: string | null;
}

/** 全链路租户/用户上下文（AsyncLocalStorage），Repository 强制带 tenantId */
export class TenantStore {
  private readonly als = new AsyncLocalStorage<AuthContext>();
  run<T>(ctx: AuthContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }
  get(): AuthContext | undefined {
    return this.als.getStore();
  }
  get tenantId(): string {
    const c = this.als.getStore();
    if (!c) throw new Error('缺少租户上下文');
    return c.tenantId;
  }
  get user(): AuthContext {
    const c = this.als.getStore();
    if (!c) throw new Error('缺少用户上下文');
    return c;
  }
  hasPerm(code: string): boolean {
    const c = this.als.getStore();
    if (!c) return false;
    if (c.roleAlias === 'ADMIN') return true;
    return c.permissions.includes(code) || c.permissions.includes('*');
  }
}
