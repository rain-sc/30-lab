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
import { useTickets, type Ticket } from "./api";

const PAGE_SIZE = 20;

/**
 * 我的注單（GET /api/tickets，分頁），新的在上；一張注單 = 一次確認下注，裡面有一到多注。
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

  return (
    <li className={cn("flex flex-col gap-3 rounded-card border bg-panel p-4 md:p-5", won ? "border-gold/60" : "border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="m-0 font-num text-lg font-bold tabular-nums">{t("drawNo", { drawNo: ticket.drawNo })}</h2>
          <span className={cn("text-sm", won ? "font-bold text-gold" : "text-muted")}>{status}</span>
        </div>
        {draw ? (
          <ResultBalls result={draw} size="xs" />
        ) : (
          revealed && missing && <span className="text-xs text-muted">{t("notFound")}</span>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ticket.lines.map((line, i) => {
          const r = results?.[i];
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-sunken px-3 py-2">
              <span className="flex gap-1">
                {line.map((n) => {
                  // 有開獎號碼時標出中的號碼（正碼金框；特別號碼另外標）
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
                      )}
                    />
                  );
                })}
              </span>
              {r && (
                <span className={cn("text-sm", r.tier ? "font-bold text-gold" : "text-muted")}>
                  {r.tier
                    ? t("linePrize", { tier: tt(r.tier), points: format.number(r.prize) })
                    : t("hits", { count: r.matched })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between gap-3 text-xs text-muted">
        <LocalTime value={ticket.createdAt} dateStyle="short" timeStyle="short" />
        <span>{t("cost", { count: ticket.lines.length, points: format.number(ticket.cost) })}</span>
      </div>
    </li>
  );
}
