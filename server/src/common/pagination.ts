export interface PageQuery { page?: number; pageSize?: number; sort?: string; order?: 'asc'|'desc'; q?: string; }
export interface PageResult<T> { list: T[]; total: number; page: number; pageSize: number; }

export function parsePage(q: PageQuery) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function pageResult<T>(list: T[], total: number, page: number, pageSize: number): PageResult<T> {
  return { list, total, page, pageSize };
}

/** 排序白名单，防止注入字段名 */
export function safeOrder(sort: string | undefined, allow: string[], def: Record<string, 'asc'|'desc'> = { createdAt: 'desc' }) {
  if (sort && allow.includes(sort)) return { [sort]: 'desc' as const };
  return def;
}
