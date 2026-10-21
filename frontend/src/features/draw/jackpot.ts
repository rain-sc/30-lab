"use client";

// 頭獎彩池（不用登入）
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

type Jackpot = components["schemas"]["JackpotResponse"];

/** 別人下注也會讓彩池變大：定時重抓 */
const POLL_MS = 30_000;

/**
 * 目前這期的頭獎彩池（GET /api/jackpot，估計值）。
 * - 重抓時機：進頁面、收到上一期的 SETTLED（DrawFeed）、自己下注成功（usePlaceBets）、每 30 秒
 * - 不能在 OPENED 時抓（上一期還差約 1 秒才結算完，滾存是舊的）
 * - 回應的 drawNo 和目前這期不同時不使用（回傳 null）
 */
export function useJackpot(currentDrawNo: string | undefined): number | null {
  const { data } = useQuery({
    queryKey: ["jackpot"],
    queryFn: () => api.get<Jackpot>("/jackpot", { redirectOnUnauthorized: false }),
    refetchInterval: POLL_MS,
  });
  return data && data.drawNo === currentDrawNo ? data.amount : null;
}
