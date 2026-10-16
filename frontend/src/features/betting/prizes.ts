// 對獎：一注只中最高的一個獎級（見 docs/game-rules.md）
import { SAMPLE_POOL_PRIZES, type DrawResult } from "@/features/draw/mock";

export type PrizeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 四獎到七獎是固定獎金（暫定值，和後端設定一致） */
const FIXED_PRIZES = { 4: 9600, 5: 640, 6: 320, 7: 40 } as const;

export type TicketResult = {
  /** 中了哪幾個正碼 */
  matched: number[];
  /** 是否中特別號碼 */
  special: boolean;
  tier: PrizeTier | null;
  prize: number;
};

function tierOf(hits: number, special: boolean): PrizeTier | null {
  if (hits === 6) return 1;
  if (hits === 5) return special ? 2 : 3;
  if (hits === 4) return special ? 4 : 5;
  if (hits === 3) return special ? 6 : 7;
  return null;
}

export function checkTicket(numbers: number[], result: DrawResult): TicketResult {
  const matched = numbers.filter((n) => result.numbers.includes(n));
  const special = numbers.includes(result.special);
  const tier = tierOf(matched.length, special);
  const prize = tier === null ? 0 : tier <= 3 ? SAMPLE_POOL_PRIZES[tier as 1 | 2 | 3] : FIXED_PRIZES[tier as 4 | 5 | 6 | 7];
  return { matched, special, tier, prize };
}
