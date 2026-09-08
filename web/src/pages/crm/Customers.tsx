import { useState } from 'react';
import { Card, Table, Button, Space, Input, Modal, Form, Drawer, Tabs, Table as T2, message, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl, colorOf, fmtTime, fmtMoney } from '../../lib/enums';
import ETag from '../../components/ETag';

const LEVELS = ['KA', 'BIG', 'MIDDLE', 'SMALL'];
const SCALES = ['SCALE_A', 'SCALE_B', 'SCALE_C', 'SCALE_D', 'SCALE_E'];

export default function Customers() {
  const qc = useQueryClient();
  const [q, setQ] = useState<any>({ page: 1, pageSize: 10 });
  const { rows, total, isFetching } = usePaged(['customers'], '/customers', q);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [note, setNote] = useState('');
  const [form] = Form.useForm();
  const [cform] = Form.useForm();
  const contacts = useOnce<any>(['contacts', detail?.id], '/contacts', { customerId: detail?.id }, { enabled: !!detail?.id });
  const opps = useOnce<any>(['opps', detail?.id], '/opportunities', { customerId: detail?.id }, { enabled: !!detail?.id });
  const acts = useOnce<any>(['cust-act', detail?.id], '/activities', { type: 'CUSTOMER', id: detail?.id }, { enabled: !!detail?.id });

  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/customers', v));
    message.success('客户已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['customers'] });
  };
  const addContact = async () => {
    const v = await cform.validateFields();
    await api(http.post('/contacts', { ...v, customerId: detail.id }));
    message.success('联系人已添加'); setContactOpen(false); cform.resetFields(); qc.invalidateQueries({ queryKey: ['contacts'] });
  };
  const addNote = async () => {
    if (!note.trim()) return;
    await api(http.post('/activities', { relatedType: 'CUSTOMER', relatedId: detail.id, type: 'NOTE', content: note }));
    setNote(''); message.success('跟进已记录'); qc.invalidateQueries({ queryKey: ['cust-act'] });
  };

  return (
    <Card title={<span className="page-title">客户</span>} extra={
      <Space>
        <Input.Search placeholder="客户名称/行业" allowClear onSearch={(kw) => setQ((s: any) => ({ ...s, keyword: kw, page: 1 }))} style={{ width: 200 }} />
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['customers'] })} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建客户</Button>
      </Space>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 900 }}
        pagination={{ current: q.page, pageSize: q.pageSize, total, showSizeChanger: true, onChange: (page, pageSize) => setQ((s: any) => ({ ...s, page, pageSize })) }}
        onRow={(r) => ({ onClick: () => setDetail(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: '客户名称', dataIndex: 'name' },
          { title: '行业', dataIndex: 'industry', render: (v) => v || '-' },
          { title: '规模', dataIndex: 'scale', render: (v) => lbl(v) },
          { title: '等级', dataIndex: 'level', render: (v) => <ETag value={v} /> },
          { title: '阶段', dataIndex: 'stage', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
          { title: '地区', dataIndex: 'area', render: (v) => v || '-' },
          { title: '最近跟进', dataIndex: 'lastFollowAt', render: fmtTime },
        ]} />

      <Modal title="新建客户" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="industry" label="行业"><Input /></Form.Item>
          <Form.Item name="scale" label="企业规模"><Select2 options={SCALES} /></Form.Item>
          <Form.Item name="level" label="客户等级" initialValue="MIDDLE"><Select2 options={LEVELS} /></Form.Item>
          <Form.Item name="area" label="地区"><Input /></Form.Item>
          <Form.Item name="website" label="官网"><Input /></Form.Item>
        </Form>
      </Modal>

      <Drawer width={560} open={!!detail} onClose={() => setDetail(null)} title={detail?.name} extra={<Button type="primary" onClick={() => setContactOpen(true)}>添加联系人</Button>}>
        <Tabs items={[
          { key: 'opp', label: `商机`, children: <T2 size="small" rowKey="id" pagination={false} dataSource={opps.data?.list || opps.data || []}
            columns={[
              { title: '商机', dataIndex: 'name' },
              { title: '阶段', dataIndex: 'stage', render: (v) => <ETag value={v} /> },
              { title: '金额', dataIndex: 'amount', render: fmtMoney },
              { title: '概率', dataIndex: 'probability', render: (v) => `${v ?? 0}%` },
            ]} /> },
          { key: 'contact', label: '联系人', children: <T2 size="small" rowKey="id" pagination={false} dataSource={contacts.data?.list || contacts.data || []}
            columns={[
              { title: '姓名', dataIndex: 'name' }, { title: '职务', dataIndex: 'title' },
              { title: '手机', dataIndex: 'phoneRaw' }, { title: '决策角色', dataIndex: 'decisionRole', render: lbl },
            ]} /> },
          { key: 'act', label: '跟进动态', children: <>
            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <Input value={note} placeholder="记录一条跟进备注" onChange={(e) => setNote(e.target.value)} />
              <Button type="primary" onClick={addNote}>添加</Button>
            </Space.Compact>
            {(acts.data?.list || acts.data || []).map((a: any) => (
              <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                <Tag>{lbl(a.type)}</Tag>{fmtTime(a.happenedAt)}<div>{a.content}</div>
              </div>
            ))}
          </> },
        ]} />
      </Drawer>

      <Modal title="添加联系人" open={contactOpen} onOk={addContact} onCancel={() => setContactOpen(false)} destroyOnClose>
        <Form form={cform} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="title" label="职务"><Input /></Form.Item>
          <Form.Item name="phoneRaw" label="手机号"><Input /></Form.Item>
          <Form.Item name="decisionRole" label="决策角色" initialValue="USER">
            <Select2 options={['DECIDER', 'INFLUENCER', 'USER', 'GATEKEEPER']} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

import { Select } from 'antd';
function Select2({ options }: { options: string[] }) {
  return <Select options={options.map((v) => ({ value: v, label: lbl(v) }))} />;
}
