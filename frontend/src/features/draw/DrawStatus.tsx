"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NextDraw } from "./useNextDraw";

// LIVE 標籤 + 期數 + 狀態（接受下注中 / 已截止）+ 示例數據
export function DrawStatus({ next, compact = false }: { next: NextDraw | null; compact?: boolean }) {
  const t = useTranslations("Live");

  return (
    <div className={cn("flex flex-wrap items-center", compact ? "gap-2" : "gap-2.5")}>
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-live/15 font-bold tracking-[0.08em] text-live-text",
          compact ? "gap-1.5 px-2 py-px text-[11px]" : "gap-2 px-3 py-1 text-[13px]",
        )}
      >
        {/* 紅點 + 往外擴散的雷達波紋 */}
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        LIVE
      </span>
      <span className={cn("font-bold", compact ? "text-xs text-muted" : "text-lg text-fg")}>
        {next ? t("drawNo", { drawNo: next.drawNo }) : " "}
      </span>
      {!compact && next && (
        <span className={cn("text-sm", next.closed ? "font-medium text-live-text" : "text-muted")}>
          {next.closed ? t("closedShort") : t("open")}
        </span>
      )}
      <span
        className={cn("rounded-md border border-line text-muted", compact ? "px-1.5 text-[11px]" : "px-2 py-0.5 text-xs")}
      >
        {t("sample")}
      </span>
    </div>
  );
}
