// 每 5 分鐘開獎一次（期數號、時間以後端為準，見 feed.ts）
import { DRAW_INTERVAL_MINUTES } from "./rules";

export const INTERVAL_MS = DRAW_INTERVAL_MINUTES * 60 * 1000;

/**
 * 期數號 → 開獎時間（毫秒）。後端的規則：yyyyMMdd-NNNN 以 UTC 計算，
 * NNNN = 開放下注時間是 UTC 當天第幾個 5 分鐘（0001 = 00:00 開放、00:05 開獎）。
 * 注單只有期數號，用這個算出開獎時間（決定什麼時候能對獎）
 */
export function drawAtOf(drawNo: string): number {
  const [ymd, seq] = drawNo.split("-");
  const startOfDay = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
  return startOfDay + Number(seq) * INTERVAL_MS;
}
