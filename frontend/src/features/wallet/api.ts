"use client";

// 錢包（要登入）
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Wallet = components["schemas"]["WalletResponse"];

export function fetchWallet() {
  return api.get<Wallet>("/wallet");
}

/** 積分餘額；還沒拿到時是 null */
export function useBalance(username: string | undefined): number | null {
  return useWallet(username).data?.balance ?? null;
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
