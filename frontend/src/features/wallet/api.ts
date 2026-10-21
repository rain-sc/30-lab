"use client";

// 錢包（要登入）
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRecentTickets } from "@/features/betting/api";
import { drawAtOf } from "@/features/draw/schedule";
import { revealedAt } from "@/features/draw/stage/timeline";
import { useNow } from "@/features/draw/useNextDraw";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Wallet = components["schemas"]["WalletResponse"];

export function fetchWallet() {
  return api.get<Wallet>("/wallet");
}

/**
 * 畫面上顯示的積分；還沒拿到時是 null。
 * 派彩在開獎後約 1 秒就完成（SETTLED），比開獎動畫早 20 幾秒：
 * 顯示的積分 = 錢包餘額 − 還沒播完開獎動畫的那幾期的獎金，動畫播完的那一刻才滾上去，不會比舞台先劇透
 */
export function useBalance(username: string | undefined): number | null {
  const wallet = useWallet(username).data;
  const tickets = useRecentTickets(username).data?.list;
  const now = useNow();
  if (!wallet) return null;
  const unrevealed = (tickets ?? [])
    .filter((ticket) => ticket.payout > 0 && (now === null || revealedAt(drawAtOf(ticket.drawNo)) > now))
    .reduce((sum, ticket) => sum + ticket.payout, 0);
  return wallet.balance - unrevealed;
}

/**
 * 我的積分餘額（GET /api/wallet）。
 * queryKey 帶帳號：換帳號登入時不會讀到上一個帳號的快取。
 * 下注成功時直接用回應的 balance 更新快取（setQueryData）；派彩後 invalidate ["wallet"] 重新抓
 */
export function useWallet(username: string | undefined) {
  return useQuery({
    queryKey: ["wallet", username],
    queryFn: fetchWallet,
    enabled: !!username,
  });
}

export type WalletTransaction = components["schemas"]["WalletTransactionResponse"];
type TransactionPage = components["schemas"]["PageResultWalletTransactionResponse"];

/** 積分紀錄（由新到舊）：註冊贈送、下注、派彩；下注成功後 invalidate ["wallet-transactions"] */
export function useWalletTransactions(username: string | undefined, page: number, size: number) {
  return useQuery({
    queryKey: ["wallet-transactions", username, page, size],
    queryFn: () => api.get<TransactionPage>("/wallet/transactions", { params: { page, size } }),
    enabled: !!username,
    placeholderData: keepPreviousData,
  });
}
