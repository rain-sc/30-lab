"use client";

import { useSyncExternalStore } from "react";
import { BETTING_CUTOFF_SECONDS, DRAW_INTERVAL_MINUTES } from "./rules";

const INTERVAL_MS = DRAW_INTERVAL_MINUTES * 60 * 1000;

// 每秒通知一次；snapshot 取到「秒」，同一秒內回傳相同的值，React 不會重複渲染
const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};
const getSnapshot = () => Math.floor(Date.now() / 1000);
// 伺服器端不知道使用者看到頁面的時間，先回傳 null，畫面顯示佔位符，避免 hydration 不一致
const getServerSnapshot = () => null;

/** 開獎時間 → 期數號：當天第幾期（本地日期，暫定格式） */
function formatDrawNo(drawAt: number) {
  const day = new Date(drawAt);
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const seq = Math.round((drawAt - startOfDay) / INTERVAL_MS);
  const ymd = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`;
  return `${ymd}-${String(seq).padStart(4, "0")}`;
}

export type NextDraw = {
  /** 下一期的期數號（暫定格式 YYYYMMDD-NNNN，等後端定案） */
  drawNo: string;
  /** 上一期（已開獎）的期數號 */
  lastDrawNo: string;
  /** 距離開獎還有幾秒 */
  remainingSeconds: number;
  /** 已過截止時間（開獎前 15 秒），不能再下注 */
  closed: boolean;
};

/**
 * 下一期開獎資訊。
 * 【暫時】後端還沒有期數 API：依「每 5 分鐘整點開獎」的規則在前端推算。
 * 接上 API 後改用後端的 drawAt + serverTime 校正（見 docs/draw-animation.md）。
 */
export function useNextDraw(): NextDraw | null {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (nowSeconds === null) return null;

  const now = nowSeconds * 1000;
  const drawAt = Math.floor(now / INTERVAL_MS) * INTERVAL_MS + INTERVAL_MS;
  const remainingSeconds = Math.round((drawAt - now) / 1000);

  return {
    drawNo: formatDrawNo(drawAt),
    lastDrawNo: formatDrawNo(drawAt - INTERVAL_MS),
    remainingSeconds,
    closed: remainingSeconds <= BETTING_CUTOFF_SECONDS,
  };
}
