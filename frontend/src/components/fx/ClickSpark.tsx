"use client";

// 點擊火花：點下去時，從點擊位置迸出幾道金色火花
// 參考：React Bits「Click Spark」 https://reactbits.dev/animations/click-spark
// 改動：原版用 Canvas 畫（483 行），這裡用 8 個 span + CSS 動畫（globals.css 的 @keyframes spark），
//       動畫結束自動移除；reduced-motion 時不顯示。
import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const SPARK_COUNT = 8;
const DURATION_MS = 450;

type Burst = { id: number; x: number; y: number };

export function ClickSpark({ children, className }: { children: ReactNode; className?: string }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const burst = { id: nextId.current++, x: e.clientX - rect.left, y: e.clientY - rect.top };
    setBursts((list) => [...list, burst]);
    setTimeout(() => setBursts((list) => list.filter((b) => b.id !== burst.id)), DURATION_MS);
  };

  return (
    <div onPointerDownCapture={handlePointerDown} className={cn("relative", className)}>
      {children}
      {bursts.map((b) => (
        <span key={b.id} aria-hidden="true" className="pointer-events-none absolute" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: SPARK_COUNT }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 left-0 h-0.5 w-2.5 origin-left rounded-full bg-gold-bright"
              style={{
                ["--angle" as string]: `${(360 / SPARK_COUNT) * i}deg`,
                animation: `spark ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
              }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
