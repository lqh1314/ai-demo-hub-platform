import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { TenantStore } from '../common/tenant.context';
import { BizException } from '../common/biz.exception';
import { parsePage, pageResult } from '../common/pagination';
import { CreateUserDto, UpdateUserDto, DeptDto, SkillGroupDto } from './dto';
import { BCRYPT_COST } from '../common/constants';

@Injectable()
export class IamService {
  constructor(private prisma: PrismaService, private store: TenantStore) {}
  private t() { return this.store.tenantId; }

  async listUsers(q: any) {
    const { skip, take, page, pageSize } = parsePage(q);
    const where: any = { tenantId: this.t(), deletedAt: null };
    if (q.kw) where.OR = [{ realName: { contains: q.kw } }, { username: { contains: q.kw } }, { mobile: { contains: q.kw } }];
    if (q.roleAlias) where.roleAlias = q.roleAlias;
    if (q.deptId) where.deptId = q.deptId;
    const [list, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { dept: true } }),
      this.prisma.user.count({ where }),
    ]);
    return pageResult(list.map(({ passwordHash, ...rest }: any) => rest), total, page, pageSize);
  }

  async createUser(dto: CreateUserDto) {
    const tenantId = this.t();
    const exists = await this.prisma.user.findFirst({ where: { tenantId, username: dto.username } });
    if (exists) throw BizException.conflict('登录账号已存在');
    const passwordHash = await bcrypt.hash(dto.password || 'Aihub@123456', BCRYPT_COST);
    return this.prisma.user.create({
      data: {
        tenantId, username: dto.username, realName: dto.realName, passwordHash,
        deptId: dto.deptId, mobile: dto.mobile, email: dto.email, jobNo: dto.jobNo,
        roleAlias: (dto.roleAlias as any) || 'AGENT', status: 'ACTIVE',
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    const data: any = {
      realName: dto.realName, deptId: dto.deptId, mobile: dto.mobile, email: dto.email,
      roleAlias: dto.roleAlias as any, status: dto.status as any,
    };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    return this.prisma.user.update({ where: { id }, data });
  }
  async deleteUser(id: string) { await this.ensureExists(id); await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISABLED' } }); return { ok: true }; }
  private async ensureExists(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, tenantId: this.t() } });
    if (!u) throw BizException.notFound('用户不存在');
  }

  async listDepts() {
    const list = await this.prisma.dept.findMany({ where: { tenantId: this.t(), deletedAt: null }, orderBy: { sort: 'asc' } });
    return list;
  }
  async createDept(dto: DeptDto) {
    return this.prisma.dept.create({ data: { tenantId: this.t(), name: dto.name, parentId: dto.parentId || null } });
  }

  async listSkillGroups() {
    return this.prisma.skillGroup.findMany({
      where: { tenantId: this.t(), deletedAt: null },
      orderBy: { priority: 'desc' },
      include: { _count: { select: { members: true } } },
    });
  }
  async createSkillGroup(dto: SkillGroupDto) {
    const g = await this.prisma.skillGroup.create({
      data: {
        tenantId: this.t(), name: dto.name,
        strategy: (({ ROUND_ROBIN: 'ROUND_ROBIN', LEAST_LOAD: 'LEAST_LOAD', SKILL_MATCH: 'SKILL_MATCH' } as any)[dto.strategy || 'ROUND_ROBIN']),
      },
    });
    if (dto.memberIds?.length) {
      await this.prisma.skillGroupMember.createMany({ data: dto.memberIds.map((userId) => ({ groupId: g.id, userId })) });
    }
    return g;
  }
  async setGroupMembers(id: string, memberIds: string[]) {
    await this.prisma.skillGroupMember.deleteMany({ where: { groupId: id } });
    if (memberIds.length) await this.prisma.skillGroupMember.createMany({ data: memberIds.map((userId) => ({ groupId: id, userId })) });
    return { ok: true, count: memberIds.length };
  }
  async groupMembers(id: string) {
    const rows = await this.prisma.skillGroupMember.findMany({ where: { groupId: id } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
    return users.map(({ passwordHash, ...rest }: any) => rest);
  }
}
