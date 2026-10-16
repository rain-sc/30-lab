import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 冷熱、開獎紀錄、我的注單等單一內容頁的外框：標題 + 內容
export function GamePage({ title, note, children, card = true }: { title: string; note?: ReactNode; children: ReactNode; card?: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-200 flex-col gap-4 px-4 py-4 md:px-10 md:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 animate-fade-up motion-reduce:animate-none">
        <h1 className="m-0 text-xl md:text-2xl">{title}</h1>
        {note && <span className="text-[13px] text-muted">{note}</span>}
      </div>
      <div
        className={cn(
          "animate-fade-up [animation-delay:80ms] motion-reduce:animate-none",
          card && "rounded-card border border-line bg-panel px-4 py-3 md:px-5.5 md:py-4.5",
        )}
      >
        {children}
      </div>
    </div>
  );
}
