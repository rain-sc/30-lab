"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { JackpotAmount } from "@/features/draw/JackpotAmount";
import { useGameRulesQuery, type GameRules, type PrizeRule } from "@/features/draw/rules";
import { REVEAL_MS } from "@/features/draw/stage/timeline";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";

const CARD = "rounded-card border border-line bg-panel";
const FADE_UP = "animate-fade-up motion-reduce:animate-none";

/**
 * 玩法說明（設計稿 G）：怎麼玩、獎級與機率、頭獎彩池、一期的時間、積分來源。
 * 數字全部來自 GET /api/game/rules（不用預設值：要等真的資料，拿不到就顯示重試）；頭獎彩池看 GET /api/jackpot
 */
export function RulesView() {
  const t = useTranslations("Rules");
  const errorText = useApiErrorText();
  const query = useGameRulesQuery();
  const rules = query.data;

  return (
    <div className="mx-auto flex w-full max-w-250 flex-col gap-5 px-4 pt-4 pb-24 md:gap-7 md:px-10 md:pt-9 md:pb-14">
      <div className={cn("flex flex-col gap-1.5", FADE_UP)}>
        <h1 className="m-0 text-[22px] md:text-[28px]">{t("title")}</h1>
        <p className="m-0 text-[13px] text-muted md:text-[15px]">{t("intro")}</p>
      </div>

      {!rules ? (
        query.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="m-0 text-danger">{t("error", { reason: errorText(query.error) })}</p>
            <Button variant="ghost" className="h-10 text-sm" onClick={() => query.refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div aria-hidden="true" className="flex flex-col gap-5">
            {[160, 420, 260].map((h) => (
              <div key={h} className="animate-pulse rounded-card bg-panel motion-reduce:animate-none" style={{ height: h }} />
            ))}
          </div>
        )
      ) : (
        <>
          <Steps rules={rules} />
          <PrizeTable rules={rules} />
          <div className={cn("grid gap-4 md:grid-cols-2", FADE_UP, "[animation-delay:160ms]")}>
            <JackpotRules rules={rules} />
            <Timeline rules={rules} />
          </div>
          <Points rules={rules} />
        </>
      )}
    </div>
  );
}

function Steps({ rules }: { rules: GameRules }) {
  const t = useTranslations("Rules");
  const steps = [
    { title: t("step1Title", { count: rules.pickCount }), text: t("step1", { count: rules.pickCount, max: rules.maxNumber }) },
    {
      title: t("step2Title"),
      text: t("step2", { points: rules.pointsPerBet, lines: rules.maxLinesPerTicket, seconds: rules.bettingCutoffSeconds }),
    },
    { title: t("step3Title"), text: t("step3", { minutes: rules.drawIntervalSeconds / 60, count: rules.pickCount }) },
  ];
  return (
    <section aria-label={t("howTitle")} className={cn("grid gap-3 md:grid-cols-3 md:gap-4", FADE_UP, "[animation-delay:40ms]")}>
      {steps.map((s, i) => (
        <div key={i} className={cn(CARD, "flex gap-3 px-4 py-3.5 md:flex-col md:gap-2 md:px-5.5 md:py-5")}>
          <span className="font-num text-[26px] leading-none font-extrabold text-gold md:text-[34px]">{i + 1}</span>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[15px] md:text-[17px]">{s.title}</h2>
            <p className="m-0 text-[13px] leading-relaxed text-fg-soft md:text-sm">{s.text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** 中獎條件的圖示：實心金點 = 要中的正碼；要中特別號碼加「+特」 */
function ConditionDots({ prize, pickCount }: { prize: PrizeRule; pickCount: number }) {
  const t = useTranslations("Rules");
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px] md:gap-1">
      {Array.from({ length: pickCount }, (_, i) => (
        <span
          key={i}
          className={cn("size-2.5 rounded-full border-[1.5px] md:size-3", i < prize.matched ? "border-gold bg-gold" : "border-line-strong")}
        />
      ))}
      {prize.specialHit && (
        <span className="ml-1 rounded-full border-[1.5px] border-gold px-1.5 text-[11px] leading-[1.4] font-bold text-gold">
          {t("specialShort")}
        </span>
      )}
    </span>
  );
}

function PrizeTable({ rules }: { rules: GameRules }) {
  const t = useTranslations("Rules");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  const odds = (combos: number) => format.number(Math.round(rules.totalCombinations / combos));
  const percent = (combos: number) =>
    format.number(combos / rules.totalCombinations, { style: "percent", maximumSignificantDigits: 3 });
  const anyCombos = rules.prizes.reduce((sum, p) => sum + p.winningCombinations, 0);

  return (
    <section aria-labelledby="prize-title" className={cn(CARD, "flex flex-col px-3.5 py-4 md:px-6 md:py-5.5", FADE_UP, "[animation-delay:100ms]")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 pb-2.5 md:px-3">
        <h2 id="prize-title" className="m-0 text-base md:text-lg">{t("prizeTitle")}</h2>
        <span className="text-xs text-muted md:text-[13px]">{t("prizeNote")}</span>
      </div>
      <table className="w-full border-collapse text-left">
        <thead className="hidden md:table-header-group">
          <tr className="text-xs text-muted">
            <th className="px-3 pb-2 font-normal">{t("colTier")}</th>
            <th className="px-3 pb-2 font-normal">{t("colCondition")}</th>
            <th className="px-3 pb-2 text-right font-normal">{t("colPrize")}</th>
            <th className="px-3 pb-2 text-right font-normal">{t("colOdds")}</th>
          </tr>
        </thead>
        <tbody>
          {rules.prizes.map((p) => {
            const first = p.prize == null;
            return (
              <tr key={p.tier} className={cn("border-t border-line align-middle", first && "bg-gold/7")}>
                {/* 手機：名稱 + 條件疊在左邊、獎金 + 機率疊在右邊 */}
                <td className="px-2.5 py-2.5 md:w-24 md:px-3 md:py-3">
                  <span className={cn("block font-bold", first ? "text-gold md:text-[17px]" : "text-fg")}>{tt(p.tier)}</span>
                  <span className="mt-1 flex items-center gap-1.5 md:hidden">
                    <ConditionDots prize={p} pickCount={rules.pickCount} />
                    <span className="text-xs text-fg-soft">{t("condition", { matched: p.matched, special: String(p.specialHit) })}</span>
                  </span>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <span className="flex items-center gap-2.5">
                    <ConditionDots prize={p} pickCount={rules.pickCount} />
                    <span className="text-sm text-fg-soft">{t("condition", { matched: p.matched, special: String(p.specialHit) })}</span>
                  </span>
                </td>
                <td className="px-2.5 py-2.5 text-right md:px-3 md:py-3">
                  {first ? (
                    <>
                      <JackpotAmount className="block font-num text-[22px] font-bold text-gold tabular-nums md:text-[26px]" />
                      <span className="block text-xs text-muted">{t("poolShare")}</span>
                    </>
                  ) : (
                    <span className="font-num text-lg font-bold tabular-nums md:text-xl">{format.number(p.prize!)}</span>
                  )}
                  <span className="block text-xs text-muted md:hidden">1 / {odds(p.winningCombinations)}</span>
                </td>
                <td className="hidden px-3 py-3 text-right md:table-cell">
                  <span className="block font-num text-lg text-fg-soft tabular-nums">1 / {odds(p.winningCombinations)}</span>
                  <span className="block text-xs text-muted">{percent(p.winningCombinations)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="m-0 px-1 pt-3 text-xs text-muted md:px-3 md:text-[13px]">
        {t.rich("anyPrize", {
          odds: odds(anyCombos),
          percent: percent(anyCombos),
          total: format.number(rules.totalCombinations),
          b: (chunks: ReactNode) => <b className="text-fg">{chunks}</b>,
        })}
      </p>
    </section>
  );
}

function JackpotRules({ rules }: { rules: GameRules }) {
  const t = useTranslations("Rules");
  const format = useFormatter();
  const b = (chunks: ReactNode) => <b className="text-fg">{chunks}</b>;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-[radial-gradient(120%_90%_at_100%_0%,rgba(244,182,63,0.12)_0%,var(--color-panel)_60%)] px-4 py-4 md:px-6 md:py-5.5">
      <h2 className="m-0 text-base md:text-lg">{t("jackpotTitle")}</h2>
      <span className="flex items-baseline gap-2">
        <JackpotAmount className="font-num text-[36px] leading-none font-bold text-gold tabular-nums md:text-[44px]" />
        <span className="text-xs text-muted md:text-[13px]">{t("jackpotNow")}</span>
      </span>
      <ul className="m-0 flex flex-col gap-1.5 pl-4.5 text-[13px] leading-relaxed text-fg-soft md:gap-2 md:text-sm">
        <li>{t.rich("jackpotFloor", { points: format.number(rules.jackpot.floor), b })}</li>
        <li>{t.rich("jackpotRate", { percent: rules.jackpot.ratePercent, b })}</li>
        <li>{t.rich("jackpotRollover", { b })}</li>
        <li>{t.rich("jackpotSplit", { b })}</li>
      </ul>
    </section>
  );
}

function Timeline({ rules }: { rules: GameRules }) {
  const t = useTranslations("Rules");
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const steps = [
    { time: "0:00", text: t("tlOpen"), dot: "bg-gold" },
    { time: clock(rules.drawIntervalSeconds - rules.bettingCutoffSeconds), text: t("tlClose"), dot: "bg-live-text" },
    { time: clock(rules.drawIntervalSeconds), text: t("tlDraw", { count: rules.pickCount + 1, seconds: REVEAL_MS / 1000 }), dot: "bg-fg" },
    { time: t("tlAfter"), text: t("tlSettle"), dot: "bg-success" },
  ];
  return (
    <section className={cn(CARD, "flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5.5")}>
      <h2 className="m-0 text-base md:text-lg">{t("timelineTitle", { minutes: rules.drawIntervalSeconds / 60 })}</h2>
      <ol className="m-0 list-none p-0">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className="flex flex-col items-center">
              <span className={cn("mt-1 size-2.5 rounded-full md:size-3", s.dot)} />
              {i < steps.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
            </span>
            <span className="flex flex-col pb-3">
              <b className="font-num text-base md:text-lg">{s.time}</b>
              <span className="text-[13px] text-fg-soft md:text-sm">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Points({ rules }: { rules: GameRules }) {
  const t = useTranslations("Rules");
  const format = useFormatter();
  const items = [
    { label: t("signup"), value: format.number(rules.signupBonus), note: t("signupNote", { count: format.number(rules.signupBonus / rules.pointsPerBet) }) },
    { label: t("daily"), value: format.number(rules.dailyBonus), note: t("dailyNote") },
    { label: t("perBet"), value: format.number(rules.pointsPerBet), note: t("perBetNote", { lines: rules.maxLinesPerTicket }) },
  ];
  return (
    <section aria-label={t("pointsTitle")} className={cn(CARD, "grid grid-cols-2 gap-4 px-4 py-4 md:grid-cols-3 md:gap-5 md:px-6 md:py-5.5", FADE_UP, "[animation-delay:220ms]")}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted md:text-[13px]">{item.label}</span>
          <span className="font-num text-[26px] font-bold md:text-[32px]">{item.value}</span>
          <span className="text-[11px] text-fg-soft md:text-[13px]">{item.note}</span>
        </div>
      ))}
    </section>
  );
}
