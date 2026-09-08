# 部署与运维：接线机器人 + 电销工作台

> Phase 5 产物。部署体系沿用项目既有选型：Docker Compose（PostgreSQL15 + Redis7 + NestJS API + Nginx 托管前端），代码托管 GitHub，前端可选 EdgeOne Pages。

## 1. 拓扑与产物
| 服务 | 镜像/来源 | 端口 | 说明 |
|---|---|---|---|
| postgres | postgres:15-alpine | 5432 | 中文物理名库，命名卷 pgdata |
| redis | redis:7-alpine（appendonly） | 6379 | presence/队列/报表缓存，命名卷 redisdata；API 缺它可内存降级（仅单实例） |
| api | `server/Dockerfile` 多阶段构建 | 3000 | 启动时 `prisma migrate deploy` → `seed.js`（幂等）→ `node dist/src/main.js` |
| web | `web/Dockerfile`（vite build + nginx:1.27-alpine） | 8080→80 | SPA，nginx 反代 `/api` 到 api:3000、upgrade `/socket.io` |

## 2. CI/CD 流水线（`.github/workflows/ci.yml`）
阶段顺序，**任一阶段失败即终止、不部署**：
1. `actions/setup-node@v4` + `npm ci`（根 workspaces 一次装 server+web）；
2. `prisma generate`；
3. `npm run typecheck`（server + web 双 tsc）；
4. `npm test`（后端 33 单测）；
5. `npm run build`（server + web 生产构建）；
6. 第二 job `docker compose config` 校验编排合法性。
> 发布门禁：测试不过禁止部署。CD（构建镜像并推镜像仓库/上服务器 `compose pull && up -d`）在目标环境凭据就绪后接入同一 workflow，本仓库先交付 CI 与容器化文件。

## 3. 迁移上流水线（先迁移后发布）
- 迁移是**独立且先于应用启动**的阶段：api 容器启动命令固定 `npx prisma migrate deploy` 在前，迁移失败则容器退出、不启动新版本应用。
- 初始迁移 `00000000000000_init`（43 张中文表）已离线生成入库；后续表结构变更用 `npx prisma migrate dev -n xxx` 生成迁移并提交，**禁止在生产用 db push / 手改库**。
- 扩展-迁移-收缩：加字段先「可空/带默认值」扩展上线 → 双写/回填 → 再收缩删除旧列，保证不停机、可回滚。

## 4. 灰度 / 特性开关
- Provider 层即天然开关：真实语音/ASR/TTS/LLM/短信是否启用由「供应商配置 + 是否配置凭证」决定，未配置走 Sandbox；可在不发版情况下于「集成中心」停用某供应商回退沙箱。
- CTI 演示入口由 `ALLOW_DEMO_INBOUND` 控制；机器人转人工关键词、外呼预测式系数等均为配置表/环境变量驱动，支持不发版关闭新链路。

## 5. 健康检查探针
- `GET /api/v1/health/live`：liveness，不依赖外部组件，恒 200 `{status:'ok'}`。
- `GET /api/v1/health/ready`：readiness，`SELECT 1` 探数据库，失败返回 503；同时上报缓存模式（redis/memory）。
- compose 已为 postgres（pg_isready）、redis（redis-cli ping）、api（node http 探 live，start_period 40s）配置 healthcheck；web `depends_on api: service_healthy`。生产编排（k8s）将 live/readiness 分别映射 livenessProbe/readinessProbe。

## 6. 监控告警（建议阈值）
| 指标 | 来源 | 告警阈值（建议） |
|---|---|---|
| API 错误率（5xx） | 访问日志/异常过滤器 | 5 分钟 > 1% |
| P95 延迟 | API 埋点/网关 | > 500ms 持续 5 分钟 |
| 就绪探针失败数 | /health/ready | 连续 3 次失败 |
| 派单队列等待时长 | DispatchQueue | 最长等待 > 30s |
| 坐席在线数 / 通话并发 | presence | 并发接近规划容量 80% 预警（200 坐席口径） |
| Redis 模式 | health.ready.cache | 多实例部署却为 memory 立即告警（状态不共享） |
日志：结构化、不打印密码/密钥/token（已静态确认）；生产接集中日志（Loki/ELK）。

## 7. 部署 Runbook
### 7.1 一键起（演示/测试环境）
```bash
cp .env.example .env          # 演示可保留 development；改强密码更安全
docker compose up -d --build  # 自动建库(中文表)+种子+起服务
# web: http://localhost:8080  api: http://localhost:3000/api/v1
```
### 7.2 生产部署
1. 准备 PostgreSQL15、Redis7（或托管实例）；`.env` 设置 `NODE_ENV=production` 与**高强度** `JWT_SECRET/JWT_REFRESH_SECRET/CREDENTIAL_KEY`、`CTI_WEBHOOK_SECRET`，`ALLOW_DEMO_INBOUND=false`（占位密钥会被启动闸门拒绝）。
2. 备份数据库（`pg_dump`）。
3. `docker compose build && docker compose up -d`；观察迁移日志成功、`/health/ready` 返回 up。
4. 按 09 的验收清单走主流程冒烟。
### 7.3 回滚步骤（先应用后数据）
1. **应用回滚**：`docker compose up -d --no-deps api web` 切回上一镜像 tag（镜像按 git sha 打标）。应用向后兼容「扩展期」的库结构，故先回应用即可恢复服务。
2. **数据回滚（仅当迁移有破坏性变更才需要）**：确认旧版应用稳定后，再按该迁移的收缩逆序回滚数据库（Prisma 不自动 down，破坏性迁移需在迁移 PR 中附手写 down SQL 并先在演练库验证）。
3. 配置/开关回滚：优先用特性开关把问题链路切回沙箱/关闭，做到秒级止损再回滚版本。
4. 每次回滚后重跑 `/health/ready` 与主流程冒烟，记录时间线。

## 8. 已知部署边界（如实声明）
- 本沙箱**无 Docker / PostgreSQL / Redis**，`docker-compose.yml`、两个 Dockerfile、nginx.conf **未经本机构建/运行验证**；已通过 YAML 合法性校验、`tsc/build/jest` 保证产物可编译，镜像实跑需在有 Docker 的环境按 7.1 验证。
- 前端若走 EdgeOne Pages 纯静态托管，需将 `/api`、`/socket.io` 指向独立部署的 API 域名（构建期设 `VITE_API_BASE`），同源 compose 部署则无需设置。
