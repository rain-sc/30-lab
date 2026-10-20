"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query：後端來的資料（開獎紀錄…）由它快取、重抓；只存在前端的狀態放 Zustand。
 * - staleTime 30 秒：切頁回來不會馬上重抓；需要更新的資料靠 queryKey 變化（例如新的一期公布）
 * - 錯誤只重試 1 次：axios 已經有 10 秒逾時，畫面負責顯示錯誤和重試按鈕
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
