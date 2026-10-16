"use client";

import { useSyncExternalStore } from "react";
import { BETTING_CUTOFF_SECONDS } from "./rules";
import { formatDrawNo, INTERVAL_MS, nextDrawAt } from "./schedule";
import { revealedAt } from "./stage/timeline";

// 每秒通知一次；snapshot 取到「秒」，同一秒內回傳相同的值，React 不會重複渲染
const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};
const getSnapshot = () => Math.floor(Date.now() / 1000);
// 伺服器端不知道使用者看到頁面的時間，先回傳 null，畫面顯示佔位符，避免 hydration 不一致
const getServerSnapshot = () => null;

/** 現在時間（每秒更新一次，毫秒）；伺服器端和 hydrate 前是 null */
export function useNow(): number | null {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return seconds === null ? null : seconds * 1000;
}

export type NextDraw = {
  /** 下一期的期數號 */
  drawNo: string;
  /** 下一期的開獎時間（毫秒） */
  drawAt: number;
  /** 上一期（已開獎）的期數號 */
  lastDrawNo: string;
  /** 上一期的開獎時間 */
  lastDrawAt: number;
  /**
   * 最近一期「已公布」的開獎時間：開獎動畫播完（開獎後 25 秒）才算公布。
   * 開獎紀錄、冷熱號碼用這個，避免列表比舞台先劇透號碼
   */
  revealedDrawAt: number;
  /** 距離開獎還有幾秒 */
  remainingSeconds: number;
  /** 這一期已經過了多少（0–1），進度條用 */
  progress: number;
  /** 已過截止時間（開獎前 15 秒），不能再下注 */
  closed: boolean;
};

/**
 * 下一期開獎資訊。
 * 【暫時】後端還沒有期數 API：依「每 5 分鐘整點開獎」的規則在前端推算。
 * 接上 API 後改用後端的 drawAt + serverTime 校正（見 docs/draw-animation.md）。
 */
export function useNextDraw(): NextDraw | null {
  const now = useNow();
  if (now === null) return null;

  const drawAt = nextDrawAt(now);
  const remainingSeconds = Math.round((drawAt - now) / 1000);

  return {
    drawNo: formatDrawNo(drawAt),
    drawAt,
    lastDrawNo: formatDrawNo(drawAt - INTERVAL_MS),
    lastDrawAt: drawAt - INTERVAL_MS,
    revealedDrawAt: now >= revealedAt(drawAt - INTERVAL_MS) ? drawAt - INTERVAL_MS : drawAt - 2 * INTERVAL_MS,
    remainingSeconds,
    progress: 1 - (drawAt - now) / INTERVAL_MS,
    closed: remainingSeconds <= BETTING_CUTOFF_SECONDS,
  };
}
