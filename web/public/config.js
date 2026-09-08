/**
 * 运行时配置（部署后可直接改本文件并刷新，无需重新打包前端）。
 * - 同源部署（nginx 反代 /api）：保持 apiBase: '/api/v1'、wsOrigin 留空即可。
 * - 前后端分离：把 apiBase 改为后端真实域名，例如 'https://api.your-domain.com/api/v1'，
 *   wsOrigin 改为 'https://api.your-domain.com'（用于实时坐席通道，必须与后端 CORS 白名单一致）。
 * 本文件必须在应用 JS 之前加载（见 index.html）。
 */
window.__APP_CONFIG__ = {
  apiBase: '/api/v1',
  wsOrigin: '',
};
