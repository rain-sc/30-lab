"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { RollingDigits } from "@/components/fx/RollingDigits";
import { cn } from "@/lib/utils";
import { hasResult, useDrawFeed } from "./feed";
import { JackpotAmount } from "./JackpotAmount";
import { useGameRules } from "./rules";
import { useNextDraw } from "./useNextDraw";

const pad = (n: number) => String(n).padStart(2, "0");

const BALL_CLASS = "md:size-11 md:text-xl";

// 開獎球：進場依序從上方掉下來彈一下；換期時舊球往右滾走，新號碼再掉下來
const rowVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } },
  exit: { transition: { staggerChildren: 0.04 } },
};
const ballVariants: Variants = {
  hidden: { y: -48, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 520, damping: 17 } },
  exit: { x: 48, rotate: 220, opacity: 0, transition: { duration: 0.35, ease: "easeIn" } },
};

// 「開獎直播間」面板：LIVE 標籤、開獎倒數、頭獎彩池、上期結果、玩法規則
// 手機：倒數和彩池左右並排，上期結果在下一行；桌面：超大倒數一整行，彩池和上期結果並排
export function LivePanel({ className }: { className?: string }) {
  const t = useTranslations("Live");
  const next = useNextDraw();
  const rules = useGameRules();

  // Next 16 的 cacheComponents 離開頁面時不卸載，而是用 <Activity> 隱藏保留（例如切換語言再切回來）。
  // 再次顯示時元件不會重新掛載，開獎球的進場動畫就不會重播。
  // 隱藏時 React 會執行 effect 的清除函式：在這裡換一個 key，回來時開獎球區塊重新掛載、重播掉落動畫。
  // （彩池累加寫在 effect 裡、頁面進場是 CSS 動畫，這兩個本來就會重播）
  // 見 node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md
  const [replayKey, setReplayKey] = useState(0);
  useLayoutEffect(() => () => setReplayKey((n) => n + 1), []);

  const minutes = next ? pad(Math.floor(next.remainingSeconds / 60)) : "--";
  const seconds = next ? pad(next.remainingSeconds % 60) : "--";
  // 上期開獎結果（後端）；登入頁沒有舞台，開獎後就直接顯示
  const previous = useDrawFeed((s) => s.previous);
  const lastResult = hasResult(previous) ? { numbers: previous.numbers, special: previous.specialNumber } : null;
  const bold = (chunks: ReactNode) => <b className="font-bold text-fg">{chunks}</b>;

  return (
    <section aria-labelledby="live-heading" className={cn("flex flex-col gap-4 md:gap-7", className)}>
      <h2 id="live-heading" className="sr-only">
        {t("heading")}
      </h2>

      <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-0.5 text-xs font-bold tracking-[0.08em] text-live-text md:gap-2 md:px-3 md:py-1 md:text-[13px]">
          {/* 紅點 + 往外擴散的雷達波紋 */}
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          LIVE
        </span>
        <span className="text-[13px] text-muted md:text-sm">{next ? t("drawNo", { drawNo: next.drawNo }) : " "}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-4 [grid-template-areas:'count_jackpot'_'result_result'] md:grid-cols-[auto_1fr] md:gap-x-12 md:gap-y-7 md:[grid-template-areas:'count_count'_'jackpot_result']">
        <div className="flex flex-col gap-1 [grid-area:count]">
          <span className={cn("text-[13px] md:text-[15px]", next?.closed ? "font-medium text-live-text" : "text-muted")}>
            {next?.closed ? t("closed") : t("nextDraw")}
          </span>
          <span
            role="timer"
            aria-label={t("countdownLabel", { minutes, seconds })}
            className={cn(
              "origin-left font-num text-[84px] leading-[0.9] font-extrabold tracking-[0.02em] tabular-nums transition-colors duration-500 md:text-[168px]",
              // 截止下注後（最後 15 秒）變紅並輕微脈動
              next?.closed && "animate-beat text-live-text motion-reduce:animate-none",
            )}
          >
            <RollingDigits
              value={`${minutes}:${seconds}`}
              renderSeparator={(c) => <span className={next?.closed ? undefined : "text-gold"}>{c}</span>}
            />
          </span>
        </div>

        <div className="flex flex-col items-end gap-1 self-end [grid-area:jackpot] md:items-start md:self-auto">
          <span className="text-[13px] text-muted md:text-sm">
            {t("jackpot")}
          </span>
          <JackpotAmount className="font-num text-[32px] leading-none font-bold text-gold tabular-nums md:text-5xl" />
          <span className="text-xs text-muted md:hidden">{t("points")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 [grid-area:result] md:flex-col md:items-start md:gap-2.5">
          <span className="mr-1 text-xs text-muted md:text-sm">{t("lastResult")}</span>
          <div key={replayKey} className="flex min-h-8 items-center md:min-h-11">
            <AnimatePresence mode="wait">
              {lastResult ? (
                <motion.div
                  key={previous!.drawNo}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex items-center gap-1.5 md:gap-2"
                >
                  {[...lastResult.numbers].sort((a, b) => a - b).map((n) => (
                    <motion.span key={n} variants={ballVariants} className="inline-flex">
                      <Ball number={n} size="sm" className={BALL_CLASS} />
                    </motion.span>
                  ))}
                  <motion.span variants={ballVariants} aria-hidden="true" className="px-0.5 font-bold text-muted">
                    +
                  </motion.span>
                  <span className="sr-only">{t("special")}</span>
                  <motion.span variants={ballVariants} className="inline-flex">
                    <Ball number={lastResult.special} size="sm" special className={BALL_CLASS} />
                  </motion.span>
                </motion.div>
              ) : (
                // 伺服器端不知道時間，先畫 7 個空位，避免版面跳動
                <div key="placeholder" aria-hidden="true" className="flex items-center gap-1.5 md:gap-2">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className={cn("size-8 rounded-full border border-dashed border-line", BALL_CLASS)} />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ul className="m-0 hidden list-none flex-wrap gap-8 border-t border-line p-0 pt-4.5 text-sm text-fg-soft md:flex">
        <li>{t.rich("rulePerBet", { points: rules.pointsPerBet, b: bold })}</li>
        <li>{t.rich("ruleInterval", { minutes: rules.drawIntervalSeconds / 60, b: bold })}</li>
        <li>{t.rich("ruleCutoff", { seconds: rules.bettingCutoffSeconds, b: bold })}</li>
      </ul>
    </section>
  );
}
