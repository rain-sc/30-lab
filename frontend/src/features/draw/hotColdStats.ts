// 冷熱號碼（含特別號碼）：用開獎紀錄計算
import type { Draw } from "./feed";

export type HotNumber = { number: number; count: number };
export type ColdNumber = { number: number; missed: number };
export type HotCold = { hot: HotNumber[]; cold: ColdNumber[]; window: number };

/**
 * draws 由新到舊（只算有號碼的）：
 * - 熱門：開出次數最多的前 top 個
 * - 冷門：最久沒開出的前 top 個（missed = 已經連續幾期沒開；整段都沒開過就是期數總數）
 */
export function computeHotCold(draws: Draw[], top = 6): HotCold | null {
  const drawn = draws.filter((d) => d.numbers && d.specialNumber !== undefined);
  if (drawn.length === 0) return null;
  const window = drawn.length;
  const count = new Array<number>(50).fill(0);
  const missed = new Array<number>(50).fill(window);
  drawn.forEach((d, i) => {
    for (const n of [...d.numbers!, d.specialNumber!]) {
      count[n]++;
      if (missed[n] === window) missed[n] = i;
    }
  });
  const all = Array.from({ length: 49 }, (_, i) => i + 1);
  return {
    hot: all
      .map((n) => ({ number: n, count: count[n] }))
      .sort((a, b) => b.count - a.count || a.number - b.number)
      .slice(0, top),
    cold: all
      .map((n) => ({ number: n, missed: missed[n] }))
      .sort((a, b) => b.missed - a.missed || a.number - b.number)
      .slice(0, top),
    window,
  };
}
