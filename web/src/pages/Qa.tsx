import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, Tag, message, Progress, Drawer, Descriptions } from 'antd';
import { PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../api/client';
import { usePaged } from '../lib/hooks';
import { lbl, colorOf, fmtTime } from '../lib/enums';
import ETag from '../components/ETag';

const TYPES = ['KEYWORD', 'SCRIPT', 'REGEX', 'SILENCE', 'EMOTION', 'SPEED'];

function Rules() {
  const qc = useQueryClient();
  const { rows } = usePaged(['qa-rules'], '/qa/rules', {});
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/qa/rules', v)); message.success('规则已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['qa-rules'] });
  };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建质检规则</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '规则', dataIndex: 'name' }, { title: '类型', dataIndex: 'type', render: lbl },
      { title: '分类', dataIndex: 'category' },
      { title: '匹配模式', render: (_, r) => (r.pattern || []).map((p: string) => <Tag key={p}>{p}</Tag>) },
      { title: '必达/禁忌', dataIndex: 'mustHit', render: (v) => (v ? '必达项' : '禁忌项') },
      { title: '权重', dataIndex: 'weight' },
    ]} />
    <Modal title="新建质检规则" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ type: 'KEYWORD', weight: 5, mustHit: false, enabled: true }}>
        <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="type" label="类型" style={{ flex: 1 }}><Select options={TYPES.map((t) => ({ value: t, label: lbl(t) }))} /></Form.Item>
          <Form.Item name="category" label="分类" style={{ flex: 1 }}><Input placeholder="服务规范/合规红线" /></Form.Item>
          <Form.Item name="weight" label="权重分" style={{ width: 110 }}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        </Space>
        <Form.Item name="pattern" label="匹配词/正则（回车添加）"><Select mode="tags" tokenSeparators={[',']} /></Form.Item>
        <Form.Item name="mustHit" label="是否必达项（否则为禁忌项）" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function scoreColor(s: number) { return s >= 90 ? '#52c41a' : s >= 75 ? '#1677ff' : s >= 60 ? '#faad14' : '#ff4d4f'; }

function Records() {
  const qc = useQueryClient();
  const { rows, isFetching } = usePaged(['qa-records'], '/qa/records', { pageSize: 50 });
  const [detail, setDetail] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [score, setScore] = useState(100);
  const [comment, setComment] = useState('');

  const review = async () => {
    await api(http.post(`/qa/records/${detail.id}/review`, { score, comment }));
    message.success('复检完成'); setReviewOpen(false); qc.invalidateQueries({ queryKey: ['qa-records'] });
  };

  return <>
    <Table rowKey="id" size="small" loading={isFetching} dataSource={rows}
      onRow={(r) => ({ onClick: () => setDetail(r), style: { cursor: 'pointer' } })}
      columns={[
        { title: '通话', render: (_, r) => r.call?.phoneE164 || r.callId?.slice(0, 8) },
        { title: '类型', dataIndex: 'type', render: (v) => lbl(v) },
        { title: '状态', dataIndex: 'status', render: (v) => <ETag value={v} /> },
        { title: '得分', dataIndex: 'score', render: (v) => <span style={{ color: scoreColor(v), fontWeight: 700 }}>{v}</span> },
        { title: '复检人', dataIndex: 'reviewerId', render: (v) => v ? '已复检' : '-' },
        { title: '时间', dataIndex: 'createdAt', render: fmtTime },
      ]} />
      <Drawer width={480} open={!!detail} onClose={() => setDetail(null)} title="质检详情"
        extra={detail?.status !== 'REVIEWED' && <Button type="primary" icon={<SafetyOutlined />} onClick={() => { setScore(detail.score); setComment(detail.comment || ''); setReviewOpen(true); }}>人工复检</Button>}>
        {detail && <>
          <Progress percent={detail.score} strokeColor={scoreColor(detail.score)} status="active" />
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="状态"><Tag color={colorOf(detail.status)}>{lbl(detail.status)}</Tag></Descriptions.Item>
            <Descriptions.Item label="复检意见">{detail.comment || '-'}</Descriptions.Item>
          </Descriptions>
        </>}
      </Drawer>
      <Modal title="人工复检" open={reviewOpen} onOk={review} onCancel={() => setReviewOpen(false)}>
        <Form layout="vertical">
          <Form.Item label="最终得分"><InputNumber min={0} max={100} value={score} onChange={(v) => setScore(v ?? 100)} /></Form.Item>
          <Form.Item label="复检意见"><Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Form.Item>
        </Form>
      </Modal>
  </>;
}

export default function Qa() {
  return (
    <Card title={<span className="page-title">智能质检（规则引擎 + AI 初检 + 人工复检）</span>}>
      <Tabs items={[
        { key: 'records', label: '质检记录', children: <Records /> },
        { key: 'rules', label: '质检规则', children: <Rules /> },
      ]} />
    </Card>
  );
}
