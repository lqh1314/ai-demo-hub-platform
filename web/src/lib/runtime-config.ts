/**
 * 运行时配置：同一套构建产物可在部署时通过 /config.js 指定后端域名，无需重新 build。
 * 优先级：window.__APP_CONFIG__（部署期 config.js）> 构建期 VITE_* 环境变量 > 同源默认。
 */
export interface AppRuntimeConfig {
  /** REST 前缀，例如 https://api.example.com/api/v1；同源部署用 /api/v1 */
  apiBase?: string;
  /** Socket.IO 来源 origin，例如 https://api.example.com；同源留空 */
  wsOrigin?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig;
  }
}

function trimSlash(s?: string): string | undefined {
  const v = (s || '').trim();
  return v.endsWith('/') ? v.slice(0, -1) : v || undefined;
}

/** 从 apiBase 推导后端 origin（去掉末尾 /api/v1），用于跨域 Socket 连接 */
function originOfApi(apiBase: string): string | undefined {
  try {
    const u = new URL(apiBase);
    return u.origin;
  } catch {
    return undefined; // 相对路径（同源）
  }
}

const cfg = (typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined) || {};

const ENV_API = trimSlash((import.meta as any).env?.VITE_API_BASE as string | undefined);
const ENV_WS = trimSlash((import.meta as any).env?.VITE_WS_ORIGIN as string | undefined);

export const RUNTIME: Required<Pick<AppRuntimeConfig, 'apiBase'>> & { wsOrigin?: string } = {
  apiBase: trimSlash(cfg.apiBase) || ENV_API || '/api/v1',
  wsOrigin: trimSlash(cfg.wsOrigin) || ENV_WS || originOfApi(trimSlash(cfg.apiBase) || ENV_API || ''),
};
