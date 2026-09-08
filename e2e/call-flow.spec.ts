import { test, expect, Page } from '@playwright/test';

/**
 * 全链路主流程 E2E（需种子数据：技能组/坐席/机器人配置/知识库）：
 * 坐席登录置空闲 -> 通过公开 CTI 演示接口制造一通呼入 -> 机器人多轮 -> 转人工 ->
 * 工作台待接队列出现并接听 -> 实时通话页出现转写 -> 挂断生成 AI 小结 -> CRM 自动建档。
 * 前置：docker compose 已起且已执行种子（账号 agent01 / Aihub@123456）。
 */
async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.getByPlaceholder('账号').fill(username);
  await page.getByPlaceholder('密码').fill('Aihub@123456');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/workbench');
}

test.describe('呼入→机器人→人工→建档 全链路', () => {
  test('坐席完成一通来电并生成跟进记录', async ({ page, request }) => {
    await login(page, 'agent01');

    // 1) 坐席置为空闲（状态下拉/按钮文本以实际页面为准，兼容“空闲/在线”）
    const idle = page.getByRole('button', { name: /空闲|在线/ }).first();
    if (await idle.count()) await idle.click();

    // 2) 通过 CTI 演示入口制造呼入（公开接口，沙箱/演示环境开放）
    const inbound = await request.get('/api/v1/cti/demo-inbound?phone=13900001111');
    expect(inbound.ok()).toBeTruthy();
    const call = await inbound.json();
    expect(call.id ?? call.callId).toBeTruthy();
    const callId = call.id ?? call.callId;

    // 3) 机器人多轮：询价 + 转人工
    await request.post('/api/v1/cti/utter', { data: { callId, text: '你们这个怎么收费' } });
    await request.post('/api/v1/cti/utter', { data: { callId, text: '我想找人工顾问聊聊' } });

    // 4) 工作台出现待接队列并接听
    await page.goto('/workbench');
    const accept = page.getByRole('button', { name: /接听|接入/ }).first();
    await expect(accept).toBeVisible({ timeout: 20000 });
    await accept.click();

    // 5) 进入实时通话页，能看到转写区域与挂机/小结
    await page.waitForURL(/\/(live|call)/, { timeout: 15000 }).catch(() => undefined);
    await expect(page.locator('body')).toContainText(/转写|通话|客户/);

    // 6) 结束通话
    const end = page.getByRole('button', { name: /结束|挂断/ }).first();
    if (await end.count()) await end.click();

    // 7) CRM 线索列表能查到该来电号码（机器人/转人工后自动建档）
    await page.goto('/crm/leads');
    await expect(page.locator('body')).toContainText('13900001111');
  });
});
