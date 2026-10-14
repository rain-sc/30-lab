"use client";

// 數字累加：進頁時從 0 快速累加到目標值
// 參考：React Bits「Count Up」 https://reactbits.dev/text-animations/count-up
// 改動：數字格式改用 next-intl（原版寫死 en-US）；reduced-motion 時直接顯示目標值；
//       伺服器渲染的 HTML 就是最終數字（沒有 JS 也看得到），掛載後才從 0 開始跑
import { animate, useReducedMotion } from "motion/react";
import { useFormatter } from "next-intl";
import { useLayoutEffect, useRef } from "react";

type CountUpProps = {
  to: number;
  /** 秒 */
  duration?: number;
  /** 秒 */
  delay?: number;
  className?: string;
};

export function CountUp({ to, duration = 1.6, delay = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = useFormatter();
  const reduced = useReducedMotion();

  // useLayoutEffect：在瀏覽器畫出第一格前就把數字歸零，不會先閃一下最終數字
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    el.textContent = format.number(0);
    const controls = animate(0, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1], // 先快後慢
      onUpdate: (v) => {
        el.textContent = format.number(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [to, duration, delay, reduced, format]);

  return (
    <span ref={ref} className={className}>
      {format.number(to)}
    </span>
  );
}
