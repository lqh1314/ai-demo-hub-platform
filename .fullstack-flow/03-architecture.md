# 架构设计：接线机器人 + 电销工作台全链路平台

## 0. 总体架构（分层 + 端口/适配器）
```
[PC Web / H5 (React)] --HTTPS/REST--> [NestJS API 网关层] ---> 领域 Service ---> Repository ---> PostgreSQL
        |                               |                              |
        +----WebSocket(Socket.IO)-------+                              +--> Redis( presence / queue / cache / BullMQ )
                                        |
                  Provider 抽象端口(Ports)：TelephonyPort / AsrPort / TtsPort / LlmPort / ChannelPort
                                        +--> Sandbox 实现(默认,离线可跑) | 真实实现(配置密钥/线路后切换)
                  外部：运营商/SIP、ASR、TTS、LLM、短信/邮件/企微、开放API/Webhook 外发
```
- 分层：`Controller(参数/鉴权/DTO) → Service(纯业务,不碰HTTP) → Repository(持久化) → DB/Redis`；依赖方向单向向内。
- 端口/适配器：所有外部能力定义 interface，运行时按 `provider_config` 选择实现（sandbox/real），业务层只依赖接口，可单测打桩。
- 实时：Socket.IO Gateway 维护坐席连接、坐席态、振铃、实时转写、队列变化；多实例以 Redis Adapter 发布订阅。
- 异步：BullMQ 承担外呼批次、消息发送、AI 小结/质检、webhook 重试、报表预聚合。

## 1. 后端（NestJS 模块划分 = 边界）
| 模块 | 职责 | 关键 Service |
|---|---|---|
| iam | 登录/刷新、用户/部门/角色/权限、技能组 | AuthService, RbacService, UserService, SkillGroupService |
| crm | 客户/联系人/线索/商机/跟进/待办 | LeadService, CustomerService, OpportunityService, ActivityService, TaskService, AssignmentService(派单) |
| telephony | 线路、通话会话、转写、坐席实时态、队列 | CallSessionService, PresenceService, QueueService, LineService, CtiController(供应商回调) |
| bot | 机器人配置、意图、知识库、对话编排、转人工 | DialogOrchestrator, IntentService, KbService, BotConfigService |
| outbound | 外呼任务/名单/调度策略/预测拨号 | CampaignService, DialerService(worker), PredictiveStrategy |
| qa | 质检规则、AI 初检、人工复检 | QaRuleService, QaScoringService |
| contract | 合同/回款 | ContractService, PaymentService |
| message | 模板/营销任务/通道发送 | TemplateService, MessageDispatchService |
| report | 漏斗/接通/转化/坐席产能，预聚合缓存 | ReportService |
| integration | OpenAPI 签名、webhook、provider 配置 | ApiKeyService, WebhookService, ProviderRegistry |
| system | 字典、通知、审计、配置 | DictService, NotificationService, AuditService |
| realtime | Socket.IO 网关与事件 | RealtimeGateway, PresenceSubscriber |
| common | 过滤器/拦截器/守卫/分页/加密/日志 | TenantContext, AllExceptionsFilter, AuditInterceptor |

### 1.1 REST 接口清单（/api/v1，均隐式带租户；列主要端点）
- 认证/账号
  - POST /auth/login、POST /auth/refresh、POST /auth/logout、GET /auth/me
  - GET/POST/PATCH/DELETE /users；GET/PATCH /departments；GET /roles、/permissions；GET/POST /skill-groups(/:id/agents)
- CRM
  - /leads（GET 列表、POST 建、GET/:id、PATCH/:id、POST/:id/assign、POST/:id/convert、POST/:id/follow-up）
  - /customers（CRUD、GET/:id/timeline、GET 分页）；/contacts（CRUD、GET search?phone=）
  - /opportunities（CRUD、POST/:id/advance-stage）；/activities（GET timeline、POST）；/tasks（GET my、POST、POST/:id/complete）
- 通话/坐席
  - GET /lines、POST /lines；GET /calls（筛选分页）、GET /calls/:id（含转写/小结）、POST /calls/:id/wrap-up
  - GET /presence（团队坐席态）、POST /presence/status（切换态）；POST /calls/dial（手动外呼）、POST /calls/:id/transfer
  - POST /cti/callback（**供应商回调，签名校验，无登录态**：incoming/asr/tts/status/hangup）
- 机器人/知识库
  - GET/PATCH /bot/config；/intents（CRUD、POST :id/test）；/kb/articles（CRUD、POST search、POST publish）
- 外呼
  - /campaigns（CRUD、POST :id/start|pause、POST :id/targets/import、GET :id/targets、GET :id/stats）
- 质检
  - /qa/rules（CRUD）；GET /qa/records、GET /qa/records/:id、POST /qa/records/:id/review
- 合同/回款
  - /contracts（CRUD、POST :id/sign）；/payments（POST、PATCH :id）
- 营销
  - /message/templates（CRUD）；/message/tasks（CRUD、POST :id/send）；GET /message/records
- 报表
  - GET /reports/funnel、/reports/calls、/reports/agents、/reports/overview（query: from,to,granularity,groupBy）
- 集成/系统
  - /integrations/api-keys（CRUD）、/webhooks（CRUD）；/providers（GET、POST、POST :id/test、PATCH enable）
  - /dicts、/notifications（GET、POST read）、/audit-logs（GET）
- 统一约定：列表 `?page,pageSize,sort,q,filters`，返回 `{list,total,page,pageSize}`；错误体 `{code,message,details,traceId}`；版本前缀 v1，破坏性变更升 v2。

### 1.2 WebSocket 事件（namespace /realtime，JWT 握手鉴权）
- 客户端→服务端：`presence.set_status`、`call.dial`、`call.answer`、`call.hangup`、`call.transfer`、`queue.subscribe(group)`。
- 服务端→客户端：`call.incoming`(弹屏+画像)、`call.transcript.segment`、`call.ai_summary`、`call.status`、`agent.presence_changed`、`queue.updated`、`task.reminder`、`notification.new`。
- 房间：`tenant:{id}`、`group:{id}`、`agent:{id}`、`call:{id}`；多实例经 Redis Adapter 广播。

### 1.3 鉴权与授权
- 登录签发 access(JWT,短) + refresh(旋转,httpOnly cookie)；bcrypt(cost≥12)；登录失败锁定、刷新令牌重用检测。
- `JwtAuthGuard` 全局；`PermissionsGuard(@RequirePerm('crm:lead:convert'))` 做按钮/接口级 RBAC；数据级：坐席只看自己（及下属，主管看本组），用 owner/dept 数据范围注入 where。
- CTI 回调与 OpenAPI 不走登录：分别用供应商签名/HMAC、AK/SK 签名 + 时间戳防重放。
- 租户上下文：解析 JWT → AsyncLocalStorage 存 tenant_id，Repository 强制带上，越权直接 404/403。

### 1.4 集成点与失败处理
- Provider 端口：`TelephonyPort.dial/answer/hangup/stream`、`AsrPort.stream`、`TtsPort.synth`、`LlmPort.chat/summarize/embed`、`ChannelPort.send`；均有 timeout、熔断(连续失败降级到 sandbox/排队)、重试退避、幂等键。
- 供应商回调幂等（provider_ref 唯一）、乱序容忍（状态机校验合法跃迁，非法丢弃并告警）。
- Webhook 外发：worker 重试（指数退避，最多 N 次），记录 delivery 与 http_code，死信后可手动重发。

## 2. 前端（React18 + TS + Vite + AntD + React Query + Zustand + ECharts）
### 2.1 路由与页面（含权限守卫）
```
/login
/app                         RequireAuth + 角色布局
  /dashboard                 总览大盘(主管/管理员)
  /workbench                 坐席工作台(默认首页): 坐席态开关、来电弹屏、实时转写、我的待办/客户/今日外呼
  /calls                     通话记录; /calls/:id 通话详情(录音+转写+AI小结+质检)
  /leads /leads/:id          线索列表/详情; /customers(/:id) 客户360; /opportunities(/:id)
  /outbound                  外呼任务列表/创建/详情(名单与进度)
  /bot/config                机器人配置; /bot/intents; /bot/kb(知识库)
  /qa                        质检列表/详情
  /contracts                 合同回款
  /message                   营销模板与任务
  /reports                   报表(漏斗/通话/坐席)
  /admin/users /admin/departments /admin/skill-groups /admin/providers /admin/dict /admin/audit /admin/api
  /me                        个人设置
/h5                          响应式移动版(我的待办/客户/通话/跟进) —— 复用组件, 独立精简布局
```
路由守卫：未登录跳 /login；按 `permissions` 过滤菜单与路由，无权显示 403 页。

### 2.2 组件层级
```
<App/>
 <Providers> (QueryClient, AuthStore, SocketProvider, Theme, ConfigProvider)
  <AuthLayout/> → <SideNav/><Header(坐席态/通知/头像)/><Content/>
   页面容器组件(取数、编排)：WorkbenchPage / Customer360 / CallDetail ...
     业务组件：IncomingPop(弹屏) / LiveTranscript / AgentStatusBar / CallActionBar /
              LeadCard / OpportunityKanban / Timeline / TaskList / DialerPanel /
              BotFlowEditor / KbTable / QaReport / FunnelChart / AgentLoadChart / ProviderForm
       通用展示组件：DataTable / PageHeader / StatCard / TagStage / PhoneText / Empty/ErrorBoundary
```
- 容器组件负责取数与动作；展示组件纯 props；通话相关为"实时容器"，订阅 WS。

### 2.3 状态管理与数据流
- **服务端状态**：React Query（缓存/分页/失效重取/乐观更新），key 层级 `[domain,list,filters]`、`[domain,id]`；变更后 invalidate 相关 key。
- **客户端/实时状态**：Zustand——auth(perms)、socket 连接态、当前通话、实时转写缓冲、坐席 presence；WS 事件更新 store 并按需 setQueryData 同步列表。
- 请求层：axios 实例（刷新拦截、错误归一、traceId 透传、取消竞态 AbortController）；重试仅对幂等 GET。
- 乐观更新用于阶段拖拽、待办完成、已读通知，失败回滚并 toast。

## 3. 横切关注点
### 3.1 错误传递链（闭环）
- 后端：业务抛 `BizException(code,httpStatus,details)` → `AllExceptionsFilter` 统一成错误体 + 记日志/traceId；未知异常 500 且不泄漏堆栈；参数校验 class-validator → 422 字段级 details。
- 前端：axios 拦截器识别 401→刷新/跳登录、403→无权限提示、422→表单字段回显、5xx→错误兜底组件 + 可重试；WS 断线自动重连并补拉缺失区间。
- 异步任务失败进死信并在管理端可见、可重试；外部 Provider 失败降级且对坐席提示当前为沙箱/降级模式。

### 3.2 安全清单（实现时逐条对照）
- 认证：强口令策略、bcrypt、JWT 短时效+刷新旋转、登录锁定、敏感操作二次校验；凭证（provider/api sk）AES-GCM 加密存储，日志脱敏。
- 越权：接口级 PermissionsGuard + 数据级 owner/dept/tenant 过滤；所有写操作经租户上下文；对象级归属校验。
- 输入：DTO class-validator 白名单校验、参数化查询(Prisma)防 SQL 注入；富文本/转写展示默认转义防 XSS；CSP、HttpOnly/SameSite cookie、CSRF token（cookie 鉴权路径）。
- 速率与滥用：登录/外呼/发信/OpenAPI 限流（Redis 令牌桶），外呼名单去重与黑名单、时段限制（合规）。
- 合规：录音/转写留存周期与授权提示、敏感字段脱敏、审计日志不可篡改（只追加）、导出受控。
- 依赖：npm audit / 容器以非 root 运行 / 镜像最小化 / 密钥走环境变量与密文配置。

### 3.3 风险评估（Top 风险与缓解）
1. **真实语音链路不确定（最高）**：运营商/SIP、ASR/TTS、LLM 选型与资质未定时会阻塞"切真"。→ 端口适配器 + 可运行 sandbox 先保证全业务闭环；定义清晰的 Provider 接口与联调清单，切真不改业务代码；先接 1 家。
2. **200+ 坐席实时并发与状态一致性**：振铃/ presence/转写高频。→ presence 与队列放 Redis + Lua 原子选择，WS 多实例 Redis Adapter，转写缓冲批量落库；压测验证（单实例目标、水平扩展方法、Sticky/Adapter）。
3. **范围大、模块多导致集成失控**：→ 严格 DB→后端→前端顺序与模块边界；每模块可独立测试；先打通主链路（呼入→派单→工作台→跟进→漏斗）再补外呼/营销/合同/质检；特性开关控制未稳模块。
- 次级风险：报表慢查询（物化/缓存+索引）、外呼合规（限频/黑名单/时段）、回调乱序与重复（状态机+幂等）。

## 4. 部署形态
- `docker-compose.yml`：postgres、redis、api(Nest)、web(静态/反代)；`.env.example` 区分 sandbox/real；`prisma migrate deploy + seed` 作为启动迁移步骤。
- 水平扩展：api 无状态可多副本（WS 用 Redis Adapter + 粘性会话），worker 可独立扩；DB 主从/连接池、Redis 持久化作为演进项写入 runbook。
- CI：lint/typecheck/test/build；交付 GitHub 仓库；前端可选 EdgeOne Pages，后端部署 runbook 含迁移与回滚。
