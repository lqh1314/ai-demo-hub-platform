import { useState } from 'react';
import { Button, Card, Form, Input, Typography, Alert, Tabs } from 'antd';
import { CustomerServiceOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function Login() {
  const nav = useNavigate();
  const login = useAuth((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onFinish = async (v: any) => {
    setErr('');
    setLoading(true);
    try {
      await login(v.username, v.password);
      nav('/workbench', { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(135deg,#1d39c4 0%,#2f6bff 55%,#69b1ff 100%)', padding: 16 }}>
      <Card style={{ width: 400, maxWidth: '100%', borderRadius: 14 }} styles={{ body: { padding: 28 } }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <CustomerServiceOutlined style={{ fontSize: 38, color: '#2f6bff' }} />
          <Typography.Title level={4} style={{ margin: '8px 0 2px' }}>企业增长云</Typography.Title>
          <div className="muted">接线机器人 + 电销工作台 · 全链路平台</div>
        </div>
        {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} />}
        <Form onFinish={onFinish} initialValues={{ username: 'admin', password: 'Aihub@123456' }} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>登 录</Button>
        </Form>
        <Tabs size="small" style={{ marginTop: 8 }} items={[{ key: 'demo', label: '演示账号（密码均为 Aihub@123456）', children: (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.9 }}>
            admin 平台管理员（全权限）<br />manager 销售主管　agent01 / agent02 电销坐席
          </div>
        ) }]} />
      </Card>
    </div>
  );
}
