import { useMemo, useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Badge, Button, Drawer, List, Tabs } from 'antd';
import {
  DashboardOutlined, PhoneOutlined, CustomerServiceOutlined, TeamOutlined, RocketOutlined,
  RobotOutlined, SafetyCertificateOutlined, FileProtectOutlined, MessageOutlined,
  BarChartOutlined, SettingOutlined, ExperimentOutlined, LogoutOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { lbl, fmtTime } from '../lib/enums';
import { useOnce } from '../lib/hooks';
import { http, api } from '../api/client';

const { Header, Sider, Content } = AntLayout;

const MENUS = [
  { key: '/workbench', icon: <DashboardOutlined />, label: '坐席工作台' },
  { key: '/live', icon: <PhoneOutlined />, label: '实时通话' },
  { key: '/simulator', icon: <ExperimentOutlined />, label: '呼入模拟器' },
  {
    key: 'crm', icon: <TeamOutlined />, label: '客户 CRM',
    children: [
      { key: '/leads', label: '线索池' },
      { key: '/customers', label: '客户' },
      { key: '/opportunities', label: '商机' },
    ],
  },
  { key: '/outbound', icon: <RocketOutlined />, label: '外呼任务' },
  {
    key: 'bot', icon: <RobotOutlined />, label: '机器人',
    children: [
      { key: '/bot/config', label: '机器人配置' },
      { key: '/bot/intents', label: '意图管理' },
      { key: '/bot/knowledge', label: '知识库' },
    ],
  },
  { key: '/qa', icon: <SafetyCertificateOutlined />, label: '智能质检' },
  { key: '/contracts', icon: <FileProtectOutlined />, label: '合同回款' },
  { key: '/messages', icon: <MessageOutlined />, label: '营销触达' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据报表' },
  {
    key: 'admin', icon: <SettingOutlined />, label: '管理端',
    children: [
      { key: '/admin/org', label: '组织与坐席' },
      { key: '/admin/providers', label: '供应商与集成' },
      { key: '/admin/system', label: '字典与审计' },
    ],
  },
];

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: unread } = useOnce<any>(['unread'], '/system/notifications/unread-count', undefined, { refetchInterval: 15000 });
  const { data: notifs, refetch } = useOnce<any>(['notifs'], '/system/notifications', { pageSize: 20 });

  const selected = useMemo(() => {
    const top = '/' + loc.pathname.split('/')[1];
    if (['/bot', '/admin'].includes(top)) return loc.pathname;
    return loc.pathname;
  }, [loc.pathname]);
  const openKey = '/' + loc.pathname.split('/')[1];

  const sider = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', color: '#E9EEF7', fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '.02em' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 16, color: '#06231e', background: 'linear-gradient(135deg,#46E6C8,#5AB2FF)', boxShadow: '0 0 16px -4px rgba(70,230,200,.7)' }}><CustomerServiceOutlined /></span>
        {!collapsed && <span>企业增长云<span style={{ color: '#9AA6BD', fontWeight: 500 }}> · 作战台</span></span>}
      </div>
      <Menu
        theme="dark" mode="inline"
        selectedKeys={[selected]}
        defaultOpenKeys={[openKey]}
        items={MENUS}
        onClick={(e) => { if (e.key.startsWith('/')) { nav(e.key); setDrawerOpen(false); } }}
        style={{ flex: 1, borderInlineEnd: 0, overflowY: 'auto', background: 'transparent' }}
      />
    </div>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} trigger={null} collapsible collapsed={collapsed}
        width={216} style={{ display: mobile ? 'none' : 'block', borderRight: '1px solid rgba(148,160,184,.12)' }}
        onBreakpoint={(broken) => setMobile(broken)}>
        {sider}
      </Sider>
      <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={230}
        styles={{ body: { padding: 0, background: '#0B0F17' }, header: { background: '#0B0F17', borderBottom: '1px solid rgba(148,160,184,.14)' } }} closable={false}>
        {sider}
      </Drawer>
      <AntLayout>
        <Header style={{ background: 'rgba(12,17,27,.72)', backdropFilter: 'blur(12px)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(148,160,184,.14)' }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => (mobile ? setDrawerOpen(true) : setCollapsed(!collapsed))} />
          <div style={{ flex: 1, color: '#9AA6BD', fontSize: 13, letterSpacing: '.02em' }}><span className="live-dot" style={{ marginRight: 8 }} />接线机器人 + 电销工作台 · 全链路实时演示</div>
          <Badge count={unread?.count ?? 0} size="small">
            <Button type="text" icon={<BellOutlined />} onClick={async () => { await refetch(); setNotifOpen(true); }} />
          </Badge>
          <Dropdown menu={{ items: [
            { key: 'role', label: `角色：${lbl(user?.roleAlias)}`, disabled: true },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); nav('/login'); } },
          ] }}>
            <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Avatar size="small" style={{ background: 'linear-gradient(135deg,#46E6C8,#5AB2FF)', color: '#06231e', fontWeight: 700, marginRight: 6 }}>{user?.realName?.[0] || 'U'}</Avatar>{user?.realName}</span>
          </Dropdown>
        </Header>
        <Content style={{ margin: mobile ? 8 : 16 }}>
          <Outlet />
        </Content>
      </AntLayout>
      <Drawer title="通知中心" open={notifOpen} onClose={() => setNotifOpen(false)} width={380}>
        <Tabs items={[
          { key: 'notif', label: '站内通知', children: <List dataSource={notifs?.list || notifs || []} locale={{ emptyText: '暂无通知' }} renderItem={(n: any) => (
            <List.Item actions={[!n.isRead && <a key="r" onClick={async () => { await api(http.post(`/system/notifications/${n.id}/read`)); refetch(); }}>标为已读</a>]}>
              <List.Item.Meta title={n.title} description={<><div style={{ color: '#6B7689', fontSize: 12 }}>{fmtTime(n.at)}</div><div>{n.content}</div></>} />
            </List.Item>
          )} /> },
          { key: 'help', label: '演示提示', children: <div style={{ color: '#9AA6BD', lineHeight: 1.9 }}>
            <p>1. 先到「呼入模拟器」模拟一通客户来电，观察机器人多轮应答、留资与转人工。</p>
            <p>2. 「实时通话/坐席工作台」可接听派单、查看弹屏画像、实时转写与 AI 小结。</p>
            <p>3. 语音/大模型/短信默认走内置沙箱，配置真实密钥即可在「供应商与集成」切换商用通道。</p>
          </div> },
        ]} />
      </Drawer>
    </AntLayout>
  );
}
