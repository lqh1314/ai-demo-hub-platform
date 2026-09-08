# E2E（Playwright）

面向**已运行的全栈**做端到端验证，覆盖认证/路由守卫与「呼入→机器人→转人工→接听→建档」主流程。

## 本地运行（先起全栈）
```bash
# 1) 起后端+数据库+前端（自动迁移与种子）
docker compose up -d --build
# 2) 安装浏览器（仅首次）
npm run e2e:install
# 3) 跑 E2E（默认访问 http://localhost:8080）
npm run e2e
# 指定前端地址：
E2E_BASE_URL=https://your-frontend.example.com npm run e2e
```

## 前置数据
依赖种子账号 `admin / manager / agent01 / agent02`（密码均 `Aihub@123456`）、默认技能组与机器人配置；`docker compose` 启动时已自动写入种子。

## 用例
- `auth.spec.ts`：登录页渲染、错误密码提示、未登录重定向、admin 登录落 token、报表页图表渲染。
- `call-flow.spec.ts`：坐席登录 → CTI 演示接口制造呼入 → 机器人多轮/转人工 → 队列接听 → 实时通话 → CRM 自动建档。

> 说明：E2E 需要真实数据库与浏览器，无法在仅含 Node 的构建沙箱内执行；CI 的 `e2e` job 会用 PostgreSQL/Redis service 起服务后运行。纯逻辑与接口层由 server 的 Jest 单测（33）与接口集成测试（12）在无 DB 环境兜底。
