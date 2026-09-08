# 后端服务实现摘要：接线机器人 + 电销工作台

> Phase 3 / Step 2 产物。NestJS 10 + TypeScript（strict）+ Prisma 5 + Socket.IO，全局前缀 `/api/v1`，WS namespace `/realtime`。

## 新建/修改文件（按模块）
- `common/` 横切层：`main.ts`（全局前缀/ValidationPipe/异常过滤器/**生产密钥启动闸门**）、`auth.guard.ts`（JWT 全局守卫 + @Public 白名单）、`token.service.ts`（双 Token、刷新）、`tenant.context.ts`+`tenant.interceptor.ts`（租户注入）、`redis.service.ts`（Redis/进程内内存双态，含 TTL）、`crypto.util.ts`（AES-256-GCM 供应商凭证加解密）、`security.ts`（密钥闸门/CTI 授权纯函数）、`health.controller.ts`（live/ready 探针）、`pagination.ts`、`phone.util.ts`、`all-exceptions.filter.ts`、`biz.exception.ts`、`current-user.decorator.ts`。
- `iam/`：登录刷新登出/me、账号 CRUD、部门、技能组与成员、RBAC（auth/iam/rbac.service + dto）。
- `crm/`：线索/客户/联系人/商机/跟进动态/待办、来电弹屏、分配策略 `assignment.strategy.ts`（轮询/最少负载/技能匹配 + 预测式外拨计数）、线索转化、商机推进。
- `bot/`：`nlu.ts`（关键词重叠打分、意图/知识库命中、槽位抽取、意向分级、转人工判定）、`dialog.orchestrator.ts`（多轮对话状态机、留资/转人工/FAQ）、bot 配置/意图/知识库管理。
- `telephony/`：`call.service.ts`（呼入/机器人/转接/接听/示闲小结全状态机）、`queue.service.ts`+`presence.service.ts`（派单与坐席状态，Redis）、`realtime.gateway.ts`+`realtime.bus.ts`（WS 事件：queue.updated/call.status/call.transcript.segment/call.ai_summary）、`cti.controller.ts`（运营商回调，**带密钥收口**）、线路管理。
- `outbound/`：外呼任务 CRUD/启停/执行一批预测式、名单导入与状态流转、任务统计。
- `qa/`：`qa.scoring.ts`（必达/禁忌/语速/静音/情绪评分纯函数）、规则管理、AI 质检、人工复检。
- `contract/`：合同 CRUD/签订、回款计划与确认回款。
- `message/`：消息模板、群发任务（SMS/EMAIL/WECHAT 沙箱）、投递记录。
- `report/`：`report.service.ts`（概览/双漏斗/通话分析/坐席产能，**Redis 时间桶缓存 120s/60s**）、`rate.ts` 比率纯函数。
- `integration/`：开放 API Key、Webhook 订阅与投递记录、供应商配置与凭证 reveal。
- `system/`：数据字典、站内通知、审计日志。
- `providers/`：`ports.ts`（TELEPHONY/ASR/TTS/LLM/SMS/EMAIL/WECHAT 七类端口接口）、`provider.registry.ts`（按配置选实现，配密钥即切真）、`sandbox.provider.ts`（内置沙箱实现，离线可跑全链路）。

## 关键实现决策
1. **分层纪律**：Controller 只做协议转换，业务在 Service，跨模块复用逻辑抽纯函数（nlu/assignment/qa.scoring/rate/security），纯函数全部可单测。
2. **Provider 端口 + 沙箱**：真实运营商/商用 ASR/TTS/LLM/短信统一走端口接口；默认注入 Sandbox 实现保证无外部账号也能演示「呼入→对话→转写→小结」，配置真实凭证后 registry 切换，不改业务代码。
3. **实时通道**：坐席状态与派单队列走 Redis（多实例共享），无 REDIS_URL 时进程内内存降级；转写片段 WS 增量推送、结束批量落库。
4. **安全基线**：全局 JWT 守卫默认拒绝、租户水平隔离、bcrypt(cost=10)+连错锁定、凭证 AES-GCM、CTI 回调密钥校验、生产占位密钥拒绝启动（详见 07）。
5. **错误链闭环**：BizException + AllExceptionsFilter 统一 `{code,message}`，前端 client 拦截 401 自动刷新一次。

## 已做的最小验证
- `tsc --noEmit` 0 错误；生产 `tsc -p tsconfig.build.json` exit 0，产出 `dist/src` + `dist/prisma`。
- 5 套件 33 单测全绿：nlu 8 / assignment 6 / qa.scoring 6 / report.rate 3 / security 10。
- 静态扫描：无裸 SQL 拼接（仅 health 用参数化 `SELECT 1` 模板）、无 eval、无凭证日志。

## 遗留问题 / 交给下一层的接口说明
- 接口清单（方法+路径+入参/出参）全量见 `09-documentation.md`；前端按全局前缀 `/api/v1` 对接，WS 走 `/realtime`。
- 无 DB 未做 supertest 接口集成测试，补测路径见 07 第 1.3 节。
