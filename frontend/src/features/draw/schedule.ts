// 期數時間表：每 5 分鐘整點開獎（00:00、00:05…）
// 【暫時】後端還沒有期數 API，期數號、開獎時間都在前端推算；接上 API 後改用後端的 drawAt + serverTime
import { DRAW_INTERVAL_MINUTES } from "./rules";

export const INTERVAL_MS = DRAW_INTERVAL_MINUTES * 60 * 1000;

/** 現在之後的第一個開獎時間（剛好整點時算下一期） */
export function nextDrawAt(now: number) {
  return Math.floor(now / INTERVAL_MS) * INTERVAL_MS + INTERVAL_MS;
}

/** 開獎時間 → 期數號：當天第幾期（本地日期，暫定格式 YYYYMMDD-NNNN，等後端定案） */
export function formatDrawNo(drawAt: number) {
  const day = new Date(drawAt);
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const seq = Math.round((drawAt - startOfDay) / INTERVAL_MS);
  const ymd = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`;
  return `${ymd}-${String(seq).padStart(4, "0")}`;
}
