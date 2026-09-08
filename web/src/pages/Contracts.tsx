import { useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, DatePicker, Select, Drawer, Descriptions, Tag, Timeline, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../api/client';
import { usePaged } from '../lib/hooks';
import { lbl, colorOf, fmtMoney, fmtDate } from '../lib/enums';
import ETag from '../components/ETag';

export default function Contracts() {
  const qc = useQueryClient();
  const { rows, isFetching } = usePaged(['contracts'], '/contracts', { pageSize: 50 });
  const opps = usePaged(['opp-all'], '/opportunities', { pageSize: 500 });
  const cust = usePaged(['cust-all2'], '/customers', { pageSize: 500 });
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [form] = Form.useForm();
  const [pform] = Form.useForm();
  const detailQ = usePaged(['payments', detail?.id], '/contracts', {}, { enabled: false });

  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/contracts', { ...v, signDate: v.signDate?.format('YYYY-MM-DD') }));
    message.success('合同已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['contracts'] });
  };
  const openDetail = async (r: any) => setDetail(await api<any>(http.get(`/contracts/${r.id}`)));
  const sign = async (id: string) => { await api(http.post(`/contracts/${id}/sign`, {})); message.success('已签署'); qc.invalidateQueries(); openDetail({ id }); };
  const addPay = async () => {
    const v = await pform.validateFields();
    await api(http.post(`/contracts/${detail.id}/payments`, { ...v, plannedDate: v.plannedDate?.format('YYYY-MM-DD'), actualDate: v.actualDate?.format('YYYY-MM-DD') }));
    message.success('回款计划已登记'); setPayOpen(false); pform.resetFields(); openDetail({ id: detail.id });
  };
  const paid = async (pid: string) => { await api(http.post(`/contracts/payments/${pid}/paid`, {})); message.success('已确认到账'); openDetail({ id: detail.id }); };

  return (
    <Card title={<span className="page-title">合同与回款</span>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建合同</Button>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 900 }}
        onRow={(r) => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: '合同编号', dataIndex: 'code' },
          { title: '合同名称', dataIndex: 'name' },
          { title: '金额', dataIndex: 'amount', render: fmtMoney },
          { title: '状态', dataIndex: 'status', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
          { title: '签署日期', dataIndex: 'signDate', render: fmtDate },
        ]} />

      <Modal title="新建合同" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="customerId" label="客户" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={cust.rows.map((c: any) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="opportunityId" label="关联商机" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={opps.rows.map((o: any) => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="name" label="合同名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Space size="large">
            <Form.Item name="amount" label="合同金额" rules={[{ required: true }]}><InputNumber min={0} style={{ width: 180 }} /></Form.Item>
            <Form.Item name="signDate" label="签署日期"><DatePicker /></Form.Item>
          </Space>
        </Form>
      </Modal>

      <Drawer width={520} open={!!detail} onClose={() => setDetail(null)} title={detail?.name}
        extra={<Space>
          {detail?.status === 'DRAFT' && <Button onClick={() => sign(detail.id)}>确认签署</Button>}
          <Button type="primary" onClick={() => setPayOpen(true)}>登记回款</Button>
        </Space>}>
        {detail && <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="合同编号">{detail.code}</Descriptions.Item>
            <Descriptions.Item label="状态"><ETag value={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="合同金额">{fmtMoney(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="已回款">{fmtMoney(detail.receivedAmount)}</Descriptions.Item>
          </Descriptions>
          <h4>回款计划/记录</h4>
          <Timeline items={(detail.payments || []).map((p: any) => ({
            color: p.status === 'RECEIVED' ? 'green' : p.status === 'OVERDUE' ? 'red' : 'gray',
            children: <Space>{fmtMoney(p.amount)}<ETag value={p.status} />计划 {fmtDate(p.plannedDate)} / 到账 {fmtDate(p.actualDate)}
              {p.status !== 'RECEIVED' && <a onClick={() => paid(p.id)}>确认到账</a>}</Space>,
          }))} />
        </>}
      </Drawer>

      <Modal title="登记回款" open={payOpen} onOk={addPay} onCancel={() => setPayOpen(false)} destroyOnClose>
        <Form form={pform} layout="vertical" initialValues={{ status: 'PLANNED' }}>
          <Form.Item name="amount" label="回款金额" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Space size="large">
            <Form.Item name="plannedDate" label="计划日期"><DatePicker /></Form.Item>
            <Form.Item name="actualDate" label="实际到账（留空为计划中）"><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="method" label="回款方式"><Input placeholder="对公转账/承兑等" /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
