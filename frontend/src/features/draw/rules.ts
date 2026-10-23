"use client";

// 遊戲規則（GET /api/game/rules，不用登入）：數字全部來自後端設定，跟實際下注、派彩用的是同一份
// - 只在後端改設定、重啟時變動：進站抓一次、一直快取
// - 回應前先用 DEFAULT_RULES（和後端目前的預設設定一致），畫面不會空白；「玩法說明」頁要等真的資料
// - React 組件用 useGameRules()；選號 store 這類非 React 的程式碼用 currentRules()（讀最近一次拿到的）
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type GameRules = components["schemas"]["GameRulesResponse"];
export type PrizeRule = components["schemas"]["PrizeRule"];

/** 後端回應前的預設值（和 docs/game-rules.md、後端預設設定一致） */
export const DEFAULT_RULES: GameRules = {
  maxNumber: 30,
  pickCount: 6,
  pointsPerBet: 10,
  maxLinesPerTicket: 50,
  maxMultipleNumbers: 10,
  maxBankers: 5,
  maxBankerLines: 210,
  drawIntervalSeconds: 300,
  bettingCutoffSeconds: 15,
  totalCombinations: 593_775,
  prizes: [],
  jackpot: { floor: 200_000, ratePercent: 20 },
  signupBonus: 10_000,
  dailyBonus: 1_000,
};

let cached: GameRules = DEFAULT_RULES;

/** 最近一次拿到的規則（非 React 的程式碼用）；還沒拿到時是預設值 */
export const currentRules = () => cached;

async function fetchRules() {
  const rules = await api.get<GameRules>("/game/rules", { redirectOnUnauthorized: false });
  cached = rules;
  return rules;
}

/** 規則的查詢狀態（「玩法說明」頁要顯示載入中 / 錯誤） */
export function useGameRulesQuery() {
  return useQuery({ queryKey: ["game-rules"], queryFn: fetchRules, staleTime: Infinity, gcTime: Infinity });
}

/** 遊戲規則；還沒拿到時是預設值 */
export function useGameRules(): GameRules {
  return useGameRulesQuery().data ?? cached;
}
