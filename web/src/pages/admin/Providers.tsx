import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, Switch, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged } from '../../lib/hooks';
import { lbl, fmtTime } from '../../lib/enums';
import ETag from '../../components/ETag';

const PROVIDER_TYPES = ['TELEPHONY', 'ASR', 'TTS', 'LLM', 'SMS', 'EMAIL', 'WECHAT'];

function ApiKeys() {
  const qc = useQueryClient();
  const { rows } = usePaged(['int-keys'], '/integrations/keys', { pageSize: 100 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    const r = await api<any>(http.post('/integrations/keys', v));
    Modal.info({ title: '请立即保存密钥', width: 520, content: <Input.TextArea readOnly rows={3} value={r?.key || r?.secret || JSON.stringify(r)} /> });
    setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['int-keys'] });
  };
  const toggle = async (r: any) => { await api(http.post(`/integrations/keys/${r.id}/toggle`, { enabled: !r.enabled })); qc.invalidateQueries({ queryKey: ['int-keys'] }); };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>创建开放密钥</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '名称', dataIndex: 'name' }, { title: 'Key 前缀', dataIndex: 'keyPrefix' },
      { title: '启用', dataIndex: 'enabled', render: (v) => (v ? '是' : '否') }, { title: '过期时间', dataIndex: 'expireAt', render: fmtTime },
      { title: '操作', render: (_, r) => <a onClick={() => toggle(r)}>{r.enabled ? '停用' : '启用'}</a> },
    ]} />
    <Modal title="创建开放密钥" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="scopes" label="权限范围（回车添加，如 crm:read）"><Select mode="tags" /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Webhooks() {
  const qc = useQueryClient();
  const { rows } = usePaged(['int-hooks'], '/integrations/webhooks', { pageSize: 100 });
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<any[] | null>(null);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/integrations/webhooks', v)); message.success('Webhook 已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['int-hooks'] });
  };
  const showDel = async (id: string) => setDeliveries(await api<any>(http.get('/integrations/webhooks/deliveries', { params: { webhookId: id } })));
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>创建 Webhook</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '名称', dataIndex: 'name' }, { title: '回调地址', dataIndex: 'url', ellipsis: true },
      { title: '订阅事件', render: (_, r) => (r.events || []).map((e: string) => <Tag key={e}>{e}</Tag>) },
      { title: '操作', render: (_, r) => <a onClick={() => showDel(r.id)}>投递记录</a> },
    ]} />
    <Modal title="创建 Webhook" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="url" label="回调 URL" rules={[{ required: true }]}><Input placeholder="https://" /></Form.Item>
        <Form.Item name="events" label="订阅事件（回车添加）"><Select mode="tags" placeholder="call.ended、lead.created" /></Form.Item>
      </Form>
    </Modal>
    <Modal open={!!deliveries} title="投递记录" footer={null} onCancel={() => setDeliveries(null)} width={640}>
      <Table size="small" rowKey="id" dataSource={(Array.isArray(deliveries) ? deliveries : (deliveries as any)?.list) || []} pagination={{ pageSize: 8 }} columns={[
        { title: '事件', dataIndex: 'event' }, { title: 'HTTP', dataIndex: 'httpStatus' }, { title: '次数', dataIndex: 'attempts' }, { title: '时间', dataIndex: 'createdAt', render: fmtTime },
      ]} />
    </Modal>
  </>;
}

function Providers() {
  const qc = useQueryClient();
  const { rows } = usePaged(['int-providers'], '/integrations/providers', { pageSize: 100 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    const credentials = { ...(v.credentialsJson ? JSON.parse(v.credentialsJson) : {}) };
    await api(http.post('/integrations/providers', { ...v, credentials }));
    message.success('供应商已保存（凭证 AES-GCM 加密存储）'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['int-providers'] });
  };
  const reveal = async (r: any) => {
    const data = await api<any>(http.get(`/integrations/providers/${r.id}/reveal`));
    Modal.info({ title: `${r.name} 明文凭证（仅本次展示）`, content: <Input.TextArea readOnly rows={4} value={JSON.stringify(data?.credentials || data, null, 2)} /> });
  };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>接入供应商</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '类型', dataIndex: 'type', render: (v) => <ETag value={v} /> },
      { title: '名称', dataIndex: 'name' }, { title: '供应商标识', dataIndex: 'provider' },
      { title: '沙箱', dataIndex: 'sandbox', render: (v) => (v ? <Tag color="orange">沙箱</Tag> : <Tag color="green">真实</Tag>) },
      { title: '启用', dataIndex: 'enabled', render: (v) => (v ? '是' : '否') },
      { title: '操作', render: (_, r) => <a onClick={() => reveal(r)}><EyeOutlined />查看凭证</a> },
    ]} />
    <Modal title="接入供应商（语音/大模型/短信，沙箱可离线）" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose width={560}>
      <Form form={form} layout="vertical" initialValues={{ type: 'LLM', sandbox: true, enabled: true }}>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="type" label="类型" style={{ flex: 1 }}><Select options={PROVIDER_TYPES.map((t) => ({ value: t, label: lbl(t) }))} /></Form.Item>
          <Form.Item name="provider" label="供应商标识" style={{ flex: 1 }}><Input placeholder="openai / aliyun / ..." /></Form.Item>
        </Space>
        <Form.Item name="name" label="配置名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="credentialsJson" label="凭证 JSON（appId/apiKey/secret 等，加密存储）">
          <Input.TextArea rows={3} placeholder={'{"apiKey":"sk-xxx","baseUrl":"https://..."}'} />
        </Form.Item>
        <Space size="large">
          <Form.Item name="sandbox" label="沙箱模式" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Space>
      </Form>
    </Modal>
  </>;
}

export default function ProvidersPage() {
  return (
    <Card title={<span className="page-title">集成中心（供应商 / 开放密钥 / Webhook）</span>}>
      <Tabs items={[
        { key: 'p', label: '供应商配置', children: <Providers /> },
        { key: 'k', label: '开放密钥', children: <ApiKeys /> },
        { key: 'w', label: 'Webhook', children: <Webhooks /> },
      ]} />
    </Card>
  );
}
