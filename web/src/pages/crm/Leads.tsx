import { useState } from 'react';
import { Card, Table, Button, Space, Select, Input, Modal, Form, Drawer, Descriptions, Timeline, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl, colorOf, fmtTime } from '../../lib/enums';
import ETag from '../../components/ETag';

const STAGES = ['NEW', 'FOLLOWING', 'CONVERTED', 'INVALID', 'LOST'];
const SOURCES = ['HOTLINE', 'BOT', 'WEB', 'FORM', 'AD', 'REFERRAL', 'IMPORT', 'MANUAL', 'OUTBOUND'];
const LEVELS = ['HIGH', 'MIDDLE', 'LOW', 'UNKNOWN'];

export default function Leads() {
  const qc = useQueryClient();
  const [q, setQ] = useState<any>({ page: 1, pageSize: 10 });
  const { rows, total, isFetching } = usePaged(['leads', q], '/leads', q);
  const users = useOnce<any>(['users-mini'], '/users', { pageSize: 200 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const userList = users.data?.list || users.data || [];

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ source: 'MANUAL', intentLevel: 'UNKNOWN' }); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue({ name: r.name, company: r.company, phoneRaw: r.phoneRaw, email: r.email, source: r.source, intentLevel: r.intentLevel }); setOpen(true); };

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api(http.patch(`/leads/${editing.id}`, v));
        message.success('线索已更新');
      } else {
        await api(http.post('/leads', v));
        message.success('线索已创建');
      }
      setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      message.error(editing ? '更新失败，请重试' : '创建失败，请重试');
    } finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    await api(http.delete(`/leads/${id}`));
    message.success('线索已删除'); qc.invalidateQueries({ queryKey: ['leads'] });
  };
  const assign = async (id: string, ownerId: string) => { await api(http.post(`/leads/${id}/assign`, { ownerId })); message.success('已分配'); qc.invalidateQueries({ queryKey: ['leads'] }); };
  const convert = async (id: string) => { await api(http.post(`/leads/${id}/convert`, {})); message.success('已转化为客户'); qc.invalidateQueries(); };
  const showDetail = async (id: string) => setDetail(await api<any>(http.get(`/leads/${id}`)));
  const acts = useOnce<any>(['lead-act', detail?.id], '/activities', { type: 'LEAD', id: detail?.id }, { enabled: !!detail?.id });

  return (
    <Card title={<span className="page-title">线索池</span>} extra={
      <Space>
        <Input.Search placeholder="姓名/公司/手机号" allowClear onSearch={(kw) => setQ((s: any) => ({ ...s, keyword: kw, page: 1 }))} style={{ width: 200 }} />
        <Select allowClear placeholder="阶段" style={{ width: 120 }} options={STAGES.map((v) => ({ value: v, label: lbl(v) }))}
          onChange={(v) => setQ((s: any) => ({ ...s, stage: v, page: 1 }))} />
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['leads'] })} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建线索</Button>
      </Space>}>
      <Table rowKey="id" loading={isFetching} dataSource={rows} size="small" scroll={{ x: 1040 }}
        pagination={{ current: q.page, pageSize: q.pageSize, total, showSizeChanger: true, onChange: (page, pageSize) => setQ((s: any) => ({ ...s, page, pageSize })) }}
        onRow={(r) => ({ onClick: () => showDetail(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: '客户', render: (_, r) => `${r.name || '-'} ${r.company ? '· ' + r.company : ''}` },
          { title: '手机号', dataIndex: 'phoneRaw' },
          { title: '来源', dataIndex: 'source', render: (v) => lbl(v) },
          { title: '意向', dataIndex: 'intentLevel', render: (v) => <ETag value={v} /> },
          { title: '阶段', dataIndex: 'stage', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
          { title: '负责人', render: (_, r) => userList.find((u: any) => u.id === r.ownerId)?.realName || '-' },
          { title: '最近跟进', dataIndex: 'lastFollowAt', render: fmtTime },
          { title: '操作', width: 230, render: (_, r) => (
            <Space onClick={(e) => e.stopPropagation()}>
              <Select size="small" style={{ width: 100 }} placeholder="分配" value={r.ownerId} onChange={(v) => assign(r.id, v)}
                options={userList.map((u: any) => ({ value: u.id, label: u.realName }))} />
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
              {r.stage !== 'CONVERTED' && <Popconfirm title="转化为客户并创建商机？" onConfirm={() => convert(r.id)}><a>转化</a></Popconfirm>}
              <Popconfirm title="确认删除该线索？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => remove(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          ) },
        ]} />

      <Modal title={editing ? '编辑线索' : '新建线索'} open={open} confirmLoading={saving} onOk={submit} onCancel={() => setOpen(false)} destroyOnClose
        okText="保存">
        <Form form={form} layout="vertical" initialValues={{ source: 'MANUAL', intentLevel: 'UNKNOWN' }}>
          <Form.Item name="name" label="客户姓名"><Input placeholder="如 王总" /></Form.Item>
          <Form.Item name="company" label="公司名称"><Input /></Form.Item>
          <Form.Item name="phoneRaw" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}><Input placeholder="11 位手机号" /></Form.Item>
          <Form.Item name="email" label="邮箱（选填）"><Input /></Form.Item>
          <Form.Item name="source" label="来源">
            <Select options={SOURCES.map((v) => ({ value: v, label: lbl(v) }))} />
          </Form.Item>
          <Form.Item name="intentLevel" label="意向等级">
            <Select options={LEVELS.map((v) => ({ value: v, label: lbl(v) }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer width={460} open={!!detail} onClose={() => setDetail(null)} title="线索详情">
        {detail && <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="姓名/公司">{detail.name} {detail.company}</Descriptions.Item>
            <Descriptions.Item label="手机号">{detail.phoneRaw}</Descriptions.Item>
            <Descriptions.Item label="来源/阶段">{lbl(detail.source)} · {lbl(detail.stage)}</Descriptions.Item>
            <Descriptions.Item label="意向"><ETag value={detail.intentLevel} /></Descriptions.Item>
            <Descriptions.Item label="意向标签">{(detail.intentTags || []).join('、') || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{fmtTime(detail.createdAt)}</Descriptions.Item>
          </Descriptions>
          <h4>跟进动态</h4>
          <Timeline items={(acts.data?.list || acts.data || []).map((a: any) => ({ children: `${fmtTime(a.happenedAt)} ${lbl(a.type)}：${a.content || ''}` }))} />
        </>}
      </Drawer>
    </Card>
  );
}
