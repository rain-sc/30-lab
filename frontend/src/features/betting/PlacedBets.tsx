"use client";

import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { useSession } from "@/features/auth/session";
import type { NextDraw } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useRecentTickets, type Ticket } from "./api";

/** 最多顯示幾列，其餘到「我的注單」看（避免下很多注時把大廳拉得很長） */
const MAX_SHOWN = 4;

/** 一列：單式是一注；複式、膽拖是一整張注單（摘要，不展開） */
type Row = { kind: "line"; numbers: number[] } | { kind: "ticket"; ticket: Ticket };

/** 本期已下注（大廳桌面版）：目前這一期的注單 */
export function PlacedBets({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Betting");
  const username = useSession((s) => s.user?.username);
  const { data } = useRecentTickets(username);
  const rows: Row[] = (data?.list ?? [])
    .filter((ticket) => ticket.drawNo === next?.drawNo)
    .flatMap((ticket): Row[] => (ticket.betType === "SINGLE" ? ticket.lines.map((numbers) => ({ kind: "line", numbers })) : [{ kind: "ticket", ticket }]));

  if (!data) return <div aria-hidden="true" className="h-10 animate-pulse rounded-button bg-sunken motion-reduce:animate-none" />;
  if (rows.length === 0) return <p className="m-0 text-[13px] text-muted">{t("placedEmpty")}</p>;

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.slice(0, MAX_SHOWN).map((row, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-button bg-sunken px-2.5 py-2">
            {row.kind === "line" ? <Balls numbers={row.numbers} /> : <TicketSummary ticket={row.ticket} />}
          </li>
        ))}
      </ul>
      {rows.length > MAX_SHOWN && (
        <Link href="/bets" className="text-[13px] text-gold no-underline hover:underline">
          {t("placedMore", { count: rows.length - MAX_SHOWN })}
        </Link>
      )}
    </>
  );
}

function Balls({ numbers, banker = false }: { numbers: number[]; banker?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {numbers.map((n) => (
        <Ball key={n} number={n} size="sm" className={banker ? "size-6.5 text-[13px] ring-2 ring-gold" : "size-6.5 text-[13px]"} />
      ))}
    </span>
  );
}

/** 複式：玩法 · 幾注 + 選的號碼；膽拖：玩法 · 幾注 + 膽（金框）| 拖 */
function TicketSummary({ ticket }: { ticket: Ticket }) {
  const t = useTranslations("Betting");
  return (
    <>
      <span className="rounded-full border border-gold/50 px-2 text-[11px] font-bold text-gold">
        {t("placedTicket", { mode: ticket.betType, count: ticket.lines.length })}
      </span>
      {ticket.betType === "MULTIPLE" && <Balls numbers={ticket.numbers ?? []} />}
      {ticket.betType === "BANKER" && (
        <>
          <Balls numbers={ticket.bankers ?? []} banker />
          <span aria-hidden="true" className="text-muted">
            |
          </span>
          <Balls numbers={ticket.legs ?? []} />
        </>
      )}
    </>
  );
}
