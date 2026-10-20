// 【示例資料】後端還沒有開獎紀錄、彩池、下注、錢包 API（見 docs/api-changelog.md），由前端模擬。
// 畫面上用到這裡的資料時，要同時顯示「示例數據」標籤。接口出來後刪掉這個檔案。
// 期數和開獎號碼已經接上後端（feed.ts）；這裡的開獎紀錄是「收到過的真實結果優先，更早的用示例補齊」
import type { DrawResult as FeedResult } from "./feed";
import { formatDrawNo, INTERVAL_MS } from "./schedule";

export const SAMPLE_JACKPOT = 128460;

/** 示例錢包的起始積分（註冊贈送的數字還沒定，見 docs/game-rules.md） */
export const SAMPLE_INITIAL_POINTS = 1000;

/** 頭獎到三獎的示例獎金（正式規則是彩池分配，比例還沒定） */
export const SAMPLE_POOL_PRIZES = { 1: SAMPLE_JACKPOT, 2: 20000, 3: 3000 } as const;

export type DrawResult = { numbers: number[]; special: number };

/**
 * 依期數號產生固定的示例開獎結果：同一期每次算出來都一樣（重新整理不會變），
 * 換到下一期就換一組號碼。numbers 保留「開出的順序」（和後端約定一致，顯示時再排序）。
 */
export function sampleResultFor(drawNo: string): DrawResult {
  // 字串 → 種子（FNV-1a），再用 mulberry32 產生偽隨機數
  let seed = 2166136261;
  for (const ch of drawNo) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pool = Array.from({ length: 49 }, (_, i) => i + 1);
  const picked = Array.from({ length: 7 }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return { numbers: picked.slice(0, 6), special: picked[6] };
}

/** sample：前端沒收到這期的真實結果，用示例號碼補上 */
export type PastDraw = DrawResult & { drawNo: string; drawAt: number; sample: boolean };

/**
 * 最近 count 期的開獎結果，新的在前；lastDrawAt 是最近一期（已公布）的開獎時間。
 * results 是收到過的真實結果（feed.ts），有的用真的，沒有的用示例補齊
 */
export function sampleRecentDraws(lastDrawAt: number, count: number, results: Record<string, FeedResult>): PastDraw[] {
  return Array.from({ length: count }, (_, i) => {
    const drawAt = lastDrawAt - i * INTERVAL_MS;
    const drawNo = formatDrawNo(drawAt);
    const real = results[drawNo];
    return real
      ? { drawNo, drawAt, numbers: real.numbers, special: real.special, sample: false }
      : { drawNo, drawAt, ...sampleResultFor(drawNo), sample: true };
  });
}

export type HotNumber = { number: number; count: number };
export type ColdNumber = { number: number; missed: number };

/**
 * 冷熱號碼（含特別號碼）：最近 window 期裡
 * - 熱門：開出次數最多的前 top 個
 * - 冷門：最久沒開出的前 top 個（missed = 已經連續幾期沒開；整段都沒開過就是 window）
 */
export function sampleHotCold(lastDrawAt: number, results: Record<string, FeedResult>, window = 100, top = 6) {
  const draws = sampleRecentDraws(lastDrawAt, window, results);
  const count = new Array<number>(50).fill(0);
  const missed = new Array<number>(50).fill(window);
  draws.forEach((d, i) => {
    for (const n of [...d.numbers, d.special]) {
      count[n]++;
      if (missed[n] === window) missed[n] = i;
    }
  });
  const all = Array.from({ length: 49 }, (_, i) => i + 1);
  const hot: HotNumber[] = all
    .map((n) => ({ number: n, count: count[n] }))
    .sort((a, b) => b.count - a.count || a.number - b.number)
    .slice(0, top);
  const cold: ColdNumber[] = all
    .map((n) => ({ number: n, missed: missed[n] }))
    .sort((a, b) => b.missed - a.missed || a.number - b.number)
    .slice(0, top);
  return { hot, cold };
}
