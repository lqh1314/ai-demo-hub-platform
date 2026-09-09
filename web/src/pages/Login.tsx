import { useState } from 'react';
import { Button, Form, Input, Alert, Tabs } from 'antd';
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
    <div className="login-shell">
      <div className="login-orb" style={{ width: 420, height: 420, left: '-8%', top: '-12%', background: 'rgba(70,230,200,.22)' }} />
      <div className="login-orb" style={{ width: 480, height: 480, right: '-10%', bottom: '-18%', background: 'rgba(90,178,255,.20)' }} />
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="login-icon-badge" style={{ margin: '0 auto 14px' }}><CustomerServiceOutlined /></div>
          <div className="login-badge"><span className="live-dot" />LIVE DEMO CONSOLE</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 12, letterSpacing: '.02em' }}>企业增长云</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>接线机器人 + 电销工作台 · 全链路作战台</div>
        </div>
        {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} />}
        <Form onFinish={onFinish} initialValues={{ username: 'admin', password: 'Aihub@123456' }} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined style={{ color: '#6B7689' }} />} placeholder="账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#6B7689' }} />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ height: 42, fontWeight: 600 }}>登 录</Button>
        </Form>
        <Tabs size="small" style={{ marginTop: 10 }} items={[{ key: 'demo', label: '演示账号（密码均为 Aihub@123456）', children: (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.9 }}>
            admin 平台管理员（全权限）<br />manager 销售主管　agent01 / agent02 电销坐席
          </div>
        ) }]} />
      </div>
    </div>
  );
}
