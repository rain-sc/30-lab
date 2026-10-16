// 開獎舞台的時間軸（從 docs/prototypes/draw-stage.html 搬過來）
// 動畫進度一律由「現在距離開獎時間過了多久」算出來，不依賴前端計時器：
// 重新整理、切換分頁回來時，已開出的球直接擺好，正在開的那顆接著播。
import { BETTING_CUTOFF_SECONDS } from "../rules";
import { INTERVAL_MS, nextDrawAt } from "../schedule";

/** 每顆球的動畫：彈出 → 飛到結果列 → 沿軌道滾到位置（毫秒） */
export const T = { interval: 3600, pop: 450, fly: 950, roll: 2000 } as const;
export const BALL_ANIM_MS = T.pop + T.fly + T.roll;
/** 7 顆球全部開完需要多久（開獎後 25 秒） */
export const REVEAL_MS = 6 * T.interval + BALL_ANIM_MS;

const CUTOFF_MS = BETTING_CUTOFF_SECONDS * 1000;

export type StagePhase =
  /** 可下注：球堆可以互動；結果列擺著上一期的 7 顆球 */
  | { kind: "idle"; drawAt: number }
  /** 已截止：吹氣攪珠，結果列清空 */
  | { kind: "mixing"; drawAt: number; remainMs: number }
  /** 開獎中：第 active 顆正在飛（t = 這顆已經播了幾毫秒），前 revealed 顆已經擺好 */
  | { kind: "drawing"; drawAt: number; revealed: number; active: { index: number; t: number } | null };

/**
 * 某個時間點的舞台階段。drawAt 是「結果列上那一期」的開獎時間（mixing 時是即將開獎的那一期）。
 * reduced：使用者關閉動畫時，開獎一到直接全部擺好。
 */
export function stagePhaseAt(now: number, reduced = false): StagePhase {
  const next = nextDrawAt(now);
  if (next - now <= CUTOFF_MS) return { kind: "mixing", drawAt: next, remainMs: next - now };

  const drawAt = next - INTERVAL_MS;
  const elapsed = reduced ? Infinity : now - drawAt;
  if (elapsed >= REVEAL_MS) return { kind: "idle", drawAt };

  let revealed = 0;
  let active: { index: number; t: number } | null = null;
  for (let i = 0; i < 7; i++) {
    const start = i * T.interval;
    if (elapsed >= start + BALL_ANIM_MS) revealed++;
    else if (elapsed >= start) active = { index: i, t: elapsed - start };
  }
  return { kind: "drawing", drawAt, revealed, active };
}

/** 這一期的結果什麼時候「公布」：動畫播完。中獎、積分、開獎紀錄都等到這個時間才更新，避免先劇透 */
export function revealedAt(drawAt: number) {
  return drawAt + REVEAL_MS;
}
