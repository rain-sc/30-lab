"use client";

import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { useSession } from "@/features/auth/session";
import type { NextDraw } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useRecentTickets } from "./api";

/** 最多顯示幾注，其餘到「我的注單」看（避免下很多注時把大廳拉得很長） */
const MAX_SHOWN = 4;

/** 本期已下注（大廳桌面版）：目前這一期所有注單的每一注 */
export function PlacedBets({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Betting");
  const username = useSession((s) => s.user?.username);
  const { data } = useRecentTickets(username);
  const lines = (data?.list ?? []).filter((ticket) => ticket.drawNo === next?.drawNo).flatMap((ticket) => ticket.lines);

  if (!data) return <div aria-hidden="true" className="h-10 animate-pulse rounded-button bg-sunken motion-reduce:animate-none" />;
  if (lines.length === 0) return <p className="m-0 text-[13px] text-muted">{t("placedEmpty")}</p>;

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.slice(0, MAX_SHOWN).map((line, i) => (
          <li key={i} className="flex gap-1 rounded-button bg-sunken px-2.5 py-2">
            {line.map((n) => (
              <Ball key={n} number={n} size="sm" className="size-6.5 text-[13px]" />
            ))}
          </li>
        ))}
      </ul>
      {lines.length > MAX_SHOWN && (
        <Link href="/bets" className="text-[13px] text-gold no-underline hover:underline">
          {t("placedMore", { count: lines.length - MAX_SHOWN })}
        </Link>
      )}
    </>
  );
}
