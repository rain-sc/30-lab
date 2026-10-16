"use client";

import { useTranslations } from "next-intl";
import { ballColor } from "@/lib/ball";
import { cn } from "@/lib/utils";
import { PICK_COUNT, useBetting } from "./store";

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

const NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

/**
 * 選號盤：1–49 選 6 個。沒選的是波色外框，選了填滿波色並加金色外圈；選滿後其他號碼變淡。
 * hot：熱門號碼右上角加金色小點（冷熱號碼的前幾名）
 */
export function NumberPad({ hot = [] }: { hot?: number[] }) {
  const t = useTranslations("Betting");
  const picked = useBetting((s) => s.picked);
  const toggle = useBetting((s) => s.toggle);
  const quickPick = useBetting((s) => s.quickPick);
  const clear = useBetting((s) => s.clear);
  const addToPending = useBetting((s) => s.addToPending);
  const full = picked.length >= PICK_COUNT;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-[17px]">{t("title", { count: PICK_COUNT })}</h2>
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
              total: PICK_COUNT,
              b: (chunks) => <b className="font-num text-[22px] text-gold tabular-nums">{chunks}</b>,
            })}
          </span>
        </div>
      </div>

      <div role="group" aria-label={t("padLabel")} className="grid grid-cols-7 gap-1.5 md:gap-2">
        {NUMBERS.map((n) => {
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
                "relative mx-auto aspect-square w-full max-w-13 min-w-11 rounded-full border-2 p-0 font-num text-lg font-bold text-fg md:text-[19px]",
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
          disabled={!full}
          className={cn(
            "h-11 rounded-button font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
            full ? "bg-gold text-gold-ink hover:bg-gold-bright" : "cursor-not-allowed bg-line text-muted",
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
