import { useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Select, InputNumber, Input, Tag, Drawer, message, Statistic, Row, Col } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, ThunderboltOutlined, UploadOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl, colorOf, fmtTime } from '../../lib/enums';
import ETag from '../../components/ETag';

export default function Outbound() {
  const qc = useQueryClient();
  const { rows, isFetching } = usePaged(['campaigns'], '/campaigns', { pageSize: 100 });
  const groups = useOnce<any>(['groups'], '/skill-groups');
  const lines = useOnce<any>(['lines'], '/lines');
  const [open, setOpen] = useState(false);
  const [targetsOf, setTargetsOf] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [form] = Form.useForm();
  const groupList = groups.data || [];
  const lineList = lines.data || [];
  const tg = usePaged(['targets', targetsOf?.id], `/campaigns/${targetsOf?.id}/targets`, { pageSize: 500 }, { enabled: !!targetsOf });
  const stats = useOnce<any>(['cstats', targetsOf?.id], `/campaigns/${targetsOf?.id}/stats`, undefined, { enabled: !!targetsOf, refetchInterval: 5000 });

  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/campaigns', v));
    message.success('外呼任务已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['campaigns'] });
  };
  const setStatus = async (id: string, act: 'start' | 'pause') => { await api(http.post(`/campaigns/${id}/${act}`)); qc.invalidateQueries({ queryKey: ['campaigns'] }); };
  const importRows = async () => {
    const list = raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [phone, name] = l.split(/[,，\t]/);
      return { phoneE164: phone?.trim(), custom: { name: name?.trim() || '' } };
    });
    await api(http.post(`/campaigns/${targetsOf.id}/targets/import`, { rows: list }));
    message.success(`导入 ${list.length} 条名单`); setImportOpen(false); setRaw(''); qc.invalidateQueries({ queryKey: ['targets'] });
  };
  const run = async (id: string) => {
    const r = await api<any>(http.post(`/campaigns/${id}/run`, {}));
    message.success(`本轮已发起 ${r?.dialed ?? r?.length ?? 0} 通预测式外呼`);
    qc.invalidateQueries();
  };

  return (
    <Card title={<span className="page-title">外呼任务（手动 / 预览 / 预测式）</span>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建任务</Button>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 900 }}
        onRow={(r) => ({ onClick: () => setTargetsOf(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: '任务名称', dataIndex: 'name' },
          { title: '拨号策略', dataIndex: 'strategy', render: (v) => lbl(v) },
          { title: '状态', dataIndex: 'status', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
          { title: '并发/日限', render: (_, r) => `${r.concurrency ?? '-'} / ${r.dailyLimit ?? '-'}` },
          { title: '时间', render: (_, r) => `${fmtTime(r.startAt, 'MM-DD HH:mm')} ~ ${fmtTime(r.endAt, 'MM-DD HH:mm')}` },
          { title: '操作', render: (_, r) => (
            <Space onClick={(e) => e.stopPropagation()}>
              {r.status !== 'RUNNING' ? <a onClick={() => setStatus(r.id, 'start')}><PlayCircleOutlined />启动</a> : <a onClick={() => setStatus(r.id, 'pause')}><PauseCircleOutlined />暂停</a>}
              <a onClick={() => run(r.id)}><ThunderboltOutlined />执行一批</a>
              <a onClick={() => { setTargetsOf(r); setImportOpen(true); }}><UploadOutlined />导入名单</a>
            </Space>
          ) },
        ]} />

      <Modal title="新建外呼任务" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ strategy: 'PREDICTIVE', concurrency: 10, dailyLimit: 200, predictiveRatio: 1.2 }}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Space size="large">
            <Form.Item name="strategy" label="拨号策略"><Select style={{ width: 140 }} options={['MANUAL', 'PREVIEW', 'PREDICTIVE'].map((v) => ({ value: v, label: lbl(v) }))} /></Form.Item>
            <Form.Item name="groupId" label="技能组"><Select style={{ width: 160 }} options={groupList.map((g: any) => ({ value: g.id, label: g.name }))} /></Form.Item>
          </Space>
          <Space size="large">
            <Form.Item name="lineId" label="线路"><Select allowClear style={{ width: 180 }} options={lineList.map((l: any) => ({ value: l.id, label: `${l.label} ${l.numberE164}` }))} /></Form.Item>
            <Form.Item name="concurrency" label="并发数"><InputNumber min={1} /></Form.Item>
          </Space>
          <Space size="large">
            <Form.Item name="dailyLimit" label="每日上限"><InputNumber min={1} /></Form.Item>
            <Form.Item name="predictiveRatio" label="预测外拨系数"><InputNumber min={1} max={3} step={0.1} /></Form.Item>
          </Space>
        </Form>
      </Modal>

      <Drawer width={620} open={!!targetsOf && !importOpen} onClose={() => setTargetsOf(null)} title={`外呼名单 · ${targetsOf?.name || ''}`}
        extra={<Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入名单</Button>}>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {['total', 'connected', 'noConnect', 'follow', 'blacklist'].map((k) => (
            <Col span={Math.floor(24 / 5)} key={k}><Card size="small"><Statistic title={({ total: '总数', connected: '已接通', noConnect: '未接通', follow: '待跟进', blacklist: '黑名单' } as any)[k]} value={(stats.data as any)?.[k] ?? 0} /></Card></Col>
          ))}
        </Row>
        <Table size="small" rowKey="id" loading={tg.isFetching} dataSource={tg.rows} pagination={{ pageSize: 8 }}
          columns={[
            { title: '号码', dataIndex: 'phoneE164' },
            { title: '状态', dataIndex: 'state', render: (v) => <ETag value={v} /> },
            { title: '尝试次数', dataIndex: 'attempts' },
            { title: '下次拨打', dataIndex: 'nextDialAt', render: fmtTime },
          ]} />
      </Drawer>

      <Modal title="导入外呼名单（每行：手机号,客户姓名）" open={importOpen} onOk={importRows} onCancel={() => setImportOpen(false)} okText="导入">
        <Input.TextArea rows={10} placeholder={'13911112222,赵经理\n13822223333,钱总'} value={raw} onChange={(e) => setRaw(e.target.value)} />
      </Modal>
    </Card>
  );
}
