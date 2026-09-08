import { useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl } from '../../lib/enums';

export default function Knowledge() {
  const qc = useQueryClient();
  const bases = useOnce<any>(['kb-bases'], '/kb/bases');
  const [kbId, setKbId] = useState<string | undefined>();
  const { rows, isFetching } = usePaged(['kb-articles', kbId], '/kb/articles', { kbId, pageSize: 200 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const baseList = bases.data || [];
  const activeKb = kbId || baseList[0]?.id;

  const edit = (r: any) => { setEditing(r); form.setFieldsValue({ ...r, keywords: r.keywords || [] }); setOpen(true); };
  const add = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    const payload = { ...v, kbId: v.kbId || activeKb };
    if (editing) await api(http.patch(`/kb/articles/${editing.id}`, payload));
    else await api(http.post('/kb/articles', payload));
    message.success('已保存'); setOpen(false); qc.invalidateQueries({ queryKey: ['kb-articles'] });
  };
  const publish = async (id: string) => { await api(http.post(`/kb/articles/${id}/publish`)); message.success('已发布'); qc.invalidateQueries({ queryKey: ['kb-articles'] }); };
  const del = async (id: string) => { await api(http.delete(`/kb/articles/${id}`)); qc.invalidateQueries({ queryKey: ['kb-articles'] }); };

  return (
    <Card title={<span className="page-title">知识库（FAQ 检索 / 发布）</span>} extra={
      <Space>
        <Select style={{ width: 200 }} placeholder="选择知识库" value={activeKb} onChange={setKbId}
          options={baseList.map((b: any) => ({ value: b.id, label: b.name }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={add}>新建条目</Button>
      </Space>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small"
        columns={[
          { title: '问题', dataIndex: 'question' },
          { title: '答案', dataIndex: 'answer', ellipsis: true },
          { title: '关键词', render: (_, r) => (r.keywords || []).map((k: string) => <Tag key={k}>{k}</Tag>) },
          { title: '命中次数', dataIndex: 'hitCount' },
          { title: '状态', dataIndex: 'status', render: (v) => <Tag color={v === 'PUBLISHED' ? 'success' : 'default'}>{lbl(v)}</Tag> },
          { title: '操作', render: (_, r) => (
            <Space>
              <a onClick={() => edit(r)}>编辑</a>
              {r.status !== 'PUBLISHED' && <a onClick={() => publish(r.id)}>发布</a>}
              <Popconfirm title="删除？" onConfirm={() => del(r.id)}><a>删除</a></Popconfirm>
            </Space>
          ) },
        ]} />
      <Modal title={editing ? '编辑知识条目' : '新建知识条目'} open={open} onOk={save} onCancel={() => setOpen(false)} destroyOnClose width={560}>
        <Form form={form} layout="vertical" initialValues={{ status: 'DRAFT' }}>
          <Form.Item name="kbId" label="所属知识库" initialValue={activeKb}>
            <Select options={baseList.map((b: any) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="question" label="标准问题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="answer" label="标准答案" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="keywords" label="检索关键词（回车添加）"><Select mode="tags" tokenSeparators={[',']} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
