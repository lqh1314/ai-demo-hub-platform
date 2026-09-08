import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { BizException } from '../common/biz.exception';
import { TokenService } from '../common/token.service';
import { RbacService } from './rbac.service';
import { LoginDto } from './dto';
import { BCRYPT_COST } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private rbac: RbacService) {}

  private publicUser(u: any) {
    return {
      id: u.id, username: u.username, realName: u.realName, roleAlias: u.roleAlias,
      deptId: u.deptId, mobile: u.mobile, email: u.email, avatarUrl: u.avatarUrl, jobNo: u.jobNo, status: u.status,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { username: dto.username, deletedAt: null } });
    if (!user) throw BizException.unauthorized('账号或密码错误');
    if (user.status === 'DISABLED') throw BizException.forbidden('账号已停用，请联系管理员');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw BizException.forbidden('登录失败次数过多，账号已临时锁定');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const failCount = user.failCount + 1;
      const lockedUntil = failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await this.prisma.user.update({ where: { id: user.id }, data: { failCount, lockedUntil } });
      throw BizException.unauthorized(`账号或密码错误${failCount >= 5 ? '，账号锁定15分钟' : `（剩余${5 - failCount}次）`}`);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const permissions = this.rbac.permissionsOf(user.roleAlias);
    const payload = { sub: user.id, tenantId: user.tenantId, realName: user.realName, roleAlias: user.roleAlias, permissions, deptId: user.deptId };
    return {
      accessToken: TokenService.signAccess(payload),
      refreshToken: TokenService.signRefresh(payload),
      permissions,
      user: this.publicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    let decoded: { sub: string };
    try { decoded = TokenService.verifyRefresh(refreshToken); } catch { throw BizException.unauthorized('刷新令牌无效'); }
    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || user.status === 'DISABLED') throw BizException.unauthorized('用户不可用');
    const permissions = this.rbac.permissionsOf(user.roleAlias);
    const payload = { sub: user.id, tenantId: user.tenantId, realName: user.realName, roleAlias: user.roleAlias, permissions, deptId: user.deptId };
    return { accessToken: TokenService.signAccess(payload), refreshToken: TokenService.signRefresh(payload), permissions };
  }

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { dept: true } });
    if (!u) throw BizException.notFound('用户不存在');
    return { ...this.publicUser(u), permissions: this.rbac.permissionsOf(u.roleAlias), deptName: u.dept?.name };
  }

  async hashPassword(raw: string) { return bcrypt.hash(raw || 'Aihub@123456', BCRYPT_COST); }
}
