// 機器人玩家：模擬 50~100 個玩家自動簽到、下注，讓開獎、排行榜、冷熱號碼有資料可看。
// 像真實玩家一樣只打公開的 HTTP API，不碰資料庫。用法見同目錄的 README.md。
//
//   node tools/bot-players/bots.mjs
//   BOT_COUNT=60 BASE_URL=http://localhost:8088 node tools/bot-players/bots.mjs

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8088';
const BOT_COUNT = clamp(Number(process.env.BOT_COUNT ?? 80), 1, 100);
const PASSWORD = process.env.BOT_PASSWORD ?? 'bot-password-2026';
const PREFIX = 'bot_';
const COOKIE_NAME = 'msl_token';
const POLL_MS = 2_000;

// 暱稱：依編號固定分配，重新啟動腳本時同一個機器人還是同一個名字
const NICKNAMES = [
  '阿明', '小美', 'Lucky7', '大雄', '阿傑', 'Kenny', '小芳', '老王', '阿珍', 'Jacky',
  '小胖', '阿翔', '佳佳', 'Momo', '阿豪', '小雯', 'Eric', '阿德', '琪琪', '大頭',
  '阿凱', 'Vivian', '小強', '阿芬', 'Tony', '小虎', '阿玲', '肥仔', 'Coco', '阿偉',
  '小蘭', '阿威', 'Peggy', '包子', '阿龍', '小婷', 'Sam', '阿輝', '妮妮', '阿光',
  '小魚兒', 'Ricky', '阿嬌', '小新', '阿忠', 'Winnie', '阿財', '小晴', 'Dennis', '阿寶',
  '小安', '阿南', 'Fiona', '阿彬', '小葵', '阿祥', 'Gary', '小米', '阿康', '露露',
  '阿峰', 'Jenny', '小樂', '阿順', '貝貝', 'Kevin', '阿華', '小琳', '阿成', 'Lily',
  '發財哥', '阿亮', '小倩', 'Mike', '阿志', '圓圓', '阿興', 'Nancy', '小傑', '阿正',
  '幸運星', '阿旺', 'Olivia', '小智', '阿泰', '豆豆', '阿勇', 'Peter', '小如', '阿福',
  '好運來', '阿星', 'Queenie', '小剛', '阿青', '樂樂', '阿東', 'Rachel', '小龍', '阿美',
];

// 玩家類型：比例、每期下注機率、每次注數範圍
const PERSONAS = [
  { name: 'casual', share: 0.5, playChance: 0.35, lines: [1, 3] },
  { name: 'regular', share: 0.35, playChance: 0.6, lines: [2, 8] },
  { name: 'whale', share: 0.15, playChance: 0.8, lines: [8, 20] },
];

const bots = [];
let rules = { pointsPerBet: 10, maxLinesPerTicket: 50 };
let currentDrawNo = null;
let bonusDay = null;
let stopping = false;
const timers = new Set();

main().catch((e) => {
  console.error('啟動失敗：', e.message);
  process.exit(1);
});

async function main() {
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  rules = (await request('GET', '/api/game/rules')).data;
  log(`連到 ${BASE_URL}，準備 ${BOT_COUNT} 個機器人（每注 ${rules.pointsPerBet} 積分）`);

  for (let i = 1; i <= BOT_COUNT; i++) {
    bots.push(createBot(i));
  }
  await inBatches(bots, 5, signIn);
  const ready = bots.filter((b) => b.cookie);
  log(`登入完成：${ready.length} / ${bots.length}`);
  if (ready.length === 0) {
    throw new Error('沒有任何機器人登入成功');
  }

  while (!stopping) {
    await tick().catch((e) => log(`對帳失敗：${e.message}`));
    await sleep(POLL_MS);
  }
}

// 每 2 秒：跨日就簽到；出現新的一期就安排這一期的下注
async function tick() {
  const today = new Date().toISOString().slice(0, 10);
  if (bonusDay !== today) {
    bonusDay = today;
    await claimDailyBonuses();
  }

  const { current } = (await request('GET', '/api/draws/current')).data;
  if (current.drawNo === currentDrawNo || current.status !== 'OPEN') {
    return;
  }
  currentDrawNo = current.drawNo;
  scheduleBets(current);
}

function scheduleBets(draw) {
  const now = Date.now();
  const earliest = now + 3_000;
  const latest = new Date(draw.closeAt).getTime() - 5_000;
  if (latest <= earliest) {
    log(`[${draw.drawNo}] 離截止太近，這期不下注`);
    return;
  }

  const players = bots.filter((b) => b.cookie && Math.random() < b.persona.playChance);
  const summary = { drawNo: draw.drawNo, pending: players.length, tickets: 0, lines: 0, points: 0, skipped: 0 };
  log(`[${draw.drawNo}] ${players.length} 個機器人會在截止前下注`);

  for (const bot of players) {
    const at = earliest + Math.random() * (latest - earliest);
    later(at - now, async () => {
      await placeBet(bot, draw.drawNo, summary).catch((e) => {
        summary.skipped++;
        log(`  ${bot.username} 下注失敗：${e.message}`);
      });
      if (--summary.pending === 0) {
        log(`[${summary.drawNo}] 下注完成：${summary.tickets} 張注單、${summary.lines} 注、${summary.points.toLocaleString()} 積分` +
            (summary.skipped ? `（${summary.skipped} 個略過）` : ''));
      }
    });
  }
}

async function placeBet(bot, drawNo, summary) {
  const wanted = randomInt(...bot.persona.lines);
  const affordable = Math.floor(bot.balance / rules.pointsPerBet);
  const count = Math.min(wanted, affordable, rules.maxLinesPerTicket);
  if (count < 1) {
    summary.skipped++;
    return;
  }

  const body = {
    drawNo,
    idempotencyKey: crypto.randomUUID(),
    lines: Array.from({ length: count }, () => pickLine(bot)),
  };
  const res = await botRequest(bot, 'POST', '/api/tickets', body);
  if (res.code === 0) {
    bot.balance = res.data.balance;
    summary.tickets++;
    summary.lines += count;
    summary.points += res.data.ticket.cost;
    return;
  }
  if (res.code === 40902 || res.code === 40903) {
    summary.skipped++; // 積分不足、已截止：真人也會遇到，略過就好
    if (res.code === 40902) {
      await refreshBalance(bot);
    }
    return;
  }
  throw new Error(`${res.code} ${res.msg}`);
}

async function claimDailyBonuses() {
  let claimed = 0;
  await inBatches(bots.filter((b) => b.cookie), 5, async (bot) => {
    await sleep(Math.random() * 500);
    const res = await botRequest(bot, 'POST', '/api/wallet/daily-bonus');
    if (res.code === 0) {
      bot.balance = res.data.balance;
      claimed++;
    } else {
      await refreshBalance(bot);
    }
  });
  log(`每日簽到：${claimed} 個機器人領到積分（其他今天已經領過）`);
}

// ---------- 帳號 ----------

function createBot(index) {
  const id = String(index).padStart(3, '0');
  const rng = mulberry32(index * 7919);
  return {
    username: `${PREFIX}${id}`,
    nickname: NICKNAMES[(index - 1) % NICKNAMES.length],
    persona: pickPersona(rng()),
    style: ['random', 'lucky', 'birthday'][Math.floor(rng() * 3)],
    luckyNumbers: shuffle(range(1, 49), rng).slice(0, 6),
    cookie: null,
    balance: 0,
  };
}

async function signIn(bot) {
  const credentials = { username: bot.username, password: PASSWORD };
  let res = await request('POST', '/api/auth/login', credentials);
  if (res.code === 40101) {
    res = await request('POST', '/api/auth/register', { ...credentials, nickname: bot.nickname });
  }
  if (res.code !== 0) {
    log(`  ${bot.username} 登入失敗：${res.code} ${res.msg}`);
    return;
  }
  bot.cookie = res.cookie;
  await refreshBalance(bot);
}

async function refreshBalance(bot) {
  const res = await botRequest(bot, 'GET', '/api/wallet');
  if (res.code === 0) {
    bot.balance = res.data.balance;
  }
}

// 帶著機器人自己的 cookie 打 API；被登出（例如有人用同一個帳號登入）就重新登入一次
async function botRequest(bot, method, path, body) {
  let res = await request(method, path, body, bot.cookie);
  if (res.code === 40100 || res.code === 40102) {
    await signIn(bot);
    res = await request(method, path, body, bot.cookie);
  }
  return res;
}

async function request(method, path, body, cookie) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return { ...json, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}

// ---------- 選號 ----------

function pickLine(bot) {
  switch (bot.style) {
    case 'lucky': {
      // 固定的幸運號碼留 3~4 個，其他隨機
      const keep = shuffle(bot.luckyNumbers.slice()).slice(0, randomInt(3, 4));
      const rest = shuffle(range(1, 49).filter((n) => !keep.includes(n)));
      return [...keep, ...rest.slice(0, 6 - keep.length)].sort((a, b) => a - b);
    }
    case 'birthday':
      // 只選 1~31（生日、紀念日）
      return shuffle(range(1, 31)).slice(0, 6).sort((a, b) => a - b);
    default:
      return shuffle(range(1, 49)).slice(0, 6).sort((a, b) => a - b);
  }
}

// ---------- 工具 ----------

function pickPersona(r) {
  let acc = 0;
  for (const p of PERSONAS) {
    acc += p.share;
    if (r < acc) return p;
  }
  return PERSONAS[0];
}

function stop() {
  if (stopping) return;
  stopping = true;
  timers.forEach(clearTimeout);
  log('停止：取消還沒送出的下注');
  setTimeout(() => process.exit(0), 300);
}

function later(ms, fn) {
  const t = setTimeout(() => {
    timers.delete(t);
    if (!stopping) fn();
  }, ms);
  timers.add(t);
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(n, min, max) {
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : min;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg) {
  console.log(`${new Date().toLocaleTimeString('zh-TW', { hour12: false })} ${msg}`);
}
