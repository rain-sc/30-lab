"use client";

import { RollingNumber } from "@/components/fx/RollingNumber";
import { useJackpot } from "./jackpot";
import { useNextDraw } from "./useNextDraw";

/** 頭獎彩池的數字：變大時從舊值滾到新值；還沒拿到（或還沒更新到目前這期）時顯示「—」 */
export function JackpotAmount({ className }: { className?: string }) {
  const next = useNextDraw();
  const amount = useJackpot(next?.drawNo);
  return <span className={className}>{amount === null ? "—" : <RollingNumber value={amount} duration={1.2} />}</span>;
}
