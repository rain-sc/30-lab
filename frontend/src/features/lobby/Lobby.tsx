"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CountUp } from "@/components/fx/CountUp";
import { useSession } from "@/features/auth/session";
import { MobileBetBar } from "@/features/betting/MobileBetBar";
import { useBalance, useUserBets } from "@/features/betting/mockBets";
import { NumberPad } from "@/features/betting/NumberPad";
import { PendingTickets } from "@/features/betting/PendingTickets";
import { PlacedBets } from "@/features/betting/PlacedBets";
import { CountdownDigits, DrawProgress } from "@/features/draw/Countdown";
import { DrawStatus } from "@/features/draw/DrawStatus";
import { HotCold, useHotCold } from "@/features/draw/HotCold";
import { SAMPLE_JACKPOT } from "@/features/draw/mock";
import { RecentDraws } from "@/features/draw/RecentDraws";
import { DrawStage } from "@/features/draw/stage/DrawStage";
import { MobileStage } from "@/features/draw/stage/MobileStage";
import { useNextDraw, useNow, type NextDraw } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

const CARD = "rounded-card border border-line bg-panel";
// 區塊依序進場（純 CSS）
const FADE_UP = "animate-fade-up motion-reduce:animate-none";

/**
 * 大廳（設計稿 D「看板 + 邊看邊玩」）
 * 桌面：狀態列 → 三張數字卡（倒數、彩池、積分）→ 3D 舞台 | 選號盤 | 待下注 → 近期開獎 | 本期已下注 → 冷熱號碼
 * 手機：頂部卡片（倒數、彩池、舞台縮圖：點一下或開獎時放大成 3D 舞台）→ 選號盤 → 待下注 → 固定在底部的下注列；冷熱、紀錄、注單在底部分頁
 */
export function Lobby() {
  const t = useTranslations("Lobby");
  const next = useNextDraw();
  const hot = useHotCold(next)?.hot.map((h) => h.number);
  const isDesktop = useIsDesktop();

  return (
    <>
      <div className="mx-auto flex w-full max-w-8xl flex-col gap-3 px-4 pt-3 pb-44 md:gap-5 md:px-10 md:pt-6 md:pb-10">
        <div className={cn("hidden md:block", FADE_UP)}>
          <DrawStatus next={next} />
        </div>

        <div className={cn("hidden gap-5 md:grid md:grid-cols-3", FADE_UP, "[animation-delay:80ms]")}>
          <CountdownCard next={next} />
          <JackpotCard />
          <BalanceCard next={next} />
        </div>

        <MobileDrawCard next={next} stage={isDesktop === false} className={cn("md:hidden", FADE_UP)} />

        <div className={cn("flex flex-wrap items-stretch gap-3 md:gap-5", FADE_UP, "[animation-delay:160ms]")}>
          <section
            aria-label={t("stage")}
            className={cn(
              CARD,
              "hidden min-h-110 flex-[1_1_340px] flex-col overflow-hidden bg-[radial-gradient(70%_60%_at_50%_55%,var(--color-stage-glow)_0%,var(--color-sunken)_75%)] md:flex",
            )}
          >
            {/* 一頁只掛一個 WebGL：桌面掛在這裡，手機由 MobileStage 放大時才掛 */}
            {isDesktop && <DrawStage className="flex-1" />}
          </section>

          <section aria-label={t("pad")} className={cn(CARD, "min-w-0 flex-[999_1_420px] p-4 md:p-5.5")}>
            <NumberPad hot={hot} />
          </section>

          <aside aria-label={t("pending")} className={cn(CARD, "flex-[1_1_260px] p-4 md:p-5")}>
            <PendingTickets />
          </aside>
        </div>

        <div className={cn("hidden flex-wrap gap-5 md:flex", FADE_UP, "[animation-delay:240ms]")}>
          <section className={cn(CARD, "min-w-0 flex-[999_1_560px] px-5.5 py-4.5")}>
            <CardHeading title={t("recent")} href="/history" link={t("allHistory")} />
            <RecentDraws next={next} count={4} />
          </section>
          <section className={cn(CARD, "flex flex-[1_1_320px] flex-col gap-2.5 px-5.5 py-4.5")}>
            <CardHeading title={t("placed")} href="/bets" link={t("myBets")} />
            <PlacedBets next={next} />
          </section>
        </div>

        <section className={cn(CARD, "hidden px-5.5 py-4.5 md:block", FADE_UP, "[animation-delay:320ms]")}>
          <CardHeading title={t("hotCold")} note={t("hotColdNote")} />
          <HotCold next={next} />
        </section>
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

function CountdownCard({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Live");
  return (
    <section className={cn(CARD, "flex flex-col gap-2.5 px-5.5 py-4.5")}>
      <StatLabel>{next?.closed ? t("closed") : t("nextDraw")}</StatLabel>
      <CountdownDigits next={next} className="text-[64px]" />
      <DrawProgress next={next} />
    </section>
  );
}

function JackpotCard() {
  const t = useTranslations("Live");
  return (
    <section className={cn(CARD, "flex flex-col gap-2.5 px-5.5 py-4.5")}>
      <StatLabel>{t("jackpot")}</StatLabel>
      <CountUp
        to={SAMPLE_JACKPOT}
        delay={0.2}
        className="font-num text-[56px] leading-[0.95] font-bold text-gold tabular-nums"
      />
      <span className="text-[13px] text-muted">
        {t("points")} · {t("sample")}
      </span>
    </section>
  );
}

function BalanceCard({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Wallet");
  const format = useFormatter();
  const user = useSession((s) => s.user);
  const balance = useBalance(user?.username, useNow());
  const placed = useUserBets(user?.username).filter((b) => b.drawNo === next?.drawNo).length;

  return (
    <section className={cn(CARD, "flex flex-col gap-2.5 px-5.5 py-4.5")}>
      <StatLabel>{t("balance")}</StatLabel>
      <span className="font-num text-[56px] leading-[0.95] font-bold tabular-nums">
        {balance === null ? "—" : format.number(balance)}
      </span>
      <span className="text-[13px] text-muted">
        {t("placedThisDraw", { count: placed })} · {t("sample")}
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
          <CountUp to={SAMPLE_JACKPOT} delay={0.2} className="font-num text-lg font-bold text-gold tabular-nums" />
        </span>
      </div>
      {stage && <MobileStage className="w-33" />}
    </section>
  );
}
