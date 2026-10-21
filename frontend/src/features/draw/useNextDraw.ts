"use client";

import { useSyncExternalStore } from "react";
import { feedNow, hasResult, useDrawFeed } from "./feed";
import { INTERVAL_MS } from "./schedule";
import { revealedAt } from "./stage/timeline";

// 每秒通知一次；snapshot 取到「秒」，同一秒內回傳相同的值，React 不會重複渲染
const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};
const getSnapshot = () => Math.floor(feedNow() / 1000);
// 伺服器端不知道使用者看到頁面的時間，先回傳 null，畫面顯示佔位符，避免 hydration 不一致
const getServerSnapshot = () => null;

/** 現在時間（用後端 serverTime 校正過，每秒更新一次，毫秒）；伺服器端和 hydrate 前是 null */
export function useNow(): number | null {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return seconds === null ? null : seconds * 1000;
}

export type NextDraw = {
  /** 目前這一期（下注中 / 已截止）的期數號 */
  drawNo: string;
  /** 目前這一期的開獎時間（毫秒） */
  drawAt: number;
  /** 上一期（已開獎）的期數號；系統剛上線還沒開過獎時是 null */
  lastDrawNo: string | null;
  /**
   * 最近一期「已公布」的開獎時間：開獎動畫播完（開獎後 25 秒）才算公布。
   * 開獎紀錄、冷熱號碼用這個，避免列表比舞台先劇透號碼
   */
  revealedDrawAt: number;
  /** 最近一期的開獎動畫已經播完（後端的統計包含了最新一期，播完前抓會提前暴露號碼） */
  latestRevealed: boolean;
  /** 距離開獎還有幾秒 */
  remainingSeconds: number;
  /** 這一期已經過了多少（0–1），進度條用 */
  progress: number;
  /** 已截止（開獎前 15 秒），不能再下注 */
  closed: boolean;
};

/**
 * 目前這一期的資訊（後端 GET /api/draws/current + /topic/draws，見 feed.ts）。
 * 還沒拿到資料時是 null（畫面顯示佔位符；拿不到時 useDrawFeed 的 status 是 "error"）
 */
export function useNextDraw(): NextDraw | null {
  const now = useNow();
  const current = useDrawFeed((s) => s.current);
  const previous = useDrawFeed((s) => s.previous);
  if (now === null || !current) return null;

  const openAt = Date.parse(current.openAt);
  const closeAt = Date.parse(current.closeAt);
  const drawAt = Date.parse(current.drawAt);
  const lastDrawAt = previous ? Date.parse(previous.drawAt) : openAt;

  return {
    drawNo: current.drawNo,
    drawAt,
    lastDrawNo: previous?.drawNo ?? null,
    revealedDrawAt: now >= revealedAt(lastDrawAt) ? lastDrawAt : lastDrawAt - INTERVAL_MS,
    latestRevealed: now >= revealedAt(lastDrawAt),
    remainingSeconds: Math.max(0, Math.round((drawAt - now) / 1000)),
    progress: Math.min(1, Math.max(0, (now - openAt) / (drawAt - openAt))),
    // 已開獎但新的一期還沒到（推播差幾毫秒）也算截止
    closed: current.status !== "OPEN" || hasResult(current) || now >= closeAt,
  };
}
