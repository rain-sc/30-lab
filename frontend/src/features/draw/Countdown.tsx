"use client";

import { useTranslations } from "next-intl";
import { RollingDigits } from "@/components/fx/RollingDigits";
import { cn } from "@/lib/utils";
import type { NextDraw } from "./useNextDraw";

const pad = (n: number) => String(n).padStart(2, "0");

/** 大字倒數：每秒滾動；截止後變紅並輕微脈動 */
export function CountdownDigits({ next, className }: { next: NextDraw | null; className?: string }) {
  const t = useTranslations("Live");
  const minutes = next ? pad(Math.floor(next.remainingSeconds / 60)) : "--";
  const seconds = next ? pad(next.remainingSeconds % 60) : "--";

  return (
    <span
      role="timer"
      aria-label={t("countdownLabel", { minutes, seconds })}
      className={cn(
        "origin-left font-num leading-[0.9] font-extrabold tabular-nums transition-colors duration-500",
        next?.closed && "animate-beat text-live-text motion-reduce:animate-none",
        className,
      )}
    >
      <RollingDigits
        value={`${minutes}:${seconds}`}
        renderSeparator={(c) => <span className={next?.closed ? undefined : "text-gold"}>{c}</span>}
      />
    </span>
  );
}

/** 這一期的進度條：金色是已經過的時間，紅色刻度是截止下注（用這一期實際的開放 / 截止 / 開獎時間算） */
export function DrawProgress({
  next,
  showLabels = true,
  labelsClassName,
}: {
  next: NextDraw | null;
  showLabels?: boolean;
  /** 說明文字（接受下注中 / 截止時間）的 class，例如只在寬螢幕顯示 */
  labelsClassName?: string;
}) {
  const t = useTranslations("Live");

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="relative h-1.5 rounded-full bg-sunken">
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", next?.closed ? "bg-live" : "bg-gold")}
          style={{ width: `${(next?.progress ?? 0) * 100}%` }}
        />
        {next && <span className="absolute -top-1 h-3.5 w-0.5 bg-live-text" style={{ left: `${next.cutoffProgress * 100}%` }} />}
      </div>
      {showLabels && (
        <div className={cn("flex justify-between text-xs text-muted", labelsClassName)}>
          <span>{t("open")}</span>
          {next && <span>{t("cutoffAt", { seconds: next.cutoffSeconds })}</span>}
        </div>
      )}
    </div>
  );
}
