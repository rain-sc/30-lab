"use client";

// 【示例資料】後端還沒有下注、錢包 API：下注記錄存在瀏覽器的 localStorage，依帳號分開。
// 積分餘額不另外存，由注單算出來（起始積分 − 下注花費 + 已開獎的獎金），不會有「扣了錢但沒注單」的不一致。
// 接上 API 後刪掉這個檔案，改用 TanStack Query 讀後端的注單和餘額。
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SAMPLE_INITIAL_POINTS, sampleResultFor } from "@/features/draw/mock";
import { POINTS_PER_BET } from "@/features/draw/rules";
import { checkTicket, type TicketResult } from "./prizes";

export type PlacedBet = {
  id: string;
  drawNo: string;
  /** 開獎時間（毫秒），過了就能對獎 */
  drawAt: number;
  numbers: number[];
  placedAt: number;
};

/** 每個帳號最多保留幾筆（localStorage 有容量上限） */
const MAX_BETS = 500;

type MockBetsState = {
  byUser: Record<string, PlacedBet[]>;
  place: (username: string, tickets: number[][], drawNo: string, drawAt: number) => void;
};

export const useMockBets = create<MockBetsState>()(
  persist(
    (set) => ({
      byUser: {},
      place: (username, tickets, drawNo, drawAt) =>
        set(({ byUser }) => {
          const placedAt = Date.now();
          const added = tickets.map((numbers) => ({ id: crypto.randomUUID(), drawNo, drawAt, numbers, placedAt }));
          return { byUser: { ...byUser, [username]: [...added, ...(byUser[username] ?? [])].slice(0, MAX_BETS) } };
        }),
    }),
    { name: "msl:mock-bets", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

const EMPTY: PlacedBet[] = [];

/** 這個帳號的注單，新的在前 */
export function useUserBets(username: string | undefined): PlacedBet[] {
  return useMockBets((s) => (username ? (s.byUser[username] ?? EMPTY) : EMPTY));
}

export type SettledBet = PlacedBet & { result: TicketResult | null };

/** 注單加上對獎結果：開獎時間還沒到的 result 是 null（待開獎） */
export function settle(bets: PlacedBet[], now: number): SettledBet[] {
  return bets.map((bet) => ({
    ...bet,
    result: bet.drawAt <= now ? checkTicket(bet.numbers, sampleResultFor(bet.drawNo)) : null,
  }));
}

/** 示例積分餘額；now 是 null（hydrate 前）時回傳 null */
export function useBalance(username: string | undefined, now: number | null): number | null {
  const bets = useUserBets(username);
  return useMemo(() => {
    if (now === null || !username) return null;
    const spent = bets.length * POINTS_PER_BET;
    const won = settle(bets, now).reduce((sum, b) => sum + (b.result?.prize ?? 0), 0);
    return SAMPLE_INITIAL_POINTS - spent + won;
  }, [bets, now, username]);
}
