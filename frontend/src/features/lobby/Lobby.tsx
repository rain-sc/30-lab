"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MobileBetBar } from "@/features/betting/MobileBetBar";
import { NumberPad } from "@/features/betting/NumberPad";
import { PendingTickets } from "@/features/betting/PendingTickets";
import { PlacedBets } from "@/features/betting/PlacedBets";
import { CountdownDigits, DrawProgress } from "@/features/draw/Countdown";
import { DrawFeedError } from "@/features/draw/DrawFeedError";
import { DrawStatus } from "@/features/draw/DrawStatus";
import { HotCold, useHotCold } from "@/features/draw/HotCold";
import { JackpotAmount } from "@/features/draw/JackpotAmount";
import { RecentDraws } from "@/features/draw/RecentDraws";
import { DrawStage } from "@/features/draw/stage/DrawStage";
import { MobileStage } from "@/features/draw/stage/MobileStage";
import { useNextDraw, type NextDraw } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

const CARD = "rounded-card border border-line bg-panel";
// 區塊依序進場（純 CSS）
const FADE_UP = "animate-fade-up motion-reduce:animate-none";

/**
 * 大廳（設計稿 D「看板 + 邊看邊玩」，桌面排版是 E2）
 * 寬螢幕（xl，1280px 以上）三欄：
 *   倒數   | 3D 舞台 | 選號盤
 *   彩池   | 3D 舞台 | 選號盤
 *   近期開獎 | 待下注  | 本期已下注
 *   冷熱號碼（整排）
 *   舞台和選號盤在第一屏並排：一邊看攪珠一邊選號（積分在頁首，不另外放卡片）
 * 中等寬度（md）兩欄：倒數 | 彩池 → 舞台 | 選號盤 → 待下注 | 本期已下注 → 近期開獎 → 冷熱號碼
 * 手機：頂部卡片（倒數、彩池、舞台縮圖：點一下或開獎時放大成 3D 舞台）→ 選號盤 → 待下注 → 固定在底部的下注列；冷熱、紀錄、注單在底部分頁
 */
export function Lobby() {
  const t = useTranslations("Lobby");
  const next = useNextDraw();
  const hotCold = useHotCold(next).data;
  const hot = hotCold?.hot.map((h) => h.number);
  const isDesktop = useIsDesktop();

  return (
    <>
      <div className="mx-auto flex w-full max-w-8xl flex-col gap-3 px-4 pt-3 pb-4 md:gap-5 md:px-10 md:pt-6 md:pb-10">
        <DrawFeedError />
        <div className={cn("hidden md:block", FADE_UP)}>
          <DrawStatus next={next} />
        </div>

        {/* 各區塊用 grid-area 放位置，不同寬度只換 grid-template-areas */}
        <div
          className={cn(
            "grid gap-3 [grid-template-areas:'mobile'_'pad'_'pending']",
            "md:grid-cols-2 md:gap-5 md:[grid-template-areas:'count_pool'_'stage_pad'_'pending_placed'_'recent_recent'_'hot_hot']",
            "xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:[grid-template-areas:'count_stage_pad'_'pool_stage_pad'_'recent_pending_placed'_'hot_hot_hot']",
          )}
        >
          <MobileDrawCard next={next} stage={isDesktop === false} className={cn("[grid-area:mobile] md:hidden", FADE_UP)} />

          <CountdownCard next={next} className={cn("hidden [grid-area:count] md:flex", FADE_UP, "[animation-delay:60ms]")} />
          <JackpotCard className={cn("hidden [grid-area:pool] md:flex", FADE_UP, "[animation-delay:120ms]")} />

          <section
            aria-label={t("stage")}
            className={cn(
              CARD,
              "hidden min-h-110 flex-col overflow-hidden bg-[radial-gradient(70%_60%_at_50%_55%,var(--color-stage-glow)_0%,var(--color-sunken)_75%)] [grid-area:stage] md:flex",
              FADE_UP,
              "[animation-delay:120ms]",
            )}
          >
            {/* 一頁只掛一個 WebGL：桌面掛在這裡，手機由 MobileStage 放大時才掛 */}
            {isDesktop && <DrawStage className="flex-1" />}
          </section>

          <section
            aria-label={t("pad")}
            className={cn(CARD, "min-w-0 p-4 [grid-area:pad] md:p-5.5", FADE_UP, "[animation-delay:180ms]")}
          >
            <NumberPad hot={hot} />
          </section>

          <aside
            aria-label={t("pending")}
            className={cn(CARD, "p-4 [grid-area:pending] md:p-5", FADE_UP, "[animation-delay:240ms]")}
          >
            <PendingTickets />
          </aside>

          <section
            className={cn(
              CARD,
              "hidden flex-col gap-2.5 px-5.5 py-4.5 [grid-area:placed] md:flex",
              FADE_UP,
              "[animation-delay:300ms]",
            )}
          >
            <CardHeading title={t("placed")} href="/bets" link={t("myBets")} />
            <PlacedBets next={next} />
          </section>

          <section
            className={cn(CARD, "hidden min-w-0 px-5.5 py-4.5 [grid-area:recent] md:block", FADE_UP, "[animation-delay:300ms]")}
          >
            <CardHeading title={t("recent")} href="/history" link={t("allHistory")} />
            <RecentDraws next={next} count={4} />
          </section>

          <section className={cn(CARD, "hidden px-5.5 py-4.5 [grid-area:hot] md:block", FADE_UP, "[animation-delay:360ms]")}>
            <CardHeading title={t("hotCold")} note={hotCold ? t("hotColdNote", { count: hotCold.window }) : undefined} />
            <HotCold next={next} />
          </section>
        </div>
      </div>

      <MobileBetBar />
    </>
  );
}

function CardHeading({ title, href, link, note }: { title: string; href?: string; link?: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2">
      <h2 className="m-0 text-base">{title}</h2>
      {href && (
        <Link href={href} className="text-[13px] text-gold no-underline hover:underline">
          {link}
        </Link>
      )}
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </div>
  );
}

function StatLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted">{children}</span>;
}

function CountdownCard({ next, className }: { next: NextDraw | null; className?: string }) {
  const t = useTranslations("Live");
  return (
    <section className={cn(CARD, "flex-col justify-center gap-2 px-5.5 py-3.5 xl:gap-2.5 xl:py-4.5", className)}>
      <StatLabel>{next?.closed ? t("closed") : t("nextDraw")}</StatLabel>
      <CountdownDigits next={next} className="text-[44px] xl:text-[64px]" />
      <DrawProgress next={next} labelsClassName="hidden xl:flex" />
    </section>
  );
}

function JackpotCard({ className }: { className?: string }) {
  const t = useTranslations("Live");
  const tl = useTranslations("Lobby");
  return (
    <section className={cn(CARD, "flex-col justify-center gap-2 px-5.5 py-3.5 xl:gap-2.5 xl:py-4.5", className)}>
      <StatLabel>{t("jackpot")}</StatLabel>
      <JackpotAmount className="font-num text-[44px] leading-[0.95] font-bold text-gold tabular-nums xl:text-[56px]" />
      <span className="flex items-baseline justify-between gap-3 text-[13px] text-muted">
        {t("points")}
        <Link href="/rules" className="text-gold no-underline hover:underline">
          {tl("jackpotRules")}
        </Link>
      </span>
    </section>
  );
}


/** stage：手機才掛 MobileStage（桌面版這張卡被 CSS 藏起來，但元件還在，不能讓它的舞台自動打開） */
function MobileDrawCard({ next, stage, className }: { next: NextDraw | null; stage: boolean; className?: string }) {
  const t = useTranslations("Live");
  return (
    <section
      aria-label={t("heading")}
      className={cn(
        CARD,
        "flex items-center gap-3 bg-[radial-gradient(60%_80%_at_85%_50%,var(--color-stage-glow)_0%,var(--color-panel)_70%)] py-3 pr-3 pl-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <DrawStatus next={next} compact />
        <CountdownDigits next={next} className="text-[50px]" />
        <DrawProgress next={next} showLabels={false} />
        <span className="text-[11px] text-muted">
          {t("jackpot")}{" "}
          <JackpotAmount className="font-num text-lg font-bold text-gold tabular-nums" />
        </span>
      </div>
      {stage && <MobileStage className="w-33" />}
    </section>
  );
}
