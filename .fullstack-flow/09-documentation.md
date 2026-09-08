# 文档与交接：接线机器人 + 电销工作台

> Phase 5 产物。含接口文档、数据库变更说明、ADR、用户手册与交接摘要。全局前缀 `/api/v1`，除标注 @Public 外均需 `Authorization: Bearer <accessToken>`。

## 一、接口文档

### 1.1 鉴权 auth（@Public：login/refresh）
| 方法 | 路径 | 入参 | 说明/响应 |
|---|---|---|---|
| POST | auth/login | {username,password} | {accessToken,refreshToken,permissions,user}；连错 5 次锁 15 分钟 |
| POST | auth/refresh | {refreshToken} | 换新双 token |
| POST | auth/logout | — | 作废当前 token |
| GET | auth/me | — | 当前用户与权限 |

### 1.2 健康 health（@Public）
- GET health/live → `{status:'ok'}`；GET health/ready → `{status,database,cache}`（DB 不通 503）。

### 1.3 组织 iam
- GET/POST users；PATCH/DELETE users/:id；GET/POST departments；GET/POST skill-groups；GET/POST skill-groups/:id/members。

### 1.4 CRM crm
- GET/POST leads；GET leads/:id；POST leads/:id/assign{ownerId}；POST leads/:id/convert。
- GET/POST customers；PATCH customers/:id；GET/POST contacts。
- GET screen-pop?phone=（号码反查客户画像弹屏）。
- GET/POST opportunities；POST opportunities/:id/advance-stage。
- GET activities?type=&id=；POST activities；GET tasks?status=；POST tasks；POST tasks/:id/complete。

### 1.5 机器人 bot
- GET/PATCH bot/config；GET/POST intents；PATCH/DELETE intents/:id；GET kb/bases；GET/POST kb/articles；PATCH kb/articles/:id；POST kb/articles/:id/publish；DELETE kb/articles/:id。

### 1.6 语音/CTI telephony + cti
- telephony（需登录）：GET calls；GET calls/:id；POST calls/dial；POST calls/:id/say|transfer|end|wrap-up；POST queue/:id/accept；GET presence；POST presence/status；GET/POST lines。
- cti（@Public，受 `CTI_WEBHOOK_SECRET` 收口）：POST cti/inbound、cti/utter、cti/end；GET cti/demo-inbound（生产默认关）。

### 1.7 外呼 campaigns
- GET/POST campaigns；PATCH campaigns/:id；POST campaigns/:id/start|pause|run；POST campaigns/:id/targets/import{rows}；GET campaigns/:id/targets；GET campaigns/:id/stats。

### 1.8 质检 qa
- GET/POST qa/rules；PATCH qa/rules/:id；POST qa/calls/:callId/evaluate；GET qa/records；POST qa/records/:id/review{score,comment}。

### 1.9 合同 contracts
- GET/POST contracts；GET contracts/:id；PATCH contracts/:id；POST contracts/:id/sign；POST contracts/:id/payments；POST contracts/payments/:id/paid。

### 1.10 触达 messages
- GET/POST messages/templates；PATCH templates/:id；GET messages/tasks；POST messages/dispatch{templateId,channel,audience,scheduledAt}；GET messages/records。

### 1.11 报表 reports（calls/agents 支持 start/end）
- GET reports/overview → {leads,customers,opps,wonAmount,calls,connectRate,online}
- GET reports/funnel → {leadFunnel:[{stage,count}],oppFunnel:[{stage,count,amount}]}
- GET reports/calls → {total,connected,connectRate,avgTalkSec,totalTalkSec,byDirection[],byDisposition[]}
- GET reports/agents → [{agentId,agentName,calls,talkSec}]（按 calls 降序）

### 1.12 集成 integrations / 系统 system
- integrations：GET/POST keys、POST keys/:id/toggle；GET/POST webhooks、GET webhooks/deliveries；GET/POST providers、GET providers/:id/reveal（解密回显凭证）。
- system：GET/POST dicts、POST dicts/:id/items；GET notifications、GET notifications/unread-count、POST notifications/:id/read；GET system/audit。

### 1.13 统一约定
- 列表响应 `{list,total,page,pageSize}`；错误响应 `{code,message}`，HTTP 状态：400 参数、401 未认证、403 越权、404 不存在、409 冲突、423 锁定、500 服务异常。
- WebSocket：namespace `/realtime`，默认 path `/socket.io`；事件 queue.updated / call.status / call.transcript.segment / call.ai_summary / call.bot_started。

## 二、数据库变更说明
- 本次为**初始建库**：迁移 `00000000000000_init`，43 张中文物理表 + 中文枚举类型，无存量数据影响。
- 正向：`npx prisma migrate deploy`；种子：`node dist/prisma/seed.js`（幂等 upsert，可重复跑）。
- 回滚初始库：`docker compose down -v`（演示，删卷）或 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`（演练环境）。生产后续变更按 08 第 3 节「扩展-迁移-收缩」，破坏性变更必须附 down SQL。
- 命名：代码层 model/字段/枚举为英文，库内表名/列名/枚举值为中文（@map），详见 02/04。

## 三、ADR（关键架构决策）
### ADR-1：Provider 端口 + 内置 Sandbox，而非直接绑死一家供应商
- 背景：真实运营商线路、商用 ASR/TTS/LLM、短信均需资质与密钥，演示环境拿不到。
- 候选：①直接集成某一家（强耦合、离线不可跑）；②端口抽象 + 沙箱实现；③纯 Mock 假数据。
- 决定：选②。定义七类 Provider 端口，默认 Sandbox 实现全链路，配真实凭证即切。
- 后果：离线可完整演示且业务代码零改动切换；代价是需维护一套沙箱实现与端口契约。

### ADR-2：Prisma 标识符 ASCII、物理名中文
- 背景：用户硬约束物理表/字段/枚举中文，但实测 Prisma 非 ASCII 标识符不可行。
- 决定：英文标识符 + `@@map/@map` 中文物理名；枚举成员英文、库内值中文。
- 后果：既满足中文库表要求又保证工具链可用；代价是代码与库内命名存在一层映射（集中在 schema）。

### ADR-3：Redis 可选 + 进程内内存降级
- 背景：200+ 坐席需要共享 presence/队列，但本地/演示不一定有 Redis。
- 决定：RedisService 双态，有 REDIS_URL 走真实 Redis（多实例共享），否则进程内内存（单实例），并在就绪探针上报模式。
- 后果：单机零依赖可跑、多实例水平扩展；代价是内存模式不可多实例共享（已加监控告警）。

### ADR-4：响应式 H5 替代原生 App
- 背景：需要坐席移动/平板可用，但原生双端成本高。
- 决定：AntD 响应式 Web（H5），实时能力用 Socket.IO。
- 后果：一套代码多端可用、交付快；复杂原生通话能力仍依赖运营商软电话 SDK（后续按需接入）。

## 四、用户手册（演示动线）
1. 登录（种子账号，密码均 `Aihub@123456`）：admin 管理员 / manager 主管 / agent01、agent02 坐席。
2. 用「线路模拟器」发起一通呼入 → 机器人多轮应答/FAQ → 命中意向转人工。
3. 坐席在「实时工作台」接听：看客户弹屏画像、双方实时转写、挂断后看 AI 小结、填待办。
4. 线索在 CRM 分配/转化为客户与商机，沿阶段推进至赢单，登记合同与回款。
5. 「外呼任务」导入名单、预测式执行一批；「智能质检」看 AI 评分与人工复检。
6. 管理端看「报表」漏斗/通话/坐席产能；「集成中心」配置真实供应商凭证即可切真。

## 五、交接摘要
### 做了什么
- DB：43 张中文物理表 + 初始迁移 + 幂等种子。
- 后端：13 个业务模块 + common + providers，约 60 个 REST 端点 + WS 实时通道，Provider 沙箱全链路可离线跑。
- 前端：18 个页面 + 统一布局/请求/枚举/实时封装，响应式 H5。
- 工程：根 workspaces、Docker Compose 四服务、两 Dockerfile、nginx 反代、CI 工作流、健康探针、.env.example、README。
### 如何验证
- `npm install`（本沙箱需 `--ignore-scripts`，常规环境直接装）→ `npm run typecheck` → `npm test`（33 绿）→ `npm run build`；或 `docker compose up -d --build` 起全栈按第四节走动线。
### 已知限制
1. 沙箱无 Docker/PG/Redis，**集成测试、E2E、镜像实跑、迁移对真实库执行**未在本机完成，已给容器环境与补测清单（07 第 1.3）。
2. 真实运营商/ASR/TTS/LLM/短信账号与线路资质需用户提供，当前为 Sandbox。
3. 剩余 backlog：超大组织下拉远程搜索、首登强制改密、httpOnly Cookie、覆盖率/CVE 门禁、关联名 include、游标分页（均为 Low/不阻断）。
### 下一步建议
- 在有 Docker 的环境执行 08 的 7.1 实跑全栈并补集成/E2E；推 GitHub 后由 CI 守门；准备真实供应商凭证时按 ADR-1 切换并配置 CTI 密钥；正式上线按 7.2 设强密钥与生产变量、按 7.3 演练回滚。
