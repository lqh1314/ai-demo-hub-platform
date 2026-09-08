# DESIGN SYSTEM — AI Demo Hub · 接线机器人 + 电销工作台

> design-fusion Phase 1 产物。行业：SaaS / B2B，细分「AI 联络中心 + 实时销售作战台」。
> 决策层（UI/UX Pro Max）结论，作为执行层（Taste，gpt-taste 严格暗色）的硬约束。

```
DESIGN SYSTEM — AI Demo Hub
├── PATTERN : Interactive Live-Demo Console（交互式实时作战台）
│            转化策略：首屏即「正在发生的一通来电」，用真实运转的界面代替静态卖点，
│            CTA「进入实时演示」首屏可见，并在能力区 / 作战台区重复出现
├── STYLE   : Dark Mission-Control × Bento × AI-Native（gpt-taste 严格暗色）
│            关键词：深空底色、1px 渐变描边玻璃面板、信号辉光、流式转写、数据密集
│            最适合：需要体现「实时、智能、可控」的 AI 运营产品
├── COLORS  :
│   bg 基底      #080B11 / #0C111B（冷调近黑，非纯黑）
│   面板 surface #10151F / #141B28；描边 rgba(148,160,184,.14)
│   主色 Primary #46E6C8（信号青）；辅助 #5AB2FF（电蓝）
│   CTA 渐变     linear-gradient(135deg,#46E6C8,#5AB2FF)，深色按钮 + 青色辉光
│   人工/提醒     #FFC261（琥珀，仅用于「转人工/待办」语义）
│   成功 #3DDC97 / 风险 #FF7A90（语义色，不单独承载含义，配图标文字）
│   正文 #E9EEF7；次要 #9AA6BD；弱化 #6B7689
│   注意：禁用通用 AI 紫粉渐变，全案只允许 青/蓝 两个品牌色 + 中性色 + 语义色
├── TYPO    : 展示 Space Grotesk（数字/英文标题，科技克制）
│            正文 Inter + Noto Sans SC；等宽 JetBrains Mono（号码/转写/指标/波形）
│            字重对比：展示 600/700，正文 400/500，标签 500 + 0.08em 字距大写
│            正文行高 1.6
├── KEY EFFECTS :
│   1. 顶部环境光：极淡网格 + 两团青/蓝柔光（低透明、缓慢漂移，尊重 reduced-motion）
│   2. 玻璃面板：背景 blur、1px 由亮到暗的渐变描边、内高光
│   3. Live 脉冲点、CSS 声纹波形（多柱错相位）、转写流式上屏
│   4. 全链路步骤自动播放 + 可点击定位；数字进入视口 count-up
│   5. 卡片 hover：translateY(-2px) + 描边变亮（≤220ms，不引发布局位移）
├── ANTI-PATTERNS（本行业明确禁止）:
│   ✗ 紫粉 AI 渐变 / 通用 hero 渐变 blob / 居中长段落
│   ✗ 一排一模一样的图标卡 / 全部 12px 圆角 / 每个卡都投影
│   ✗ 纯黑 #000 文字与底色、灰上灰、Emoji 当图标、灰色占位 logo 墙
│   ✗ 界面文案使用破折号 —（改用逗号、冒号、断句）；禁 lorem / TODO / 半成品
│   ✗ 为「科技感」堆无意义装饰与无限循环动画
└── PRE-DELIVERY CHECKLIST :
    [ ] 正文对比 ≥4.5:1，大字/控件 ≥3:1      [ ] 375/768/1024/1440 无横向滚动
    [ ] 键盘可达 + 可见 focus ring            [ ] prefers-reduced-motion 关闭非必要动效
    [ ] 语义化 header/nav/main/section/footer，单一 h1   [ ] 触控目标 ≥44px
    [ ] 真实业务文案（呼入/转人工/AI小结/漏斗/200坐席），无占位
```

## 表盘（Dials，SaaS/B2B 调整后）
- DESIGN_VARIANCE 6（在 Bento 内做非对称，打破传统后台）
- MOTION_INTENSITY 4（实时感来自流式转写/声纹/步骤，不做炫技转场）
- VISUAL_DENSITY 7（作战台信息密度高，但用分层与留白呼吸）

## 内容映射（来自现有平台，保证 Demo 真实）
- 智能接线：多轮应答 / FAQ / 意向识别 / 自动留资 / 转人工
- 派单：轮询、最少负载、技能匹配三套策略；待接队列
- 坐席台：弹屏、实时转写、AI 小结、跟进待办
- 增长闭环：线索、客户、商机漏斗、外呼任务、合同回款、营销触达、智能质检、经营报表
- Provider 端口：TELEPHONY/ASR/TTS/LLM/SMS 等内置 Sandbox，配密钥切真实
