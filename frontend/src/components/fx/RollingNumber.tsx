"use client";

// 數字變化時從舊值滾到新值（積分扣款、派彩）
// 和 CountUp 的差別：CountUp 是進頁時從 0 累加；這個是值改變時才動，第一次顯示不動
// 直接改 DOM 的文字，不觸發 React 重新渲染；reduced-motion 時直接換成新值
import { animate, useReducedMotion } from "motion/react";
import { useFormatter } from "next-intl";
import { useLayoutEffect, useRef } from "react";

type RollingNumberProps = {
  value: number;
  /** 秒 */
  duration?: number;
  className?: string;
};

export function RollingNumber({ value, duration = 0.9, className }: RollingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = useFormatter();
  const reduced = useReducedMotion();
  /** 畫面上目前顯示的值（動畫中途被打斷時，從這裡接著滾） */
  const shown = useRef(value);
  const formatRef = useRef(format.number);
  useLayoutEffect(() => {
    formatRef.current = format.number;
  });

  // useLayoutEffect：React 已經把文字換成新值，在畫面更新前改回舊值再開始滾，不會閃一下
  useLayoutEffect(() => {
    const el = ref.current;
    const from = shown.current;
    if (!el || from === value) return;
    if (reduced) {
      shown.current = value;
      return;
    }
    el.textContent = formatRef.current(Math.round(from));
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = formatRef.current(Math.round(v));
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {format.number(value)}
    </span>
  );
}
