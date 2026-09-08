import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService, JwtPayload } from './token.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const REQUIRED_PERMS = 'requiredPerms';
export const RequirePerm = (...perms: string[]) => SetMetadata(REQUIRED_PERMS, perms);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    if (isPublic) return true;
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '缺少访问令牌' });
    let payload: JwtPayload;
    try {
      payload = TokenService.verifyAccess(token);
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '访问令牌无效或已过期' });
    }
    req.user = payload;
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMS, [ctx.getHandler(), ctx.getClass()]) || [];
    if (required.length) {
      const ok = payload.roleAlias === 'ADMIN' || required.every((p) => payload.permissions?.includes(p) || payload.permissions?.includes('*'));
      if (!ok) throw new ForbiddenException({ code: 'FORBIDDEN', message: '权限不足' });
    }
    return true;
  }
}
