"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/auth/session";
import { useNextDraw, useNow } from "@/features/draw/useNextDraw";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import { TOP_N, useLeaderboard, type Board, type LeaderboardEntry, type RecentWin } from "./api";

const CARD = "rounded-card border border-line bg-panel";

/**
 * 排行榜（設計稿 F）：今日 / 本週的中獎總額、富豪榜（目前積分餘額）。
 * 桌面：名次列表 | 我的名次 + 計算方式；手機：名次列表，我的名次固定在底部分頁上方。
 * 暱稱可能重複，列表的 key 用名次 + 索引。
 * 每一列可以點開，看那個人最近的中獎（最多 10 次、不分期間；筆數依 recentWins 的長度）；一次只展開一列。
 */
export function Leaderboard() {
  const t = useTranslations("Leaderboard");
  const errorText = useApiErrorText();
  const username = useSession((s) => s.user?.username);
  const next = useNextDraw();
  const [period, setPeriod] = useState<Board>("DAY");
  /** 展開的那一列（列表的 key；不在前 20 名的自己是 "mine"） */
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));
  const query = useLeaderboard(period, username, next);
  const data = query.data?.board === period ? query.data : undefined;
  // 中獎榜的金額加「+」；富豪榜是餘額
  const signed = period !== "BALANCE";
  const mine = data?.mine;
  // 自己不在前 20 名：列表下面另外顯示自己那一列
  const mineOutside = !!mine && !data?.entries.some((e) => e.me);

  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-4 px-4 pt-4 pb-24 md:gap-5 md:px-10 md:pt-8 md:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-up motion-reduce:animate-none">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-xl md:text-[26px]">{t("title")}</h1>
          <p className="m-0 text-xs text-muted md:text-sm">
            {t("subtitle", { period })}
            {data?.to && <ResetIn to={data.to} />}
          </p>
        </div>
        <div role="tablist" aria-label={t("periodLabel")} className="flex gap-1 rounded-button bg-sunken p-1">
          {(["DAY", "WEEK", "BALANCE"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => {
                setPeriod(p);
                setOpen(null);
              }}
              className={cn(
                "h-9 rounded-[9px] px-4 text-[13px] font-bold transition-colors md:h-10 md:px-5.5 md:text-sm",
                period === p ? "bg-gold text-gold-ink" : "text-muted hover:text-fg",
              )}
            >
              {t("period", { period: p })}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5 animate-fade-up [animation-delay:80ms] motion-reduce:animate-none">
        <section aria-label={t("ranking")} className={cn(CARD, "min-w-0 flex-[999_1_560px] p-1.5 md:p-2")}>
          {query.isError && !data ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="m-0 text-danger">{t("error", { reason: errorText(query.error) })}</p>
              <Button variant="ghost" className="h-10 text-sm" onClick={() => query.refetch()}>
                {t("retry")}
              </Button>
            </div>
          ) : !data ? (
            <div aria-hidden="true" className="flex flex-col gap-1 p-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-control bg-sunken motion-reduce:animate-none" />
              ))}
            </div>
          ) : data.entries.length === 0 ? (
            <p className="m-0 px-4 py-10 text-center text-muted">{t("empty", { period })}</p>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {data.entries.map((entry, i) => (
                <Row key={`${entry.rank}-${i}`} entry={entry} signed={signed} open={open === `${entry.rank}-${i}`} onToggle={() => toggle(`${entry.rank}-${i}`)} />
              ))}
            </ol>
          )}
          {mineOutside && (
            <div className="mx-1.5 mt-2 border-t border-dashed border-line-strong pt-2">
              <ol className="m-0 list-none p-0">
                <Row entry={mine} outside signed={signed} open={open === "mine"} onToggle={() => toggle("mine")} />
              </ol>
            </div>
          )}
        </section>

        <aside className="hidden flex-[1_1_280px] flex-col gap-5 md:flex">
          <MineCard period={period} mine={mine} loggedIn={!!username} entries={data?.entries} />
          <section className={cn(CARD, "flex flex-col gap-2.5 px-5.5 py-5 text-[13px] leading-relaxed text-fg-soft")}>
            <h2 className="m-0 text-[15px] text-fg">{t("howTitle")}</h2>
            <p className="m-0">{t("how1", { board: period })}</p>
            <p className="m-0">{t("how2", { board: period })}</p>
            <p className="m-0">{t("how3", { board: period })}</p>
          </section>
        </aside>
      </div>

      {/* 手機：我的名次固定在底部分頁上方 */}
      {mine && (
        <div className="fixed inset-x-0 bottom-[calc(60px+max(8px,env(safe-area-inset-bottom)))] z-20 px-4 pb-2 md:hidden">
          <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(244,182,63,0.14)_0%,var(--color-panel)_60%)] px-3.5 py-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
            <span className="text-xs text-muted">{t("mine")}</span>
            <span className="font-num text-[26px] font-extrabold text-gold">#{mine.rank}</span>
            <span className="flex-1 text-xs text-muted">{mineOutside && t("outside", { top: TOP_N })}</span>
            <Amount value={mine.amount} signed={signed} className="text-xl text-gold" />
          </div>
        </div>
      )}
    </div>
  );
}

/** 一列名次：前 3 名比較大，第 1 名金色；自己那一列加「我」。點一下展開最近的中獎 */
function Row({
  entry,
  outside = false,
  signed,
  open,
  onToggle,
}: {
  entry: LeaderboardEntry;
  outside?: boolean;
  signed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("Leaderboard");
  const panelId = useId();
  const top = entry.rank <= 3 && !outside;
  const first = entry.rank === 1 && !outside;
  return (
    <li
      className={cn(
        "rounded-[14px] border",
        first ? "border-gold/35 bg-gold/8" : entry.me ? "border-gold/30 bg-gold/5" : open ? "border-line bg-sunken/60" : "border-transparent",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-[14px] px-2.5 text-left transition-colors hover:bg-sunken/50 focus-visible:outline-2 focus-visible:outline-gold md:gap-4 md:px-3",
          top ? "py-3 md:py-3.5" : "py-2 md:py-2.5",
        )}
      >
        <span
          className={cn(
            "w-8 shrink-0 text-center font-num font-extrabold md:w-11",
            top ? "text-2xl md:text-[30px]" : "text-[17px] md:text-xl",
            first || entry.me ? "text-gold" : top ? "text-fg" : "text-muted",
          )}
        >
          {entry.rank}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "hidden shrink-0 place-items-center rounded-full border bg-sunken text-sm font-bold md:grid",
            top ? "size-10" : "size-8",
            entry.me ? "border-gold text-gold" : "border-line-strong",
            first ? "text-gold" : !entry.me && "text-fg-soft",
          )}
        >
          {entry.nickname.slice(0, 1)}
        </span>
        <span className={cn("flex min-w-0 flex-1 items-center gap-2", top ? "text-base font-bold md:text-[17px]" : "text-sm font-medium md:text-[15px]")}>
          <span className="truncate">{entry.nickname}</span>
          {entry.me && <span className="shrink-0 rounded-full bg-gold/15 px-2 text-[11px] font-bold text-gold">{t("me")}</span>}
          {outside && <span className="hidden shrink-0 text-xs font-normal text-muted md:inline">{t("outside", { top: TOP_N })}</span>}
        </span>
        <Amount value={entry.amount} signed={signed} className={cn(top ? "text-[22px] md:text-[26px]" : "text-[17px] md:text-xl", first || entry.me ? "text-gold" : "text-fg")} />
        <Chevron open={open} />
      </button>
      {/* 展開：grid 列高從 0fr 變 1fr，內容高度不用量 */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-2.5 pt-1 pb-3 md:pr-3 md:pl-[76px]">
            <RecentWins wins={entry.recentWins} />
          </div>
        </div>
      </div>
    </li>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-4 shrink-0 fill-none stroke-muted stroke-2 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 最近的中獎（最多 10 次）：獎級、中幾注、獎金；下一行期數和時間（本地時區） */
function RecentWins({ wins }: { wins: RecentWin[] }) {
  const t = useTranslations("Leaderboard");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 text-xs font-medium text-muted">{t("recentTitle", { count: wins.length })}</h3>
      {wins.length === 0 ? (
        <p className="m-0 text-sm text-fg-soft">{t("recentEmpty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {wins.map((w, i) => (
            <li key={`${w.drawNo}-${i}`} className="flex items-center gap-3 rounded-control bg-sunken px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2 text-sm">
                  <b className={cn("font-bold", w.bestTier === "FIRST" || w.bestTier === "SECOND" || w.bestTier === "THIRD" ? "text-gold" : "text-fg")}>
                    {tt(w.bestTier)}
                  </b>
                  <span className="text-xs text-fg-soft">{t("recentLines", { count: w.winningLines })}</span>
                </span>
                <span className="truncate text-xs text-muted">
                  <span className="font-num text-[13px]">#{w.drawNo}</span>
                  {" · "}
                  <LocalTime value={w.settledAt} month="numeric" day="numeric" hour="2-digit" minute="2-digit" />
                </span>
              </span>
              <span className="shrink-0 font-num text-lg font-bold text-gold tabular-nums">+{format.number(w.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** signed：中獎總額加「+」；富豪榜的餘額不加 */
function Amount({ value, signed, className }: { value: number; signed: boolean; className?: string }) {
  const format = useFormatter();
  return (
    <span className={cn("font-num font-bold tabular-nums", className)}>
      {signed && "+"}
      {format.number(value)}
    </span>
  );
}

/** 距離重置還有多久 */
function ResetIn({ to }: { to: string }) {
  const t = useTranslations("Leaderboard");
  const now = useNow();
  if (now === null) return null;
  const minutes = Math.max(1, Math.ceil((Date.parse(to) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return <span className="text-fg-soft"> · {t("resetIn", { days, hours, minutes: minutes % 60 })}</span>;
}

function MineCard({
  period,
  mine,
  loggedIn,
  entries,
}: {
  period: Board;
  mine: LeaderboardEntry | undefined;
  loggedIn: boolean;
  entries: LeaderboardEntry[] | undefined;
}) {
  const t = useTranslations("Leaderboard");
  const format = useFormatter();
  // 不在前 20 名、前 20 名已滿：還差多少追上第 20 名
  const last = entries && entries.length >= TOP_N ? entries[TOP_N - 1] : undefined;
  const gap = mine && last && mine.rank > TOP_N ? last.amount - mine.amount : 0;

  return (
    <section className="flex flex-col gap-1.5 rounded-card border border-line bg-[radial-gradient(120%_90%_at_100%_0%,rgba(244,182,63,0.14)_0%,var(--color-panel)_60%)] p-5.5">
      <span className="text-sm text-muted">{t("mineTitle", { period })}</span>
      {mine ? (
        <>
          <span className="font-num text-[64px] leading-[0.95] font-extrabold">#{mine.rank}</span>
          <span className="text-sm text-fg-soft">
            {t.rich("mineAmount", {
              board: period,
              points: format.number(mine.amount),
              b: (chunks) => <b className="font-num text-[22px] text-gold">{chunks}</b>,
            })}
          </span>
          {gap > 0 && <span className="text-[13px] text-muted">{t("gap", { top: TOP_N, points: format.number(gap) })}</span>}
          <div className="mt-3 border-t border-line pt-3">
            <RecentWins wins={mine.recentWins} />
          </div>
        </>
      ) : (
        <p className="m-0 py-2 text-sm text-fg-soft">{loggedIn ? t("mineNone", { period }) : t("mineLogin")}</p>
      )}
    </section>
  );
}
