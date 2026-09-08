import { useEffect } from 'react';
import { Card, Form, Input, Switch, Button, InputNumber, message, Divider, Alert, Select } from 'antd';
import { http, api } from '../../api/client';
import { useOnce } from '../../lib/hooks';

export default function BotConfigPage() {
  const [form] = Form.useForm();
  const cfg = useOnce<any>(['bot-config'], '/bot/config');
  useEffect(() => { if (cfg.data) form.setFieldsValue(cfg.data); }, [cfg.data]);

  const save = async () => {
    const v = await form.validateFields();
    await api(http.patch('/bot/config', v));
    message.success('机器人配置已保存');
  };

  return (
    <Card title={<span className="page-title">接线机器人配置</span>} extra={<Button type="primary" onClick={save}>保存</Button>}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="机器人先多轮应答与 FAQ，命中转人工关键词或识别到高意向时自动留资/转技能组派单；模型与语音默认走内置沙箱，可在管理端切换真实供应商。" />
      <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
        <Form.Item name="name" label="机器人名称"><Input /></Form.Item>
        <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="welcomeText" label="欢迎语"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="fallbackText" label="兜底/转人工话术"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="transferKeywords" label="转人工关键词（回车添加）">
          <Select mode="tags" style={{ width: '100%' }} placeholder="人工、真人、找顾问" tokenSeparators={[',', '，']} />
        </Form.Item>
        <Divider />
        <Form.Item label="静默超时 / 最大轮次">
          <SpaceInline>
            <Form.Item name="idleTimeoutSec" noStyle><InputNumber min={3} addonAfter="秒" /></Form.Item>
            <Form.Item name="maxBotTurns" noStyle><InputNumber min={1} addonAfter="轮" /></Form.Item>
          </SpaceInline>
        </Form.Item>
      </Form>
    </Card>
  );
}

function SpaceInline({ children }: any) {
  return <div style={{ display: 'flex', gap: 16 }}>{children}</div>;
}
