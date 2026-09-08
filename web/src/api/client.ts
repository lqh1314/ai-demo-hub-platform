import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import { RUNTIME } from '../lib/runtime-config';

const BASE = RUNTIME.apiBase;

export const http = axios.create({ baseURL: BASE, timeout: 20000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let refreshing: Promise<string> | null = null;
async function refreshAccess(): Promise<string> {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) throw new Error('no refresh token');
  const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt });
  localStorage.setItem('access_token', data.accessToken);
  localStorage.setItem('refresh_token', data.refreshToken);
  return data.accessToken;
}

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<any>) => {
    const cfg: any = err.config;
    if (err.response?.status === 401 && !cfg?._retry && !cfg?.url?.includes('auth/')) {
      cfg._retry = true;
      try {
        refreshing = refreshing || refreshAccess();
        const at = await refreshing;
        refreshing = null;
        cfg.headers.Authorization = `Bearer ${at}`;
        return http(cfg);
      } catch {
        refreshing = null;
        localStorage.clear();
        if (location.pathname !== '/login') location.href = '/login';
      }
    }
    const msg = (err.response?.data as any)?.message || err.message || '请求失败';
    if (!cfg?.silent) message.error(Array.isArray(msg) ? msg.join('；') : String(msg));
    return Promise.reject(err);
  },
);

// 统一解包：分页接口返回 {list,total,page,pageSize}，其余直接返回 data
export async function api<T = any>(p: Promise<{ data: T }>): Promise<T> {
  const r = await p;
  return r.data;
}
