import { OpenAiCompatLlm, resolveEndpoint } from './openai-compat.llm';

function mockFetchOnce(payload: any) {
  (global as any).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => '',
  }));
}

describe('OpenAiCompatLlm 适配器', () => {
  afterEach(() => delete (global as any).fetch);

  it('预设端点：deepseek/豆包/自定义 baseUrl 解析正确', () => {
    expect(resolveEndpoint('deepseek', {}).baseUrl).toBe('https://api.deepseek.com/v1');
    expect(resolveEndpoint('deepseek', {}).model).toBe('deepseek-chat');
    expect(resolveEndpoint('doubao', { model: 'ep-1' }).baseUrl).toContain('ark.cn-beijing.volces.com');
    expect(resolveEndpoint('custom', { baseUrl: 'https://x.test/v1///' }).baseUrl).toBe('https://x.test/v1');
  });

  it('chat 解析模型 JSON，并强制识别“转人工”', async () => {
    mockFetchOnce({ reply: '好的这就为您转接', intentCode: 'PRICE', action: 'ANSWER', slots: {}, confidence: 0.9 });
    const llm = new OpenAiCompatLlm('deepseek', { apiKey: 'k', model: 'deepseek-chat' });
    const r = await llm.chat({ messages: [{ role: 'user', content: '我要转人工' }], intents: [], knowledge: [] });
    expect(r.reply).toBe('好的这就为您转接');
    expect(r.action).toBe('TRANSFER'); // 用户明确说转人工，规则兜底强制
  });

  it('模型未按 JSON 输出时，整段作为回复且不报错', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '您好，我们产品支持免费试用七天。' } }] }),
      text: async () => '',
    }));
    const llm = new OpenAiCompatLlm('deepseek', { apiKey: 'k', model: 'deepseek-chat' });
    const r = await llm.chat({ messages: [{ role: 'user', content: '能试用吗' }], intents: [], knowledge: [] });
    expect(r.reply).toContain('免费试用');
    expect(r.action).toBe('ANSWER');
  });

  it('用户话术中的手机号被规则槽位兜底抽取', async () => {
    mockFetchOnce({ reply: '已记录', action: 'ANSWER', slots: {} });
    const llm = new OpenAiCompatLlm('deepseek', { apiKey: 'k', model: 'deepseek-chat' });
    const r = await llm.chat({ messages: [{ role: 'user', content: '我手机号13812345678，联系我' }], intents: [], knowledge: [] });
    expect(r.slots.phone).toBe('13812345678');
  });
});
