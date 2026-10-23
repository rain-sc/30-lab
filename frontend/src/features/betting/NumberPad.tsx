"use client";

import { useTranslations } from "next-intl";
import { ballColor } from "@/lib/ball";
import { cn } from "@/lib/utils";
import { useGameRules } from "@/features/draw/rules";
import { Link } from "@/i18n/navigation";
import { useBetting, type PlayMode } from "./store";

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
const MODES: PlayMode[] = ["SINGLE", "MULTIPLE", "BANKER"];

/**
 * 選號盤：上方切換玩法（單式 / 複式 / 膽拖，設計稿：https://claude.ai/artifact/C9D57kEs3nEv8q4f8tjrXW）。
 * 號碼 1–maxNumber（數字都從 GET /api/game/rules 讀）；≤ 36 排 6 欄（30 = 6 × 5），更多排 7 欄（49 = 7 × 7）。
 * 沒選的是波色外框，選了填滿波色並加金色外圈；膽再加金色光圈和「膽」標籤；選滿後其他號碼變淡。
 * - 單式：選 pickCount 個 → 加入待下注
 * - 複式：選 pickCount + 1 ~ maxMultipleNumbers 個；膽拖：分兩步，先選膽（1 ~ maxBankers 個）再選拖
 *   兩者都不經過待下注，在旁邊的明細（手機是底部的下注列）直接確認下注
 * hot：熱門號碼右上角加金色小點（冷熱號碼的前幾名）
 */
export function NumberPad({ hot = [] }: { hot?: number[] }) {
  const t = useTranslations("Betting");
  const mode = useBetting((s) => s.mode);
  const setMode = useBetting((s) => s.setMode);
  const picked = useBetting((s) => s.picked);
  const multi = useBetting((s) => s.multi);
  const bankers = useBetting((s) => s.bankers);
  const legs = useBetting((s) => s.legs);
  const step = useBetting((s) => s.step);
  const setStep = useBetting((s) => s.setStep);
  const toggle = useBetting((s) => s.toggle);
  const quickPick = useBetting((s) => s.quickPick);
  const clear = useBetting((s) => s.clear);
  const addToPending = useBetting((s) => s.addToPending);
  const { maxNumber, pickCount, maxLinesPerTicket, maxMultipleNumbers, maxBankers } = useGameRules();
  // 待下注已滿（每張注單最多 maxLinesPerTicket 注）：不能再加，先送出
  const slipFull = useBetting((s) => s.pending.length >= maxLinesPerTicket);
  const canAdd = picked.length >= pickCount && !slipFull;

  const selected = mode === "SINGLE" ? picked : mode === "MULTIPLE" ? multi : legs;
  const full =
    mode === "SINGLE" ? picked.length >= pickCount : mode === "MULTIPLE" ? multi.length >= maxMultipleNumbers : step === "banker" && bankers.length >= maxBankers;
  const empty = mode === "SINGLE" ? picked.length === 0 : mode === "MULTIPLE" ? multi.length === 0 : bankers.length + legs.length === 0;
  const count = (chunks: React.ReactNode) => <b className="font-num text-[22px] text-gold tabular-nums">{chunks}</b>;

  return (
    <div className="flex flex-col gap-3.5">
      <div role="tablist" aria-label={t("modesLabel")} className="flex gap-1 rounded-button bg-stage p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-9 flex-1 rounded-[9px] text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-gold",
              mode === m ? "bg-gold text-gold-ink" : "text-muted hover:text-fg",
            )}
          >
            {t("mode", { mode: m })}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 flex items-center gap-2 text-[17px]">
          {mode === "SINGLE"
            ? t("title", { count: pickCount })
            : mode === "MULTIPLE"
              ? t("multiTitle", { min: pickCount + 1, max: maxMultipleNumbers })
              : t("bankerTitle")}
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
            {mode === "SINGLE"
              ? t.rich("pickedCount", { count: picked.length, total: pickCount, b: count })
              : mode === "MULTIPLE"
                ? t.rich("pickedRange", { count: multi.length, min: pickCount + 1, max: maxMultipleNumbers, b: count })
                : t.rich("bankerCount", { bankers: bankers.length, legs: legs.length, b: count })}
          </span>
        </div>
      </div>

      {mode !== "SINGLE" && (
        <p className="m-0 -mt-1.5 text-[13px] leading-relaxed text-muted">
          {mode === "MULTIPLE" ? t("multiHelp", { count: pickCount }) : t("bankerHelp", { count: pickCount })}
        </p>
      )}

      {mode === "BANKER" && (
        <div role="group" aria-label={t("bankerSteps")} className="grid grid-cols-2 gap-1.5">
          {(["banker", "leg"] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              aria-pressed={step === s}
              onClick={() => setStep(s)}
              className={cn(
                "flex flex-col items-start rounded-button border px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                step === s ? "border-gold bg-gold/10 text-fg" : "border-line bg-sunken text-fg-soft hover:border-line-strong",
              )}
            >
              <span className="text-xs text-muted">{t("stepNo", { n: i + 1 })}</span>
              <span className="text-sm font-bold">
                {s === "banker" ? t("stepBanker", { count: bankers.length, max: maxBankers }) : t("stepLeg", { count: legs.length })}
              </span>
            </button>
          ))}
        </div>
      )}

      <div role="group" aria-label={t("padLabel", { max: maxNumber })} className={cn("grid gap-1.5 md:gap-2", maxNumber <= 36 ? "grid-cols-6" : "grid-cols-7")}>
        {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
          const banker = mode === "BANKER" && bankers.includes(n);
          const on = banker || selected.includes(n);
          const isHot = hot.includes(n);
          const color = ballColor(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              aria-label={banker ? t("bankerNumber", { number: n }) : isHot ? t("hotNumber", { number: n }) : String(n)}
              onClick={() => toggle(n)}
              className={cn(
                "relative mx-auto aspect-square w-full max-w-12 min-w-11 xl:max-w-13 rounded-full border-2 p-0 font-num text-lg font-bold text-fg md:text-[19px]",
                "transition-[transform,background-color,opacity] duration-150 active:scale-90 motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                on
                  ? cn(FILL[color], "scale-105 border-gold text-white shadow-[inset_-3px_-4px_6px_rgba(0,0,0,0.35),inset_2px_3px_4px_rgba(255,255,255,0.25)]")
                  : cn(RING[color], "bg-sunken hover:bg-panel", full && "opacity-40"),
                banker && "ring-3 ring-gold/45",
              )}
            >
              {n}
              {banker && (
                <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 rounded-full bg-gold px-1 text-[10px] leading-4 font-bold text-gold-ink">
                  {t("bankerBadge")}
                </span>
              )}
              {isHot && !banker && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-panel bg-gold"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className={cn("grid gap-2 md:gap-2.5", mode === "SINGLE" ? "grid-cols-3" : "grid-cols-2")}>
        <PadAction onClick={quickPick}>{t("quickPick")}</PadAction>
        <PadAction onClick={clear} disabled={empty}>
          {t("clear")}
        </PadAction>
        {mode === "SINGLE" && (
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
        )}
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
