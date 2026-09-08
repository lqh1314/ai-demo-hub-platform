import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged } from '../../lib/hooks';
import { lbl, fmtTime } from '../../lib/enums';

function Dicts() {
  const qc = useQueryClient();
  const { rows } = usePaged(['sys-dicts'], '/system/dicts', { pageSize: 200 });
  const [dict, setDict] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [form] = Form.useForm();
  const [iform] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/system/dicts', v)); message.success('字典已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['sys-dicts'] });
  };
  const addItem = async () => {
    const v = await iform.validateFields();
    await api(http.post(`/system/dicts/${dict.id}/items`, v)); message.success('字典项已添加'); setItemOpen(false); iform.resetFields(); qc.invalidateQueries({ queryKey: ['sys-dicts'] });
  };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建字典</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false}
      onRow={(r) => ({ onClick: () => setDict(r), style: { cursor: 'pointer' } })}
      columns={[
        { title: '字典编码', dataIndex: 'code' }, { title: '名称', dataIndex: 'name' },
        { title: '字典项', render: (_, r) => (r.items || []).map((i: any) => <Tag key={i.id}>{i.label}</Tag>) },
        { title: '操作', render: (_, r) => <a onClick={(e) => { e.stopPropagation(); setDict(r); setItemOpen(true); }}>加字典项</a> },
      ]} />
    <Modal title="新建字典" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`添加字典项 · ${dict?.name || ''}`} open={itemOpen} onOk={addItem} onCancel={() => setItemOpen(false)} destroyOnClose>
      <Form form={iform} layout="vertical">
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="value" label="值" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          <Form.Item name="label" label="显示名" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
        </Space>
        <Form.Item name="sort" label="排序"><Input type="number" /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Notifications() {
  const qc = useQueryClient();
  const { rows } = usePaged(['sys-notif'], '/system/notifications', { pageSize: 100 });
  const read = async (id: string) => { await api(http.post(`/system/notifications/${id}/read`)); qc.invalidateQueries({ queryKey: ['sys-notif'] }); };
  return (
    <Table rowKey="id" size="small" dataSource={rows} pagination={{ pageSize: 12 }} columns={[
      { title: '类型', dataIndex: 'type' }, { title: '标题', dataIndex: 'title' }, { title: '内容', dataIndex: 'content', ellipsis: true },
      { title: '已读', dataIndex: 'readAt', render: (v) => (v ? <Tag color="default">已读</Tag> : <Tag color="processing">未读</Tag>) },
      { title: '时间', dataIndex: 'createdAt', render: fmtTime },
      { title: '操作', render: (_, r) => !r.readAt && <a onClick={() => read(r.id)}>标为已读</a> },
    ]} />
  );
}

function Audit() {
  const { rows, isFetching } = usePaged(['sys-audit'], '/system/audit', { pageSize: 50 });
  return (
    <Table rowKey="id" size="small" loading={isFetching} dataSource={rows} pagination={{ pageSize: 12 }} scroll={{ x: 900 }} columns={[
      { title: '来源', dataIndex: 'actorType', render: lbl }, { title: '操作人', dataIndex: 'actorName' },
      { title: '动作', dataIndex: 'action' }, { title: '对象', render: (_, r) => `${r.resource || ''} ${r.resourceId?.slice(0, 8) || ''}` },
      { title: '结果', dataIndex: 'result' }, { title: 'IP', dataIndex: 'ip' }, { title: '时间', dataIndex: 'createdAt', render: fmtTime },
    ]} />
  );
}

export default function SystemPage() {
  return (
    <Card title={<span className="page-title">系统管理（数据字典 / 通知 / 审计日志）</span>}>
      <Tabs items={[
        { key: 'd', label: '数据字典', children: <Dicts /> },
        { key: 'n', label: '站内通知', children: <Notifications /> },
        { key: 'a', label: '审计日志', children: <Audit /> },
      ]} />
    </Card>
  );
}
