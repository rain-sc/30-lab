"use client";

// 錢包（要登入）
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Wallet = components["schemas"]["WalletResponse"];

export function fetchWallet() {
  return api.get<Wallet>("/wallet");
}

/**
 * 我的積分餘額（GET /api/wallet）。
 * queryKey 帶帳號：換帳號登入時不會讀到上一個帳號的快取。
 * 下注、派彩 API 完成後，在那些操作成功後 invalidate ["wallet"] 重新抓
 */
export function useWallet(username: string | undefined) {
  return useQuery({
    queryKey: ["wallet", username],
    queryFn: fetchWallet,
    enabled: !!username,
  });
}
