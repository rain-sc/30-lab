// 冷熱號碼（GET /api/draws/number-stats，不用登入）
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

type NumberStats = components["schemas"]["NumberStatsResponse"];

export type HotNumber = { number: number; count: number };
export type ColdNumber = { number: number; missed: number };
/** window：實際統計了最近幾期（已開獎的期數不夠時會比要求的少） */
export type HotCold = { hot: HotNumber[]; cold: ColdNumber[]; window: number };

/** 統計最近幾期 */
export const STATS_WINDOW = 100;

export function fetchNumberStats(window = STATS_WINDOW) {
  return api.get<NumberStats>("/draws/number-stats", { params: { window }, redirectOnUnauthorized: false });
}

/**
 * 後端的 maxNumber 個號碼統計 → 熱門 / 冷門的前 top 名
 * - 熱門：開出次數（正碼 + 特別號碼）最多
 * - 冷門：最久沒開出（missed，正碼或特別號碼都算開出）
 */
export function toHotCold(stats: NumberStats, top = 6): HotCold | null {
  if (stats.window === 0) return null;
  const all = stats.numbers.map((s) => ({ number: s.number, count: s.count + s.specialCount, missed: s.missed }));
  return {
    hot: [...all]
      .sort((a, b) => b.count - a.count || a.number - b.number)
      .slice(0, top)
      .map(({ number, count }) => ({ number, count })),
    cold: [...all]
      .sort((a, b) => b.missed - a.missed || a.number - b.number)
      .slice(0, top)
      .map(({ number, missed }) => ({ number, missed })),
    window: stats.window,
  };
}
