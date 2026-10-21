"use client";

// 下注、我的注單（要登入）
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Ticket = components["schemas"]["TicketResponse"];
export type LineResult = components["schemas"]["LineResult"];
/** 獎級：FIRST 頭獎 … SEVENTH 七獎（沒中獎時 LineResult.tier 不存在） */
export type Tier = NonNullable<LineResult["tier"]>;
export const TIERS: Tier[] = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"];
export type PlaceBetRequest = components["schemas"]["PlaceBetRequest"];
export type PlaceBetResponse = components["schemas"]["PlaceBetResponse"];
type TicketPage = components["schemas"]["PageResultTicketResponse"];

/** 每張注單最多幾注（後端上限，超過回 40002） */
export const MAX_LINES = 50;

/** 錯誤碼：注數超過上限、積分不足、這一期已截止 */
export const TOO_MANY_LINES = 40002;
export const INSUFFICIENT_POINTS = 40902;
export const BETTING_CLOSED = 40903;

/** 下注：一次送出 = 一張注單；idempotencyKey 相同的重送不會重複扣款 */
export function placeBet(body: PlaceBetRequest) {
  return api.post<PlaceBetResponse>("/tickets", body);
}

export function fetchTickets(page: number, size: number) {
  return api.get<TicketPage>("/tickets", { params: { page, size } });
}

/** 最近的注單（大廳的「本期已下注」、開獎通知共用同一份快取） */
export const RECENT_TICKETS = 50;
export const useRecentTickets = (username: string | undefined) => useTickets(username, 1, RECENT_TICKETS);

/** 我的注單（由新到舊）；下注成功後 invalidate ["tickets"] 重新抓 */
export function useTickets(username: string | undefined, page: number, size: number) {
  return useQuery({
    queryKey: ["tickets", username, page, size],
    queryFn: () => fetchTickets(page, size),
    enabled: !!username,
    placeholderData: keepPreviousData,
  });
}
