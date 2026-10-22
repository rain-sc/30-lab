"use client";

// 選號盤和待下注列表（只存在前端的狀態）
// - 選號盤、待下注列表、冷熱號碼、手機的下注列分散在不同組件甚至不同頁面，所以放在共用的 store
// - 存在 sessionStorage：重新整理、換頁回來都還在；每個分頁各自一份（和「每個分頁各自登入」的規則一致）
// - skipHydration：伺服器端沒有 sessionStorage，等 hydrate 完才由 GameSessionGate 讀回來，避免 hydration 不一致
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { currentRules } from "@/features/draw/rules";

type BettingState = {
  /** 選號盤目前選的號碼（依點選順序） */
  picked: number[];
  /** 待下注的注單，每注 6 個號碼（由小到大） */
  pending: number[][];
  toggle: (n: number) => void;
  /** 加一個號碼（冷熱號碼用）；已選或選滿就不動，回傳是否加入 */
  add: (n: number) => boolean;
  quickPick: () => void;
  clear: () => void;
  /** 選滿時加入待下注（最多 maxLinesPerTicket 注，和後端每張注單的上限一致） */
  addToPending: () => void;
  removePending: (index: number) => void;
  clearPending: () => void;
};

/** 用 crypto 亂數機選 pickCount 個不重複的號碼 */
function randomPick(): number[] {
  const { maxNumber, pickCount } = currentRules();
  const pool = Array.from({ length: maxNumber }, (_, i) => i + 1);
  const buf = new Uint32Array(1);
  return Array.from({ length: pickCount }, () => {
    crypto.getRandomValues(buf);
    return pool.splice(buf[0] % pool.length, 1)[0];
  });
}

export const useBetting = create<BettingState>()(
  persist(
    (set, get) => ({
      picked: [],
      pending: [],
      toggle: (n) =>
        set(({ picked }) =>
          picked.includes(n)
            ? { picked: picked.filter((x) => x !== n) }
            : picked.length < currentRules().pickCount
              ? { picked: [...picked, n] }
              : {},
        ),
      add: (n) => {
        const { picked } = get();
        if (picked.includes(n) || picked.length >= currentRules().pickCount) return false;
        set({ picked: [...picked, n] });
        return true;
      },
      quickPick: () => set({ picked: randomPick() }),
      clear: () => set({ picked: [] }),
      addToPending: () =>
        set(({ picked, pending }) =>
          picked.length === currentRules().pickCount && pending.length < currentRules().maxLinesPerTicket
            ? { picked: [], pending: [...pending, [...picked].sort((a, b) => a - b)] }
            : {},
        ),
      removePending: (index) => set(({ pending }) => ({ pending: pending.filter((_, i) => i !== index) })),
      clearPending: () => set({ pending: [] }),
    }),
    {
      name: "msl:betting",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ picked, pending }) => ({ picked, pending }),
      skipHydration: true,
    },
  ),
);
