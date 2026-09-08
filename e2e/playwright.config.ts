import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 面向「已起好的全栈」运行（docker compose 起的 pg+redis+api+web，或测试环境）。
 * 通过 E2E_BASE_URL 指定前端地址，默认同源 compose：http://localhost:8080。
 * 后端地址默认与前端同源（nginx 反代 /api、/socket.io）；如前后端分离，用 E2E_API_BASE 覆盖。
 * 本沙箱无浏览器/数据库，不在本机执行；CI 的 e2e job 会先起服务再跑本套件。
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
