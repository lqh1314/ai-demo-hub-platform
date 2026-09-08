import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantStore } from './tenant.context';

/** 将 req.user 注入 AsyncLocalStorage，业务层/仓储层据此强制租户隔离 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly store: TenantStore) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const u = req.user;
    if (!u) return next.handle(); // public 路由由控制器自行建立系统上下文
    return this.store.run(
      {
        tenantId: u.tenantId,
        userId: u.sub,
        realName: u.realName,
        roleAlias: u.roleAlias,
        permissions: u.permissions || [],
        deptId: u.deptId,
      },
      () => next.handle(),
    );
  }
}
