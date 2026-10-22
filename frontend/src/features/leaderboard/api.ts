"use client";

// 排行榜（不用登入；有登入會多回傳自己的名次 mine）
// - 中獎榜：GET /api/leaderboard?period=DAY|WEEK（期間內的中獎總額，會重置）
// - 富豪榜：GET /api/leaderboard/balance（目前積分餘額，只列出下注過的人，不會重置）
import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { feedNow } from "@/features/draw/feed";
import type { NextDraw } from "@/features/draw/useNextDraw";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

type WinningsBoard = components["schemas"]["LeaderboardResponse"];
type BalanceBoard = components["schemas"]["BalanceLeaderboardResponse"];
export type LeaderboardEntry = components["schemas"]["LeaderboardEntry"];
/** 今日、本週中獎榜，富豪榜 */
export type Board = WinningsBoard["period"] | "BALANCE";
/** 兩種榜統一的格式：富豪榜沒有 to（不會重置） */
export type LeaderboardData = { board: Board; entries: LeaderboardEntry[]; mine?: LeaderboardEntry; to?: string };

/** 前幾名（後端固定回傳前 20 名） */
export const TOP_N = 20;

async function fetchBoard(board: Board): Promise<LeaderboardData> {
  if (board === "BALANCE") {
    const res = await api.get<BalanceBoard>("/leaderboard/balance", { redirectOnUnauthorized: false });
    return { board, entries: res.entries, mine: res.mine };
  }
  const res = await api.get<WinningsBoard>("/leaderboard", { params: { period: board }, redirectOnUnauthorized: false });
  return { board, entries: res.entries, mine: res.mine, to: res.to };
}

/**
 * 排行榜。
 * - 跟中獎結果一樣不能提前暴露（派彩會改變中獎總額和餘額）：queryKey 帶 revealedDrawAt，開獎動畫播完才重抓；
 *   動畫播放中（latestRevealed 為 false）打開頁面時不抓，沿用上一份
 * - 中獎榜到了 to（下次重置）自動重抓；自己下注、簽到成功後 invalidate ["leaderboard"]
 * - queryKey 帶帳號：mine 是登入者自己的名次
 */
export function useLeaderboard(board: Board, username: string | undefined, next: NextDraw | null) {
  const query = useQuery({
    queryKey: ["leaderboard", board, username, next?.revealedDrawAt ?? null],
    queryFn: () => fetchBoard(board),
    enabled: !!next?.latestRevealed,
    placeholderData: keepPreviousData,
  });
  const { refetch } = query;
  const to = query.data?.to;

  useEffect(() => {
    if (!to) return;
    const id = setTimeout(() => void refetch(), Math.max(0, Date.parse(to) - feedNow()) + 1000);
    return () => clearTimeout(id);
  }, [to, refetch]);

  return query;
}
