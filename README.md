# AI Demo Hub · 接线机器人 + 电销工作台 全链路平台

面向 **To-B SaaS 获客** 的生产级全链路平台：呼入由**接线机器人**完成多轮应答 / FAQ / 意向识别 / 自动留资或转人工，转人工后进入**派单队列**，坐席在**电销工作台**完成弹屏、实时转写、AI 小结、跟进待办、外呼、商机漏斗、合同回款、营销触达，并提供管理端组织权限、供应商集成、质检与经营报表。设计支撑 **200+ 坐席**。

> 语音（运营商/ASR/TTS）、大模型（LLM）、短信/邮件/企微均通过 **Provider 端口** 接入；内置 **Sandbox 沙箱实现**，离线即可跑通全流程，在「集成中心」配置真实供应商密钥后一键切换为商用能力。

---

## 1. 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 + Ant Design 5 + React Query 5 + Zustand + ECharts + Socket.IO Client，响应式（桌面 / 移动 H5） |
| 后端 | NestJS + TypeScript + Prisma 5 + Socket.IO（JWT 鉴权、多租户拦截器、全局异常过滤） |
| 数据库 | PostgreSQL 15（物理表名/字段名/枚举值均为**中文**，Prisma 标识符为英文并以 `@map/@@map` 映射中文物理名） |
| 缓存 | Redis 7（可选；未配置 `REDIS_URL` 时自动降级为进程内内存） |
| 部署 | Docker Compose（pg / redis / api / web-nginx），前端亦可托管 EdgeOne Pages |

## 2. 目录结构

```
ai-demo-hub/
├─ server/                # NestJS 后端
│  ├─ prisma/schema.prisma# 英文标识符 + 中文 @map（43 模型 / ~35 枚举）
│  ├─ prisma/seed.ts      # 幂等种子：租户/角色权限/账号/机器人/知识库/沙箱供应商/演示数据
│  └─ src/                # iam crm bot telephony outbound qa contract message report integration system + providers
├─ web/                   # React 前端（17 个业务页面 + 布局/请求层/实时层）
├─ docker-compose.yml     # pg15 + redis7 + api + web
├─ .env.example
└─ .fullstack-flow/       # Fullstack Flow 五阶段过程文档（需求/设计/架构/测试/部署）
```

## 3. 本地开发（无 Docker 也可）

前置：Node ≥ 20、PostgreSQL 15（Redis 可选）。

```bash
# 1) 安装依赖（npm workspaces，一次性装 server + web）
npm install --no-audit --no-fund --ignore-scripts

# 2) 配置环境变量
cp .env.example server/.env        # 按需修改 DATABASE_URL / JWT_SECRET / CREDENTIAL_KEY

# 3) 生成 Prisma Client、建表迁移、写入种子
cd server
npx prisma generate
npx prisma migrate dev              # 或对已有库：npx prisma db push
npx prisma db seed                  # 写入演示账号与沙箱配置
cd ..

# 4) 启动后端（:3000）与前端（:5173，已配置 /api 与 /socket.io 代理）
npm run dev:server                  # 终端 1
npm run dev:web                     # 终端 2
```

打开 http://localhost:5173 。

## 4. 一键容器部署

```bash
# 可选：导出生产密钥
export JWT_SECRET=... JWT_REFRESH_SECRET=... CREDENTIAL_KEY=...
docker compose up -d --build
# web: http://localhost:8080   api: http://localhost:3000
```

api 容器启动时自动执行 `prisma migrate deploy`。首次进入后如需演示数据，执行：
`docker compose exec api npx prisma db seed`。

## 5. 演示账号（种子，密码统一 Aihub@123456）

| 账号 | 角色 | 用途 |
|---|---|---|
| admin | 管理员 | 组织权限、集成中心、系统管理、全部报表 |
| manager | 主管 | 派单监控、外呼任务、质检复检、团队报表 |
| agent01 / agent02 | 坐席 | 工作台、实时通话、CRM、跟进待办 |

## 6. 最快体验全链路（沙箱，无需任何外部密钥）

1. 用 **agent01** 登录，进入「坐席工作台」把状态切为「空闲」；
2. 打开「呼入模拟器」，输入号码触发来电 → 与机器人多轮对话（快捷话术含询价/转人工）；
3. 命中转人工后回工作台「待接队列」点**接听**，进入实时通话页看转写/弹屏；
4. 结束通话自动生成 **AI 小结**，到 CRM 看自动建档的线索/客户，推进商机阶段；
5. 用 admin 查看「智能质检」「经营报表」，在「集成中心」看到 5 类沙箱供应商。

## 7. 切换真实供应商

在「集成中心 → 供应商配置」新增对应类型（TELEPHONY/ASR/TTS/LLM/SMS/EMAIL/WECHAT），凭证以 AES-256-GCM 加密落库，关闭「沙箱模式」即走真实 Provider 端口；无需改业务代码。**商用语音线路、ASR/TTS/LLM、短信签名等资质与密钥需自行提供。**

## 8. 验证与测试

```bash
npm run typecheck     # server + web 全量 TS 类型检查（均 0 错误）
npm run build         # 后端 tsc 构建 + 前端 vite 构建
npm test              # Jest 纯函数单测（NLU / 派单策略 / 质检评分 / 报表比率）
```

## 9. 安全基线

- JWT 双 Token（access + refresh），登录失败 5 次锁定 15 分钟；
- 全量多租户隔离（租户上下文拦截器 + 查询强制 tenantId）；
- 供应商凭证 AES-256-GCM 加密、开放密钥仅展示前缀、查看明文需授权并留审计；
- 全站审计日志（操作人/动作/对象/IP）、RBAC 角色权限、Webhook 签名与投递记录。
