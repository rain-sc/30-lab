"use client";

// 排行榜（不用登入；有登入會多回傳自己的名次 mine）
import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { feedNow } from "@/features/draw/feed";
import type { NextDraw } from "@/features/draw/useNextDraw";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Leaderboard = components["schemas"]["LeaderboardResponse"];
export type LeaderboardEntry = components["schemas"]["LeaderboardEntry"];
export type Period = Leaderboard["period"];

/** 前幾名（後端固定回傳前 20 名） */
export const TOP_N = 20;

/**
 * 排行榜（GET /api/leaderboard?period=DAY|WEEK）。
 * - 跟中獎結果一樣不能提前暴露：queryKey 帶 revealedDrawAt，開獎動畫播完才重抓；
 *   動畫播放中（latestRevealed 為 false）打開頁面時不抓，沿用上一份
 * - 到了 to（下次重置）自動重抓
 * - queryKey 帶帳號：mine 是登入者自己的名次
 */
export function useLeaderboard(period: Period, username: string | undefined, next: NextDraw | null) {
  const query = useQuery({
    queryKey: ["leaderboard", period, username, next?.revealedDrawAt ?? null],
    queryFn: () => api.get<Leaderboard>("/leaderboard", { params: { period }, redirectOnUnauthorized: false }),
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
