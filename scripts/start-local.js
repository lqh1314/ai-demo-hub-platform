/* eslint-disable */
/**
 * 免 Docker 本地一键编排（Node 直接运行，无需安装 PostgreSQL/Redis）
 *  1) 启动程序内置 PostgreSQL（embedded-postgres，数据落在 .local-pgdata，可重复启动）
 *     —— 若已设置外部 DATABASE_URL，则直接使用外部库，跳过内置库
 *  2) prisma migrate deploy + 幂等种子
 *  3) 启动后端 API（3000，内存缓存，无需 Redis）
 *  4) 启动前端静态预览（WEB_PORT，默认 8080），就绪后自动打开浏览器
 * 退出时自动回收全部子进程与内置数据库。
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const WEB = path.join(ROOT, 'web');
const PG_PORT = Number(process.env.LOCAL_PG_PORT || 5433);
const API_PORT = Number(process.env.PORT || 3000);
const WEB_PORT = Number(process.env.WEB_PORT || 8080);
const LLM_PORT = Number(process.env.LOCAL_LLM_PORT || 3100);
const DB_NAME = 'aihub';
const DB_URL = `postgresql://aihub:aihub_dev_2026@127.0.0.1:${PG_PORT}/${DB_NAME}?schema=public`;

const log = (tag, msg) => console.log(`[${tag}] ${msg}`);
const children = [];
let pg = null;

function resolveBin(pkg, rel, fromDir) {
  // 先按包内相对路径解析；被 package exports 限制时，退回 package.json 所在目录拼接 bin
  try {
    return require.resolve(rel, { paths: [fromDir, ROOT] });
  } catch {
    const pkgJson = require.resolve(`${pkg}/package.json`, { paths: [fromDir, ROOT] });
    const sub = rel.startsWith(`${pkg}/`) ? rel.slice(pkg.length + 1) : rel;
    return path.join(path.dirname(pkgJson), sub);
  }
}

function runNode(args, cwd, env, tag) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    p.stdout.on('data', (d) => process.stdout.write(`[${tag}] ${d}`));
    p.stderr.on('data', (d) => process.stderr.write(`[${tag}] ${d}`));
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${tag} 退出码 ${code}`))));
  });
}

function spawnService(args, cwd, env, tag) {
  const p = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stdout.on('data', (d) => process.stdout.write(`[${tag}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${tag}] ${d}`));
  p.on('exit', (code) => log(tag, `已退出 code=${code}`));
  children.push(p);
  return p;
}

async function waitReady(url, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${label} 在 ${timeoutMs / 1000}s 内未就绪：${url}`);
}

function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch { /* 忽略自动打开失败，用户可手动访问 */ }
}

async function shutdown(code = 0) {
  for (const c of children) { try { c.kill(); } catch { /* noop */ } }
  if (pg) { try { await pg.stop(); } catch { /* noop */ } }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('数据库', '启动内置 PostgreSQL（首次会初始化数据目录，约 10-30 秒）...');
    const EP = require('embedded-postgres').default || require('embedded-postgres');
    pg = new EP({
      databaseDir: path.join(ROOT, '.local-pgdata'),
      port: PG_PORT,
      user: 'aihub',
      password: 'aihub_dev_2026',
      authMethod: 'password',
      persistent: true,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DB_NAME).catch((e) => {
      if (!/already exists|42P04/i.test(String(e && e.message))) throw e;
    });
    databaseUrl = DB_URL;
    log('数据库', `内置 PostgreSQL 已就绪 127.0.0.1:${PG_PORT}`);
  } else {
    log('数据库', `使用外部 DATABASE_URL`);
  }

  if (!fs.existsSync(path.join(SERVER, 'dist', 'src', 'main.js'))) {
    throw new Error('未找到 server/dist，请先在项目根执行 npm run build');
  }

  log('迁移', '执行 prisma migrate deploy ...');
  const prismaCli = resolveBin('prisma', 'prisma/build/index.js', SERVER);
  await runNode([prismaCli, 'migrate', 'deploy'], SERVER, { DATABASE_URL: databaseUrl }, '迁移');

  log('种子', '写入/校验演示数据（幂等）...');
  await runNode([path.join(SERVER, 'dist', 'prisma', 'seed.js')], SERVER, { DATABASE_URL: databaseUrl }, '种子');

  // 启动内置离线演示大模型（OpenAI 兼容，免 Key），让机器人开箱即有“真实链路”的自然应答
  const localLlm = path.join(ROOT, 'runtime', 'local-llm-server.js');
  if (fs.existsSync(localLlm)) {
    log('演示大模型', `启动内置离线模型 :${LLM_PORT}（无需外部 Key）...`);
    spawnService([localLlm], ROOT, { LOCAL_LLM_PORT: String(LLM_PORT) }, '演示大模型');
    await waitReady(`http://127.0.0.1:${LLM_PORT}/health`, 30000, '内置演示大模型');
  }

  const apiEnv = {
    DATABASE_URL: databaseUrl,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: String(API_PORT),
    DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
    JWT_SECRET: 'demo-access-9f3a2c71e8b44d06a5c1f80e2b9d4a73',
    JWT_REFRESH_SECRET: 'demo-refresh-2d71b04c9a6f4e28b1d53a80f6c29e47',
    CREDENTIAL_KEY: 'demo-credential-7c10ae36d92b4f5881e06ad3c97b2e54',
    ALLOW_DEMO_INBOUND: 'true',
    ACCESS_TTL: '8h',
  };
  log('后端', `启动 API :${API_PORT} ...`);
  spawnService([path.join(SERVER, 'dist', 'src', 'main.js')], SERVER, apiEnv, '后端');
  await waitReady(`http://127.0.0.1:${API_PORT}/api/v1/health/ready`, 180000, '后端 API');
  log('后端', 'API 已就绪');

  // 让前端运行时指向本机后端（跨端口，CORS 已开启）
  const distCfg = path.join(WEB, 'dist', 'config.js');
  if (fs.existsSync(path.dirname(distCfg))) {
    fs.writeFileSync(
      distCfg,
      `window.__APP_CONFIG__ = { apiBase: 'http://127.0.0.1:${API_PORT}/api/v1', wsOrigin: 'http://127.0.0.1:${API_PORT}' };\n`,
    );
    log('前端', '已写入运行时配置 web/dist/config.js');
  } else {
    throw new Error('未找到 web/dist，请先在项目根执行 npm run build');
  }
  const viteBin = resolveBin('vite', 'vite/bin/vite.js', WEB);
  log('前端', `启动静态服务 :${WEB_PORT} ...`);
  spawnService([viteBin, 'preview', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'], WEB, {}, '前端');
  await waitReady(`http://127.0.0.1:${WEB_PORT}/`, 60000, '前端');

  const url = `http://localhost:${WEB_PORT}`;
  log('完成', `平台已启动：${url}  （账号 admin / Aihub@123456）`);
  openBrowser(url);
  log('提示', '关闭本窗口或按 Ctrl+C 即停止全部服务（演示数据保留在 .local-pgdata）');
}

main().catch((e) => {
  console.error('[启动失败]', e && e.stack ? e.stack : e);
  shutdown(1);
});
