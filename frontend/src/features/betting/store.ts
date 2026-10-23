"use client";

// 選號盤和待下注列表（只存在前端的狀態）
// - 選號盤、待下注列表、冷熱號碼、手機的下注列分散在不同組件甚至不同頁面，所以放在共用的 store
// - 存在 sessionStorage：重新整理、換頁回來都還在；每個分頁各自一份（和「每個分頁各自登入」的規則一致）
// - skipHydration：伺服器端沒有 sessionStorage，等 hydrate 完才由 GameSessionGate 讀回來，避免 hydration 不一致
// - 三種玩法（設計稿：https://claude.ai/artifact/C9D57kEs3nEv8q4f8tjrXW）：
//   單式：選 pickCount 個 → 加入待下注（可以放很多注）→ 一次送出一張注單
//   複式、膽拖：一組選號就是一張注單，不經過待下注，直接確認下注；切換玩法時各玩法的選號、待下注都保留
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { currentRules, type GameRules } from "@/features/draw/rules";

export type PlayMode = "SINGLE" | "MULTIPLE" | "BANKER";
/** 膽拖：目前在選膽還是選拖 */
export type BankerStep = "banker" | "leg";
/** 冷熱號碼加號碼的結果 */
export type AddResult = { status: "added"; to: "pick" | BankerStep } | { status: "already" } | { status: "full" };

type BettingState = {
  mode: PlayMode;
  /** 單式選號盤目前選的號碼（依點選順序） */
  picked: number[];
  /** 複式選的號碼 */
  multi: number[];
  /** 膽拖：膽、拖 */
  bankers: number[];
  legs: number[];
  step: BankerStep;
  /** 待下注的單式，每注 pickCount 個號碼（由小到大） */
  pending: number[][];
  setMode: (mode: PlayMode) => void;
  setStep: (step: BankerStep) => void;
  /** 點選號盤上的號碼：依目前的玩法（膽拖依目前的步驟）選取或取消 */
  toggle: (n: number) => void;
  /** 加一個號碼（冷熱號碼用）：只加不取消 */
  add: (n: number) => AddResult;
  /** 隨機選號：單式 pickCount 個、複式 pickCount + 1 個（最少的複式）、膽拖 1 膽 pickCount 拖 */
  quickPick: () => void;
  /** 清除目前玩法的選號 */
  clear: () => void;
  /** 選滿時加入待下注（最多 maxLinesPerTicket 注，和後端每張注單的上限一致） */
  addToPending: () => void;
  removePending: (index: number) => void;
  clearPending: () => void;
  /** 下注成功後清掉送出的那一組 */
  clearSubmitted: (mode: PlayMode) => void;
};

/** 用 crypto 亂數選 count 個不重複的號碼 */
function randomNumbers(count: number): number[] {
  const pool = Array.from({ length: currentRules().maxNumber }, (_, i) => i + 1);
  const buf = new Uint32Array(1);
  return Array.from({ length: Math.min(count, pool.length) }, () => {
    crypto.getRandomValues(buf);
    return pool.splice(buf[0] % pool.length, 1)[0];
  });
}

const without = (list: number[], n: number) => list.filter((x) => x !== n);

export const useBetting = create<BettingState>()(
  persist(
    (set, get) => ({
      mode: "SINGLE",
      picked: [],
      multi: [],
      bankers: [],
      legs: [],
      step: "banker",
      pending: [],
      setMode: (mode) => set({ mode }),
      setStep: (step) => set({ step }),
      toggle: (n) => {
        const s = get();
        const rules = currentRules();
        if (s.mode === "SINGLE") {
          if (s.picked.includes(n)) set({ picked: without(s.picked, n) });
          else if (s.picked.length < rules.pickCount) set({ picked: [...s.picked, n] });
        } else if (s.mode === "MULTIPLE") {
          if (s.multi.includes(n)) set({ multi: without(s.multi, n) });
          else if (s.multi.length < rules.maxMultipleNumbers) set({ multi: [...s.multi, n] });
        } else if (s.step === "banker") {
          // 選膽：已經是拖的號碼改成膽
          if (s.bankers.includes(n)) set({ bankers: without(s.bankers, n) });
          else if (s.bankers.length < rules.maxBankers) set({ bankers: [...s.bankers, n], legs: without(s.legs, n) });
        } else {
          if (s.legs.includes(n)) set({ legs: without(s.legs, n) });
          else set({ legs: [...s.legs, n], bankers: without(s.bankers, n) });
        }
      },
      add: (n) => {
        const s = get();
        const rules = currentRules();
        if (s.mode === "SINGLE") {
          if (s.picked.includes(n)) return { status: "already" };
          if (s.picked.length >= rules.pickCount) return { status: "full" };
          set({ picked: [...s.picked, n] });
          return { status: "added", to: "pick" };
        }
        if (s.mode === "MULTIPLE") {
          if (s.multi.includes(n)) return { status: "already" };
          if (s.multi.length >= rules.maxMultipleNumbers) return { status: "full" };
          set({ multi: [...s.multi, n] });
          return { status: "added", to: "pick" };
        }
        if (s.bankers.includes(n) || s.legs.includes(n)) return { status: "already" };
        if (s.step === "banker") {
          if (s.bankers.length >= rules.maxBankers) return { status: "full" };
          set({ bankers: [...s.bankers, n] });
          return { status: "added", to: "banker" };
        }
        set({ legs: [...s.legs, n] });
        return { status: "added", to: "leg" };
      },
      quickPick: () => {
        const { mode } = get();
        const { pickCount } = currentRules();
        if (mode === "SINGLE") set({ picked: randomNumbers(pickCount) });
        else if (mode === "MULTIPLE") set({ multi: randomNumbers(pickCount + 1) });
        else {
          const [banker, ...legs] = randomNumbers(pickCount + 1);
          set({ bankers: [banker], legs, step: "leg" });
        }
      },
      clear: () => {
        const { mode } = get();
        if (mode === "SINGLE") set({ picked: [] });
        else if (mode === "MULTIPLE") set({ multi: [] });
        else set({ bankers: [], legs: [], step: "banker" });
      },
      addToPending: () =>
        set(({ picked, pending }) =>
          picked.length === currentRules().pickCount && pending.length < currentRules().maxLinesPerTicket
            ? { picked: [], pending: [...pending, [...picked].sort((a, b) => a - b)] }
            : {},
        ),
      removePending: (index) => set(({ pending }) => ({ pending: pending.filter((_, i) => i !== index) })),
      clearPending: () => set({ pending: [] }),
      clearSubmitted: (mode) => {
        if (mode === "SINGLE") set({ pending: [] });
        else if (mode === "MULTIPLE") set({ multi: [] });
        else set({ bankers: [], legs: [], step: "banker" });
      },
    }),
    {
      name: "tl:betting",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ mode, picked, multi, bankers, legs, step, pending }) => ({ mode, picked, multi, bankers, legs, step, pending }),
      skipHydration: true,
    },
  ),
);

// ---------- 注數、能不能送出 ----------

/** 組合數 C(n, k) */
export function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** 還不能送出的原因（翻譯 key + 參數）；null = 可以送出 */
export type SelectionProblem =
  | { key: "pendingEmpty" }
  | { key: "multiTooFew"; need: number; min: number; max: number }
  | { key: "needBanker"; max: number }
  | { key: "legsTooFew"; need: number; min: number }
  | { key: "tooManyLines"; max: number; count: number };

export type Selection = {
  mode: PlayMode;
  /** 展開後幾注 */
  lines: number;
  problem: SelectionProblem | null;
};

/** 目前玩法要送出的那一組：幾注、能不能送出 */
export function summarize(s: Pick<BettingState, "mode" | "multi" | "bankers" | "legs" | "pending">, rules: GameRules): Selection {
  const min = rules.pickCount + 1; // 複式、膽拖至少比一注多一個號碼
  if (s.mode === "MULTIPLE") {
    const n = s.multi.length;
    const lines = n >= min ? choose(n, rules.pickCount) : 0;
    return { mode: s.mode, lines, problem: n < min ? { key: "multiTooFew", need: min - n, min, max: rules.maxMultipleNumbers } : null };
  }
  if (s.mode === "BANKER") {
    const k = s.bankers.length;
    const m = s.legs.length;
    const lines = k >= 1 && k + m >= min ? choose(m, rules.pickCount - k) : 0;
    const problem: SelectionProblem | null =
      k === 0
        ? { key: "needBanker", max: rules.maxBankers }
        : k + m < min
          ? { key: "legsTooFew", need: min - k - m, min }
          : lines > rules.maxBankerLines
            ? { key: "tooManyLines", max: rules.maxBankerLines, count: lines }
            : null;
    return { mode: s.mode, lines, problem };
  }
  return { mode: s.mode, lines: s.pending.length, problem: s.pending.length === 0 ? { key: "pendingEmpty" } : null };
}
