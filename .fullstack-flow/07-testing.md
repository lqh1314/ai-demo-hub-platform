# 测试与验证：接线机器人 + 电销工作台全链路平台

> Phase 4 产物。测试 / 安全 / 性能三视角并行；结论均来自本沙箱内**实际运行**或**源码静态审计**，未运行项明确标注原因与补测方案。

## 一、测试套件

### 1.1 实际运行结果（本沙箱执行）

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端单元测试 | `npx jest --runInBand`（server） | **5 套件 / 33 用例全部通过**（含闸门 C 新增安全回归 10 例，约 40s） |
| 后端类型检查 | `npx tsc --noEmit -p tsconfig.json` | **0 错误** |
| 后端生产构建 | `tsc -p tsconfig.build.json` | **exit 0，dist 已产出** |
| Prisma Schema | `prisma validate` / `prisma generate` | **schema valid，Client 5.22 生成成功** |
| 前端类型检查 | `npx tsc --noEmit`（web） | **0 错误** |
| 前端生产构建 | `npx vite build`（web） | **exit 0，3782 模块，分包后最大 chunk 1.26MB < 1.6MB 阈值** |
| seed 脚本类型 | `tsc` 单独检查 prisma/seed.ts | 通过（幂等 upsert） |

### 1.2 单元测试清单（纯函数，隔离外部依赖）

| 用例文件 | 用例数 | 覆盖的业务规则（正常/边界/错误） |
|---|---|---|
| `src/bot/nlu.spec.ts` | 8 | 关键词重叠打分、意图匹配优先级、知识库命中、槽位抽取（手机号/公司规模）、转人工关键词、意向等级 HIGH/MID/LOW/UNKNOWN、单轮决策、空输入兜底 |
| `src/crm/assignment.strategy.spec.ts` | 6 | 轮询 / 最少负载 / 技能匹配三策略、空候选、技能不匹配回退、预测式外拨数量 `predictiveDialCount` 边界（0 空闲、系数取整） |
| `src/qa/qa.scoring.spec.ts` | 6 | 必达项未中扣分、禁忌项命中扣分、只评 BOT/AGENT 话术（客户语不计）、满分、等级分档（优秀/合格/待改进/不合格） |
| `src/report/report.rate.spec.ts` | 3 | 比率计算、`total<=0` 返回 0（除零保护）、保留 1 位小数 |
| `src/common/security.spec.ts`（闸门 C 新增） | 10 | 占位密钥识别、生产密钥闸门（非生产跳过/生产列出缺失/全合规）、CTI 授权（未配置时生产拒绝·非生产放行、正确密钥通过、错误/不等长拒绝） |

每个被测纯函数均覆盖**正常路径 / 边界条件 / 错误或空输入**三类。核心业务决策（NLU、派单、质检评分、报表比率）分支已覆盖；这些函数被上层 service 复用，等于给主链路的关键判断上了回归锁。

### 1.3 本沙箱无法运行的测试层（如实标注 + 补测方案）

当前沙箱**无 PostgreSQL / Redis / Docker / sudo**，下列需要真实运行时的测试层未在本机执行，不属于"已验证"：

| 测试层 | 现状 | 补测方案（具备 DB 的环境，已在 docker-compose 备好） |
|---|---|---|
| 接口集成测试（成功/鉴权失败/参数非法/依赖异常） | 未运行 | 起 pg+redis 后用 Jest + supertest 对每个 Controller 跑 4 路径；JwtAuthGuard 未带 token→401、低权限→403 为重点断言 |
| 数据层测试（迁移正向/回滚、关键查询） | 未运行 | `prisma migrate deploy` 正向 + `migrate diff` 校验；对来电弹屏号码反查、漏斗 groupBy、外呼待拨部分索引补断言 |
| 前端组件 / E2E | 未运行（以 tsc + vite build 保证可编译可打包） | Vitest + Testing Library 覆盖表单/列表交互；Playwright 跑「呼入→机器人→转人工→接听→AI小结→建档」主流程 |
| 覆盖率统计 | 未产出（无 DB，未开 --coverage 全量） | CI 中 `jest --coverage`，目标新代码行/分支 80%+ |

> 结论：**纯业务逻辑层已实测全绿且可重复；依赖外部运行时的集成/E2E 层为已知缺口**，已提供一键容器环境与明确补测路径，需在有 PostgreSQL 的环境补齐后方可宣称端到端验证完成。

## 二、安全发现（静态审计，位置 + 级别 + 处置）

| 级别 | 位置 | 问题 | 状态 |
|---|---|---|---|
| —（已具备的基线，非缺陷） | `common/auth.guard.ts` + `app.module` 全局 `APP_GUARD` | 默认所有接口需登录，仅显式 `@Public` 放行；JWT 双 Token、401 自动 refresh 一次 | 已实现 |
| — | `common/tenant.interceptor.ts` + 各 service `tenantId` 过滤 | 多租户水平隔离，查询强制带 tenantId，防跨租户读 | 已实现 |
| — | `iam/auth.service.ts` | bcryptjs cost=10；连错 5 次锁 15 分钟；登录/刷新比较走常量时间 bcrypt.compare | 已实现 |
| — | `common/crypto.ts` | 供应商凭证 AES-256-GCM 加密落库，主密钥经 sha256 取 32B；reveal 需授权 | 已实现 |
| 良好 | 全局源码扫描 | **无任何 `$queryRaw/$executeRaw`（无 SQL 注入面）、无 eval/child_process、无 console 打印密码/密钥/token** | 已确认 |
| ~~Medium~~ **已修复** | `telephony/cti.controller.ts` + `common/security.ts:ctiAuthorize` | CTI 回调免登录、公网可伪造呼入 | **已收口并加 10 例回归**：配置 `CTI_WEBHOOK_SECRET` 后必须带匹配 `x-cti-secret`（定长+逐字节比较）；生产强制要求、缺失即 403；demo-inbound 生产默认关闭（`ALLOW_DEMO_INBOUND=true` 才开）；非生产无密钥仍放行以保离线演示 |
| ~~Medium~~ **已修复** | `main.ts:assertProductionSecrets` + `common/security.ts:missingProdSecrets`、`.env.example` | 生产沿用默认占位密钥属弱配置 | **已加启动闸门**：NODE_ENV=production 时 JWT_SECRET/JWT_REFRESH_SECRET/CREDENTIAL_KEY/DATABASE_URL 缺失或为 change-me/your-/xxx 占位则**拒绝启动**；.env.example 补充 CTI 变量说明。首登强制改密仍列 Low backlog |
| Low | 前端 localStorage 存 access/refresh token | XSS 下可读 | 当前为演示形态；生产建议改 httpOnly Cookie + SameSite=Strict，CSP 头由 Nginx 增补 |
| Low | 依赖 CVE 扫描 | 本沙箱未联网跑 `npm audit` 流水线 | CI 增加 `npm audit --production` 门禁 |

**安全结论：0 Critical / 0 High；原 2 个 Medium 已在本轮全部修复并补回归测试，仅剩 2 个 Low。** CTI 收口与默认密钥拦截已落地为代码（非仅文档要求），离线演示路径保持可用。

### XSS / CSRF / 输入校验
- 前端 React 默认对插值转义；富文本仅知识库答案，渲染走文本节点，不使用 `dangerouslySetInnerHTML`（已全局确认无该调用）。
- 后端 DTO 层对必填/类型/枚举做校验；手机号统一经 `common/phone.ts` E.164 规范化后入库，杜绝畸形号码进入派单。
- CSRF：纯 Bearer Token（不依赖自动携带的 Cookie）天然不受传统 CSRF 影响；若后续改 Cookie 方案需同步引入 CSRF Token。

## 三、性能发现（静态审计）

| 级别 | 位置 | 影响（200+ 坐席口径） | 状态 / 建议 |
|---|---|---|---|
| — | 派单 `queue` + `presence`（Redis，缺省进程内降级） | 选坐席为 O(候选) 内存/Redis 操作，不打 DB，支撑高并发振铃 | 已实现；多实例部署必须配 REDIS_URL（已在 .env.example/compose 标明） |
| — | 转写片段 | WS 实时推送 + 结束批量落库，避免逐字写库放大 | 已实现 |
| — | 前端分包 `vite manualChunks` | react/antd/charts/query 四 vendor 分包，首屏主包从 2.56MB 降到业务包 126KB，gzip 主包约 41KB | 已优化并重新构建验证 |
| ~~Medium~~ **已修复** | 报表 `report.service` 每次实时 groupBy | 高并发下概览接口有聚合压力 | **已加时间桶缓存**：overview/funnel 120s、calls/agents 60s（按租户+时间范围分桶），走 RedisService（配 REDIS_URL 多实例共享，缺省进程内内存且同样兑现 TTL），缓存异常自动降级实时聚合，不影响取数 |
| Medium | 列表接口分页 | 未分页的大表全量返回会放大 payload | 所有列表走 `{list,total,page,pageSize}` 分页；前端 usePaged 统一分页；个别下拉（用户/客户）用 pageSize:200/500 一次取，200 坐席规模可接受，超大组织改远程搜索 |
| Low | N+1 风险点：列表里关联展示名（如负责人姓名） | 部分页面在前端用已缓存的全量用户映射，后端个别列表未 include 关联 | 数据量增大后改为后端 include/批量 map，避免前端多次请求；列入 backlog |
| Low | 深分页 offset | 大表深页性能下降 | 时间线/审计已规划 keyset 游标分页，当前 offset 满足演示与中小规模 |

**性能结论：0 Critical / 0 High；报表缓存 Medium 已修复，仅剩 1 个规模化 Medium（超大组织下拉远程搜索，200 坐席规模不触发）与 2 个 Low。**

## 四、修复与复验记录

### 4.1 前端实现期修复（回归闭环）
1. **前端编译错误清零**：首轮 `tsc --noEmit` 报 18 处 → 逐项修复：ETag 补默认导出；enums 字典 4 处重复键合并去重；List `locale` 改为 `{emptyText}`；refetchInterval 的 `false` 改 `undefined`；外呼名单 useOnce→usePaged；Webhook 投递类型收窄。复验 `tsc` **0 错误**、`vite build` **exit 0**。
2. **包体积告警**：加 manualChunks 后重新构建，最大 chunk 1.26MB < 阈值，告警消除。
3. **LiveCall 冗余 ETag**：删除 AI 小结情绪行多余组件，复验通过。

### 4.2 闸门 C Medium 修复（用户选「先修复再交付」）
4. **CTI 收口**：新增 `common/security.ts:ctiAuthorize` 纯函数，`cti.controller` 四个回调统一走密钥校验（生产强制、沙箱放行、demo 入口生产默认关）；`.env.example` 补 `CTI_WEBHOOK_SECRET/ALLOW_DEMO_INBOUND`。
5. **生产密钥闸门**：`main.ts` 启动前调用 `missingProdSecrets`，生产环境关键密钥缺失/占位即拒绝启动。
6. **报表时间桶缓存**：`report.service` 四个聚合方法接 RedisService 缓存（120s/60s），并给内存降级模式补齐 TTL 定时器，避免缓存永不失效；缓存异常自动降级实时聚合。
7. **回归测试**：新增 `common/security.spec.ts` 10 例覆盖上述安全逻辑。
8. **复验结果**：修复后 `tsc --noEmit` **0 错误**、`npm run build` **exit 0**、`jest` **5 套件 33 例全绿**（由 23 增至 33），确认修复未引入回退。

## 五、遗留 Medium / Low 与建议（backlog）

> 闸门 C 原 3 个 Medium（CTI 收口、默认密钥、报表缓存）已全部修复，下列为剩余项。

- [Medium] 超大组织（坐席数远超 200）用户/客户下拉改远程搜索——当前 pageSize 200/500 一次取，200 坐席规模无压力。
- [Low] 首登强制改密；Token 改 httpOnly Cookie + Nginx CSP/Security Headers；CI 接 `npm audit` 与 `jest --coverage` 门禁（80%+）。
- [Low] 补集成测试 / 迁移回滚测试 / Playwright 主流程 E2E（需 PostgreSQL 环境）。
- [Low] 关联名后端 include、审计/时间线游标分页。

## 六、闸门 C 结论（修复后复审）

- 实测：后端 **33/33 单测通过**、server/web 类型检查均 0 错误、前后端生产构建均成功、Prisma schema 合法。
- 安全：**0 Critical / 0 High / 0 未修复 Medium / 2 Low**（原 2 Medium 已修复并回归）。
- 性能：**0 Critical / 0 High / 1 规模化 Medium（200 坐席不触发）/ 2 Low**（原报表缓存 Medium 已修复）。
- 已知验证边界：沙箱无 DB/Redis，集成测试与 E2E 未运行，已备容器环境与补测清单；容器镜像与 compose 未在本机实跑（无 Docker）。
- 用户选择「先修复 Medium 再交付」，三项 Medium 已清零，**据此进入 Phase 5 交付**。
