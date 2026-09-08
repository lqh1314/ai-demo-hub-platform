import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { http, api } from '../../api/client';
import { usePaged, useOnce } from '../../lib/hooks';
import { lbl, colorOf, fmtTime } from '../../lib/enums';
import ETag from '../../components/ETag';

const ROLES = ['ADMIN', 'MANAGER', 'AGENT'];
const STATUSES = ['PENDING', 'ACTIVE', 'DISABLED'];

function Users() {
  const qc = useQueryClient();
  const { rows } = usePaged(['adm-users'], '/users', { pageSize: 200 });
  const depts = useOnce<any>(['adm-depts'], '/departments');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/users', v)); message.success('账号已创建（初始密码见系统策略）'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['adm-users'] });
  };
  const toggle = async (r: any) => { await api(http.patch(`/users/${r.id}`, { status: r.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })); qc.invalidateQueries({ queryKey: ['adm-users'] }); };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建账号</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '姓名', dataIndex: 'realName' }, { title: '账号', dataIndex: 'username' }, { title: '手机', dataIndex: 'mobile' },
      { title: '部门', render: (_, r) => (depts.data || []).find((d: any) => d.id === r.deptId)?.name || '-' },
      { title: '角色', render: (_, r) => (r.roleAlias ? <ETag value={r.roleAlias} /> : (r.roles || []).map((x: any) => <Tag key={x.id}>{x.name}</Tag>)) },
      { title: '状态', dataIndex: 'status', render: (v) => <Tag color={colorOf(v)}>{lbl(v)}</Tag> },
      { title: '操作', render: (_, r) => <Popconfirm title="启用/停用该账号？" onConfirm={() => toggle(r)}><a>{r.status === 'ACTIVE' ? '停用' : '启用'}</a></Popconfirm> },
    ]} />
    <Modal title="新建账号" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ status: 'ACTIVE', roleAlias: 'AGENT' }}>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="realName" label="姓名" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          <Form.Item name="username" label="登录账号" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
        </Space>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="mobile" label="手机号" style={{ flex: 1 }}><Input /></Form.Item>
          <Form.Item name="deptId" label="部门" style={{ flex: 1 }}><Select allowClear options={(depts.data || []).map((d: any) => ({ value: d.id, label: d.name }))} /></Form.Item>
        </Space>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="roleAlias" label="角色" style={{ flex: 1 }}><Select options={ROLES.map((r) => ({ value: r, label: lbl(r) }))} /></Form.Item>
          <Form.Item name="status" label="状态" style={{ flex: 1 }}><Select options={STATUSES.map((s) => ({ value: s, label: lbl(s) }))} /></Form.Item>
        </Space>
      </Form>
    </Modal>
  </>;
}

function Depts() {
  const qc = useQueryClient();
  const { rows } = usePaged(['adm-dept'], '/departments', { pageSize: 200 });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/departments', v)); message.success('部门已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['adm-dept'] });
  };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建部门</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '部门名称', dataIndex: 'name' }, { title: '负责人', dataIndex: 'leader' }, { title: '创建时间', dataIndex: 'createdAt', render: fmtTime },
    ]} />
    <Modal title="新建部门" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="部门名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="leader" label="负责人"><Input /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Groups() {
  const qc = useQueryClient();
  const { rows } = usePaged(['adm-groups'], '/skill-groups', { pageSize: 200 });
  const users = usePaged(['adm-users2'], '/users', { pageSize: 200 });
  const [open, setOpen] = useState(false);
  const [membersOf, setMembersOf] = useState<any>(null);
  const [form] = Form.useForm();
  const create = async () => {
    const v = await form.validateFields();
    await api(http.post('/skill-groups', v)); message.success('技能组已创建'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['adm-groups'] });
  };
  const addMember = async (userId: string) => { await api(http.post(`/skill-groups/${membersOf.id}/members`, { userId })); message.success('已加入'); qc.invalidateQueries(); };
  return <>
    <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>新建技能组</Button>
    <Table rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: '技能组', dataIndex: 'name' }, { title: '分配策略', dataIndex: 'assignStrategy', render: lbl },
      { title: '最大排队', dataIndex: 'maxQueue' }, { title: '坐席数', render: (_, r) => r._count?.members ?? (r.members || []).length },
      { title: '操作', render: (_, r) => <a onClick={() => setMembersOf(r)}>管理成员</a> },
    ]} />
    <Modal title="新建技能组" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ assignStrategy: 'LEAST_LOAD', maxQueue: 50 }}>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="assignStrategy" label="分配策略" style={{ flex: 1 }}>
            <Select options={['ROUND_ROBIN', 'LEAST_LOAD', 'SKILL_MATCH'].map((s) => ({ value: s, label: lbl(s) }))} />
          </Form.Item>
          <Form.Item name="maxQueue" label="最大排队" style={{ flex: 1 }}><Input type="number" /></Form.Item>
        </Space>
      </Form>
    </Modal>
    <Modal title={`管理成员 · ${membersOf?.name || ''}`} open={!!membersOf} onCancel={() => setMembersOf(null)} footer={null}>
      <Select showSearch placeholder="选择坐席加入" style={{ width: '100%', marginBottom: 10 }} optionFilterProp="label"
        value={undefined} onChange={addMember}
        options={users.rows.map((u: any) => ({ value: u.id, label: `${u.realName}（${u.username}）` }))} />
      <Table size="small" rowKey="id" pagination={false} dataSource={membersOf?.members || []}
        columns={[{ title: '坐席', render: (_, m: any) => m.user?.realName || m.userId?.slice(0, 8) }, { title: '技能等级', dataIndex: 'skillLevel' }]} />
    </Modal>
  </>;
}

export default function Org() {
  return (
    <Card title={<span className="page-title">组织与权限（账号 / 部门 / 技能组）</span>}>
      <Tabs items={[
        { key: 'u', label: '坐席账号', children: <Users /> },
        { key: 'd', label: '部门', children: <Depts /> },
        { key: 'g', label: '技能组', children: <Groups /> },
      ]} />
    </Card>
  );
}
