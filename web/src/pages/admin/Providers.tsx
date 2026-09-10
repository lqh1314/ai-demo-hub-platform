import { useEffect, useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, Switch, Tag, message, Alert } from 'antd';
import { PlusOutlined, EyeOutlined, ApiOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged } from '../../lib/hooks';
import { fmtTime } from '../../lib/enums';
import ETag from '../../components/ETag';

// OpenAI 兼容大模型预设（填好标识与 Key 即可，baseUrl/模型留空走预设）
const LLM_PRESETS = [
  { value: 'deepseek', label: 'DeepSeek（deepseek-chat，国内直连推荐）' },
  { value: 'doubao', label: '豆包 / 火山方舟 Ark（模型填推理接入点 ep-xxxx）' },
  { value: 'qwen', label: '通义千问 DashScope（qwen-plus）' },
  { value: 'zhipu', label: '智谱 GLM（glm-4-flash）' },
  { value: 'kimi', label: 'Kimi / Moonshot' },
  { value: 'openai', label: 'OpenAI（gpt-4o-mini，需可访问）' },
  { value: 'local-demo', label: '内置离线演示模型（免Key，开箱即用，推荐先体验）' },
  { value: 'ollama', label: '本地 Ollama / vLLM（自建模型）' },
  { value: 'custom', label: '自定义 OpenAI 兼容接口' },
];

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
  const [testing, setTesting] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [form] = Form.useForm();
  const code = Form.useWatch('code', form);

  const refreshActive = async () => setActive(await api<any>(http.get('/integrations/providers/active')));
  useEffect(() => { refreshActive(); }, [rows.length]);

  const buildCreds = (v: any) => ({
    apiKey: v.apiKey?.trim() || undefined,
    baseUrl: v.baseUrl?.trim() || undefined,
    model: v.model?.trim() || undefined,
    persona: v.persona?.trim() || undefined,
  });
  const save = async () => {
    const v = await form.validateFields();
    await api(http.post('/integrations/providers', {
      type: 'LLM', code: v.code, name: v.name || `大模型-${v.code}`, enabled: v.enabled ?? true, priority: 100,
      credentials: buildCreds(v),
    }));
    message.success('已保存并即时生效（凭证 AES-GCM 加密存储）');
    setOpen(false); form.resetFields();
    qc.invalidateQueries({ queryKey: ['int-providers'] }); refreshActive();
  };
  const testDraft = async () => {
    const v = await form.validateFields(['code']);
    setTesting(true);
    try {
      const r = await api<any>(http.post('/integrations/providers/test', { code: v.code, credentials: buildCreds(form.getFieldsValue()) }));
      if (r?.ok) Modal.success({ title: '连接成功', width: 520, content: <div>模型：{r.model}<br />延迟：{r.latencyMs} ms<br />样例回复：{r.sample}</div> });
      else Modal.error({ title: '连接失败', width: 560, content: r?.error || '未知错误' });
    } finally { setTesting(false); }
  };
  const testSaved = async (r: any) => {
    const res = await api<any>(http.post('/integrations/providers/test', { id: r.id }));
    if (res?.ok) message.success(`连接成功，延迟 ${res.latencyMs}ms：${res.sample?.slice(0, 30)}`);
    else Modal.error({ title: `${r.name} 连接失败`, content: res?.error });
  };
  const reveal = async (r: any) => {
    const data = await api<any>(http.get(`/integrations/providers/${r.id}/reveal`));
    Modal.info({ title: `${r.name} 明文凭证（仅本次展示）`, content: <Input.TextArea readOnly rows={4} value={JSON.stringify(data?.credentials || data, null, 2)} /> });
  };
  return <>
    <Alert
      style={{ marginBottom: 10 }}
      type={active?.real ? 'success' : 'warning'} showIcon
      message={active?.real
        ? (active.activeCode === 'local-demo'
          ? '当前机器人大脑：内置离线演示模型（免Key、走真实 OpenAI 兼容链路）。在下方换成豆包/DeepSeek 并填 Key，即无缝升级为真实大模型。'
          : `当前机器人大脑：真实大模型「${active.activeName}」（${active.activeCode}）；调用失败会自动回退内置沙箱，通话不中断。`)
        : '当前机器人大脑：内置沙箱 NLU（离线可演示）。在下方接入一个 OpenAI 兼容大模型并启用后，接线机器人即切换为真实 AI。'}
    />
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>接入大模型</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '类型', dataIndex: 'type', render: (v) => <ETag value={v} /> },
      { title: '名称', dataIndex: 'name' }, { title: '供应商标识', dataIndex: 'code' },
      { title: '状态', dataIndex: 'enabled', render: (v, r) => !v ? <Tag>未启用</Tag> : (r.code === 'sandbox' ? <Tag color="default">启用·内置兜底</Tag> : <Tag color="green">启用·真实</Tag>) },
      { title: '操作', render: (_, r) => <Space>
        <a onClick={() => testSaved(r)}><ApiOutlined />测试连接</a>
        <a onClick={() => reveal(r)}><EyeOutlined />凭证</a>
      </Space> },
    ]} />
    <Modal title="接入大模型（OpenAI 兼容协议：DeepSeek/豆包/通义/智谱/Kimi/本地）" open={open} onOk={save} confirmLoading={testing}
      onCancel={() => setOpen(false)} destroyOnClose width={600}
      footer={(_, { OkBtn, CancelBtn }) => <Space>
        <Button icon={<ApiOutlined />} loading={testing} onClick={testDraft}>先测试连接</Button>
        <CancelBtn /><OkBtn />
      </Space>}>
      <Form form={form} layout="vertical" initialValues={{ type: 'LLM', code: 'local-demo', enabled: true }}>
        <Form.Item name="code" label="选择大模型" rules={[{ required: true }]}><Select options={LLM_PRESETS} showSearch optionFilterProp="label" /></Form.Item>
        <Form.Item name="name" label="配置名称（可选，默认按模型生成）"><Input placeholder="如：售前接线-DeepSeek" /></Form.Item>
        <Form.Item name="apiKey" label="API Key（内置离线演示 / 本地模型可留空）">
          <Input.Password autoComplete="new-password" placeholder="sk-xxxxxxxx，加密存储、不明文回显；选“内置离线演示模型”无需填写" />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="model" label="模型/接入点（留空用预设）" style={{ flex: 1 }}><Input placeholder={code === 'doubao' ? 'ep-xxxxxxxx' : 'deepseek-chat'} /></Form.Item>
          <Form.Item name="baseUrl" label="BaseUrl（留空用预设）" style={{ flex: 1 }}><Input placeholder="https://..." /></Form.Item>
        </Space>
        <Form.Item name="persona" label="机器人业务人设（可选，让回答更贴合你的产品）"><Input.TextArea rows={2} placeholder="如：我们是面向中小企业的智能客服 SaaS，主打通话机器人+电销工作台……" /></Form.Item>
        <Form.Item name="enabled" label="保存后立即启用为机器人大脑" valuePropName="checked"><Switch /></Form.Item>
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
