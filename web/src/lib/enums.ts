import dayjs from 'dayjs';

// 后端枚举成员 -> 中文展示（数据库物理值亦为中文，这里统一前端展示字典）
export const ENUM_LABEL: Record<string, string> = {
  // 线索阶段
  NEW: '新线索', FOLLOWING: '跟进中', CONVERTED: '已转化', INVALID: '无效', LOST: '流失/输单',
  // 线索来源
  HOTLINE: '热线', BOT: '机器人接入', WEB: '官网', FORM: '表单', AD: '广告', REFERRAL: '转介绍', IMPORT: '导入', MANUAL: '手工/手动', OUTBOUND: '外呼/呼出',
  // 意向
  HIGH: '高', MIDDLE: '中', MID: '中', LOW: '低', UNKNOWN: '未知',
  // 商机阶段
  NEED_CONFIRM: '需求确认', NEED_DIG: '需求挖掘', SOLUTION: '方案', QUOTE: '报价', NEGOTIATE: '谈判', WON: '赢单',
  // 通话
  INBOUND: '呼入',
  RINGING: '振铃', QUEUE: '排队中', TRANSFERRING: '转接中', AGENT_TALK: '人工通话', WRAP: '话后处理', ENDED: '已结束', MISSED: '未接', FAILED: '呼叫失败',
  INTENT: '有意向', FOLLOW: '待跟进', NO_ANSWER: '未接通', BUSY: '占线', REJECT: '拒绝', INVALID_NUM: '无效号码', OTHER: '其他',
  // 坐席状态
  OFFLINE: '离线', ONLINE: '在线', IDLE: '空闲', ON_CALL: '通话中', AFTER: '话后', BREAK: '小休',
  // 外呼
  DRAFT: '草稿', RUNNING: '进行中', PAUSED: '已暂停', FINISHED: '已完成', CANCELED: '已取消',
  PREVIEW: '预览', PREDICTIVE: '预测式',
  PENDING: '待拨打', DIALING: '拨打中', CONNECTED: '已接通', NO_CONNECT: '未接通', BLACKLIST: '黑名单',
  // 质检
  AI: 'AI初检', PENDING_REVIEW: '待复检', REVIEWED: '已复检', APPEAL: '申诉中', AUTO: '智能质检',
  KEYWORD: '关键词', SCRIPT: '话术', REGEX: '正则', SILENCE: '静音', EMOTION: '情绪', SPEED: '语速',
  // 合同/回款
  SIGNED: '已签署', IN_PROGRESS: '履约中', COMPLETED: '已完成', TERMINATED: '已终止',
  PLANNED: '计划中', RECEIVED: '已回款', OVERDUE: '逾期', PARTIAL: '部分回款',
  // 消息
  SMS: '短信', EMAIL: '邮件', WECHAT: '企微', QUEUED: '排队', SENT: '已发送', DELIVERED: '已送达', READ: '已读',
  // 角色
  ADMIN: '管理员', MANAGER: '主管', AGENT: '坐席',
  // 任务
  TODO: '待办', DONE: '已完成',
  URGENT: '紧急', NORMAL: '普通',
  // 供应商
  TELEPHONY: '语音线路', ASR: '语音识别', TTS: '语音合成', LLM: '大模型',
  ACTIVE: '启用', DISABLED: '停用',
};

export const lbl = (v?: string | null) => (v == null || v === '' ? '-' : ENUM_LABEL[v] || v);

// antd Tag 颜色
export const ENUM_COLOR: Record<string, string> = {
  HIGH: 'red', MIDDLE: 'orange', MID: 'orange', LOW: 'default', UNKNOWN: 'default',
  NEW: 'blue', FOLLOWING: 'processing', CONVERTED: 'success', INVALID: 'default', LOST: 'error',
  WON: 'success', RUNNING: 'processing', PAUSED: 'warning', FINISHED: 'success',
  ENDED: 'default', AGENT_TALK: 'green', QUEUE: 'orange', IDLE: 'green', ON_CALL: 'processing',
  REVIEWED: 'success', AI: 'processing', PENDING_REVIEW: 'warning',
  RECEIVED: 'success', OVERDUE: 'error', PARTIAL: 'warning', SIGNED: 'blue', IN_PROGRESS: 'processing',
  SENT: 'success', DELIVERED: 'success', FAILED: 'error',
};
export const colorOf = (v?: string | null) => (v ? ENUM_COLOR[v] || 'default' : 'default');

export const fmtTime = (t?: string | Date | null, f = 'YYYY-MM-DD HH:mm:ss') => (t ? dayjs(t).format(f) : '-');
export const fmtDate = (t?: string | Date | null) => (t ? dayjs(t).format('YYYY-MM-DD') : '-');
export const fmtMoney = (n?: number | string | null) =>
  n == null || n === '' ? '-' : `¥${Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtSec = (s?: number | null) => {
  if (s == null) return '-';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};
