import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Button, Tag, List, Segmented, Empty, Badge, Table, Space } from 'antd';
import { PhoneOutlined, CheckOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../api/client';
import { useOnce } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { getSocket } from '../lib/socket';
import { lbl, colorOf, fmtTime, fmtSec } from '../lib/enums';
import ETag from '../components/ETag';
import { useNavigate } from 'react-router-dom';

const STATUSES = ['ONLINE', 'IDLE', 'BUSY', 'BREAK', 'OFFLINE'];

export default function Workbench() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [status, setStatus] = useState('IDLE');
  const ov = useOnce<any>(['ov'], '/reports/overview', undefined, { refetchInterval: 20000 });
  const presence = useOnce<any>(['presence'], '/presence', undefined, { refetchInterval: 15000 });
  const tasks = useOnce<any>(['my-tasks'], '/tasks', { status: 'TODO' });
  const calls = useOnce<any>(['my-calls'], '/calls', { mine: 1, pageSize: 8 });

  useEffect(() => {
    const sock = getSocket();
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['presence'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-calls'] });
    };
    sock.on('queue.updated', refresh);
    sock.on('call.status', refresh);
    return () => { sock.off('queue.updated', refresh); sock.off('call.status', refresh); };
  }, [qc]);

  const changeStatus = async (s: string) => {
    setStatus(s);
    await api(http.post('/presence/status', { status: s }));
    qc.invalidateQueries({ queryKey: ['presence'] });
  };
  const accept = async (qid: string) => {
    const r = await api<any>(http.post(`/queue/${qid}/accept`));
    if (r?.call?.id) nav(`/live?callId=${r.call.id}`);
    qc.invalidateQueries();
  };
  const completeTask = async (id: string) => { await api(http.post(`/tasks/${id}/complete`, { result: '已完成' })); qc.invalidateQueries({ queryKey: ['my-tasks'] }); };

  const waiting = (presence.data?.queues || []).filter((q: any) => q.state === 'WAITING');
  const agents = presence.data?.agents || [];
  const myTasks = tasks.data?.list || tasks.data || [];
  const myCalls = calls.data?.list || calls.data || [];

  return (
    <div>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card><Statistic title="线索总数" value={ov.data?.leads ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="客户总数" value={ov.data?.customers ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="今日通话" value={ov.data?.calls ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="接通率" value={ov.data?.connectRate ?? 0} suffix="%" precision={1} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginTop: 12 }} title={<Space>我的坐席状态 <Badge status="processing" text={`当前：${lbl(status)}`} /></Space>}
        extra={<Button icon={<PhoneOutlined />} type="primary" onClick={() => nav('/live')}>新建外呼</Button>}>
        <Segmented value={status} onChange={(v) => changeStatus(v as string)}
          options={STATUSES.map((s) => ({ label: lbl(s), value: s }))} />
        <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>在线坐席 {agents.filter((a: any) => !['OFFLINE'].includes(a.status)).length}/{agents.length} 人</span>
      </Card>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={10}>
          <Card size="small" title={<span>待接派单队列 <Tag color="orange">{waiting.length}</Tag></span>} style={{ height: '100%' }}>
            <List locale={{ emptyText: <Empty description="暂无排队，可到呼入模拟器触发" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              dataSource={waiting} renderItem={(q: any) => (
                <List.Item actions={[<Button key="a" type="primary" size="small" icon={<CheckOutlined />} onClick={() => accept(q.id)}>接听</Button>]}>
                  <List.Item.Meta title={<Space>{q.phoneE164 || '未知号码'}<ETag value={q.state} /></Space>}
                    description={`入队 ${fmtTime(q.enqueueAt)} · 策略 ${lbl(q.strategy)}`} />
                </List.Item>
              )} />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="我的待办" style={{ marginBottom: 12 }}>
            <List size="small" locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" /> }} dataSource={myTasks}
              renderItem={(t: any) => (
                <List.Item actions={[<a key="c" onClick={() => completeTask(t.id)}>完成</a>]}>
                  <List.Item.Meta title={t.title} description={`${lbl(t.priority)}优先级 · 截止 ${fmtTime(t.dueAt)}`} />
                </List.Item>
              )} />
          </Card>
          <Card size="small" title="最近通话">
            <Table size="small" rowKey="id" pagination={false} dataSource={myCalls} locale={{ emptyText: '暂无通话' }}
              onRow={(r: any) => ({ onClick: () => nav(`/live?callId=${r.id}`), style: { cursor: 'pointer' } })}
              columns={[
                { title: '号码', dataIndex: 'phoneE164', render: (v, r: any) => v || r.fromNo || r.toNo },
                { title: '方向', dataIndex: 'direction', render: (v) => <ETag value={v} /> },
                { title: '状态', dataIndex: 'status', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
                { title: '时长', dataIndex: 'talkSec', render: fmtSec },
                { title: '时间', dataIndex: 'createdAt', render: fmtTime },
              ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
