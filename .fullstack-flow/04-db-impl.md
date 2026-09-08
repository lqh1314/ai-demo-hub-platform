# 数据库层实现摘要：接线机器人 + 电销工作台

> Phase 3 / Step 1 产物。设计依据 `02-database-design.md`，物理实现为 PostgreSQL 15 + Prisma 5。

## 新建/修改文件
- `server/prisma/schema.prisma` — 43 个 model、约 35 个 enum；**代码标识符为 ASCII，物理表名/字段名/枚举值全部中文**（`@@map/@map`），满足命名硬约束。
- `server/prisma/migrations/00000000000000_init/migration.sql` — 初始迁移，`prisma migrate diff --from-empty --to-schema-datamodel` 离线生成，**43 张中文表 + 中文枚举类型**，共 1147 行，无需连库即可产出、可重复生成。
- `server/prisma/migrations/migration_lock.toml` — 锁定 provider=postgresql。
- `server/prisma/seed.ts` — 幂等种子（固定 UUID 主键 + upsert，可重复执行）：默认租户、部门、3 角色与权限、2 技能组、4 账号、机器人配置/意图/知识库、电话线路、5 个沙箱供应商凭证（AES-GCM 加密）、数据字典、质检规则、演示线索/客户/商机。
- `server/src/common/prisma.service.ts` — PrismaClient 封装（onModuleInit connect、enableShutdownHooks）。

## 关键实现决策
1. **标识符 ASCII、物理名中文**：经最小对照实验确认 Prisma 标识符不接受非 ASCII（中文只能进 `@map/@@map` 字符串），因此 model/field/enum 成员用英文，数据库落中文物理名；枚举成员（如 `LeadStage.NEW`）在库内存中文值「新线索」。
2. **多租户**：所有业务表带 `tenantId`，由 `TenantInterceptor` + service 统一注入过滤，默认单租户用固定 DEFAULT_TENANT_ID，水平扩展为多租户不改表结构。
3. **中文表名对照（节选）**：Tenant→租户、User→坐席账号、Lead→线索、Customer→客户、Opportunity→商机、CallSession→通话会话、TranscriptSegment→转写片段、DispatchQueue→派单队列、BotSession→机器人会话、Campaign→外呼任务、QaRecord→质检记录、ProviderConfig→供应商配置、AuditLog→审计日志（全量 43 张见 schema 与迁移 SQL）。
4. **索引落地**：外键列、高频查询列（线索 stage/ownerId、通话 tenantId+createdAt、派单 groupId+state、外呼名单 campaignId+state、审计 createdAt）建单列/复合索引，与 02 文档「先有查询再定索引」一致。
5. **迁移策略**：采用 Prisma Migrate（迁移文件入库、`migrate deploy` 上流水线）；初始迁移可正向建库，后续变更走「扩展-迁移-收缩」。回滚顺序遵循先应用后数据。

## 已做的最小验证
- `prisma validate`：schema valid；`prisma generate`：Client 5.22 成功。
- `migrate diff --from-empty` 成功产出 43 张中文表 DDL（CREATE TABLE 计数=43，枚举 TYPE 为中文）。
- `seed.ts` 单独类型检查通过；随生产构建编译为 `dist/prisma/seed.js`，其相对引用 `../src/common/*` 在 dist 下可正确解析（已核对 require 路径）。

## 遗留问题 / 交给下一层的接口说明
- 本沙箱**无 PostgreSQL**，未对真实库执行 `migrate deploy`/seed；容器 `api` 启动命令已编排为「migrate deploy → seed.js → 启动」，需在有 Docker/Postgres 的环境实跑确认（已列入 07/08 已知边界）。
- DAO 不单独抽层，数据访问统一经 PrismaService 在各 service 内完成（事务用 `$transaction`），下一层后端直接注入 PrismaService。
