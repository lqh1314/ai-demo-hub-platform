import { useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl } from '../../lib/enums';

const ACTIONS = ['ANSWER', 'TRANSFER', 'COLLECT', 'FLOW'];

export default function Intents() {
  const qc = useQueryClient();
  const { rows, isFetching } = usePaged(['intents'], '/intents', { pageSize: 200 });
  const groups = useOnce<any>(['groups'], '/skill-groups');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const edit = (r: any) => { setEditing(r); form.setFieldsValue({ ...r, keywords: r.keywords || [], examples: (r.examples || []).join('\n') }); setOpen(true); };
  const add = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    const payload = { ...v, examples: String(v.examples || '').split('\n').filter(Boolean) };
    if (editing) await api(http.patch(`/intents/${editing.id}`, payload));
    else await api(http.post('/intents', payload));
    message.success('已保存'); setOpen(false); qc.invalidateQueries({ queryKey: ['intents'] });
  };
  const del = async (id: string) => { await api(http.delete(`/intents/${id}`)); qc.invalidateQueries({ queryKey: ['intents'] }); };

  return (
    <Card title={<span className="page-title">意图管理（NLU 语料 / 命中动作 / 转接技能组）</span>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={add}>新建意图</Button>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 900 }}
        columns={[
          { title: '意图', render: (_, r) => `${r.name}（${r.code}）` },
          { title: '关键词', render: (_, r) => (r.keywords || []).slice(0, 4).map((k: string) => <Tag key={k}>{k}</Tag>) },
          { title: '动作', dataIndex: 'action', render: lbl },
          { title: '优先级', dataIndex: 'priority' },
          { title: '启用', dataIndex: 'enabled', render: (v) => (v ? '是' : '否') },
          { title: '操作', render: (_, r) => <Space><a onClick={() => edit(r)}>编辑</a><Popconfirm title="删除？" onConfirm={() => del(r.id)}><a>删除</a></Popconfirm></Space> },
        ]} />
      <Modal title={editing ? '编辑意图' : '新建意图'} open={open} onOk={save} onCancel={() => setOpen(false)} destroyOnClose width={560}>
        <Form form={form} layout="vertical" initialValues={{ action: 'ANSWER', priority: 100, enabled: true }}>
          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item name="name" label="意图名称" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="code" label="意图编码" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="PRICE_INQUIRY" /></Form.Item>
          </Space>
          <Form.Item name="keywords" label="关键词（回车添加）"><Select mode="tags" tokenSeparators={[',']} placeholder="价格、多少钱" /></Form.Item>
          <Form.Item name="examples" label="语料示例（每行一句）"><Input.TextArea rows={3} /></Form.Item>
          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item name="action" label="命中动作" style={{ flex: 1 }}><Select options={ACTIONS.map((a) => ({ value: a, label: lbl(a) }))} /></Form.Item>
            <Form.Item name="targetGroupId" label="转接技能组" style={{ flex: 1 }}>
              <Select allowClear options={(groups.data || []).map((g: any) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="priority" label="优先级" style={{ width: 110 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Form.Item name="answer" label="回答话术"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
