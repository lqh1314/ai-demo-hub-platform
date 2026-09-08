import { useState } from 'react';
import { Card, Table, Button, Space, Input, Modal, Form, Select, InputNumber, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged } from '../../lib/hooks';
import { lbl, colorOf, fmtMoney, fmtDate } from '../../lib/enums';
import ETag from '../../components/ETag';

const STAGES = ['NEED_CONFIRM', 'NEED_DIG', 'SOLUTION', 'QUOTE', 'NEGOTIATE', 'WON', 'LOST'];
const NEXT: Record<string, string> = { NEED_CONFIRM: 'NEED_DIG', NEED_DIG: 'SOLUTION', SOLUTION: 'QUOTE', QUOTE: 'NEGOTIATE', NEGOTIATE: 'WON' };

export default function Opportunities() {
  const qc = useQueryClient();
  const [q, setQ] = useState<any>({ page: 1, pageSize: 10 });
  const { rows, total, isFetching } = usePaged(['opps-page'], '/opportunities', q);
  const customers = usePaged(['cust-all'], '/customers', { pageSize: 500 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const create = async () => {
    const v = await form.validateFields();
    const payload = { ...v, expectedClose: v.expectedClose?.format('YYYY-MM-DD') };
    await api(http.post('/opportunities', payload));
    message.success('商机已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['opps-page'] });
  };
  const advance = async (id: string) => { await api(http.post(`/opportunities/${id}/advance-stage`, {})); message.success('阶段已推进'); qc.invalidateQueries({ queryKey: ['opps-page'] }); };
  const lost = async (id: string) => { await api(http.post(`/opportunities/${id}/advance-stage`, { stage: 'LOST', reason: '客户暂不考虑' })); qc.invalidateQueries({ queryKey: ['opps-page'] }); };

  return (
    <Card title={<span className="page-title">商机漏斗</span>} extra={
      <Space>
        <Input.Search placeholder="商机名称" allowClear onSearch={(kw) => setQ((s: any) => ({ ...s, keyword: kw, page: 1 }))} style={{ width: 180 }} />
        <Select allowClear placeholder="阶段" style={{ width: 130 }} options={STAGES.map((v) => ({ value: v, label: lbl(v) }))}
          onChange={(v) => setQ((s: any) => ({ ...s, stage: v, page: 1 }))} />
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['opps-page'] })} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建商机</Button>
      </Space>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 960 }}
        pagination={{ current: q.page, pageSize: q.pageSize, total, showSizeChanger: true, onChange: (page, pageSize) => setQ((s: any) => ({ ...s, page, pageSize })) }}
        columns={[
          { title: '商机名称', dataIndex: 'name' },
          { title: '客户', render: (_, r) => customers.rows.find((c: any) => c.id === r.customerId)?.name || r.customerId?.slice(0, 6) },
          { title: '阶段', dataIndex: 'stage', render: (v) => <ETag value={v} /> },
          { title: '预计金额', dataIndex: 'amount', render: fmtMoney },
          { title: '赢单概率', dataIndex: 'probability', render: (v) => `${v ?? 0}%` },
          { title: '预计成交', dataIndex: 'expectedClose', render: fmtDate },
          { title: '操作', render: (_, r) => (
            <Space>
              {NEXT[r.stage] && <a onClick={() => advance(r.id)}>推进到「{lbl(NEXT[r.stage])}」</a>}
              {!['WON', 'LOST'].includes(r.stage) && <Popconfirm title="标记为输单？" onConfirm={() => lost(r.id)}><a>输单</a></Popconfirm>}
            </Space>
          ) },
        ]} />
      <Modal title="新建商机" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ stage: 'NEED_CONFIRM', probability: 20 }}>
          <Form.Item name="customerId" label="所属客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select showSearch optionFilterProp="label" options={customers.rows.map((c: any) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="name" label="商机名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="stage" label="初始阶段"><Select options={STAGES.map((v) => ({ value: v, label: lbl(v) }))} /></Form.Item>
          <Space size="large">
            <Form.Item name="amount" label="预计金额"><InputNumber min={0} style={{ width: 160 }} /></Form.Item>
            <Form.Item name="probability" label="赢单概率(%)"><InputNumber min={0} max={100} /></Form.Item>
          </Space>
          <Form.Item name="expectedClose" label="预计成交时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
