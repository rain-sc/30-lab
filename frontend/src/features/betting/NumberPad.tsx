"use client";

import { useTranslations } from "next-intl";
import { ballColor } from "@/lib/ball";
import { cn } from "@/lib/utils";
import { useGameRules } from "@/features/draw/rules";
import { Link } from "@/i18n/navigation";
import { useBetting } from "./store";

const RING: Record<ReturnType<typeof ballColor>, string> = {
  red: "border-ball-red",
  blue: "border-ball-blue",
  green: "border-ball-green",
};
const FILL: Record<ReturnType<typeof ballColor>, string> = {
  red: "bg-ball-red",
  blue: "bg-ball-blue",
  green: "bg-ball-green",
};


/**
 * 選號盤：1–maxNumber 選 pickCount 個（數字都從 GET /api/game/rules 讀）。號碼 ≤ 36 排 6 欄（30 = 6 × 5），更多排 7 欄（49 = 7 × 7）。沒選的是波色外框，選了填滿波色並加金色外圈；選滿後其他號碼變淡。
 * hot：熱門號碼右上角加金色小點（冷熱號碼的前幾名）
 */
export function NumberPad({ hot = [] }: { hot?: number[] }) {
  const t = useTranslations("Betting");
  const picked = useBetting((s) => s.picked);
  const toggle = useBetting((s) => s.toggle);
  const quickPick = useBetting((s) => s.quickPick);
  const clear = useBetting((s) => s.clear);
  const addToPending = useBetting((s) => s.addToPending);
  const { maxNumber, pickCount, maxLinesPerTicket } = useGameRules();
  const full = picked.length >= pickCount;
  // 待下注已滿（每張注單最多 maxLinesPerTicket 注）：不能再加，先送出
  const slipFull = useBetting((s) => s.pending.length >= maxLinesPerTicket);
  const canAdd = full && !slipFull;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 flex items-center gap-2 text-[17px]">
          {t("title", { count: pickCount })}
          <Link
            href="/rules"
            aria-label={t("rulesLink")}
            title={t("rulesLink")}
            className="grid size-6 place-items-center rounded-full border border-line-strong text-xs font-bold text-muted no-underline hover:border-gold hover:text-gold"
          >
            ?
          </Link>
        </h2>
        <div className="flex items-center gap-3.5">
          {hot.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
              {t("hotLegend")}
            </span>
          )}
          <span aria-live="polite" className="text-sm text-muted">
            {t.rich("pickedCount", {
              count: picked.length,
              total: pickCount,
              b: (chunks) => <b className="font-num text-[22px] text-gold tabular-nums">{chunks}</b>,
            })}
          </span>
        </div>
      </div>

      <div role="group" aria-label={t("padLabel", { max: maxNumber })} className={cn("grid gap-1.5 md:gap-2", maxNumber <= 36 ? "grid-cols-6" : "grid-cols-7")}>
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
          const on = picked.includes(n);
          const isHot = hot.includes(n);
          const color = ballColor(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              aria-label={isHot ? t("hotNumber", { number: n }) : String(n)}
              onClick={() => toggle(n)}
              className={cn(
                "relative mx-auto aspect-square w-full max-w-12 min-w-11 xl:max-w-13 rounded-full border-2 p-0 font-num text-lg font-bold text-fg md:text-[19px]",
                "transition-[transform,background-color,opacity] duration-150 active:scale-90 motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                on
                  ? cn(FILL[color], "scale-105 border-gold text-white shadow-[inset_-3px_-4px_6px_rgba(0,0,0,0.35),inset_2px_3px_4px_rgba(255,255,255,0.25)]")
                  : cn(RING[color], "bg-sunken hover:bg-panel", full && "opacity-40"),
              )}
            >
              {n}
              {isHot && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-panel bg-gold"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-2.5">
        <PadAction onClick={quickPick}>{t("quickPick")}</PadAction>
        <PadAction onClick={clear} disabled={picked.length === 0}>
          {t("clear")}
        </PadAction>
        <button
          type="button"
          onClick={addToPending}
          disabled={!canAdd}
          title={slipFull ? t("slipFull", { max: maxLinesPerTicket }) : undefined}
          className={cn(
            "h-11 rounded-button font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
            canAdd ? "bg-gold text-gold-ink hover:bg-gold-bright" : "cursor-not-allowed bg-line text-muted",
          )}
        >
          {t("addToPending")}
        </button>
      </div>
    </div>
  );
}

function PadAction({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="h-11 rounded-button border border-line-strong bg-sunken font-bold text-fg transition-colors hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}
