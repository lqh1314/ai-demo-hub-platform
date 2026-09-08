import { Injectable } from '@nestjs/common';

/** 内置角色权限矩阵；管理员通配，主管按团队管理，坐席按自身业务。可与库内角色权限叠加 */
const PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: ['*'],
  MANAGER: [
    'crm:read', 'crm:write', 'crm:assign', 'crm:convert',
    'call:read', 'call:operate', 'outbound:read', 'outbound:write',
    'bot:read', 'qa:read', 'qa:review', 'contract:read', 'contract:write',
    'message:read', 'message:write', 'report:read', 'presence:read',
  ],
  AGENT: [
    'crm:read', 'crm:write', 'crm:convert',
    'call:read', 'call:operate', 'outbound:read',
    'bot:read', 'qa:read', 'contract:read', 'message:read', 'presence:read',
  ],
};

export const ROLE_LABEL: Record<string, string> = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', AGENT: 'AGENT' };
/** 数据库角色枚举为中文（管理员/主管/坐席），统一归一到内部英文键 */
const ROLE_CN2KEY: Record<string, 'ADMIN' | 'MANAGER' | 'AGENT'> = { 管理员: 'ADMIN', 主管: 'MANAGER', 坐席: 'AGENT' };
export function normalizeRole(role?: string | null): 'ADMIN' | 'MANAGER' | 'AGENT' {
  if (!role) return 'AGENT';
  return ROLE_CN2KEY[role] || (role as 'ADMIN' | 'MANAGER' | 'AGENT');
}

@Injectable()
export class RbacService {
  permissionsOf(roleAlias: string): string[] {
    return PERMISSION_MAP[normalizeRole(roleAlias)] || PERMISSION_MAP.AGENT;
  }
  can(roleAlias: string, perm: string): boolean {
    const set = this.permissionsOf(roleAlias);
    return set.includes('*') || set.includes(perm);
  }
  /** 数据范围：管理员看全租户，主管看本部门及下级，坐席看自己 */
  dataScope(roleAlias: string, userId: string, deptId?: string | null) {
    const key = normalizeRole(roleAlias);
    if (key === 'ADMIN') return { all: true as const };
    if (key === 'MANAGER') return { all: false as const, deptId: deptId || null, includeSub: true };
    return { all: false as const, ownerId: userId };
  }
}
