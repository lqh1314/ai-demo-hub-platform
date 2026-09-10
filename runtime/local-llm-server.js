/* eslint-disable */
/**
 * 内置离线演示大模型（零依赖 Node，OpenAI Chat Completions 兼容）· 流畅版
 * 设计目标：在没有外部大模型 Key、断网时，也让接线机器人在业务场景内“像真人一样”多轮对话——
 *   · 带上下文记忆：能接住“然后呢/太贵了/行吧”这类承接、异议、肯定，而不是每句各答各的；
 *   · 话术多变：同一意图多个自然说法，按对话进程与随机挑选，避免重复模板；
 *   · 口语化：先共情/承接，再给信息，最后轻引导，句子短、像打电话；
 *   · 覆盖咨询、异议、顾虑、留资、转人工、闲聊、告别全流程。
 * 说明：它是离线检索/对话状态引擎，不是神经网络；接入真实豆包后由同一链路替换，可开放域自由对话。
 */
const http = require('http');
const PORT = Number(process.env.LOCAL_LLM_PORT || 3100);
const HOST = process.env.LOCAL_LLM_HOST || '127.0.0.1';

const pick = (arr, seed) => arr[Math.abs((seed || 0) + Math.floor(Math.random() * arr.length)) % arr.length];

const ACK = ['嗯，', '好的，', '明白您的意思，', '是这样的，', '您放心，', ''];

// 业务知识口径
const CAPABILITY = '它把“来电自动接听、听懂客户意图、当场答疑、自动留资、高意向转人工、挂断出小结和跟进任务”串成一条线，CRM、外呼、质检报表也都在同一个工作台里';

// 业务意图：每个意图多条自然说法
const INTENTS = [
  { key: 'GREET', re: /^(你好|您好|hi|hello|喂|在吗|在不在|早上好|下午好|晚上好|哈喽)/,
    say: ['您好呀，欢迎咨询企业增长云，很高兴为您服务～请问您是想先了解产品，还是想看个实际演示？', '您好，我是您的智能顾问小助，您直接说需求就行，功能、报价、试用我都能给您讲。', '您好，欢迎来电～请问这次主要想了解哪块呢？'] },
  { key: 'CAPABILITY', re: /(什么功能|有什么功能|哪些功能|能干啥|能做什么|功能介绍|产品介绍|介绍一下|是什么|干嘛用|什么是|讲一下|说说)/,
    say: [`简单说，${CAPABILITY}。您现在最头疼的是来电没人接，还是线索跟不过来？我挑重点讲。`, `我们是一套“接线机器人+电销工作台”，${CAPABILITY}。要不我按您的业务场景给您串一遍？`] },
  { key: 'BOT', re: /(机器人|自动接|智能接|ai接|怎么接|接线原理|怎么工作|怎么运行)/,
    say: ['机器人 7×24 小时在线，客户一打进电话它先接，听懂问什么就当场答，遇到谈价格、要合作这类高意向的，秒级转给对应销售，全程自动记进客户档案，不漏接也不漏记。', '它不是那种“按 1 按 2”的死板菜单，是真能听懂话、能来回聊的；答不了或客户要找人，马上转人工，客户几乎无感。'] },
  { key: 'PRICE', re: /(多少钱|价格|怎么收费|收费|报价|费用|贵不贵|价位|怎么卖|一年.*钱|费用多少)/,
    say: ['我们按坐席数分版本订阅，小团队可以先从标准版起步，具体多少钱得看您几个坐席、要不要外呼线路，我让顾问按规模算一版实价，不花冤枉钱，您看行不？', '从几千到几万都有，主要看坐席规模和版本，我不想随便报个数字误导您。方便说下大概多少人用吗？我给您对个最合适的价。'] },
  { key: 'TRIAL', re: /(试用|体验|演示|demo|看看效果|试一下|开通测试|免费试|先试试|看看实际)/,
    say: ['可以的，能给您开试用环境，里面带演示数据，半天就能把“来电—应答—留资—转人工—出小结”整条流程跑一遍，您亲手点一点最直观，我先帮您登记？', '没问题，安排一对一演示或开试用账号都行，二十来分钟就能讲明白，您看这两天哪个时间方便？'] },
  { key: 'BUY', re: /(购买|下单|签约|签合同|合作|采购|定下来|订一套|买一套|成交|怎么开通|开通流程)/,
    say: ['感谢认可！开通很简单：确认版本和坐席数、走个合同，当天就能把环境配好。请问您怎么称呼、方便留个手机号吗？顾问好准确对接。', '好的，我这就帮您对接专属顾问走开通，您留个联系方式，稍后合同和开通清单一并发您。'] },
  { key: 'CASE', re: /(案例|谁在用|同行|标杆|成功案例|什么公司用|效果怎么样|靠谱吗|客户口碑)/,
    say: ['我们在制造、企业服务、教育、家装这些靠电话获客的行业用得比较多，普遍反馈是漏接少了、跟进快了。同行业案例我让顾问整理一份发您，更有参考性。', '两百人左右的电销团队用下来，机器人先挡掉重复咨询，销售只接高意向，人效提升很明显，详细数据我让顾问发份材料。'] },
  { key: 'SECURITY', re: /(数据安全|安全|合规|隐私|数据泄露|存哪|私有化|本地部署|部署方式)/,
    say: ['数据安全您放心，支持云端也支持私有化，传输加密、权限分级、操作留痕，客户数据归您自己所有；合规要求高的话建议私有化，数据不出内网。', '权限和审计都齐全，谁看了客户、谁导了数据都有记录，也支持等保相关要求，这块可以让顾问给您份安全说明。'] },
  { key: 'INTEGRATION', re: /(对接|集成|打通|和.*系统|微信|企微|钉钉|飞书|crm|erp|工单|api|接口)/,
    say: ['开放标准接口，能和企微、钉钉、飞书以及主流 CRM、工单系统打通，客户资料和通话记录自动同步，不用销售两边抄。您现在用哪套系统？我让顾问确认下方案。', '集成不复杂，常用系统都有现成对接，定制系统走开放 API，一般几天就能联调好。'] },
  { key: 'ONSEAT', re: /(多少坐席|坐席数|并发|多少人|人数限制|扩容|规模|几百人|200人)/,
    say: ['单套环境支持几百坐席同时在线，技能组智能派单，后面加人随时扩容不用换系统。您团队现在大概多少人？我帮您估个版本。', '几个人的小团队到两三百人的呼叫中心都能撑，按需加坐席就行，不用担心用着不够用。'] },
  { key: 'OUTBOUND', re: /(外呼|主动打|批量打|电销|触达|回访任务)/,
    say: ['有的，能建外呼任务、批量导号码，机器人先初筛，筛出有意向的再转人工，配合话术和频次控制，既提效也合规。', '外呼支持任务式批量触达、自动重拨和意向分级，结果直接变线索，跟呼入是一套数据，不割裂。'] },
  { key: 'QA', re: /(质检|报表|统计|数据分析|看板|转化率|监控坐席)/,
    say: ['通话自动转写并做 AI 质检，有没有按话术、有没有情绪问题都能查；管理者有实时看板，接通、意向、转化、工作量一目了然。', '报表自动出，不用人工一条条听录音，今天多少来电、多少意向、卡在哪一环，打开看板就知道。'] },
  { key: 'IMPLEMENT', re: /(多久上线|实施周期|多久能用|上线时间|培训|上手|不会用|难不难|多久搞定)/,
    say: ['标准功能几天就能上线，顾问帮您配好知识库和话术、做两次培训，销售当天就能用，上手不复杂。', '实施您不用操心，开通、配置、培训全程带着走，后台可视化，后期改话术您自己就能弄。'] },
  { key: 'INDUSTRY', re: /(行业|我们是做|适合.*吗|适不适合|我们这种)/,
    say: ['只要客户会通过电话或线上咨询、需要销售跟进，就基本都适用，尤其适合靠获客转化的 To-B 团队。您方便说下做哪个行业吗？我给您对下贴合度。'] },
  { key: 'SERVICE', re: /(售后|服务支持|故障|报错|登录不上|出问题|维护|保修)/,
    say: ['上线后有专属服务群，日常问题随时响应，重大故障有应急通道，不会让您没人管。您是遇到具体问题了吗？我可以先帮您转技术同事。'] },
  { key: 'ABOUT', re: /(你们是谁|哪家公司|公司叫|品牌|成立|背景)/,
    say: ['我们专注做企业智能获客和客户运营，核心就是这套 AI 接线机器人加电销工作台，服务的都是靠销售转化的 To-B 团队。'] },
];

// 异议 / 顾虑（真人销售应对）
const OBJECTIONS = [
  { re: /(太贵|便宜|优惠|打折|降价|费用高|预算不够|超预算|砍价|最低价)/,
    say: ['理解，预算都得花在刀刃上。其实算笔账：少漏一个客户、销售每天多跟几条线索，这钱很快就回来了；而且可以先上少量坐席，见效再扩，压力不大。', '价格能按您预算灵活配版本，先把最核心的接线和留资用起来，也支持试用，用出效果再决定，不着急。'] },
  { re: /(考虑考虑|想想|再说|不急|商量一下|研究一下|对比一下|回去商量)/,
    say: ['应该的，选系统是要多比较。我先发份产品资料和同行业案例给您，您跟团队看着也有依据，需要时我随时在，好吗？', '没问题，不催您。我帮您留个试用名额，您哪天想细看直接能进，留个手机号或微信就行，绝不打扰。'] },
  { re: /(没用过|怕.*不会|太复杂|学不会|员工不会|难操作)/,
    say: ['这个不用担心，后台是可视化的，销售用着跟普通聊天软件差不多，加上培训和陪跑，很多客户当天就用顺了。'] },
  { re: /(有效果吗|真的假的|真的吗|靠谱不|智商税|没用怎么办)/,
    say: ['能理解您的顾虑，所以我们支持先试用：拿您自己的场景跑一跑，漏接有没有变少、线索有没有变多，数据不骗人，效果好您再留。'] },
  { re: /(别的家|竞品|和.*比|对比|差异|区别|优势在哪)/,
    say: ['各家侧重不同，我们的优势是“接线+电销工作台”一体、数据不割裂，大模型和线路还能按需要换、不绑死。详细对比我让顾问按您需求客观捋一份。'] },
];

// 承接类（依赖上文）
const FOLLOWUPS = [
  { re: /(然后呢|还有呢|继续说|接着|还有什么|再说说|详细点|具体点)/, onlyAfter: true,
    say: ['接着刚才的讲，除了自动接听和答疑，它还会给客户意向分级，高意向立刻推给销售，挂断自动出小结、建待办，销售不用自己整理记录。', '再补充一点，管理者有实时看板和 AI 质检，多少来电、多少意向、谁跟得好都看得到，相当于把整个获客过程管起来了。'] },
  { re: /^(行|好|可以|嗯+|ok|OK|没问题|是的|对|有道理)(的|吧|啊|呀)?$/, onlyAfter: true,
    say: ['那我帮您把试用先安排上？您留个联系方式，顾问把入口和操作指引发过去，几分钟就能看效果。', '好嘞，那我先给您登记一下，请问您怎么称呼、手机号方便留一下吗？'] },
];

const CHITCHAT = [
  { re: /(你是机器人|你是真人|是人是|人工智能|你是谁|你叫什么|名字)/,
    say: ['我是智能接线顾问小助，日常问题都能直接帮您解答；想跟真人销售细聊，说一声“转人工”我马上接过去～'] },
  { re: /(听不清|再说一遍|没听清|重复一下|声音小)/,
    say: ['好的我说慢一点，您也可以随时打断我；刚才主要是讲产品怎么帮您接住来电、管好线索。'] },
  { re: /(谢谢|感谢|多谢|辛苦了)/,
    say: ['不客气，应该的～还有想了解的随时问，需要一对一介绍我也能马上帮您转顾问。'] },
];

const TRANSFER_RE = /(转人工|人工|真人|找客服|找顾问|找销售|工作人员|投诉|接你们|活人|找你们人)/;
const BYE_RE = /(再见|拜拜|我挂了|先这样|结束通话)/;
const PHONE_RE = /(?:\+?86)?1[3-9]\d{9}/;
const NAME_RE = /(?:我姓|我叫|称呼我|姓名是?)([一-龥]{1,4})/;
const FALLBACKS = [
  '这个我想给您讲准一点，方便先说下现在最想解决哪块吗——是来电经常漏接，还是销售线索跟不过来？',
  '您说的我记下了。为了建议更对路，请问您团队大概多少人、主要靠电话还是线上获客？',
  '嗯，这块让顾问结合您实际情况讲会更清楚。您也可以先说最关心功能、价格还是试用，我先给您划重点。',
];

function parseKnowledge(system) {
  const kbs = []; const re = /问[:：]([^\n]+)\n\s*答[:：]([^\n]+)/g; let m;
  while ((m = re.exec(system || ''))) kbs.push({ q: m[1].trim(), a: m[2].trim() });
  return kbs;
}
function parseIntents(system) {
  const arr = []; const re = /-\s*([A-Z0-9_]+)[：:]\s*([^（(]+)[（(]关键词[：:]([^)）]+)/g; let m;
  while ((m = re.exec(system || ''))) arr.push({ code: m[1].trim(), name: m[2].trim(), kws: m[3].split(/[、,，\s]+/).filter(Boolean) });
  return arr;
}
const overlap = (t, ws) => (ws || []).filter((w) => w && t.includes(w.trim()));
function lastTopicOf(messages) {
  const prev = messages.filter((m) => m.role === 'user').slice(0, -1).reverse();
  for (const t of prev) {
    for (const it of INTENTS) if (it.re.test(t.content)) return it.key;
    for (const o of OBJECTIONS) if (o.re.test(t.content)) return 'OBJ';
  }
  return null;
}

function answerChat(messages) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const userMsg = [...messages].reverse().find((m) => m.role === 'user');
  const text = String(userMsg?.content || '').trim();
  const turn = messages.filter((m) => m.role === 'user').length;
  const seed = text.length + turn * 7;

  if (system.includes('通话质检助手')) {
    const lines = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
    const high = /(多少钱|报价|购买|合作|试用|开通|签|价格|演示)/.test(lines);
    const neg = /(投诉|生气|差|骗|退|不满|太贵)/.test(lines);
    return {
      summary: high ? '客户主动咨询产品、价格与开通/试用，沟通顺畅、意向积极，已就功能与落地方式做初步解答，建议尽快安排顾问跟进报价并开通试用。' : '客户就产品进行了初步了解，态度中性偏正面，已做基础解答，可发送资料后二次跟进确认需求。',
      nextActions: high ? ['1个工作日内顾问跟进并出具报价', '发送产品资料、案例与试用入口'] : ['发送产品介绍与案例资料', '安排二次回访确认意向与规模'],
      sentiment: neg ? '负面' : high ? '正面' : '中性',
    };
  }

  const slots = {};
  const ph = text.match(PHONE_RE); if (ph) slots.phone = ph[0];
  const nm = text.match(NAME_RE); if (nm) slots.name = nm[1];

  // “你是机器人还是真人”这类身份疑问要先于转人工（否则句中“真人”会被误判为要转人工）
  const IDENTITY_RE = /(你是(机器人|真人|人工智能|不是)|是人是|还是真人|你是谁|你叫什么|是不是真人)/;
  if (IDENTITY_RE.test(text)) {
    return { reply: pick(CHITCHAT[0].say, seed), action: 'ANSWER', slots, confidence: 0.9, intentCode: 'CHITCHAT' };
  }
  if (TRANSFER_RE.test(text)) {
    return { reply: pick(['好的，这就为您转接专属顾问，请稍等别挂机～', '没问题，马上帮您接人工销售，稍等片刻。', '好的，正在为您转接，请稍等。'], seed), action: 'TRANSFER', slots, confidence: 0.99 };
  }
  if (BYE_RE.test(text)) return { reply: '好的，感谢您的咨询，祝您工作顺利，需要时随时来电，再见～', action: 'ANSWER', slots, confidence: 0.9, intentCode: 'BYE' };

  const kbs = parseKnowledge(system);
  let bestKb = null, bestHit = 0;
  for (const k of kbs) { const hit = overlap(text, k.q.split(/[\s,，、?？]+/)).length; if (hit > bestHit) { bestHit = hit; bestKb = k; } }

  const topic = lastTopicOf(messages);
  for (const f of FOLLOWUPS) if (f.re.test(text) && (!f.onlyAfter || topic)) return { reply: pick(f.say, seed), action: 'ANSWER', slots, confidence: 0.8, intentCode: 'FOLLOW' };
  for (const o of OBJECTIONS) if (o.re.test(text)) return { reply: pick(o.say, seed), action: 'ANSWER', slots, confidence: 0.83, intentCode: 'OBJECTION' };
  for (const c of CHITCHAT) if (c.re.test(text)) return { reply: pick(c.say, seed), action: 'ANSWER', slots, confidence: 0.85, intentCode: 'CHITCHAT' };
  if (bestKb && bestHit >= 1) return { reply: bestKb.a, action: ph ? 'COLLECT_LEAD' : 'ANSWER', slots, confidence: 0.82 };

  const intents = parseIntents(system);
  let bestIt = null, bestIHit = 0;
  for (const it of intents) { const hit = overlap(text, it.kws).length; if (hit > bestIHit) { bestIHit = hit; bestIt = it; } }
  for (const it of INTENTS) {
    if (it.re.test(text)) {
      let say = pick(it.say, seed);
      if (turn > 1 && Math.random() < 0.35 && !/^(您好|你好)/.test(say)) say = pick(ACK, seed) + say;
      if (ph) say = `您的联系方式 ${ph[0]} 我先记下了。` + say;
      return { reply: say, intentCode: bestIt?.code || it.key, action: ph ? 'COLLECT_LEAD' : 'ANSWER', slots, confidence: 0.83 };
    }
  }
  if (bestIt) return { reply: `关于「${bestIt.name}」我先记下了，稍后让顾问给您详细说明，您也可以先说最关心的点。`, intentCode: bestIt.code, action: 'ANSWER', slots, confidence: 0.7 };
  if (ph) return { reply: `好的，手机号 ${ph[0]} 记下了，稍后会有顾问联系您。请问您主要想了解哪方面，我先帮您备注上？`, action: 'COLLECT_LEAD', slots, confidence: 0.88 };
  return { reply: pick(FALLBACKS, seed), action: 'ANSWER', slots, confidence: 0.45 };
}

const server = http.createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); return res.end(); }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/health'))) return json(200, { ok: true, engine: 'local-demo-llm', fluent: true });
  if (req.method === 'GET' && req.url.startsWith('/v1/models')) return json(200, { object: 'list', data: [{ id: 'demo-zh', object: 'model', owned_by: 'local' }] });
  if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const p = JSON.parse(body || '{}');
        const isSummary = JSON.stringify(p.messages || []).includes('通话质检助手');
        const out = answerChat(p.messages || []);
        const content = isSummary
          ? JSON.stringify({ summary: out.summary, nextActions: out.nextActions, sentiment: out.sentiment })
          : JSON.stringify({ reply: out.reply, intentCode: out.intentCode || '', action: out.action || 'ANSWER', slots: out.slots || {}, confidence: out.confidence });
        json(200, { id: 'chatcmpl-local-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: p.model || 'demo-zh',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: body.length, completion_tokens: content.length, total_tokens: body.length + content.length } });
      } catch (e) { json(500, { error: { message: 'local demo llm error: ' + e.message } }); }
    });
    return;
  }
  json(404, { error: { message: 'not found' } });
});

server.listen(PORT, HOST, () => console.log(`[本地演示大模型·流畅版] OpenAI 兼容服务已启动 http://${HOST}:${PORT}/v1（离线免Key，带多轮上下文）`));
