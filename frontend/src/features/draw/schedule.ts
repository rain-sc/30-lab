// 期數時間（期數、開獎時間以後端為準，見 feed.ts）
import { currentRules } from "./rules";

/** 每期間隔（毫秒），來自遊戲規則 */
export const intervalMs = () => currentRules().drawIntervalSeconds * 1000;

/**
 * 期數號 → 開獎時間（毫秒）。後端的規則：yyyyMMdd-NNNN 以 UTC 計算，
 * NNNN = 開放下注時間是 UTC 當天第幾個期間（0001 = 00:00 開放、00:05 開獎）。
 * 注單只有期數號，用這個算出開獎時間（決定什麼時候能對獎）
 */
export function drawAtOf(drawNo: string): number {
  const [ymd, seq] = drawNo.split("-");
  const startOfDay = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
  return startOfDay + Number(seq) * intervalMs();
}
