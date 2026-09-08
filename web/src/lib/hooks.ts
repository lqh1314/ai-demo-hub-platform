import { useQuery } from '@tanstack/react-query';
import { http, api } from '../api/client';

/** 分页列表查询：后端返回 {list,total,page,pageSize} */
export function usePaged(key: any[], url: string, params: Record<string, any> = {}, opts: { enabled?: boolean } = {}) {
  const q = useQuery({
    queryKey: [key, params],
    enabled: opts.enabled !== false,
    queryFn: () => api<any>(http.get(url, { params })),
  });
  return { ...q, rows: (q.data?.list ?? q.data ?? []) as any[], total: (q.data?.total ?? 0) as number };
}

export function useOnce<T = any>(key: any[], url: string, params?: Record<string, any>, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T>({
    queryKey: [key, params],
    enabled: opts.enabled !== false,
    refetchInterval: opts.refetchInterval,
    queryFn: () => api<T>(http.get(url, { params })),
  });
}
