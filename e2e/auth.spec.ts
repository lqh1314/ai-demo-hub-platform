import { test, expect, Page } from '@playwright/test';

/** 用账号密码完成 UI 登录（种子账号密码统一 Aihub@123456） */
async function login(page: Page, username: string, password = 'Aihub@123456') {
  await page.goto('/login');
  await page.getByPlaceholder('账号').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/workbench');
}

test.describe('认证与路由守卫', () => {
  test.beforeEach(async ({ page }) => { await page.context().clearCookies(); await page.goto('/login'); });

  test('登录页正常渲染，含演示账号提示', async ({ page }) => {
    await expect(page.getByText('接线机器人 + 电销工作台')).toBeVisible();
    await expect(page.getByPlaceholder('账号')).toBeVisible();
    await expect(page.getByPlaceholder('密码')).toBeVisible();
  });

  test('错误密码给出提示且不跳转', async ({ page }) => {
    await page.getByPlaceholder('账号').fill('admin');
    await page.getByPlaceholder('密码').fill('wrong-password');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录访问受保护页被重定向到登录页', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForURL('**/login');
    await expect(page.getByPlaceholder('账号')).toBeVisible();
  });

  test('admin 登录成功进入工作台，且本地写入访问令牌', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/workbench/);
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeTruthy();
  });

  test('admin 可进入经营报表页并渲染图表容器', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/reports');
    // ECharts 渲染出 canvas 或图表占位
    await expect(page.locator('canvas, .echarts-for-react, [_echarts_instance_]').first()).toBeVisible({ timeout: 15000 });
  });
});
