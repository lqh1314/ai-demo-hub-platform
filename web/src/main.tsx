import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'dayjs/locale/zh-cn';
import App from './App';
import './global.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10 * 1000 } },
});

// 暗色作战室 Dark Mission-Control 设计令牌
const BRAND = {
  primary: '#46E6C8', // 信号青
  blue: '#5AB2FF', // 电蓝
  bg: '#080B11',
  surface: '#10151F',
  surface2: '#141B28',
  border: 'rgba(148,160,184,.14)',
  text: '#E9EEF7',
  textSub: '#9AA6BD',
  textWeak: '#6B7689',
  success: '#3DDC97',
  warning: '#FFC261',
  error: '#FF7A90',
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: BRAND.primary,
          colorInfo: BRAND.blue,
          colorSuccess: BRAND.success,
          colorWarning: BRAND.warning,
          colorError: BRAND.error,
          colorBgBase: BRAND.bg,
          colorBgLayout: BRAND.bg,
          colorBgContainer: BRAND.surface,
          colorBgElevated: '#161D2B',
          colorBorder: 'rgba(148,160,184,.16)',
          colorBorderSecondary: 'rgba(148,160,184,.10)',
          colorText: BRAND.text,
          colorTextSecondary: BRAND.textSub,
          colorTextTertiary: BRAND.textWeak,
          colorTextQuaternary: BRAND.textWeak,
          borderRadius: 10,
          fontFamily:
            "Inter, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          wireframe: false,
        },
        components: {
          Layout: { bodyBg: BRAND.bg, headerBg: 'transparent', siderBg: '#0B0F17' },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'linear-gradient(90deg, rgba(70,230,200,.16), rgba(90,178,255,.10))',
            darkItemHoverBg: 'rgba(148,160,184,.08)',
            darkItemColor: BRAND.textSub,
            darkItemSelectedColor: BRAND.primary,
            itemBorderRadius: 8,
            itemMarginInline: 8,
          },
          Table: {
            headerBg: 'rgba(148,160,184,.06)',
            headerColor: BRAND.textSub,
            rowHoverBg: 'rgba(90,178,255,.06)',
            borderColor: 'rgba(148,160,184,.10)',
          },
          Card: { colorBgContainer: BRAND.surface, colorBorderSecondary: 'rgba(148,160,184,.12)' },
          Modal: { contentBg: BRAND.surface2, headerBg: BRAND.surface2 },
          Drawer: { colorBgElevated: '#0B0F17' },
          Input: { colorBgContainer: 'rgba(255,255,255,.03)', activeBorderColor: BRAND.primary, hoverBorderColor: 'rgba(70,230,200,.5)' },
          InputNumber: { colorBgContainer: 'rgba(255,255,255,.03)' },
          Select: { colorBgContainer: 'rgba(255,255,255,.03)', optionSelectedBg: 'rgba(70,230,200,.16)' },
          DatePicker: { colorBgContainer: 'rgba(255,255,255,.03)' },
          Tabs: { itemColor: BRAND.textSub, itemSelectedColor: BRAND.primary, inkBarColor: BRAND.primary },
          Button: { primaryShadow: 'none', defaultShadow: 'none' },
          Tag: { defaultBg: 'rgba(148,160,184,.10)', defaultColor: BRAND.textSub },
          Tooltip: { colorBgSpotlight: '#1B2333' },
          Statistic: { colorTextDescription: BRAND.textSub },
          Divider: { colorSplit: 'rgba(148,160,184,.12)' },
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);

export { BRAND };
