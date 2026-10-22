"use client";

// 每日簽到（要登入）：每個 UTC 日可以領一次
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { feedNow } from "@/features/draw/feed";
import { api, ApiError } from "@/lib/api/client";
import type { components } from "@/types/api";
import type { Wallet } from "./api";

type DailyBonus = components["schemas"]["DailyBonusResponse"];
type ClaimDailyBonus = components["schemas"]["ClaimDailyBonusResponse"];

/** 今天已經簽到過了：當成「已簽到」狀態，不當錯誤提示 */
export const ALREADY_CLAIMED = 40904;

/**
 * 今天簽到了沒（GET /api/wallet/daily-bonus）。
 * 過了 nextResetAt（下一個 UTC 00:00）自動重抓：停在頁面上跨日後，簽到按鈕才會恢復
 */
export function useDailyBonus(username: string | undefined) {
  const query = useQuery({
    queryKey: ["daily-bonus", username],
    queryFn: () => api.get<DailyBonus>("/wallet/daily-bonus"),
    enabled: !!username,
  });
  const { refetch } = query;
  const resetAt = query.data?.nextResetAt;

  useEffect(() => {
    if (!resetAt) return;
    // 多等 1 秒，確定後端已經跨日
    const id = setTimeout(() => void refetch(), Math.max(0, Date.parse(resetAt) - feedNow()) + 1000);
    return () => clearTimeout(id);
  }, [resetAt, refetch]);

  return query;
}

/**
 * 簽到（POST /api/wallet/daily-bonus）：成功用回應的 balance 更新積分（數字滾動照舊）；
 * 40904（今天已經簽到過了，例如別的分頁先簽了）→ 重新抓簽到狀態和積分，畫面變成「已簽到」
 */
export function useClaimDailyBonus(username: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ClaimDailyBonus>("/wallet/daily-bonus"),
    onSuccess: (res) => {
      queryClient.setQueryData<Wallet>(["wallet", username], { balance: res.balance });
      queryClient.setQueryData<DailyBonus>(["daily-bonus", username], {
        claimed: true,
        amount: res.amount,
        nextResetAt: res.nextResetAt,
      });
      void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === ALREADY_CLAIMED) {
        void queryClient.invalidateQueries({ queryKey: ["daily-bonus"] });
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
        void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      }
    },
  });
}
