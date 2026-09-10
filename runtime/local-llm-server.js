/* eslint-disable */
/**
 * 内置离线演示大模型（零依赖 Node 服务，OpenAI Chat Completions 兼容）
 * 作用：在没有任何外部大模型 Key、断网的情况下，让“接线机器人”也能通过与豆包/DeepSeek 完全相同的
 *      适配器与 HTTP 链路（/v1/chat/completions）产生自然、贴合业务的中文应答，便于先看效果。
 * 说明：它是离线规则/检索式演示引擎，不是神经网络大模型；在「集成中心」接入真实豆包后即被替换，代码链路不变。
 * 端口：LOCAL_LLM_PORT，默认 3100。
 */
const http = require('http');

const PORT = Number(process.env.LOCAL_LLM_PORT || 3100);
const HOST = process.env.LOCAL_LLM_HOST || '127.0.0.1';

// —— 业务内置口径（知识库缺失时兜底，保证演示连贯）——
const PRODUCT = '我们是“企业增长云”，一套接线机器人加电销工作台：来电由 AI 自动接听、理解客户意图、答疑并留资，高意向客户实时转给人工，全程生成通话小结和跟进任务';
const RULES = [
  { re: /(多少钱|价格|怎么收费|收费|报价|费用|贵不贵|价位|怎么卖)/, reply: '我们按坐席数分版本，标准版适合小团队起步，也有可试用的演示环境。具体报价我让顾问结合您的坐席规模给您算一版，更准确些，您看可以吗？', intent: 'PRICE_INQUIRY' },
  { re: /(试用|体验|演示|demo|看看效果|试一下|开通测试)/, reply: '可以的，我们支持开通试用环境，内置演示数据，半天就能跑通“来电-AI应答-留资-转人工-小结”全流程。我先帮您登记，顾问会把试用入口和操作指引发您。', intent: 'TRIAL' },
  { re: /(购买|下单|签约|签合同|合作|采购|定下来|订一套|买一套)/, reply: '感谢认可！我这就为您对接专属顾问，确认版本和坐席数后走开通流程，请问怎么称呼您、方便留个手机号吗？', intent: 'PURCHASE' },
  { re: /(功能|能做什么|有什么用|产品介绍|介绍一下|是什么|干嘛用的|哪些能力|能干啥)/, reply: PRODUCT + '。您更关注自动接线、客户管理，还是外呼触达这一块？我给您重点说说。', intent: 'PRODUCT' },
  { re: /(机器人|自动接|接线|ai接|智能应答|语音机器人)/, reply: '机器人会 7×24 小时自动接听来电，先听懂客户想问什么，能答的当场答，需要人工或高意向时秒级转给对应销售，通话内容和客户信息自动沉淀到 CRM。', intent: 'BOT' },
  { re: /(对接|集成|打通|部署|私有化|本地部署|和.*系统|微信|钉钉|企微|crm)/, reply: '支持云端开通，也支持私有化部署；能和企业微信、钉钉以及主流 CRM 对接，标准接口开放。详细方案我让顾问跟您对一下现有系统。', intent: 'INTEGRATION' },
  { re: /(售后|服务支持|培训|上线|不会用|怎么办)/, reply: '上线会有顾问协助配置知识库和话术，并提供操作培训，日常使用有专属服务群，您不用担心上手问题。', intent: 'SERVICE' },
  { re: /(公司|你们是谁|哪家公司|品牌|靠谱吗|成立)/, reply: '我们专注企业智能获客与客户运营，核心产品就是 AI 接线机器人加电销工作台，已服务不少 To-B 销售型团队。', intent: 'ABOUT' },
  { re: /(你好|您好|在吗|喂|hi|hello|早上好|下午好)/, reply: '您好，欢迎咨询企业增长云，请问您是想了解产品功能，还是想让我帮您安排一次演示？', intent: 'GREETING' },
  { re: /(谢谢|感谢|好的|行|可以|没问题)/, reply: '不客气，还有其他想了解的随时问我；如果需要顾问一对一介绍，我也可以马上为您转接。', intent: 'THANKS' },
];
const TRANSFER_RE = /(转人工|人工|真人|找客服|找顾问|找销售|工作人员|投诉|接你们|活人)/;
const PHONE_RE = /(?:\+?86)?1[3-9]\d{9}/;
const FALLBACKS = [
  '这个问题我想给您讲得更准确些，方便先说下您目前团队的规模和最想解决的场景吗？比如漏接来电、线索跟进，还是外呼效率？',
  '我大概理解了，为了给您更贴合的建议，请问您现在主要是想解决来电没人接，还是客户线索管理的问题呢？',
];

function parseKnowledge(system) {
  const kbs = [];
  const re = /问[:：]([^\n]+)\n\s*答[:：]([^\n]+)/g;
  let m;
  while ((m = re.exec(system || ''))) kbs.push({ q: m[1].trim(), a: m[2].trim() });
  return kbs;
}
function parseIntents(system) {
  const intents = [];
  const re = /-\s*([A-Z0-9_]+)[：:]\s*([^（(]+)[（(]关键词[：:]([^)）]+)/g;
  let m;
  while ((m = re.exec(system || ''))) intents.push({ code: m[1].trim(), name: m[2].trim(), kws: m[3].split(/[、,，\s]+/).filter(Boolean) });
  return intents;
}
function overlap(text, words) {
  return (words || []).filter((w) => w && text.includes(w.trim()));
}

function answerChat(messages) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const user = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const text = String(user).trim();

  // 通话小结请求（适配器 summarize 使用的系统提示）
  if (system.includes('通话质检助手')) {
    const lines = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
    const high = /(多少钱|报价|购买|合作|试用|开通|签|价格)/.test(lines);
    const neg = /(投诉|生气|差|骗|退|不满)/.test(lines);
    return {
      summary: high ? '客户主动咨询产品与价格/开通，意向较积极，已就核心功能做初步解答，建议尽快安排顾问跟进报价与试用。' : '客户就产品进行了初步咨询，整体态度中性，已做基础解答，可后续二次跟进确认需求。',
      nextActions: high ? ['1个工作日内顾问跟进并报价', '发送产品资料与试用入口'] : ['发送产品介绍资料', '安排二次回访确认意向'],
      sentiment: neg ? '负面' : high ? '正面' : '中性',
    };
  }

  const slots = {};
  const ph = text.match(PHONE_RE);
  if (ph) slots.phone = ph[0];
  const nm = text.match(/(?:我姓|我叫|称呼我)([一-龥]{1,4})/);
  if (nm) slots.name = nm[1];

  // 1) 转人工最优先
  if (TRANSFER_RE.test(text)) {
    return { reply: '好的，正在为您转接专属顾问，请稍等片刻。', action: 'TRANSFER', slots, confidence: 0.98 };
  }
  // 2) 知识库命中（系统提示里带了租户知识库）
  const kbs = parseKnowledge(system);
  let bestKb = null, bestHit = 0;
  for (const k of kbs) {
    const hit = overlap(text, k.q.split(/[\s,，、?？]+/)).length;
    if (hit > bestHit) { bestHit = hit; bestKb = k; }
  }
  if (bestKb && bestHit >= 1) {
    return { reply: bestKb.a, action: ph ? 'COLLECT_LEAD' : 'ANSWER', slots, confidence: 0.82 };
  }
  // 3) 意图表命中
  const intents = parseIntents(system);
  let bestIt = null, bestIHit = 0;
  for (const it of intents) {
    const hit = overlap(text, it.kws).length;
    if (hit > bestIHit) { bestIHit = hit; bestIt = it; }
  }
  // 4) 内置业务规则
  for (const r of RULES) {
    if (r.re.test(text)) {
      const intentCode = bestIt?.code || r.intent;
      return { reply: ph ? `已记下您的联系方式${ph[0]}。` + r.reply : r.reply, intentCode, action: ph ? 'COLLECT_LEAD' : 'ANSWER', slots, confidence: 0.8 };
    }
  }
  if (bestIt) {
    return { reply: `关于「${bestIt.name}」，我先为您记录，稍后由顾问给您详细说明。`, intentCode: bestIt.code, action: 'ANSWER', slots, confidence: 0.7 };
  }
  // 5) 留了手机号
  if (ph) {
    return { reply: `好的，已记下您的手机号 ${ph[0]}，稍后会有顾问与您联系，请问您最关注哪方面呢？`, action: 'COLLECT_LEAD', slots, confidence: 0.85 };
  }
  // 6) 兜底（引导而非生硬转人工）
  return { reply: FALLBACKS[text.length % FALLBACKS.length], action: 'ANSWER', slots, confidence: 0.45 };
}

const server = http.createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); return res.end(); }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/health'))) return json(200, { ok: true, engine: 'local-demo-llm' });
  if (req.method === 'GET' && req.url.startsWith('/v1/models')) return json(200, { object: 'list', data: [{ id: 'demo-zh', object: 'model', owned_by: 'local' }] });
  if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const p = JSON.parse(body || '{}');
        const isSummary = JSON.stringify(p.messages || []).includes('通话质检助手');
        const payload = answerChat(p.messages || []);
        const content = isSummary
          ? JSON.stringify({ summary: payload.summary, nextActions: payload.nextActions, sentiment: payload.sentiment })
          : JSON.stringify({ reply: payload.reply, intentCode: payload.intentCode || '', action: payload.action || 'ANSWER', slots: payload.slots || {}, confidence: payload.confidence });
        json(200, {
          id: 'chatcmpl-local-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: p.model || 'demo-zh',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: body.length, completion_tokens: content.length, total_tokens: body.length + content.length },
        });
      } catch (e) {
        json(500, { error: { message: 'local demo llm error: ' + e.message } });
      }
    });
    return;
  }
  json(404, { error: { message: 'not found' } });
});

server.listen(PORT, HOST, () => console.log(`[本地演示大模型] OpenAI 兼容服务已启动 http://${HOST}:${PORT}/v1（离线免Key）`));
