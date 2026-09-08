import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './store/auth';
import MainLayout from './components/Layout';
import Login from './pages/Login';
import Workbench from './pages/Workbench';
import LiveCall from './pages/LiveCall';
import Simulator from './pages/Simulator';
import Leads from './pages/crm/Leads';
import Customers from './pages/crm/Customers';
import Opportunities from './pages/crm/Opportunities';
import Outbound from './pages/outbound/Outbound';
import BotConfig from './pages/bot/BotConfig';
import Intents from './pages/bot/Intents';
import Knowledge from './pages/bot/Knowledge';
import Qa from './pages/Qa';
import Contracts from './pages/Contracts';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import Org from './pages/admin/Org';
import Providers from './pages/admin/Providers';
import System from './pages/admin/System';

function RequireAuth({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  const { user, loaded, loadMe } = useAuth();
  useEffect(() => { if (!loaded && localStorage.getItem('access_token')) loadMe(); }, [loaded]);
  if (!localStorage.getItem('access_token')) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!user) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><Spin size="large" tip="加载中…" /></div>;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/live" element={<LiveCall />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/outbound" element={<Outbound />} />
          <Route path="/bot/config" element={<BotConfig />} />
          <Route path="/bot/intents" element={<Intents />} />
          <Route path="/bot/knowledge" element={<Knowledge />} />
          <Route path="/qa" element={<Qa />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin/org" element={<Org />} />
          <Route path="/admin/providers" element={<Providers />} />
          <Route path="/admin/system" element={<System />} />
          <Route path="*" element={<Navigate to="/workbench" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
