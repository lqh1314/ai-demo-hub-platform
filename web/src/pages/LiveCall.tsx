import { useEffect, useRef, useState } from 'react';
import { Row, Col, Card, Button, Input, Select, Space, Tag, List, Descriptions, Empty, Divider, Alert, message, Timeline } from 'antd';
import { PhoneFilled, PauseOutlined, LoginOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { http, api } from '../api/client';
import { usePaged, useOnce } from '../lib/hooks';
import { getSocket } from '../lib/socket';
import { lbl, colorOf, fmtTime, fmtSec } from '../lib/enums';
import ETag from '../components/ETag';

interface Seg { id?: string; speaker: string; text: string; seq?: number }

export default function LiveCall() {
  const [params] = useSearchParams();
  const [callId, setCallId] = useState(params.get('callId') || '');
  const [segments, setSegments] = useState<Seg[]>([]);
  const [say, setSay] = useState('');
  const [to, setTo] = useState('13911112222');
  const [ai, setAi] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = usePaged(['calls-active'], '/calls', { pageSize: 50 }, {});
  const call = useOnce<any>(['call', callId], `/calls/${callId}`, undefined, { enabled: !!callId, refetchInterval: callId ? 5000 : undefined });
  const pop = useOnce<any>(['pop', call.data?.phoneE164], '/screen-pop', { phone: call.data?.phoneE164 }, { enabled: !!call.data?.phoneE164 });
  const activities = useOnce<any>(['act', callId], '/activities', { type: 'CUSTOMER', id: call.data?.customerId }, { enabled: !!call.data?.customerId });

  // 初始载入历史转写
  useEffect(() => {
    if (call.data?.segments) setSegments(call.data.segments);
    if (call.data?.aiSummary) setAi(call.data.aiSummary);
  }, [call.data]);

  useEffect(() => {
    const sock = getSocket();
    const onSeg = (p: any) => {
      if (p.callId !== callId) return;
      if (p.customer) setSegments((s) => [...s, { speaker: 'CUSTOMER', text: p.customer }]);
      if (p.bot) setSegments((s) => [...s, { speaker: 'BOT', text: p.bot }]);
      if (p.speaker) setSegments((s) => [...s, { speaker: p.speaker, text: p.text }]);
    };
    const onAi = (p: any) => { if (p.callId === callId) setAi(p.ai); };
    sock.on('call.transcript.segment', onSeg);
    sock.on('call.ai_summary', onAi);
    return () => { sock.off('call.transcript.segment', onSeg); sock.off('call.ai_summary', onAi); };
  }, [callId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [segments]);

  const dial = async () => {
    const c = await api<any>(http.post('/calls/dial', { to }));
    setCallId(c.id); message.success('外呼已建立（沙箱）');
  };
  const utter = async (speaker: 'AGENT' | 'CUSTOMER') => {
    if (!say.trim() || !callId) return;
    await api(http.post(`/calls/${callId}/say`, { speaker, text: say }));
    setSegments((s) => [...s, { speaker, text: say }]);
    setSay('');
  };
  const transfer = async () => {
    if (!callId || ended) return;
    try {
      await api(http.post(`/calls/${callId}/transfer`));
      message.success('已请求转人工派单'); call.refetch();
    } catch { message.error('转人工失败，请重试'); }
  };
  const end = async () => {
    if (!callId || ending || ended) return;
    setEnding(true);
    try {
      const r = await api<any>(http.post(`/calls/${callId}/end`, { disposition: 'INTENT' }));
      if (r?.aiSummary) setAi(r.aiSummary);
      message.success('通话结束，AI 小结已生成');
      await Promise.all([call.refetch(), active.refetch?.()]);
    } catch {
      message.error('结束失败，请重试');
    } finally { setEnding(false); }
  };

  const ended = ['ENDED', 'MISSED', 'FAILED'].includes(call.data?.status);
  const ongoing = active.rows.filter((c: any) => !['ENDED', 'MISSED', 'FAILED'].includes(c.status));

  return (
    <Row gutter={12}>
      <Col xs={24} lg={15}>
        <Card size="small" title="通话中 / 选择通话" extra={
          <Space>
            <Input size="small" style={{ width: 140 }} placeholder="外呼号码" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="small" type="primary" icon={<PhoneFilled />} onClick={dial}>外呼</Button>
          </Space>
        }>
          <Select style={{ width: '100%', marginBottom: 8 }} placeholder="选择一通进行中的通话" value={callId || undefined}
            onChange={setCallId} options={ongoing.map((c: any) => ({ value: c.id, label: `${c.phoneE164 || c.fromNo || c.toNo} · ${lbl(c.status)} · ${fmtTime(c.createdAt)}` }))} />
          {!callId && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="可外呼、从工作台接听，或在呼入模拟器发起来电" />}
        </Card>

        {callId && (
          <Card size="small" style={{ marginTop: 12 }}
            title={<Space>实时转写 {call.data && <Tag color={colorOf(call.data.status)}>{lbl(call.data.status)}</Tag>}</Space>}
            extra={<Space>
              <Button size="small" icon={<LoginOutlined />} disabled={ended} onClick={transfer}>转人工</Button>
              <Button size="small" danger icon={<PauseOutlined />} loading={ending} disabled={ended} onClick={end}>
                {ended ? '已结束' : '结束并生成小结'}
              </Button>
            </Space>}>
            {ended && (
              <Alert style={{ marginBottom: 8 }} type="success" showIcon
                message="本通通话已结束，AI 小结与跟进动态已生成（见下方）。可在上方下拉选择或发起下一通。" />
            )}
            <div className="chat-col scroll-y" style={{ height: 340, background: 'rgba(255,255,255,.025)', borderRadius: 8, padding: 10 }}>
              {segments.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无对话，使用下方输入模拟说话" />}
              {segments.map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: s.speaker === 'CUSTOMER' ? 'flex-end' : 'flex-start' }}>
                  <div className="muted" style={{ fontSize: 11 }}>{lbl(s.speaker)}</div>
                  <div className={`chat-bubble chat-${s.speaker === 'CUSTOMER' ? 'customer' : s.speaker === 'BOT' ? 'bot' : 'agent'}`}>{s.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <Space.Compact style={{ width: '100%', marginTop: 10 }}>
              <Input value={say} disabled={ended} placeholder="输入话术（沙箱模拟语音识别文本）" onChange={(e) => setSay(e.target.value)}
                onPressEnter={() => utter('AGENT')} />
              <Button disabled={ended} onClick={() => utter('CUSTOMER')}>模拟客户说</Button>
              <Button disabled={ended} type="primary" onClick={() => utter('AGENT')}>坐席说</Button>
            </Space.Compact>
          </Card>
        )}

        {ai && (
          <Card size="small" style={{ marginTop: 12 }} title="AI 通话小结">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="小结">{ai.summary}</Descriptions.Item>
              <Descriptions.Item label="情绪"><span>{ai.sentiment}</span></Descriptions.Item>
              <Descriptions.Item label="后续动作">
                {(ai.nextActions || []).map((a: string, i: number) => <Tag key={i}>{a}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Col>

      <Col xs={24} lg={9}>
        <Card size="small" title="来电弹屏 / 客户画像">
          {pop.data ? (
            <>
              {pop.data.customer && <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="客户">{pop.data.customer.name}</Descriptions.Item>
                <Descriptions.Item label="行业/规模">{pop.data.customer.industry || '-'} · {lbl(pop.data.customer.scale)}</Descriptions.Item>
                <Descriptions.Item label="等级"><ETag value={pop.data.customer.level} /></Descriptions.Item>
                <Descriptions.Item label="阶段"><ETag value={pop.data.customer.stage} /></Descriptions.Item>
              </Descriptions>}
              {pop.data.lead && <Divider style={{ margin: '8px 0' }} />}
              {pop.data.lead && <Descriptions column={1} size="small">
                <Descriptions.Item label="线索意向"><ETag value={pop.data.lead.intentLevel} /></Descriptions.Item>
                <Descriptions.Item label="线索阶段"><ETag value={pop.data.lead.stage} /></Descriptions.Item>
                <Descriptions.Item label="意向标签">{(pop.data.lead.intentTags || []).join('、') || '-'}</Descriptions.Item>
              </Descriptions>}
            </>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配客户，机器人将自动建档留资" />}
        </Card>
        <Card size="small" style={{ marginTop: 12 }} title="通话信息">
          {call.data ? <Descriptions column={1} size="small">
            <Descriptions.Item label="方向"><ETag value={call.data.direction} /></Descriptions.Item>
            <Descriptions.Item label="通话时长">{fmtSec(call.data.talkSec)}</Descriptions.Item>
            <Descriptions.Item label="结果"><ETag value={call.data.disposition} /></Descriptions.Item>
            <Descriptions.Item label="创建">{fmtTime(call.data.createdAt)}</Descriptions.Item>
          </Descriptions> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未选择通话" />}
        </Card>
        <Card size="small" style={{ marginTop: 12 }} title="跟进时间线">
          <Timeline items={(activities.data?.list || activities.data || []).map((a: any) => ({ children: `${fmtTime(a.happenedAt)} ${lbl(a.type)}：${a.content || ''}` }))} />
        </Card>
      </Col>
    </Row>
  );
}
