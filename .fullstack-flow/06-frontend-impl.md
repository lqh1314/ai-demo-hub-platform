# 前端界面实现摘要：接线机器人 + 电销工作台

> Phase 3 / Step 3 产物。React 18 + TypeScript + Vite 5 + Ant Design 5 + React Query 5 + Zustand + ECharts + Socket.IO-client，响应式 H5（替代原生 App）。

## 新建/修改文件
- 基础设施：`api/client.ts`（http 封装、`api()` 解包、401 自动刷新一次、localStorage 双 token）、`lib/hooks.ts`（`usePaged` 分页查询 / `useOnce` 单取/轮询）、`lib/enums.ts`（枚举中文标签与颜色）、`lib/socket.ts`（getSocket 单例 + 事件订阅）、`store/auth.ts`（登录态）、`components/Layout.tsx`（侧边导航+权限菜单+顶栏）、`components/ETag.tsx`（枚举标签，默认导出）、`App.tsx`（19 条路由 + 登录守卫）、`global.css`。
- 18 个页面：
  - 工作台与实时：`Login`、`Workbench`（待办/队列/今日概览）、`LiveCall`（坐席实时通话：弹屏/双方转写/AI 小结/操作）、`Simulator`（模拟呼入驱动 CTI 全链路）。
  - CRM：`crm/Leads`（搜索/筛选/新建/分配/转化/详情时间线）、`crm/Customers`（客户 + 商机/联系人/动态 Tabs）、`crm/Opportunities`（商机阶段推进/输单）。
  - 外呼：`outbound/Outbound`（任务 CRUD/启停/预测式执行一批/名单导入/名单抽屉+统计轮询）。
  - 机器人：`bot/BotConfig`、`bot/Intents`（关键词/语料/命中动作）、`bot/Knowledge`（知识库切换+文章 CRUD+发布）。
  - 质检/合同/触达：`Qa`（记录+规则 Tabs、人工复检）、`Contracts`（合同/签订/回款 Timeline）、`Messages`（群发任务+记录+模板 Tabs）。
  - 报表：`Reports`（6 KPI、线索/商机双漏斗、通话结果饼图、呼入呼出柱、坐席产能横向柱、时间范围）。
  - 管理端：`admin/Org`（账号/部门/技能组）、`admin/Providers`（供应商凭证 reveal/开放密钥/Webhook 投递）、`admin/System`（字典/通知/审计）。

## 关键实现决策
1. **服务端状态用 React Query、本地/会话态用 Zustand**：列表统一 `usePaged`（兼容 `{list,total}` 与裸数组），单取/轮询用 `useOnce`（refetchInterval 仅 number|undefined），不另造请求封装。
2. **三态闭环**：所有列表/详情处理 loading / empty（antd `locale.emptyText`）/ error；表单提交态防重复、后端错误 message 回显。
3. **枚举单一事实源**：展示统一走 `lbl()/colorOf()` 或 `ETag`，与后端英文枚举成员、库内中文值一一对应。
4. **实时数据**：LiveCall/队列订阅 socket 事件（call.status / call.transcript.segment / call.ai_summary / queue.updated），轮询仅用于统计等弱实时场景。
5. **性能**：Vite `manualChunks` 拆 react/antd/charts/query 四 vendor 包，业务主包 126KB（gzip≈41KB）；路由级代码按页组织、图表按需引入。
6. **响应式**：AntD Grid + Flex，工作台/弹屏在平板与手机宽度可用，满足「H5 替代原生 App」。

## 已做的最小验证
- `tsc --noEmit` **0 错误**（首轮 18 处全部修复，详见 07 第 4.1）。
- `vite build` **exit 0**，3782 模块，分包后最大 chunk antd 1.26MB / charts 1.05MB，均低于 1.6MB 告警线，无体积告警。

## 遗留问题 / 交付说明
- 无后端环境时以 tsc + vite build 保证可编译可打包；组件/E2E（Vitest/Playwright）补测路径见 07。
- 个别非阻断未使用变量（noUnusedLocals 关闭）不影响产物，列入清理 backlog。
