// 對獎（前端顯示用）：一注只中最高的一個獎級（見 docs/game-rules.md）
// 正式的中獎結果、獎金由後端結算模組決定；結算完成前，前端用開獎號碼先標出中了哪幾個、可能的獎級
import type { DrawResult } from "@/features/draw/mock";

export type PrizeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type LineResult = {
  /** 中了哪幾個正碼 */
  matched: number[];
  /** 是否中特別號碼 */
  special: boolean;
  tier: PrizeTier | null;
};

function tierOf(hits: number, special: boolean): PrizeTier | null {
  if (hits === 6) return 1;
  if (hits === 5) return special ? 2 : 3;
  if (hits === 4) return special ? 4 : 5;
  if (hits === 3) return special ? 6 : 7;
  return null;
}

/** 一注（6 個號碼）對開獎結果 */
export function checkLine(numbers: number[], result: DrawResult): LineResult {
  const matched = numbers.filter((n) => result.numbers.includes(n));
  const special = numbers.includes(result.special);
  return { matched, special, tier: tierOf(matched.length, special) };
}
