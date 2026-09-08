import { create } from 'zustand';
import { http, api } from '../api/client';

export interface AuthUser {
  userId: string;
  username: string;
  realName: string;
  roleAlias: string;
  permissions: string[];
  deptId?: string | null;
  deptName?: string | null;
  [k: string]: any;
}

function normalize(u: any, permissions?: string[]): AuthUser {
  return { ...u, userId: u.userId || u.id, permissions: permissions || u.permissions || [] };
}

interface AuthState {
  user: AuthUser | null;
  loaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  can: (perm: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loaded: false,
  async login(username, password) {
    const data = await api<any>(http.post('/auth/login', { username, password }));
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    set({ user: normalize(data.user, data.permissions) });
  },
  logout() {
    localStorage.clear();
    set({ user: null });
  },
  async loadMe() {
    try {
      const me = await api<any>(http.get('/auth/me'));
      set({ user: normalize(me), loaded: true });
    } catch {
      set({ user: null, loaded: true });
    }
  },
  can(perm) {
    const u = get().user;
    if (!u) return false;
    if (u.permissions?.includes('*')) return true;
    return u.permissions?.includes(perm);
  },
}));
