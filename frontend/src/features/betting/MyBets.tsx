"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/auth/session";
import { useDrawFeed } from "@/features/draw/feed";
import { ResultBalls } from "@/features/draw/ResultBalls";
import { drawAtOf } from "@/features/draw/schedule";
import { revealedAt } from "@/features/draw/stage/timeline";
import { useResultBackfill } from "@/features/draw/useResultBackfill";
import { useNow } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import { TIERS, useTickets, type LineResult, type Ticket } from "./api";

const PAGE_SIZE = 20;

/**
 * 我的注單（GET /api/tickets，分頁），新的在上；一張注單 = 一次確認下注，裡面有一到多注。
 * 單式逐注列出；複式、膽拖先顯示原始的選號（膽、拖分開）和中獎摘要，展開後的每一注收合起來
 * 每注的獎級、獎金來自後端結算（results、payout）；開獎動畫播完才顯示，不比舞台先劇透
 */
export function MyBets() {
  const t = useTranslations("MyBets");
  const errorText = useApiErrorText();
  const username = useSession((s) => s.user?.username);
  const [page, setPage] = useState(1);
  const query = useTickets(username, page, PAGE_SIZE);
  const tickets = query.data?.list ?? [];
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  // 這一頁的期數裡，開獎時不在線上（沒有號碼）的，用開獎紀錄補查
  useResultBackfill(tickets.map((ticket) => ticket.drawNo));

  if (query.isError && !query.data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="m-0 text-danger">{t("error", { reason: errorText(query.error) })}</p>
        <Button variant="ghost" className="h-10 text-sm" onClick={() => query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!query.data) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="m-0 text-muted">{t("empty")}</p>
        <Link href="/" className="font-medium text-gold underline-offset-4 hover:underline">
          {t("toLobby")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </ol>
      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <Button variant="ghost" className="h-10 text-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("prev")}
          </Button>
          <span className="text-sm text-muted">{t("page", { page, pages })}</span>
          <Button variant="ghost" className="h-10 text-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const t = useTranslations("MyBets");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  const now = useNow();
  const result = useDrawFeed((s) => s.results[ticket.drawNo]);
  const missing = useDrawFeed((s) => !!s.missing[ticket.drawNo]);

  // 開獎動畫播完才顯示開獎號碼和中獎結果
  const revealed = now !== null && revealedAt(drawAtOf(ticket.drawNo)) <= now;
  const results = revealed && ticket.status !== "PENDING" ? ticket.results : undefined;
  const draw = revealed && result ? result : null;
  const won = !!results && ticket.payout > 0;
  const status = !revealed
    ? t("waiting")
    : !results
      ? t("settling")
      : won
        ? t("won", { points: format.number(ticket.payout) })
        : t("lost");
  const single = ticket.betType === "SINGLE";

  return (
    <li className={cn("flex flex-col gap-3 rounded-card border bg-panel p-4 md:p-5", won ? "border-gold/60" : "border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="m-0 font-num text-lg font-bold tabular-nums">{t("drawNo", { drawNo: ticket.drawNo })}</h2>
          <span className={cn("rounded-full border px-2 text-xs font-bold", single ? "border-line-strong text-fg-soft" : "border-gold/50 text-gold")}>
            {t("type", { type: ticket.betType, numbers: ticket.numbers?.length ?? 0, bankers: ticket.bankers?.length ?? 0, legs: ticket.legs?.length ?? 0 })}
          </span>
          <span className={cn("text-sm", won ? "font-bold text-gold" : "text-muted")}>{status}</span>
        </div>
        {draw ? (
          <ResultBalls result={draw} size="xs" />
        ) : (
          revealed && missing && <span className="text-xs text-muted">{t("notFound")}</span>
        )}
      </div>

      {single ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ticket.lines.map((line, i) => (
            <LineRow key={i} line={line} draw={draw} result={results?.[i]} />
          ))}
        </ul>
      ) : (
        <>
          {/* 原始的選號：複式一排；膽拖分成膽、拖兩排 */}
          <div className="flex flex-col gap-2 rounded-button bg-sunken px-3 py-2.5">
            {ticket.betType === "MULTIPLE" ? (
              <HitBalls numbers={ticket.numbers ?? []} draw={draw} />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="min-w-7 shrink-0 text-xs text-muted">{t("bankers")}</span>
                  <HitBalls numbers={ticket.bankers ?? []} draw={draw} banker />
                </div>
                <div className="flex items-center gap-3">
                  <span className="min-w-7 shrink-0 text-xs text-muted">{t("legs")}</span>
                  <HitBalls numbers={ticket.legs ?? []} draw={draw} />
                </div>
              </>
            )}
          </div>
          {results && <WinSummary results={results} />}
          {/* 展開後的每一注：收合起來，展開時只列號碼和結果（最多 210 注，不畫成號碼球） */}
          <details className="group">
            <summary className="w-fit cursor-pointer list-none text-[13px] text-gold marker:hidden hover:underline">
              <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
                ▸
              </span>
              {t("showLines", { count: ticket.lines.length })}
            </summary>
            <ul className="m-0 mt-2 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0">
              {ticket.lines.map((line, i) => {
                const r = results?.[i];
                return (
                  <li
                    key={i}
                    className={cn("flex justify-between gap-3 rounded-control bg-sunken px-2.5 py-1 font-num text-[15px] tabular-nums", r?.tier ? "text-gold" : "text-fg-soft")}
                  >
                    <span className="flex gap-2.5">
                      {line.map((n) => (
                        <span key={n} className="w-5 text-right">
                          {n}
                        </span>
                      ))}
                    </span>
                    {r && <span className="text-[13px]">{r.tier ? t("linePrize", { tier: tt(r.tier), points: format.number(r.prize) }) : t("hits", { count: r.matched })}</span>}
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}

      <div className="flex justify-between gap-3 text-xs text-muted">
        <LocalTime value={ticket.createdAt} dateStyle="short" timeStyle="short" />
        <span>{t("cost", { count: ticket.lines.length, points: format.number(ticket.cost) })}</span>
      </div>
    </li>
  );
}

type DrawResultLike = { numbers: number[]; special: number } | null;

/** 號碼球：有開獎號碼時，中的正碼金框、特別號碼另外標，沒中的變淡 */
function HitBalls({ numbers, draw, banker = false }: { numbers: number[]; draw: DrawResultLike; banker?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {numbers.map((n) => {
        const hit = draw?.numbers.includes(n);
        const special = draw?.special === n;
        return (
          <Ball
            key={n}
            number={n}
            size="sm"
            className={cn(
              "size-7 text-sm",
              draw && !hit && !special && "opacity-35",
              hit && "ring-2 ring-gold",
              special && "ring-2 ring-fg-soft",
              !draw && banker && "ring-2 ring-gold/70",
            )}
          />
        );
      })}
    </span>
  );
}

/** 單式的一注：號碼 + 結果 */
function LineRow({ line, draw, result }: { line: number[]; draw: DrawResultLike; result: LineResult | undefined }) {
  const t = useTranslations("MyBets");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-sunken px-3 py-2">
      <HitBalls numbers={line} draw={draw} />
      {result && (
        <span className={cn("text-sm", result.tier ? "font-bold text-gold" : "text-muted")}>
          {result.tier ? t("linePrize", { tier: tt(result.tier), points: format.number(result.prize) }) : t("hits", { count: result.matched })}
        </span>
      )}
    </li>
  );
}

/** 複式、膽拖的中獎摘要：每個獎級中了幾注、獎金合計 */
function WinSummary({ results }: { results: LineResult[] }) {
  const t = useTranslations("MyBets");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  const byTier = TIERS.map((tier) => {
    const hits = results.filter((r) => r.tier === tier);
    return { tier, count: hits.length, points: hits.reduce((sum, r) => sum + r.prize, 0) };
  }).filter((g) => g.count > 0);
  if (byTier.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-fg-soft">
      {byTier.map((g) => (
        <li key={g.tier} className="flex justify-between gap-3">
          <span>{t("tierLines", { tier: tt(g.tier), count: g.count })}</span>
          <b className="font-num text-base text-gold">+{format.number(g.points)}</b>
        </li>
      ))}
    </ul>
  );
}
