"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * 積分變化時在旁邊浮出「+40」「−20」，往上飄後消失（派彩金色、扣款灰色）。
 * 第一次拿到餘額（null → 數字）不顯示。放在 relative 的父層裡。
 */
export function BalanceDelta({ balance, className }: { balance: number | null; className?: string }) {
  const format = useFormatter();
  const [prev, setPrev] = useState(balance);
  const [delta, setDelta] = useState<{ id: number; value: number } | null>(null);

  // 「在渲染時比較前一次的值」：React 文件建議的做法，不用 effect
  if (balance !== prev) {
    setPrev(balance);
    if (prev !== null && balance !== null) setDelta((d) => ({ id: (d?.id ?? 0) + 1, value: balance - prev }));
  }

  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute", className)}>
      <AnimatePresence>
        {delta && (
          <motion.span
            key={delta.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: [0, 1, 1, 0], y: -22 }}
            transition={{ duration: 1.8, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
            onAnimationComplete={() => setDelta((d) => (d?.id === delta.id ? null : d))}
            className={cn(
              "absolute right-0 bottom-0 font-num text-base font-bold whitespace-nowrap tabular-nums",
              delta.value > 0 ? "text-gold-bright" : "text-muted",
            )}
          >
            {delta.value > 0 ? "+" : "−"}
            {format.number(Math.abs(delta.value))}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
