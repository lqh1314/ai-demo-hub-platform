import { Card, Row, Col, Statistic, DatePicker, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useState } from 'react';
import { useOnce } from '../lib/hooks';
import { http, api } from '../api/client';
import { lbl, fmtSec } from '../lib/enums';

export default function Reports() {
  const [range, setRange] = useState<any>({});
  const ov = useOnce<any>(['r-ov'], '/reports/overview');
  const fn = useOnce<any>(['r-fn'], '/reports/funnel');
  const calls = useOnce<any>(['r-calls', range], '/reports/calls', range);
  const agents = useOnce<any>(['r-agents', range], '/reports/agents', range);

  const leadFunnel = {
    tooltip: {}, series: [{ type: 'funnel', left: 20, right: 20, top: 20, bottom: 20,
      data: (fn.data?.leadFunnel || []).map((x: any) => ({ name: lbl(x.stage), value: x.count })) }],
  };
  const oppFunnel = {
    tooltip: {}, series: [{ type: 'funnel', left: 20, right: 20, top: 20, bottom: 20,
      data: (fn.data?.oppFunnel || []).map((x: any) => ({ name: lbl(x.stage), value: x.count })) }],
  };
  const callPie = {
    tooltip: { trigger: 'item' }, legend: { bottom: 0 },
    series: [{ type: 'pie', radius: ['40%', '68%'], data: (calls.data?.byDisposition || []).map((x: any) => ({ name: x.k === '未标记' ? '未标记' : lbl(x.k), value: x.v })) }],
  };
  const dirBar = {
    tooltip: {}, xAxis: { type: 'category', data: (calls.data?.byDirection || []).map((x: any) => lbl(x.k)) },
    yAxis: { type: 'value' }, series: [{ type: 'bar', data: (calls.data?.byDirection || []).map((x: any) => x.v), itemStyle: { color: '#2f6bff' } }],
  };
  const agentBar = {
    tooltip: {}, grid: { left: 80 }, xAxis: { type: 'value' },
    yAxis: { type: 'category', data: (agents.data || []).map((x: any) => x.agentName) },
    series: [{ type: 'bar', data: (agents.data || []).map((x: any) => x.calls), itemStyle: { color: '#36cbcb' } }],
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }} title={<span className="page-title">经营与坐席报表</span>} extra={
        <Space>
          <DatePicker.RangePicker onChange={(v) => setRange(v ? { start: v[0]?.toISOString(), end: v[1]?.toISOString() } : {})} />
          <Button icon={<ReloadOutlined />} onClick={() => { ov.refetch(); fn.refetch(); calls.refetch(); agents.refetch(); }} />
        </Space>}>
        <Row gutter={16}>
          {[
            ['线索数', ov.data?.leads], ['客户数', ov.data?.customers], ['商机数', ov.data?.opps],
            ['赢单金额', ov.data?.wonAmount, '¥'], ['总通话', ov.data?.calls], ['接通率', ov.data?.connectRate, '%'],
          ].map(([t, v, u]: any) => (
            <Col xs={12} sm={8} lg={4} key={t}><Statistic title={t} value={v ?? 0} prefix={u === '¥' ? '¥' : ''} suffix={u === '%' ? '%' : ''} /></Col>
          ))}
        </Row>
      </Card>
      <Row gutter={12}>
        <Col xs={24} lg={12}><Card size="small" title="线索漏斗"><ReactECharts style={{ height: 280 }} option={leadFunnel} /></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="商机漏斗"><ReactECharts style={{ height: 280 }} option={oppFunnel} /></Card></Col>
        <Col xs={24} lg={10}><Card size="small" title={`通话结果分布 · 平均时长 ${fmtSec(calls.data?.avgTalkSec)}`}><ReactECharts style={{ height: 300 }} option={callPie} /></Card></Col>
        <Col xs={24} lg={6}><Card size="small" title="呼入/呼出"><ReactECharts style={{ height: 300 }} option={dirBar} /></Card></Col>
        <Col xs={24} lg={8}><Card size="small" title="坐席产能排行（通话量）"><ReactECharts style={{ height: 300 }} option={agentBar} /></Card></Col>
      </Row>
    </div>
  );
}
