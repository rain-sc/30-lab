// 開獎舞台的時間軸（從 docs/prototypes/draw-stage.html 搬過來）
// 動畫進度一律由「現在距離開獎時間過了多久」算出來，不依賴前端計時器：
// 重新整理、切換分頁回來時，已開出的球直接擺好，正在開的那顆接著播。
// 期數和號碼來自後端（feed.ts 的 current / previous）
import { hasResult, type Draw } from "../feed";

/** 每顆球的動畫：彈出 → 飛到結果列 → 沿軌道滾到位置（毫秒） */
export const T = { interval: 3600, pop: 450, fly: 950, roll: 2000 } as const;
export const BALL_ANIM_MS = T.pop + T.fly + T.roll;
/** 7 顆球全部開完需要多久（開獎後 25 秒） */
export const REVEAL_MS = 6 * T.interval + BALL_ANIM_MS;
/** 新的一期開始後，等上一期的號碼最多等多久（推播晚到時繼續攪珠）；超過就放棄，顯示更早那期 */
const WAIT_RESULT_MS = 60_000;

export type StagePhase =
  /** 可下注：球堆可以互動；結果列擺著上一期的 7 顆球（numbers 是 null：還沒開過獎，結果列空著） */
  | { kind: "idle"; drawAt: number; numbers: number[] | null }
  /** 已截止、或開獎了但號碼還沒收到：吹氣攪珠，結果列清空 */
  | { kind: "mixing"; drawAt: number; remainMs: number }
  /** 開獎中：第 active 顆正在飛（t = 這顆已經播了幾毫秒），前 revealed 顆已經擺好 */
  | {
      kind: "drawing";
      drawAt: number;
      /** 7 個號碼，依開出順序（最後一個是特別號碼） */
      numbers: number[];
      revealed: number;
      active: { index: number; t: number } | null;
    };

export type StageInput = { current: Draw | null; previous: Draw | null };

const sevenOf = (d: Draw & { numbers: number[]; specialNumber: number }) => [...d.numbers, d.specialNumber];

/**
 * 某個時間點的舞台階段。
 * reduced：使用者關閉動畫時，開獎一到直接全部擺好。
 */
export function stagePhaseAt(now: number, { current, previous }: StageInput, reduced = false): StagePhase {
  if (!current) return { kind: "idle", drawAt: 0, numbers: null };
  const openAt = Date.parse(current.openAt);
  const drawAt = Date.parse(current.drawAt);

  // 目前這期已截止（或過了開獎時間還沒收到號碼）→ 攪珠等開獎
  if (!hasResult(current) && now >= Date.parse(current.closeAt)) {
    return { kind: "mixing", drawAt, remainMs: Math.max(0, drawAt - now) };
  }

  // 結果列要擺的那期：目前這期剛開完（DRAWN 比下一期的 OPENED 早到），否則是上一期
  const shown = hasResult(current) ? current : previous;
  // 新的一期開始了，但上一期的號碼還沒收到（推播晚到）→ 繼續攪珠等
  const waiting = !hasResult(current) && (!shown || Date.parse(shown.drawAt) < openAt) && now < openAt + WAIT_RESULT_MS;
  if (waiting) return { kind: "mixing", drawAt: openAt, remainMs: 0 };
  if (!shown || !hasResult(shown)) return { kind: "idle", drawAt: 0, numbers: null };

  const shownAt = Date.parse(shown.drawAt);
  const numbers = sevenOf(shown);
  const elapsed = reduced ? Infinity : now - shownAt;
  if (elapsed >= REVEAL_MS) return { kind: "idle", drawAt: shownAt, numbers };

  let revealed = 0;
  let active: { index: number; t: number } | null = null;
  for (let i = 0; i < 7; i++) {
    const start = i * T.interval;
    if (elapsed >= start + BALL_ANIM_MS) revealed++;
    else if (elapsed >= start) active = { index: i, t: elapsed - start };
  }
  return { kind: "drawing", drawAt: shownAt, numbers, revealed, active };
}

/** 這一期的結果什麼時候「公布」：動畫播完。中獎、積分、開獎紀錄都等到這個時間才更新，避免先劇透 */
export function revealedAt(drawAt: number) {
  return drawAt + REVEAL_MS;
}
