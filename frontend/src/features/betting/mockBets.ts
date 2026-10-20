"use client";

// 【示例資料】後端還沒有下注 API：下注記錄存在瀏覽器的 localStorage，依帳號分開。
// 積分 = 後端錢包的餘額（GET /api/wallet）+ 示例注單的增減（− 下注花費 + 已開獎的獎金）。
// 下注 API 完成後刪掉這個檔案，注單改用 TanStack Query 讀後端，積分直接用錢包餘額。
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useDrawFeed, type DrawResult } from "@/features/draw/feed";
import { POINTS_PER_BET } from "@/features/draw/rules";
import { revealedAt } from "@/features/draw/stage/timeline";
import { useWallet } from "@/features/wallet/api";
import { checkTicket, type TicketResult } from "./prizes";

export type PlacedBet = {
  id: string;
  drawNo: string;
  /** 開獎時間（毫秒，後端的 drawAt）；開獎動畫播完（revealedAt）才對獎 */
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

/**
 * - waiting：還沒開獎、或開獎動畫還沒播完（中獎和積分等動畫結束才出現）
 * - unconfirmed：開獎時不在線上，前端沒收到真實號碼；等開獎紀錄 API 完成後才能補上，獎金先不算
 * - settled：已對獎（result 有值）
 */
export type SettledBet = PlacedBet & { status: "waiting" | "unconfirmed" | "settled"; result: TicketResult | null };

/** 注單加上對獎結果；results 是收到過的真實開獎結果（feed.ts） */
export function settle(bets: PlacedBet[], now: number, results: Record<string, DrawResult>): SettledBet[] {
  return bets.map((bet) => {
    if (revealedAt(bet.drawAt) > now) return { ...bet, status: "waiting", result: null };
    const real = results[bet.drawNo];
    if (!real) return { ...bet, status: "unconfirmed", result: null };
    return { ...bet, status: "settled", result: checkTicket(bet.numbers, { numbers: real.numbers, special: real.special }) };
  });
}

/**
 * 積分餘額 = 後端錢包餘額 + 示例注單的增減（下注 API 完成前）。
 * 錢包還沒拿到、或 now 是 null（hydrate 前）時回傳 null
 */
export function useBalance(username: string | undefined, now: number | null): number | null {
  const bets = useUserBets(username);
  const results = useDrawFeed((s) => s.results);
  const wallet = useWallet(username).data;
  return useMemo(() => {
    if (now === null || !username || !wallet) return null;
    const spent = bets.length * POINTS_PER_BET;
    const won = settle(bets, now, results).reduce((sum, b) => sum + (b.result?.prize ?? 0), 0);
    return wallet.balance - spent + won;
  }, [bets, now, username, results, wallet]);
}
