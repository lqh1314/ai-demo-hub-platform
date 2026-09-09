import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, Tag, message } from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../api/client';
import { usePaged } from '../lib/hooks';
import { lbl, colorOf, fmtTime } from '../lib/enums';
import ETag from '../components/ETag';

const CHANNELS = ['SMS', 'EMAIL', 'WECHAT'];

function Templates() {
  const qc = useQueryClient();
  const { rows } = usePaged(['msg-tpl'], '/messages/templates', { pageSize: 200 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/messages/templates', v)); message.success('模板已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['msg-tpl'] });
  };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建消息模板</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '通道', dataIndex: 'channel', render: (v) => <ETag value={v} /> },
      { title: '名称', dataIndex: 'name' }, { title: '标题', dataIndex: 'title' },
      { title: '内容', dataIndex: 'content', ellipsis: true }, { title: '审核', dataIndex: 'auditStatus' },
    ]} />
    <Modal title="新建模板" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ channel: 'SMS' }}>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="channel" label="通道" style={{ flex: 1 }}><Select options={CHANNELS.map((c) => ({ value: c, label: lbl(c) }))} /></Form.Item>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]} style={{ flex: 2 }}><Input /></Form.Item>
        </Space>
        <Form.Item name="title" label="标题（邮件/企微）"><Input /></Form.Item>
        <Form.Item name="content" label="内容（变量用 {{name}}）" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Dispatch() {
  const qc = useQueryClient();
  const { rows: tpls } = usePaged(['msg-tpl2'], '/messages/templates', { pageSize: 200 });
  const { rows: tasks } = usePaged(['msg-tasks'], '/messages/tasks', { pageSize: 50 });
  const { rows: records } = usePaged(['msg-records'], '/messages/records', { pageSize: 50 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const send = async () => {
    const v = await form.validateFields();
    const audience = v.audience.split(/[\n,，;；]/).map((s: string) => s.trim()).filter(Boolean);
    await api(http.post('/messages/dispatch', { templateId: v.templateId, channel: v.channel, audience, scheduledAt: v.scheduledAt?.format('YYYY-MM-DD HH:mm:ss') }));
    message.success(`已下发 ${audience.length} 个接收方（沙箱）`); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['msg-tasks'] });
  };
  return <>
    <Button type="primary" icon={<SendOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>发起群发</Button>
    <h4>发送任务</h4>
    <Table rowKey="id" size="small" style={{ marginBottom: 16 }} dataSource={tasks} pagination={false} columns={[
      { title: '通道', dataIndex: 'channel', render: (v) => <ETag value={v} /> },
      { title: '状态', dataIndex: 'status', render: (v) => <Tag color={colorOf(v)}>{v}</Tag> },
      { title: '计划时间', dataIndex: 'scheduledAt', render: fmtTime },
      { title: '统计', render: (_, r) => {
        const items = Object.entries(r.stats || {}).filter(([, v]) => v != null);
        return items.length ? items.map(([k, v]) => `${k} ${v}`).join(' · ') : '-';
      } },
    ]} />
    <h4>发送记录</h4>
    <Table rowKey="id" size="small" dataSource={records} pagination={{ pageSize: 8 }} columns={[
      { title: '接收方', dataIndex: 'toAddr' }, { title: '通道', dataIndex: 'channel', render: lbl },
      { title: '状态', dataIndex: 'status', render: (v) => <ETag value={v} /> },
      { title: '内容', dataIndex: 'content', ellipsis: true }, { title: '发送时间', dataIndex: 'sendAt', render: fmtTime },
    ]} />
    <Modal title="发起群发（沙箱直发）" open={open} onOk={send} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ channel: 'SMS' }}>
        <Form.Item name="channel" label="通道"><Select options={CHANNELS.map((c) => ({ value: c, label: lbl(c) }))} /></Form.Item>
        <Form.Item name="templateId" label="选择模板" rules={[{ required: true }]}>
          <Select options={tpls.map((t: any) => ({ value: t.id, label: `[${lbl(t.channel)}] ${t.name}` }))} />
        </Form.Item>
        <Form.Item name="audience" label="接收方（手机号/邮箱，分隔符换行或逗号）" rules={[{ required: true }]}>
          <Input.TextArea rows={3} placeholder={'13911112222\n13833334444'} />
        </Form.Item>
      </Form>
    </Modal>
  </>;
}

export default function Messages() {
  return (
    <Card title={<span className="page-title">营销触达（短信 / 邮件 / 企微，Provider 可切换）</span>}>
      <Tabs items={[
        { key: 'dispatch', label: '群发与记录', children: <Dispatch /> },
        { key: 'tpl', label: '消息模板', children: <Templates /> },
      ]} />
    </Card>
  );
}
