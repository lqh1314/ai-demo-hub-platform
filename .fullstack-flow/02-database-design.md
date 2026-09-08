# 数据库设计：接线机器人 + 电销工作台全链路平台

> DBMS：PostgreSQL 15；ORM：Prisma（迁移即版本）；缓存/实时态：Redis 7。所有业务表带 `tenant_id`（预留多租户，默认单组织 default）。
> 通用列（每张业务表均含，下文不重复）：`id uuid pk default gen_random_uuid()`、`tenant_id uuid not null`、`created_at timestamptz default now()`、`updated_at timestamptz default now()`、`deleted_at timestamptz null`（软删）。
> 命名：表蛇形单数；外键 `<实体>_id`；枚举 `*_enum`。金额 `numeric(14,2)`；电话统一存 E.164 规范化列 `phone_e164` + 原始 `phone_raw`。

## 一、ER 关系（按领域分 9 个聚合）

### A. 组织与权限（IAM）
- tenant 1—N department；department 自引用树（parent_id，1—N 子部门）。
- tenant 1—N user；department 1—N user；user N—1 manager(user 自引用)。
- role N—N permission（role_permission）；user N—N role（user_role）。内置角色 ADMIN/MANAGER/AGENT。
- skill_group N—N user（skill_group_agent）；skill_group 1—N queue_item。

### B. 客户 CRM
- customer(B 端客户/公司) 1—N contact；customer 1—N opportunity；customer 1—N activity；customer N—1 owner(user)。
- contact 1—N opportunity（决策联系人，可空）；opportunity 1—N activity、1—N contract、1—N task。
- lead（线索）N—1 customer（转化后绑定，可空）、N—1 owner、N—1 contact（去重关联）。lead --qualify--> 生成/关联 customer+opportunity。
- activity（跟进/动态）多态关联 `(related_type, related_id)` ∈ customer/contact/opportunity/lead；activity N—1 creator(user)。
- task（待办）N—1 owner、多态关联业务对象；task 完成生成 activity。

### C. 通话与实时
- phone_line（线路/号码）1—N call_session；user(坐席) 1—N call_session；customer/contact 1—N call_session。
- call_session 1—N transcript_segment；call_session 1—1 bot_conversation；call_session 1—N qa_record；call_session 1—1 派单结果(queue_item)。
- 坐席实时态（在线/忙碌/通话/小休/离线）主存 Redis（agent:presence），状态变迁落 agent_status_log（1—N by user）。

### D. 机器人与知识库
- bot_config（每租户机器人配置，1 条生效）1—N intent；knowledge_base 1—N kb_article；bot_conversation 1—N bot_turn（或复用 transcript_segment）。
- intent（意图）命中后动作：answer / transfer / collect_lead / open_script。

### E. 外呼
- outbound_campaign 1—N campaign_target；campaign_target N—1 contact/customer；外呼产生的 call_session N—1 campaign_target。
- outbound_campaign N—1 owner；策略 MANUAL/PREVIEW/PREDICTIVE。

### F. 质检
- qa_rule 1—N qa_hit；qa_record 1—N qa_hit；call_session 1—N qa_record（AI 初检 + 人工复检各一条）；qa_record N—1 reviewer(user)。

### G. 合同回款
- opportunity 1—N contract；contract 1—N payment_record。

### H. 营销触达
- message_template 1—N message_task；message_task 1—N message_record；message_record N—1 target(customer/contact)。通道 SMS/EMAIL/WECHAT。

### I. 集成与系统
- provider_config（telephony/asr/tts/llm/sms/email/wechat 各供应商配置）；api_key（开放 API 凭证）1—N webhook_subscription；webhook_subscription 1—N webhook_delivery。
- audit_log（多态操作人/对象）；notification（站内信 N—1 user）；data_dict / data_dict_item（线索来源、客户阶段、行业等字典）。

**基数小结**：1:N 为主干（客户-联系人-商机-合同-回款、任务-通话-转写）；N:N 仅 user↔role、user↔skill_group、role↔permission，均用关联表。

## 二、Schema 定义（核心表；枚举与关键列）

### A. IAM
```
tenant(id, name, plan, status[ACTIVE|SUSPENDED], default_locale)
department(id, tenant_id, parent_id→department, name, path ltree, sort)
user(id, tenant_id, dept_id→department, manager_id→user, username uq(tenant), email uq(tenant),
     password_hash, real_name, avatar_url, mobile, role_alias[ADMIN|MANAGER|AGENT],
     status[ACTIVE|DISABLED|INVITED], job_no, last_login_at, fail_count, locked_until)
role(id, tenant_id|null, code uq, name, is_system)
permission(id, code uq, name, module, action)
role_permission(role_id, permission_id, PK(role_id,permission_id))
user_role(user_id, role_id, PK(user_id,role_id))
skill_group(id, tenant_id, name, strategy[ROUND_ROBIN|LEAST_LOAD|SKILL_MATCH], priority, overflow_seconds)
skill_group_agent(group_id, user_id, skill_level int, PK(group_id,user_id))
```

### B. CRM
```
lead_stage_enum: NEW(新线索) FOLLOWING(跟进中) CONVERTED(已转化) INVALID(无效) DROPPED(已流失)
lead_source_enum: HOTLINE INBOUND_BOT WEB FORM AD REFERRAL IMPORT MANUAL OUTBOUND
lead(id, tenant_id, name, company, phone_e164, phone_raw, email, source[lead_source_enum],
     intent_level[HIGH|MID|LOW|UNKNOWN], intent_tags text[], owner_id→user, group_id→skill_group,
     stage[lead_stage_enum], customer_id→customer?, contact_id→contact?,
     first_call_id, last_call_id, last_follow_at, raw_payload jsonb, converted_at)
customer(id, tenant_id, owner_id→user, name, unified_credit_code, industry, scale[A|B|C|D|E],
         website, area, address, source, stage[lead_stage_enum], level[KA|BIG|MID|SMALL],
         last_follow_at, next_follow_at, remark jsonb)
contact(id, tenant_id, customer_id→customer, name, title, phone_e164, phone_raw, email, wechat,
        is_primary bool, decision_role[DECIDER|INFLUENCER|USER|GATEKEEPER], remark)
opp_stage_enum: QUALIFIED NEEDS SOLUTION PROPOSAL NEGOTIATION WON LOST
opportunity(id, tenant_id, customer_id→customer, contact_id→contact?, owner_id→user,
            name, stage[opp_stage_enum], amount numeric, probability int, expected_close date,
            win_reason/lost_reason, stage_changed_at, source)
activity_type_enum: CALL NOTE MEETING EMAIL WECHAT STAGE_CHANGE SYSTEM
activity(id, tenant_id, creator_id→user, type[activity_type_enum], related_type, related_id,
         content, call_id→call_session?, direction?, duration?, stage_from, stage_to, happened_at)
task_status_enum: PENDING DONE CANCELED; task_priority: LOW NORMAL HIGH URGENT
task(id, tenant_id, owner_id→user, creator_id→user, related_type, related_id, title, content,
     priority[task_priority], status[task_status_enum], due_at, remind_at, finished_at, result)
```

### C. 通话/实时
```
call_dir_enum: INBOUND OUTBOUND
call_status_enum: RINGING IN_QUEUE BOT_ACTIVE TRANSFERRING AGENT_ACTIVE WRAP_UP ENDED MISSED FAILED
disposition_enum: INTENDED FOLLOWUP NO_ANSWER BUSY REFUSED INVALID OTHER
phone_line(id, tenant_id, provider, number_e164, label, group_id, concurrency_limit, enabled)
call_session(id, tenant_id, line_id→phone_line, call_provider_ref, direction[call_dir_enum],
   from_no, to_no, phone_e164, customer_id?, contact_id?, lead_id?, agent_id→user?, group_id?,
   campaign_target_id?, status[call_status_enum], disposition[disposition_enum],
   is_bot_handled bool, transferred bool, transfer_from_agent?, queue_enter_at, answer_at, end_at,
   duration_sec int, talk_sec int, wait_sec int, hangup_by[CALLER|AGENT|BOT|SYSTEM],
   recording_url, transcript_text, ai_summary jsonb, ai_intent, ai_slots jsonb, sentiment,
   raw jsonb)
speaker_enum: BOT AGENT CUSTOMER
transcript_segment(id, tenant_id, call_id→call_session, seq int, speaker[speaker_enum],
   text, start_ms int, end_ms int, confidence numeric, audio_url?, emotion?)
agent_status_enum: OFFLINE ONLINE IDLE BUSY ON_CALL WRAP_UP BREAK
agent_status_log(id, user_id, from_status, to_status, call_id?, at)
queue_item(id, tenant_id, group_id→skill_group, lead_id?, call_id?, phone_e164, priority int,
   strategy, state[WAITING ASSIGNED TIMEOUT CLOSED], assigned_to→user?, enqueue_at, assign_at, ttl_sec)
```

### D. 机器人/知识库
```
bot_config(id, tenant_id, name, enabled bool, welcome_text, fallback_text, model jsonb,
           voice jsonb, transfer_keywords text[], idle_timeout_sec, max_bot_turns, working_hours jsonb,
           after_hours_action[VOICEMAIL|TRANSFER|BOT])
intent(id, tenant_id, name, code, examples text[], keywords text[], slots jsonb,
       action[ANSWER|TRANSFER|COLLECT_LEAD|SCRIPT], answer, target_group_id?, next_intent?, enabled, priority)
kb_status: DRAFT PUBLISHED ARCHIVED
knowledge_base(id, tenant_id, name, description)
kb_article(id, tenant_id, kb_id→knowledge_base, question, answer, keywords text[], tags text[],
           hit_count, status[kb_status], version, published_at)
bot_conversation(id, tenant_id, call_id→call_session, recognized_intent, slots jsonb,
                 outcome[RESOLVED|LEAD_COLLECTED|TRANSFERRED|ABANDONED], turn_count, summary)
```

### E. 外呼
```
campaign_status: DRAFT RUNNING PAUSED FINISHED CANCELED
dial_strategy: MANUAL PREVIEW PREDICTIVE
target_state: PENDING QUEUED DIALING CONNECTED NO_ANSWER FAILED FOLLOWUP BLACKLISTED
outbound_campaign(id, tenant_id, owner_id, name, strategy[dial_strategy], status[campaign_status],
   line_id, group_id, caller_number, start_at/end_at, daily_limit, concurrency int,
   predictive_ratio numeric, filter_sql?/rule jsonb, stats jsonb)
campaign_target(id, tenant_id, campaign_id→outbound_campaign, customer_id?, contact_id?,
   phone_e164, state[target_state], attempts int, last_call_id?, next_dial_at, result_code, custom jsonb,
   UQ(campaign_id, phone_e164))
```

### F. 质检
```
qa_rule_type: KEYWORD SCRIPT REGEX SILENCE EMOTION SPEED
qa_rule(id, tenant_id, name, type[qa_rule_type], category, pattern text[], weight int,
        must_hit bool, enabled)
qa_status: AI_DONE PENDING_REVIEW REVIEWED APPEAL
qa_record(id, tenant_id, call_id→call_session, type[AI|MANUAL], status[qa_status], score int,
          reviewer_id?, reviewed_at, comment)
qa_hit(id, qa_record_id, rule_id, segment_id?, matched_text, deduct int)
```

### G. 合同回款
```
contract_status: DRAFT SIGNED EXECUTING COMPLETED TERMINATED
contract(id, tenant_id, opportunity_id→opportunity, customer_id, code uq(tenant), name, amount,
         sign_date, start_date, end_date, status[contract_status], file_url, owner_id)
pay_status: PLANNED RECEIVED OVERDUE PARTIAL
payment_record(id, tenant_id, contract_id→contract, amount, planned_date, actual_date?,
               status[pay_status], method, remark)
```

### H. 营销触达
```
channel_enum: SMS EMAIL WECHAT; msg_status: QUEUED SENT DELIVERED FAILED READ
message_template(id, tenant_id, channel[channel_enum], name, title?, content, variables jsonb, audit_status)
message_task(id, tenant_id, template_id, channel, target_rule jsonb, scheduled_at, status, owner_id, stats jsonb)
message_record(id, tenant_id, task_id?, channel, to_addr, content, status[msg_status],
               provider_msg_id, provider, send_at, callback jsonb)
```

### I. 集成/系统
```
provider_type: TELEPHONY ASR TTS LLM SMS EMAIL WECHAT
provider_config(id, tenant_id, type[provider_type], code, name, enabled, priority,
                credentials_enc bytea, config jsonb)   -- 凭证 AES-GCM 加密，不明文
api_key(id, tenant_id, owner_id?, name, ak uq, sk_hash, scopes text[], enabled, last_used_at)
webhook_subscription(id, tenant_id, api_key_id, event, url, secret, enabled)
webhook_delivery(id, subscription_id, event, payload jsonb, status, http_code, attempts, next_retry_at)
audit_log(id, tenant_id, actor_id, actor_type[USER|API|SYSTEM], action, object_type, object_id,
          before jsonb, after jsonb, ip, ua, at)
notification(id, tenant_id, user_id, type, title, content, related_type, related_id, is_read, at)
data_dict(id, tenant_id, code, name); data_dict_item(id, dict_id, label, value, sort, enabled)
```

## 三、索引策略（先有查询再定索引）

- **租户隔离基线**：几乎所有查询都带 tenant_id，核心列表建复合索引且把等值列在前、排序列在后。
- 来电弹屏（最高优先，要求毫秒级）：
  - `contact(tenant_id, phone_e164)`、`customer` 经 contact 关联；`lead(tenant_id, phone_e164)`；均为 btree，支撑号码反查画像。
- 坐席工作台列表：
  - `call_session(tenant_id, agent_id, started_at desc)`、`call_session(tenant_id, status)`、`call_session(tenant_id, group_id, status)`。
  - `task(tenant_id, owner_id, status, due_at)`、`activity(related_type, related_id, happened_at desc)`。
  - 客户/线索：`customer(tenant_id, owner_id, updated_at desc)`、`lead(tenant_id, owner_id, stage, updated_at desc)`、`opportunity(tenant_id, owner_id, stage)`。
- 派单队列：`queue_item(tenant_id, group_id, state, priority desc, enqueue_at)`；坐席负载走 Redis 有序集合，DB 仅留痕。
- 外呼调度：`campaign_target(campaign_id, state, next_dial_at)` 部分索引 `WHERE state IN ('PENDING','QUEUED')`（高频捞取待拨）；`UQ(campaign_id, phone_e164)` 防重拨。
- 报表聚合：`call_session(tenant_id, started_at)` BRIN + btree；漏斗按 `opportunity(tenant_id, stage)`；质检 `qa_record(tenant_id, status)`。报表热点用物化视图/Redis 缓存（见架构）。
- 唯一索引：user(username)、user(email)、contract(code)、api_key(ak) 均为 `(tenant_id, col)` 复合唯一；关联表以联合主键天然唯一。
- 文本/标签：kb_article 与 intent 的检索优先用 PostgreSQL `GIN`（`keywords`/`tsvector`）支撑 FAQ 初筛，向量语义检索走 LLM Provider 的向量库（适配层，不强耦合 DB）。
- 软删：唯一索引带条件 `WHERE deleted_at IS NULL`，避免软删后占用唯一值。

## 四、迁移策略（Prisma Migrate，可回滚、不停机）

1. 每个变更一个迁移文件，`migrate deploy` 上生产，`migrate resolve` 处理异常；种子 `seed.ts` 负责 default 租户、三角色+权限、字典、管理员、sandbox provider、示例技能组。
2. 采用 **扩展—迁移—收缩（Expand/Migrate/Contract）**：加列先 nullable/带默认 → 双写或回填脚本（分批，带限速）→ 校验一致 → 下个版本再删旧列。
3. 枚举新增值只追加不重排；重命名/拆表走中间视图，避免长锁表。大表加索引使用 `CREATE INDEX CONCURRENTLY`（Prisma 用原生 SQL 迁移承载）。
4. 默认值回填用 `update ... where ... limit 批`；tenant_id 对存量一次性回填 default。
5. **回滚**：每个迁移配 `down.sql`；DDL 优先可逆向（加列可直接 drop，删列前先备份列/影子表）。部署 runbook 记录“迁移前备份—执行—校验—失败回退”步骤。
6. 启动顺序：db 就绪 → `prisma migrate deploy` → `seed`（幂等）→ 服务启动健康检查。

## 五、查询模式（关键读写路径与支撑）

1. **呼入弹屏**：线路回调 → 规范化号码 → 并行查 contact/customer/lead/最近 activity/进行中 opportunity → 组装画像快照；命中 phone 索引，单次聚合查询返回。
2. **实时转写**：segment 先经 WS 推送并写 Redis 缓冲，通话结束批量落库（降低写放大），列表按 call_id+seq。
3. **派单**：queue_item 入队 → Lua 脚本在 Redis 按策略选空闲坐席（IDLE 且技能匹配、最少会话数）→ 指派并 WS 振铃；无空闲则排队等待/溢出，DB 异步留痕。
4. **坐席我的工作台**：今日待办、我的客户、进行中通话、今日外呼名单，走 `(tenant,owner,...)` 复合索引 + React Query 分页。
5. **漏斗/报表**：按时间范围对 opportunity/call_session/lead 做分组聚合，结果缓存 Redis（key 带维度与时间桶，TTL 60–300s），下钻即按维度细化查询。
6. **外呼调度**：BullMQ 定时任务按 `(campaign,state,next_dial_at)` 捞批次 → 限速/并发控制 → Provider 拨号 → 回写 target 与 call_session。
7. **审计/时间线**：activity + audit_log 按对象聚合，游标分页（keyset pagination，避免深 offset）。

## 六、数据访问层（Repository/DAO 接口，按聚合）

> 仅列方法签名与职责；Controller/Service 不直接写 SQL，一律经 Repository。所有方法隐式注入 tenant_id（租户上下文中间件），禁止跨租户读。
```
UserRepo: findByCredentials(tenant,username), findByIds, listPage(filter,page), upsert, softDelete,
          lockForLogin(id)->(fail_count,locked_until), bindRoles, setStatus
RbacRepo: rolesOf(userId), permissionsOf(userId), hasPermission(userId,code)
CustomerRepo: getById, searchPage(tenant,query,owner,tags,page), upsertByPhone(tenant,e164),
              ownersWorkload(ids), updateStage, timeline(id)
ContactRepo: findByPhoneE164(tenant,e164), listByCustomer, upsert
LeadRepo: createFromBot(payload), assign(id,owner/group), convert(id,customer,opp), listPage, autoDedup(e164)
OpportunityRepo: create, advanceStage(id,to,reason), funnelCounts(tenant,range), listPage
ActivityRepo: append(activity), timeline(relatedType,relatedId,cursor), bulkInsertForCall
TaskRepo: myOpenTasks(owner), create, complete(id,result), remindDue(now)
CallRepo: createSession, updateStatus, attachAi(id,summary,intent,slots), endSession(id,stats),
          listByAgent/page, segmentsBulkUpsert, aggregateReport(tenant,range,dims)
QueueRepo: enqueue(item), pickAgent(group,strategy), assign(item,agentId), release, timeoutSweep
PresenceRepo(Redis): setStatus(agent,status), idleAgents(group), incrTalking(agent), snapshot(tenant)
BotRepo: activeConfig(tenant), intentsOf(tenant), kbSearch(tenant,query,top), saveConversation
CampaignRepo: create, nextDialBatch(campaign,limit), markResult(target,state,callId), stats
QaRepo: rules(), createAiRecord, addHits, review, listPage
ContractRepo/PaymentRepo: create, sign, addPayment, receivedAmount(contractId)
MessageRepo: createTask, enqueueRecords, updateProviderStatus
ProviderConfigRepo: enabledOfType(tenant,type)->ordered[], decryptCreds(id)
IntegrationRepo: issueApiKey, verifyAkSk, subscriptionsFor(event), recordDelivery
AuditRepo: log(entry), searchPage
```

## 七、命名约定（用户硬约束：物理表名/字段名使用中文）
- 物理层：PostgreSQL **表名与列名一律中文**，建表/查询由 Prisma `@@map("中文表名")`、`@map("中文列名")` 自动加双引号；枚举类型与枚举值同样 `@map` 为中文。
- 代码层：Prisma model/字段使用英文标识符（保证工程可维护、避免在业务代码里散落裸中文标识符），仅数据库内呈现中文；Repository 不写裸 SQL，规避中文标识符手写风险。
- 示例：model Customer → 表 `客户`；字段 name → `客户名称`、ownerId → `负责人编号`；枚举客户等级 KA/BIG... → `KA客户/大客户/中型/小微`。

> **实测修正（实现阶段验证，2026-09）**：经最小对照实验确认，Prisma 的 model / enum / 字段 / 枚举成员**标识符只接受 ASCII**，中文无法作为标识符（schema validate 直接报错）；中文只能进入 `@map("…")` / `@@map("…")` 字符串。最终方案为「**代码层全英文标识符 + 数据库物理层全中文名**」：Prisma Client 访问器为英文小写 model 名（如 `prisma.lead`），where/data 中枚举用英文成员（如 `stage:'WON'`），写入 PostgreSQL 后物理表名、列名、枚举值均为中文。另：schema 不支持 `/* */` 块注释、block 内每行只能声明一个字段/枚举值。该方案已通过 `prisma validate` + `prisma generate`，满足「物理表名/字段名/枚举值中文」硬约束。
