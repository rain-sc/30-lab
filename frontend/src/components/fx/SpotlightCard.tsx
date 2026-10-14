"use client";

// 卡片游標聚光燈：滑鼠在卡片上移動時，一道柔和的金色光暈跟著游標
// 參考：React Bits「Spotlight Card」 https://reactbits.dev/components/spotlight-card
// 改動：原版 340 行，這裡只保留核心效果——用 CSS 變數記錄游標位置，徑向漸層跟著走，
//       不觸發 React 重新渲染。觸控裝置沒有 hover，不會出現；reduced-motion 時關閉。
import { useRef, type ComponentProps, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({ className, children, ...props }: ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <section
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("group/spot relative isolate overflow-hidden", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(420px_circle_at_var(--spot-x)_var(--spot-y),color-mix(in_srgb,var(--color-gold)_9%,transparent),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 motion-reduce:hidden"
      />
      {children}
    </section>
  );
}
