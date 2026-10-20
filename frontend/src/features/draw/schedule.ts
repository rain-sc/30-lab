// 期數時間表：每 5 分鐘開獎一次（期數、時間以後端為準，見 feed.ts）
// 這裡只剩開獎紀錄 API 完成前，用來補齊示例期數的計算
import { DRAW_INTERVAL_MINUTES } from "./rules";

export const INTERVAL_MS = DRAW_INTERVAL_MINUTES * 60 * 1000;

/**
 * 開獎時間 → 期數號，和後端相同的規則：yyyyMMdd-NNNN，以 UTC 計算，
 * NNNN = 開放下注時間（開獎前 5 分鐘）是 UTC 當天第幾個 5 分鐘（0001–0288）
 */
export function formatDrawNo(drawAt: number) {
  const openAt = new Date(drawAt - INTERVAL_MS);
  const startOfDay = Date.UTC(openAt.getUTCFullYear(), openAt.getUTCMonth(), openAt.getUTCDate());
  const seq = Math.floor((openAt.getTime() - startOfDay) / INTERVAL_MS) + 1;
  const ymd = `${openAt.getUTCFullYear()}${String(openAt.getUTCMonth() + 1).padStart(2, "0")}${String(openAt.getUTCDate()).padStart(2, "0")}`;
  return `${ymd}-${String(seq).padStart(4, "0")}`;
}
