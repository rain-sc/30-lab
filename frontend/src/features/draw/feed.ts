"use client";

// 期數資料（後端）：GET /api/draws/current + WebSocket /topic/draws
// - 全站一份（[locale]/layout 的 DrawFeed 啟動），大廳、舞台、登入頁的直播面板都從這裡讀
// - 時鐘：用回應的 serverTime 算出和本機的差距，倒數和開獎動畫都用校正後的時間（feedNow）
// - 推播可能晚到、可能補送過期的事件（後端重啟），所以不假設「收到的就是目前這期」：
//   所有收到的期數依 drawNo 存起來，「目前這期」= 開獎時間最晚的那期，「上一期」= 有號碼的期數裡最晚的那期
// - 收到的開獎號碼存在 localStorage：我的注單、開獎通知標出中了哪幾個（結算模組完成前由前端對）
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type Draw = components["schemas"]["DrawResponse"];
type CurrentDrawResponse = components["schemas"]["CurrentDrawResponse"];
export type DrawEvent = { type: "OPENED" | "CLOSED" | "DRAWN" | "SETTLED"; serverTime: string; draw: Draw };

/** 一期的開獎結果：numbers 是開出順序（沒有排序） */
export type DrawResult = { numbers: number[]; special: number; drawAt: number };

/** 最多記住幾期的開獎號碼 */
const MAX_RESULTS = 300;
/** 最多保留幾期的期數資料（只用來找目前 / 上一期） */
const MAX_DRAWS = 12;

type FeedState = {
  status: "loading" | "ready" | "error";
  /** 依 drawNo 存的期數 */
  draws: Record<string, Draw>;
  current: Draw | null;
  previous: Draw | null;
  /** 伺服器時間 − 本機時間（毫秒） */
  offset: number;
  results: Record<string, DrawResult>;
  setError: () => void;
  applyCurrent: (res: CurrentDrawResponse) => void;
  applyEvent: (event: DrawEvent) => void;
  /** 從開獎紀錄記下號碼（不影響目前 / 上一期） */
  addResults: (draws: Draw[]) => void;
  /** 已經用開獎紀錄查過、還是查不到號碼的期數（我的注單顯示「查不到」） */
  missing: Record<string, true>;
  setMissing: (drawNos: string[]) => void;
};

const at = (iso: string) => Date.parse(iso);
export const hasResult = (d: Draw | null | undefined): d is Draw & { numbers: number[]; specialNumber: number } =>
  !!d?.numbers && d.specialNumber !== undefined;

/** 加入期數，重新算出目前 / 上一期；同時記下開獎號碼 */
function merge(state: FeedState, incoming: Draw[], serverTime: string): Partial<FeedState> {
  const draws = { ...state.draws };
  const results = { ...state.results };
  for (const d of incoming) {
    const old = draws[d.drawNo];
    // 同一期收到兩次（例如 CLOSED 比 DRAWN 晚到）：保留比較完整的那份（有號碼的優先）
    draws[d.drawNo] = old && hasResult(old) && !hasResult(d) ? old : d;
    if (hasResult(d)) results[d.drawNo] = { numbers: d.numbers, special: d.specialNumber, drawAt: at(d.drawAt) };
  }
  const sorted = Object.values(draws).sort((a, b) => at(b.drawAt) - at(a.drawAt));
  const kept = Object.fromEntries(sorted.slice(0, MAX_DRAWS).map((d) => [d.drawNo, d]));
  const resultEntries = Object.entries(results);
  const keptResults =
    resultEntries.length > MAX_RESULTS
      ? Object.fromEntries(resultEntries.sort(([, a], [, b]) => b.drawAt - a.drawAt).slice(0, MAX_RESULTS))
      : results;
  return {
    status: "ready",
    draws: kept,
    current: sorted[0] ?? null,
    previous: sorted.find(hasResult) ?? null,
    offset: at(serverTime) - Date.now(),
    results: keptResults,
  };
}

export const useDrawFeed = create<FeedState>()(
  persist(
    (set) => ({
      status: "loading",
      draws: {},
      current: null,
      previous: null,
      offset: 0,
      results: {},
      setError: () => set((s) => (s.current ? {} : { status: "error" })),
      applyCurrent: (res) =>
        set((s) => merge(s, res.previous ? [res.current, res.previous] : [res.current], res.serverTime)),
      applyEvent: (event) => set((s) => merge(s, [event.draw], event.serverTime)),
      addResults: (list) =>
        set((s) => {
          const fresh = list.filter((d) => hasResult(d) && !s.results[d.drawNo]);
          if (fresh.length === 0) return {};
          const results = { ...s.results };
          for (const d of fresh) {
            if (hasResult(d)) results[d.drawNo] = { numbers: d.numbers, special: d.specialNumber, drawAt: at(d.drawAt) };
          }
          return { results };
        }),
      missing: {},
      setMissing: (drawNos) => set((s) => ({ missing: { ...s.missing, ...Object.fromEntries(drawNos.map((n) => [n, true as const])) } })),
    }),
    {
      name: "msl:draw-results",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ results }) => ({ results }),
      skipHydration: true,
    },
  ),
);

/** 校正過的現在時間（毫秒） */
export const feedNow = () => Date.now() + useDrawFeed.getState().offset;

/** 某一期的開獎結果；前端沒收到（開獎時不在線上）是 undefined */
export const useDrawResult = (drawNo: string | null | undefined) =>
  useDrawFeed((s) => (drawNo ? s.results[drawNo] : undefined));

/** 立刻重新抓一次目前期數（例如下注回 40903 已截止時）；失敗就算了，DrawFeed 會自己重試 */
export function reloadCurrentDraw() {
  return fetchCurrentDraw()
    .then((res) => useDrawFeed.getState().applyCurrent(res))
    .catch(() => {});
}

export function fetchCurrentDraw() {
  return api.get<CurrentDrawResponse>("/draws/current", { redirectOnUnauthorized: false });
}
