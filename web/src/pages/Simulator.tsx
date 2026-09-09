import { useRef, useState } from 'react';
import { Row, Col, Card, Button, Input, Space, Tag, Typography, Alert } from 'antd';
import { PhoneOutlined, MessageOutlined } from '@ant-design/icons';
import axios from 'axios';
import { RUNTIME } from '../lib/runtime-config';

const BASE = RUNTIME.apiBase;

interface Msg { who: 'bot' | 'customer' | 'sys'; text: string }
const QUICK = ['你们这个多少钱', '想预约一个产品演示，我电话13911112222', '转人工', '支持多少坐席', '我姓王，来自星河制造有限公司'];

export default function Simulator() {
  const [from, setFrom] = useState('13911112222');
  const [callId, setCallId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const push = (m: Msg) => setMsgs((s) => [...s, m]);
  const scroll = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const inbound = async () => {
    setBusy(true); setMsgs([]);
    try {
      const { data } = await axios.get(`${BASE}/cti/demo-inbound`, { params: { phone: from } });
      setCallId(data.call.id);
      push({ who: 'sys', text: `来电接入：${from} → 机器人接听（通话号 ${data.call.id.slice(0, 8)}…）` });
      push({ who: 'bot', text: data.welcome });
      scroll();
    } finally { setBusy(false); }
  };

  const utter = async (t?: string) => {
    const content = (t ?? text).trim();
    if (!content || !callId) return;
    setBusy(true);
    push({ who: 'customer', text: content });
    setText('');
    try {
      const { data } = await axios.post(`${BASE}/cti/demo-utter`, { callId, text: content });
      push({ who: 'bot', text: data.reply });
      if (data.action && data.action !== 'ANSWER') push({ who: 'sys', text: `机器人动作：${data.action}${data.leadId ? '（已自动留资建档）' : ''}${data.routed?.assigned ? '，已派单给坐席' : ''}` });
      scroll();
    } finally { setBusy(false); }
  };

  const end = async () => {
    if (!callId) return;
    await axios.post(`${BASE}/cti/demo-end`, { callId, disposition: 'INTENT' });
    push({ who: 'sys', text: '客户挂断，系统生成 AI 小结、写跟进动态并释放坐席。' });
    setCallId(''); scroll();
  };

  return (
    <Row gutter={12}>
      <Col xs={24} lg={14}>
        <Card size="small" title="呼入机器人对话沙箱（免登录 CTI 接口）" extra={
          <Space>
            <Input size="small" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="主叫号码" disabled={!!callId} />
            {!callId
              ? <Button size="small" type="primary" icon={<PhoneOutlined />} loading={busy} onClick={inbound}>模拟来电</Button>
              : <Button size="small" danger onClick={end}>挂断结束</Button>}
          </Space>
        }>
          <div className="chat-col scroll-y" style={{ height: 420, background: 'rgba(255,255,255,.025)', borderRadius: 8, padding: 12 }}>
            {msgs.length === 0 && <Alert type="info" showIcon message="点击「模拟来电」发起一通呼入，再用快捷语句或自由输入与机器人多轮对话，观察意向识别、自动留资与转人工派单。" />}
            {msgs.map((m, i) => m.who === 'sys' ? (
              <div key={i} style={{ textAlign: 'center', margin: '6px 0' }}><Tag color="blue">{m.text}</Tag></div>
            ) : (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.who === 'customer' ? 'flex-end' : 'flex-start' }}>
                <div className={`chat-bubble ${m.who === 'customer' ? 'chat-customer' : 'chat-bot'}`}>{m.text}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <Space.Compact style={{ width: '100%', marginTop: 10 }}>
            <Input prefix={<MessageOutlined />} value={text} placeholder="客户说的话（ASR 文本）"
              disabled={!callId} onChange={(e) => setText(e.target.value)} onPressEnter={() => utter()} />
            <Button type="primary" loading={busy} disabled={!callId} onClick={() => utter()}>发送</Button>
          </Space.Compact>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card size="small" title="快捷话术（覆盖典型分支）">
          <Space wrap>
            {QUICK.map((q) => <Button key={q} size="small" disabled={!callId} onClick={() => utter(q)}>{q}</Button>)}
          </Space>
          <Typography.Paragraph className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            价格/演示类会触发意向识别与留资追问；说「转人工」会按技能组策略派单，坐席在「工作台」可看到并接听；
            全程在「实时通话」可查看转写与 AI 小结。默认走内置沙箱模型，无需任何外部密钥。
          </Typography.Paragraph>
        </Card>
      </Col>
    </Row>
  );
}
