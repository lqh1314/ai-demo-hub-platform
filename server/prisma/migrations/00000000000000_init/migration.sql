-- CreateEnum
CREATE TYPE "枚举_租户状态" AS ENUM ('启用', '停用');

-- CreateEnum
CREATE TYPE "枚举_用户状态" AS ENUM ('待激活', '启用', '停用');

-- CreateEnum
CREATE TYPE "枚举_角色别名" AS ENUM ('管理员', '主管', '坐席');

-- CreateEnum
CREATE TYPE "枚举_派单策略" AS ENUM ('轮询', '最少负载', '技能匹配');

-- CreateEnum
CREATE TYPE "枚举_线索阶段" AS ENUM ('新线索', '跟进中', '已转化', '无效', '已流失');

-- CreateEnum
CREATE TYPE "枚举_线索来源" AS ENUM ('热线', '机器人接入', '官网', '表单', '广告', '转介绍', '导入', '手工', '外呼');

-- CreateEnum
CREATE TYPE "枚举_意向等级" AS ENUM ('高', '中', '低', '未知');

-- CreateEnum
CREATE TYPE "枚举_客户规模" AS ENUM ('2000人以上', '500-2000人', '100-500人', '20-100人', '20人以下');

-- CreateEnum
CREATE TYPE "枚举_客户等级" AS ENUM ('KA客户', '大客户', '中型客户', '小微客户');

-- CreateEnum
CREATE TYPE "枚举_决策角色" AS ENUM ('决策者', '影响者', '使用者', '把关者');

-- CreateEnum
CREATE TYPE "枚举_商机阶段" AS ENUM ('需求确认', '需求挖掘', '方案', '报价', '谈判', '赢单', '输单');

-- CreateEnum
CREATE TYPE "枚举_动态类型" AS ENUM ('通话', '跟进备注', '拜访', '邮件', '企微', '阶段变更', '系统');

-- CreateEnum
CREATE TYPE "枚举_任务状态" AS ENUM ('待办', '已完成', '已取消');

-- CreateEnum
CREATE TYPE "枚举_任务优先级" AS ENUM ('低', '普通', '高', '紧急');

-- CreateEnum
CREATE TYPE "枚举_通话方向" AS ENUM ('呼入', '呼出');

-- CreateEnum
CREATE TYPE "枚举_通话状态" AS ENUM ('振铃', '排队中', '机器人接听', '转接中', '人工通话', '话后处理', '已结束', '未接', '呼叫失败');

-- CreateEnum
CREATE TYPE "枚举_通话结果" AS ENUM ('有意向', '待跟进', '未接通', '占线', '拒绝', '无效号码', '其他');

-- CreateEnum
CREATE TYPE "枚举_话者" AS ENUM ('机器人', '坐席', '客户');

-- CreateEnum
CREATE TYPE "枚举_坐席状态" AS ENUM ('离线', '在线', '空闲', '忙碌', '通话中', '话后', '小休');

-- CreateEnum
CREATE TYPE "枚举_队列状态" AS ENUM ('等待分配', '已分配', '超时', '已关闭');

-- CreateEnum
CREATE TYPE "枚举_知识状态" AS ENUM ('草稿', '已发布', '已归档');

-- CreateEnum
CREATE TYPE "枚举_机器人动作" AS ENUM ('直接回答', '转人工', '收集线索', '进入话术');

-- CreateEnum
CREATE TYPE "枚举_机器人结果" AS ENUM ('已解决', '已留资', '转人工', '客户放弃');

-- CreateEnum
CREATE TYPE "枚举_外呼状态" AS ENUM ('草稿', '进行中', '已暂停', '已完成', '已取消');

-- CreateEnum
CREATE TYPE "枚举_拨号策略" AS ENUM ('手动', '预览', '预测式');

-- CreateEnum
CREATE TYPE "枚举_目标状态" AS ENUM ('待拨打', '排队中', '拨打中', '已接通', '未接通', '失败', '待跟进', '黑名单');

-- CreateEnum
CREATE TYPE "枚举_质检规则类型" AS ENUM ('关键词', '话术', '正则', '静音', '情绪', '语速');

-- CreateEnum
CREATE TYPE "枚举_质检状态" AS ENUM ('AI初检', '待复检', '已复检', '申诉中');

-- CreateEnum
CREATE TYPE "枚举_质检类型" AS ENUM ('智能质检', '人工质检');

-- CreateEnum
CREATE TYPE "枚举_合同状态" AS ENUM ('草稿', '已签署', '履约中', '已完成', '已终止');

-- CreateEnum
CREATE TYPE "枚举_回款状态" AS ENUM ('计划中', '已回款', '逾期', '部分回款');

-- CreateEnum
CREATE TYPE "枚举_通道类型" AS ENUM ('短信', '邮件', '企微');

-- CreateEnum
CREATE TYPE "枚举_消息状态" AS ENUM ('排队', '已发送', '已送达', '失败', '已读');

-- CreateEnum
CREATE TYPE "枚举_供应商类型" AS ENUM ('语音线路', '语音识别', '语音合成', '大模型', '短信', '邮件通道', '企微通道');

-- CreateEnum
CREATE TYPE "枚举_审计主体" AS ENUM ('用户', '开放接口', '系统');

-- CreateTable
CREATE TABLE "租户" (
    "租户编号" TEXT NOT NULL,
    "租户名称" TEXT NOT NULL,
    "套餐" TEXT,
    "状态" "枚举_租户状态" NOT NULL DEFAULT '启用',
    "默认语言" TEXT NOT NULL DEFAULT 'zh-CN',
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "租户_pkey" PRIMARY KEY ("租户编号")
);

-- CreateTable
CREATE TABLE "部门" (
    "部门编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "上级部门编号" TEXT,
    "部门名称" TEXT NOT NULL,
    "层级路径" TEXT,
    "排序" INTEGER NOT NULL DEFAULT 0,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "部门_pkey" PRIMARY KEY ("部门编号")
);

-- CreateTable
CREATE TABLE "坐席账号" (
    "用户编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "部门编号" TEXT,
    "直属主管编号" TEXT,
    "登录账号" TEXT NOT NULL,
    "邮箱" TEXT,
    "密码哈希" TEXT NOT NULL,
    "姓名" TEXT NOT NULL,
    "头像" TEXT,
    "手机号" TEXT,
    "角色别名" "枚举_角色别名" NOT NULL DEFAULT '坐席',
    "状态" "枚举_用户状态" NOT NULL DEFAULT '待激活',
    "工号" TEXT,
    "登录失败次数" INTEGER NOT NULL DEFAULT 0,
    "锁定截止" TIMESTAMP(3),
    "最近登录时间" TIMESTAMP(3),
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "坐席账号_pkey" PRIMARY KEY ("用户编号")
);

-- CreateTable
CREATE TABLE "角色" (
    "角色编号" TEXT NOT NULL,
    "租户编号" TEXT,
    "角色编码" TEXT NOT NULL,
    "角色名称" TEXT NOT NULL,
    "系统内置" BOOLEAN NOT NULL DEFAULT false,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "角色_pkey" PRIMARY KEY ("角色编号")
);

-- CreateTable
CREATE TABLE "权限" (
    "权限编号" TEXT NOT NULL,
    "权限编码" TEXT NOT NULL,
    "权限名称" TEXT NOT NULL,
    "所属模块" TEXT NOT NULL,
    "动作" TEXT NOT NULL,

    CONSTRAINT "权限_pkey" PRIMARY KEY ("权限编号")
);

-- CreateTable
CREATE TABLE "角色权限" (
    "角色编号" TEXT NOT NULL,
    "权限编号" TEXT NOT NULL,

    CONSTRAINT "角色权限_pkey" PRIMARY KEY ("角色编号","权限编号")
);

-- CreateTable
CREATE TABLE "用户角色" (
    "用户编号" TEXT NOT NULL,
    "角色编号" TEXT NOT NULL,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "用户角色_pkey" PRIMARY KEY ("用户编号","角色编号")
);

-- CreateTable
CREATE TABLE "技能组" (
    "技能组编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "技能组名称" TEXT NOT NULL,
    "分配策略" "枚举_派单策略" NOT NULL DEFAULT '轮询',
    "优先级" INTEGER NOT NULL DEFAULT 100,
    "溢出秒数" INTEGER NOT NULL DEFAULT 30,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "技能组_pkey" PRIMARY KEY ("技能组编号")
);

-- CreateTable
CREATE TABLE "技能组成员" (
    "技能组编号" TEXT NOT NULL,
    "用户编号" TEXT NOT NULL,
    "技能等级" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "技能组成员_pkey" PRIMARY KEY ("技能组编号","用户编号")
);

-- CreateTable
CREATE TABLE "线索" (
    "线索编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "客户姓名" TEXT,
    "公司名称" TEXT,
    "规范号码" TEXT,
    "原始号码" TEXT,
    "邮箱" TEXT,
    "来源" "枚举_线索来源" NOT NULL DEFAULT '热线',
    "意向等级" "枚举_意向等级" NOT NULL DEFAULT '未知',
    "意向标签" TEXT[],
    "负责人编号" TEXT,
    "技能组编号" TEXT,
    "线索阶段" "枚举_线索阶段" NOT NULL DEFAULT '新线索',
    "转化客户编号" TEXT,
    "关联联系人编号" TEXT,
    "首次通话编号" TEXT,
    "最近通话编号" TEXT,
    "最近跟进时间" TIMESTAMP(3),
    "转化时间" TIMESTAMP(3),
    "原始留资" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "线索_pkey" PRIMARY KEY ("线索编号")
);

-- CreateTable
CREATE TABLE "客户" (
    "客户编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "负责人编号" TEXT,
    "客户名称" TEXT NOT NULL,
    "统一社会信用代码" TEXT,
    "行业" TEXT,
    "企业规模" "枚举_客户规模",
    "官网" TEXT,
    "地区" TEXT,
    "地址" TEXT,
    "来源" "枚举_线索来源",
    "客户阶段" "枚举_线索阶段" NOT NULL DEFAULT '新线索',
    "客户等级" "枚举_客户等级",
    "最近跟进时间" TIMESTAMP(3),
    "下次跟进时间" TIMESTAMP(3),
    "扩展信息" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "客户_pkey" PRIMARY KEY ("客户编号")
);

-- CreateTable
CREATE TABLE "联系人" (
    "联系人编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "客户编号" TEXT NOT NULL,
    "联系人姓名" TEXT NOT NULL,
    "职务" TEXT,
    "规范号码" TEXT,
    "原始号码" TEXT,
    "邮箱" TEXT,
    "企微号" TEXT,
    "是否主联系人" BOOLEAN NOT NULL DEFAULT false,
    "决策角色" "枚举_决策角色",
    "备注" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "联系人_pkey" PRIMARY KEY ("联系人编号")
);

-- CreateTable
CREATE TABLE "商机" (
    "商机编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "客户编号" TEXT NOT NULL,
    "联系人编号" TEXT,
    "负责人编号" TEXT,
    "商机名称" TEXT NOT NULL,
    "商机阶段" "枚举_商机阶段" NOT NULL DEFAULT '需求确认',
    "预计金额" DECIMAL(14,2),
    "赢单概率" INTEGER NOT NULL DEFAULT 0,
    "预计成交时间" TIMESTAMP(3),
    "赢单原因" TEXT,
    "输单原因" TEXT,
    "阶段变更时间" TIMESTAMP(3),
    "来源" "枚举_线索来源",
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "商机_pkey" PRIMARY KEY ("商机编号")
);

-- CreateTable
CREATE TABLE "跟进动态" (
    "动态编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "创建人编号" TEXT,
    "动态类型" "枚举_动态类型" NOT NULL DEFAULT '跟进备注',
    "关联对象类型" TEXT NOT NULL,
    "关联对象编号" TEXT NOT NULL,
    "内容" TEXT NOT NULL DEFAULT '',
    "通话编号" TEXT,
    "方向" TEXT,
    "时长秒" INTEGER,
    "变更前阶段" TEXT,
    "变更后阶段" TEXT,
    "发生时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "跟进动态_pkey" PRIMARY KEY ("动态编号")
);

-- CreateTable
CREATE TABLE "待办任务" (
    "任务编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "负责人编号" TEXT NOT NULL,
    "创建人编号" TEXT,
    "关联对象类型" TEXT,
    "关联对象编号" TEXT,
    "任务标题" TEXT NOT NULL,
    "任务内容" TEXT,
    "优先级" "枚举_任务优先级" NOT NULL DEFAULT '普通',
    "状态" "枚举_任务状态" NOT NULL DEFAULT '待办',
    "截止时间" TIMESTAMP(3),
    "提醒时间" TIMESTAMP(3),
    "完成时间" TIMESTAMP(3),
    "完成结果" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "待办任务_pkey" PRIMARY KEY ("任务编号")
);

-- CreateTable
CREATE TABLE "电话线路" (
    "线路编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "供应商标识" TEXT NOT NULL DEFAULT 'sandbox',
    "接入号码" TEXT NOT NULL,
    "线路名称" TEXT NOT NULL,
    "默认技能组" TEXT,
    "并发上限" INTEGER NOT NULL DEFAULT 50,
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "电话线路_pkey" PRIMARY KEY ("线路编号")
);

-- CreateTable
CREATE TABLE "通话会话" (
    "通话编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "线路编号" TEXT,
    "供应商通话号" TEXT,
    "方向" "枚举_通话方向" NOT NULL,
    "主叫号码" TEXT,
    "被叫号码" TEXT,
    "对端规范号码" TEXT,
    "客户编号" TEXT,
    "联系人编号" TEXT,
    "线索编号" TEXT,
    "坐席编号" TEXT,
    "转接来源坐席" TEXT,
    "技能组编号" TEXT,
    "外呼名单编号" TEXT,
    "通话状态" "枚举_通话状态" NOT NULL,
    "通话结果" "枚举_通话结果",
    "是否机器人处理" BOOLEAN NOT NULL DEFAULT false,
    "是否转接" BOOLEAN NOT NULL DEFAULT false,
    "入队时间" TIMESTAMP(3),
    "接听时间" TIMESTAMP(3),
    "结束时间" TIMESTAMP(3),
    "总时长秒" INTEGER NOT NULL DEFAULT 0,
    "通话秒数" INTEGER NOT NULL DEFAULT 0,
    "等待秒数" INTEGER NOT NULL DEFAULT 0,
    "挂断方" TEXT,
    "录音地址" TEXT,
    "完整转写" TEXT,
    "AI小结" JSONB,
    "识别意图" TEXT,
    "槽位" JSONB,
    "情绪" TEXT,
    "供应商原始数据" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "通话会话_pkey" PRIMARY KEY ("通话编号")
);

-- CreateTable
CREATE TABLE "转写片段" (
    "片段编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "通话编号" TEXT NOT NULL,
    "序号" INTEGER NOT NULL,
    "话者" "枚举_话者" NOT NULL,
    "文本" TEXT NOT NULL DEFAULT '',
    "开始毫秒" INTEGER NOT NULL DEFAULT 0,
    "结束毫秒" INTEGER NOT NULL DEFAULT 0,
    "置信度" DECIMAL(5,4),
    "情绪" TEXT,
    "切片音频" TEXT,

    CONSTRAINT "转写片段_pkey" PRIMARY KEY ("片段编号")
);

-- CreateTable
CREATE TABLE "坐席状态日志" (
    "日志编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "坐席编号" TEXT NOT NULL,
    "原状态" "枚举_坐席状态",
    "新状态" "枚举_坐席状态" NOT NULL,
    "相关通话" TEXT,
    "发生时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "坐席状态日志_pkey" PRIMARY KEY ("日志编号")
);

-- CreateTable
CREATE TABLE "派单队列" (
    "队列编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "技能组编号" TEXT NOT NULL,
    "线索编号" TEXT,
    "通话编号" TEXT,
    "规范号码" TEXT,
    "优先级" INTEGER NOT NULL DEFAULT 100,
    "策略" "枚举_派单策略" NOT NULL DEFAULT '轮询',
    "队列状态" "枚举_队列状态" NOT NULL DEFAULT '等待分配',
    "指派坐席编号" TEXT,
    "入队时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "指派时间" TIMESTAMP(3),
    "存活秒数" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "派单队列_pkey" PRIMARY KEY ("队列编号")
);

-- CreateTable
CREATE TABLE "机器人配置" (
    "配置编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "机器人名称" TEXT NOT NULL DEFAULT '智能接线员',
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "欢迎语" TEXT NOT NULL DEFAULT '您好，这里是客户服务中心，请问有什么可以帮您？',
    "兜底话术" TEXT NOT NULL DEFAULT '抱歉没有完全理解，我为您转接人工顾问请稍等。',
    "模型配置" JSONB,
    "音色配置" JSONB,
    "转人工关键词" TEXT[],
    "静默超时秒" INTEGER NOT NULL DEFAULT 12,
    "最大轮次" INTEGER NOT NULL DEFAULT 20,
    "工作时间" JSONB,
    "非工作时间策略" TEXT NOT NULL DEFAULT 'BOT',
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "机器人配置_pkey" PRIMARY KEY ("配置编号")
);

-- CreateTable
CREATE TABLE "意图" (
    "意图编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "意图名称" TEXT NOT NULL,
    "意图编码" TEXT NOT NULL,
    "语料示例" TEXT[],
    "关键词" TEXT[],
    "槽位定义" JSONB,
    "命中动作" "枚举_机器人动作" NOT NULL DEFAULT '直接回答',
    "回答话术" TEXT,
    "转接技能组" TEXT,
    "后续意图" TEXT,
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "优先级" INTEGER NOT NULL DEFAULT 100,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "意图_pkey" PRIMARY KEY ("意图编号")
);

-- CreateTable
CREATE TABLE "知识库" (
    "知识库编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "知识库名称" TEXT NOT NULL,
    "描述" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "知识库_pkey" PRIMARY KEY ("知识库编号")
);

-- CreateTable
CREATE TABLE "知识条目" (
    "条目编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "知识库编号" TEXT NOT NULL,
    "问题" TEXT NOT NULL,
    "答案" TEXT NOT NULL,
    "关键词" TEXT[],
    "标签" TEXT[],
    "命中次数" INTEGER NOT NULL DEFAULT 0,
    "状态" "枚举_知识状态" NOT NULL DEFAULT '草稿',
    "版本" INTEGER NOT NULL DEFAULT 1,
    "发布时间" TIMESTAMP(3),
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "知识条目_pkey" PRIMARY KEY ("条目编号")
);

-- CreateTable
CREATE TABLE "机器人会话" (
    "会话编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "通话编号" TEXT NOT NULL,
    "识别意图" TEXT,
    "收集槽位" JSONB,
    "会话结果" "枚举_机器人结果",
    "对话轮次" INTEGER NOT NULL DEFAULT 0,
    "会话摘要" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "机器人会话_pkey" PRIMARY KEY ("会话编号")
);

-- CreateTable
CREATE TABLE "外呼任务" (
    "任务编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "负责人编号" TEXT,
    "任务名称" TEXT NOT NULL,
    "拨号策略" "枚举_拨号策略" NOT NULL DEFAULT '手动',
    "任务状态" "枚举_外呼状态" NOT NULL DEFAULT '草稿',
    "线路编号" TEXT,
    "技能组编号" TEXT,
    "主叫号码" TEXT,
    "开始时间" TIMESTAMP(3),
    "结束时间" TIMESTAMP(3),
    "每日上限" INTEGER NOT NULL DEFAULT 200,
    "并发数" INTEGER NOT NULL DEFAULT 10,
    "预测外拨系数" DECIMAL(4,2) DEFAULT 1.2,
    "筛选规则" JSONB,
    "统计快照" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "外呼任务_pkey" PRIMARY KEY ("任务编号")
);

-- CreateTable
CREATE TABLE "外呼名单" (
    "名单编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "外呼任务编号" TEXT NOT NULL,
    "客户编号" TEXT,
    "联系人编号" TEXT,
    "规范号码" TEXT NOT NULL,
    "拨打状态" "枚举_目标状态" NOT NULL DEFAULT '待拨打',
    "拨打次数" INTEGER NOT NULL DEFAULT 0,
    "最近通话编号" TEXT,
    "下次拨打时间" TIMESTAMP(3),
    "结果码" TEXT,
    "自定义字段" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "外呼名单_pkey" PRIMARY KEY ("名单编号")
);

-- CreateTable
CREATE TABLE "质检规则" (
    "规则编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "规则名称" TEXT NOT NULL,
    "规则类型" "枚举_质检规则类型" NOT NULL,
    "分类" TEXT,
    "匹配模式" TEXT[],
    "分值权重" INTEGER NOT NULL DEFAULT 5,
    "是否必达项" BOOLEAN NOT NULL DEFAULT false,
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "质检规则_pkey" PRIMARY KEY ("规则编号")
);

-- CreateTable
CREATE TABLE "质检记录" (
    "质检编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "通话编号" TEXT NOT NULL,
    "质检类型" "枚举_质检类型" NOT NULL DEFAULT '智能质检',
    "质检状态" "枚举_质检状态" NOT NULL DEFAULT 'AI初检',
    "质检得分" INTEGER NOT NULL DEFAULT 100,
    "复检人编号" TEXT,
    "复检时间" TIMESTAMP(3),
    "复检意见" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "质检记录_pkey" PRIMARY KEY ("质检编号")
);

-- CreateTable
CREATE TABLE "质检命中" (
    "命中编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "质检记录编号" TEXT NOT NULL,
    "规则编号" TEXT NOT NULL,
    "片段编号" TEXT,
    "命中内容" TEXT,
    "扣分" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "质检命中_pkey" PRIMARY KEY ("命中编号")
);

-- CreateTable
CREATE TABLE "合同" (
    "合同编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "商机编号" TEXT NOT NULL,
    "客户编号" TEXT NOT NULL,
    "合同编号编码" TEXT NOT NULL,
    "合同名称" TEXT NOT NULL,
    "合同金额" DECIMAL(14,2),
    "签署日期" TIMESTAMP(3),
    "开始日期" TIMESTAMP(3),
    "结束日期" TIMESTAMP(3),
    "合同状态" "枚举_合同状态" NOT NULL DEFAULT '草稿',
    "合同文件" TEXT,
    "负责人编号" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,
    "删除时间" TIMESTAMP(3),

    CONSTRAINT "合同_pkey" PRIMARY KEY ("合同编号")
);

-- CreateTable
CREATE TABLE "回款记录" (
    "回款编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "合同编号" TEXT NOT NULL,
    "回款金额" DECIMAL(14,2) NOT NULL,
    "计划日期" TIMESTAMP(3),
    "实际到账日期" TIMESTAMP(3),
    "回款状态" "枚举_回款状态" NOT NULL DEFAULT '计划中',
    "回款方式" TEXT,
    "备注" TEXT,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "回款记录_pkey" PRIMARY KEY ("回款编号")
);

-- CreateTable
CREATE TABLE "消息模板" (
    "模板编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "通道" "枚举_通道类型" NOT NULL,
    "模板名称" TEXT NOT NULL,
    "标题" TEXT,
    "模板内容" TEXT NOT NULL,
    "变量列表" TEXT[],
    "审核状态" TEXT NOT NULL DEFAULT '已通过',
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "消息模板_pkey" PRIMARY KEY ("模板编号")
);

-- CreateTable
CREATE TABLE "消息任务" (
    "消息任务编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "模板编号" TEXT,
    "通道" "枚举_通道类型" NOT NULL,
    "目标规则" JSONB,
    "计划发送时间" TIMESTAMP(3),
    "任务状态" TEXT NOT NULL DEFAULT '草稿',
    "负责人编号" TEXT,
    "统计快照" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "消息任务_pkey" PRIMARY KEY ("消息任务编号")
);

-- CreateTable
CREATE TABLE "消息记录" (
    "消息记录编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "消息任务编号" TEXT,
    "通道" "枚举_通道类型" NOT NULL,
    "接收方" TEXT NOT NULL,
    "发送内容" TEXT NOT NULL,
    "发送状态" "枚举_消息状态" NOT NULL DEFAULT '排队',
    "供应商消息号" TEXT,
    "供应商标识" TEXT NOT NULL DEFAULT 'sandbox',
    "发送时间" TIMESTAMP(3),
    "回执" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "消息记录_pkey" PRIMARY KEY ("消息记录编号")
);

-- CreateTable
CREATE TABLE "供应商配置" (
    "配置编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "供应商类型" "枚举_供应商类型" NOT NULL,
    "供应商标识" TEXT NOT NULL,
    "供应商名称" TEXT NOT NULL,
    "是否启用" BOOLEAN NOT NULL DEFAULT false,
    "优先级" INTEGER NOT NULL DEFAULT 100,
    "加密凭证" BYTEA,
    "非密配置" JSONB,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "更新时间" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "供应商配置_pkey" PRIMARY KEY ("配置编号")
);

-- CreateTable
CREATE TABLE "开放密钥" (
    "密钥编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "归属人编号" TEXT,
    "密钥名称" TEXT NOT NULL,
    "访问键" TEXT NOT NULL,
    "签名密钥哈希" TEXT NOT NULL,
    "授权范围" TEXT[],
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "最近使用时间" TIMESTAMP(3),
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "开放密钥_pkey" PRIMARY KEY ("密钥编号")
);

-- CreateTable
CREATE TABLE "Webhook订阅" (
    "订阅编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "密钥编号" TEXT NOT NULL,
    "事件" TEXT NOT NULL,
    "回调地址" TEXT NOT NULL,
    "签名密钥" TEXT,
    "是否启用" BOOLEAN NOT NULL DEFAULT true,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook订阅_pkey" PRIMARY KEY ("订阅编号")
);

-- CreateTable
CREATE TABLE "Webhook投递" (
    "投递编号" TEXT NOT NULL,
    "订阅编号" TEXT NOT NULL,
    "事件" TEXT NOT NULL,
    "投递内容" JSONB,
    "投递状态" TEXT NOT NULL DEFAULT '待投递',
    "HTTP状态码" INTEGER,
    "尝试次数" INTEGER NOT NULL DEFAULT 0,
    "下次重试时间" TIMESTAMP(3),
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook投递_pkey" PRIMARY KEY ("投递编号")
);

-- CreateTable
CREATE TABLE "审计日志" (
    "日志编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "操作人编号" TEXT,
    "操作人类型" "枚举_审计主体" NOT NULL DEFAULT '用户',
    "操作动作" TEXT NOT NULL,
    "对象类型" TEXT,
    "对象编号" TEXT,
    "变更前" JSONB,
    "变更后" JSONB,
    "IP地址" TEXT,
    "用户代理" TEXT,
    "操作时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "审计日志_pkey" PRIMARY KEY ("日志编号")
);

-- CreateTable
CREATE TABLE "站内通知" (
    "通知编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "接收人编号" TEXT NOT NULL,
    "通知类型" TEXT NOT NULL,
    "标题" TEXT NOT NULL,
    "内容" TEXT,
    "关联类型" TEXT,
    "关联编号" TEXT,
    "是否已读" BOOLEAN NOT NULL DEFAULT false,
    "产生时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "站内通知_pkey" PRIMARY KEY ("通知编号")
);

-- CreateTable
CREATE TABLE "数据字典" (
    "字典编号" TEXT NOT NULL,
    "租户编号" TEXT NOT NULL,
    "字典编码" TEXT NOT NULL,
    "字典名称" TEXT NOT NULL,
    "创建时间" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "数据字典_pkey" PRIMARY KEY ("字典编号")
);

-- CreateTable
CREATE TABLE "字典项" (
    "字典项编号" TEXT NOT NULL,
    "字典编号" TEXT NOT NULL,
    "显示名" TEXT NOT NULL,
    "取值" TEXT NOT NULL,
    "排序" INTEGER NOT NULL DEFAULT 0,
    "是否启用" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "字典项_pkey" PRIMARY KEY ("字典项编号")
);

-- CreateIndex
CREATE INDEX "部门_租户编号_上级部门编号_idx" ON "部门"("租户编号", "上级部门编号");

-- CreateIndex
CREATE INDEX "坐席账号_租户编号_部门编号_idx" ON "坐席账号"("租户编号", "部门编号");

-- CreateIndex
CREATE UNIQUE INDEX "坐席账号_租户编号_登录账号_key" ON "坐席账号"("租户编号", "登录账号");

-- CreateIndex
CREATE UNIQUE INDEX "坐席账号_租户编号_邮箱_key" ON "坐席账号"("租户编号", "邮箱");

-- CreateIndex
CREATE UNIQUE INDEX "角色_角色编码_key" ON "角色"("角色编码");

-- CreateIndex
CREATE UNIQUE INDEX "权限_权限编码_key" ON "权限"("权限编码");

-- CreateIndex
CREATE INDEX "技能组_租户编号_idx" ON "技能组"("租户编号");

-- CreateIndex
CREATE INDEX "线索_租户编号_规范号码_idx" ON "线索"("租户编号", "规范号码");

-- CreateIndex
CREATE INDEX "线索_租户编号_负责人编号_线索阶段_idx" ON "线索"("租户编号", "负责人编号", "线索阶段");

-- CreateIndex
CREATE INDEX "线索_租户编号_线索阶段_更新时间_idx" ON "线索"("租户编号", "线索阶段", "更新时间");

-- CreateIndex
CREATE INDEX "客户_租户编号_负责人编号_更新时间_idx" ON "客户"("租户编号", "负责人编号", "更新时间");

-- CreateIndex
CREATE INDEX "客户_租户编号_客户名称_idx" ON "客户"("租户编号", "客户名称");

-- CreateIndex
CREATE INDEX "联系人_租户编号_规范号码_idx" ON "联系人"("租户编号", "规范号码");

-- CreateIndex
CREATE INDEX "联系人_客户编号_idx" ON "联系人"("客户编号");

-- CreateIndex
CREATE INDEX "商机_租户编号_负责人编号_商机阶段_idx" ON "商机"("租户编号", "负责人编号", "商机阶段");

-- CreateIndex
CREATE INDEX "商机_租户编号_商机阶段_idx" ON "商机"("租户编号", "商机阶段");

-- CreateIndex
CREATE INDEX "跟进动态_关联对象类型_关联对象编号_发生_idx" ON "跟进动态"("关联对象类型", "关联对象编号", "发生时间");

-- CreateIndex
CREATE INDEX "跟进动态_租户编号_创建人编号_idx" ON "跟进动态"("租户编号", "创建人编号");

-- CreateIndex
CREATE INDEX "待办任务_租户编号_负责人编号_状态_截止时_idx" ON "待办任务"("租户编号", "负责人编号", "状态", "截止时间");

-- CreateIndex
CREATE INDEX "电话线路_租户编号_idx" ON "电话线路"("租户编号");

-- CreateIndex
CREATE INDEX "通话会话_租户编号_坐席编号_创建时间_idx" ON "通话会话"("租户编号", "坐席编号", "创建时间");

-- CreateIndex
CREATE INDEX "通话会话_租户编号_通话状态_idx" ON "通话会话"("租户编号", "通话状态");

-- CreateIndex
CREATE INDEX "通话会话_租户编号_技能组编号_通话状态_idx" ON "通话会话"("租户编号", "技能组编号", "通话状态");

-- CreateIndex
CREATE INDEX "通话会话_租户编号_对端规范号码_idx" ON "通话会话"("租户编号", "对端规范号码");

-- CreateIndex
CREATE INDEX "转写片段_通话编号_序号_idx" ON "转写片段"("通话编号", "序号");

-- CreateIndex
CREATE INDEX "坐席状态日志_坐席编号_发生时间_idx" ON "坐席状态日志"("坐席编号", "发生时间");

-- CreateIndex
CREATE UNIQUE INDEX "派单队列_通话编号_key" ON "派单队列"("通话编号");

-- CreateIndex
CREATE INDEX "派单队列_租户编号_技能组编号_队列状态_优_idx" ON "派单队列"("租户编号", "技能组编号", "队列状态", "优先级");

-- CreateIndex
CREATE UNIQUE INDEX "机器人配置_租户编号_key" ON "机器人配置"("租户编号");

-- CreateIndex
CREATE INDEX "意图_租户编号_是否启用_idx" ON "意图"("租户编号", "是否启用");

-- CreateIndex
CREATE INDEX "知识条目_知识库编号_状态_idx" ON "知识条目"("知识库编号", "状态");

-- CreateIndex
CREATE UNIQUE INDEX "机器人会话_通话编号_key" ON "机器人会话"("通话编号");

-- CreateIndex
CREATE INDEX "外呼任务_租户编号_任务状态_idx" ON "外呼任务"("租户编号", "任务状态");

-- CreateIndex
CREATE INDEX "外呼名单_外呼任务编号_拨打状态_下次拨打_idx" ON "外呼名单"("外呼任务编号", "拨打状态", "下次拨打时间");

-- CreateIndex
CREATE UNIQUE INDEX "外呼名单_外呼任务编号_规范号码_key" ON "外呼名单"("外呼任务编号", "规范号码");

-- CreateIndex
CREATE INDEX "质检规则_租户编号_是否启用_idx" ON "质检规则"("租户编号", "是否启用");

-- CreateIndex
CREATE UNIQUE INDEX "质检记录_通话编号_key" ON "质检记录"("通话编号");

-- CreateIndex
CREATE INDEX "质检记录_租户编号_质检状态_idx" ON "质检记录"("租户编号", "质检状态");

-- CreateIndex
CREATE INDEX "质检记录_通话编号_idx" ON "质检记录"("通话编号");

-- CreateIndex
CREATE INDEX "质检命中_质检记录编号_idx" ON "质检命中"("质检记录编号");

-- CreateIndex
CREATE INDEX "合同_租户编号_合同状态_idx" ON "合同"("租户编号", "合同状态");

-- CreateIndex
CREATE UNIQUE INDEX "合同_租户编号_合同编号编码_key" ON "合同"("租户编号", "合同编号编码");

-- CreateIndex
CREATE INDEX "回款记录_合同编号_idx" ON "回款记录"("合同编号");

-- CreateIndex
CREATE INDEX "消息模板_租户编号_通道_idx" ON "消息模板"("租户编号", "通道");

-- CreateIndex
CREATE INDEX "消息任务_租户编号_任务状态_idx" ON "消息任务"("租户编号", "任务状态");

-- CreateIndex
CREATE INDEX "消息记录_消息任务编号_发送状态_idx" ON "消息记录"("消息任务编号", "发送状态");

-- CreateIndex
CREATE INDEX "消息记录_租户编号_通道_idx" ON "消息记录"("租户编号", "通道");

-- CreateIndex
CREATE INDEX "供应商配置_租户编号_供应商类型_是否启用_idx" ON "供应商配置"("租户编号", "供应商类型", "是否启用");

-- CreateIndex
CREATE UNIQUE INDEX "开放密钥_访问键_key" ON "开放密钥"("访问键");

-- CreateIndex
CREATE INDEX "Webhook订阅_租户编号_事件_idx" ON "Webhook订阅"("租户编号", "事件");

-- CreateIndex
CREATE INDEX "Webhook投递_订阅编号_投递状态_idx" ON "Webhook投递"("订阅编号", "投递状态");

-- CreateIndex
CREATE INDEX "审计日志_租户编号_操作时间_idx" ON "审计日志"("租户编号", "操作时间");

-- CreateIndex
CREATE INDEX "审计日志_对象类型_对象编号_idx" ON "审计日志"("对象类型", "对象编号");

-- CreateIndex
CREATE INDEX "站内通知_接收人编号_是否已读_idx" ON "站内通知"("接收人编号", "是否已读");

-- CreateIndex
CREATE UNIQUE INDEX "数据字典_租户编号_字典编码_key" ON "数据字典"("租户编号", "字典编码");

-- CreateIndex
CREATE INDEX "字典项_字典编号_idx" ON "字典项"("字典编号");

-- AddForeignKey
ALTER TABLE "部门" ADD CONSTRAINT "部门_上级部门编号_fkey" FOREIGN KEY ("上级部门编号") REFERENCES "部门"("部门编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "坐席账号" ADD CONSTRAINT "坐席账号_部门编号_fkey" FOREIGN KEY ("部门编号") REFERENCES "部门"("部门编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "坐席账号" ADD CONSTRAINT "坐席账号_直属主管编号_fkey" FOREIGN KEY ("直属主管编号") REFERENCES "坐席账号"("用户编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "角色权限" ADD CONSTRAINT "角色权限_角色编号_fkey" FOREIGN KEY ("角色编号") REFERENCES "角色"("角色编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "角色权限" ADD CONSTRAINT "角色权限_权限编号_fkey" FOREIGN KEY ("权限编号") REFERENCES "权限"("权限编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "用户角色" ADD CONSTRAINT "用户角色_角色编号_fkey" FOREIGN KEY ("角色编号") REFERENCES "角色"("角色编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "技能组成员" ADD CONSTRAINT "技能组成员_技能组编号_fkey" FOREIGN KEY ("技能组编号") REFERENCES "技能组"("技能组编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "线索" ADD CONSTRAINT "线索_转化客户编号_fkey" FOREIGN KEY ("转化客户编号") REFERENCES "客户"("客户编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "线索" ADD CONSTRAINT "线索_关联联系人编号_fkey" FOREIGN KEY ("关联联系人编号") REFERENCES "联系人"("联系人编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "线索" ADD CONSTRAINT "线索_技能组编号_fkey" FOREIGN KEY ("技能组编号") REFERENCES "技能组"("技能组编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "联系人" ADD CONSTRAINT "联系人_客户编号_fkey" FOREIGN KEY ("客户编号") REFERENCES "客户"("客户编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "商机" ADD CONSTRAINT "商机_客户编号_fkey" FOREIGN KEY ("客户编号") REFERENCES "客户"("客户编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "商机" ADD CONSTRAINT "商机_联系人编号_fkey" FOREIGN KEY ("联系人编号") REFERENCES "联系人"("联系人编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "跟进动态" ADD CONSTRAINT "跟进动态_通话编号_fkey" FOREIGN KEY ("通话编号") REFERENCES "通话会话"("通话编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "电话线路" ADD CONSTRAINT "电话线路_默认技能组_fkey" FOREIGN KEY ("默认技能组") REFERENCES "技能组"("技能组编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_线路编号_fkey" FOREIGN KEY ("线路编号") REFERENCES "电话线路"("线路编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_客户编号_fkey" FOREIGN KEY ("客户编号") REFERENCES "客户"("客户编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_联系人编号_fkey" FOREIGN KEY ("联系人编号") REFERENCES "联系人"("联系人编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_线索编号_fkey" FOREIGN KEY ("线索编号") REFERENCES "线索"("线索编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_技能组编号_fkey" FOREIGN KEY ("技能组编号") REFERENCES "技能组"("技能组编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "通话会话" ADD CONSTRAINT "通话会话_外呼名单编号_fkey" FOREIGN KEY ("外呼名单编号") REFERENCES "外呼名单"("名单编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "转写片段" ADD CONSTRAINT "转写片段_通话编号_fkey" FOREIGN KEY ("通话编号") REFERENCES "通话会话"("通话编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "派单队列" ADD CONSTRAINT "派单队列_技能组编号_fkey" FOREIGN KEY ("技能组编号") REFERENCES "技能组"("技能组编号") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "派单队列" ADD CONSTRAINT "派单队列_线索编号_fkey" FOREIGN KEY ("线索编号") REFERENCES "线索"("线索编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "派单队列" ADD CONSTRAINT "派单队列_通话编号_fkey" FOREIGN KEY ("通话编号") REFERENCES "通话会话"("通话编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "意图" ADD CONSTRAINT "意图_转接技能组_fkey" FOREIGN KEY ("转接技能组") REFERENCES "技能组"("技能组编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "知识条目" ADD CONSTRAINT "知识条目_知识库编号_fkey" FOREIGN KEY ("知识库编号") REFERENCES "知识库"("知识库编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "机器人会话" ADD CONSTRAINT "机器人会话_通话编号_fkey" FOREIGN KEY ("通话编号") REFERENCES "通话会话"("通话编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "外呼任务" ADD CONSTRAINT "外呼任务_线路编号_fkey" FOREIGN KEY ("线路编号") REFERENCES "电话线路"("线路编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "外呼任务" ADD CONSTRAINT "外呼任务_技能组编号_fkey" FOREIGN KEY ("技能组编号") REFERENCES "技能组"("技能组编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "外呼名单" ADD CONSTRAINT "外呼名单_外呼任务编号_fkey" FOREIGN KEY ("外呼任务编号") REFERENCES "外呼任务"("任务编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "外呼名单" ADD CONSTRAINT "外呼名单_客户编号_fkey" FOREIGN KEY ("客户编号") REFERENCES "客户"("客户编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "外呼名单" ADD CONSTRAINT "外呼名单_联系人编号_fkey" FOREIGN KEY ("联系人编号") REFERENCES "联系人"("联系人编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "质检记录" ADD CONSTRAINT "质检记录_通话编号_fkey" FOREIGN KEY ("通话编号") REFERENCES "通话会话"("通话编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "质检命中" ADD CONSTRAINT "质检命中_质检记录编号_fkey" FOREIGN KEY ("质检记录编号") REFERENCES "质检记录"("质检编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "合同" ADD CONSTRAINT "合同_商机编号_fkey" FOREIGN KEY ("商机编号") REFERENCES "商机"("商机编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "合同" ADD CONSTRAINT "合同_客户编号_fkey" FOREIGN KEY ("客户编号") REFERENCES "客户"("客户编号") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "回款记录" ADD CONSTRAINT "回款记录_合同编号_fkey" FOREIGN KEY ("合同编号") REFERENCES "合同"("合同编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "消息任务" ADD CONSTRAINT "消息任务_模板编号_fkey" FOREIGN KEY ("模板编号") REFERENCES "消息模板"("模板编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "消息记录" ADD CONSTRAINT "消息记录_消息任务编号_fkey" FOREIGN KEY ("消息任务编号") REFERENCES "消息任务"("消息任务编号") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook订阅" ADD CONSTRAINT "Webhook订阅_密钥编号_fkey" FOREIGN KEY ("密钥编号") REFERENCES "开放密钥"("密钥编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook投递" ADD CONSTRAINT "Webhook投递_订阅编号_fkey" FOREIGN KEY ("订阅编号") REFERENCES "Webhook订阅"("订阅编号") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "字典项" ADD CONSTRAINT "字典项_字典编号_fkey" FOREIGN KEY ("字典编号") REFERENCES "数据字典"("字典编号") ON DELETE CASCADE ON UPDATE CASCADE;

