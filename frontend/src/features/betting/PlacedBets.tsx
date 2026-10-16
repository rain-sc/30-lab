"use client";

import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { useSession } from "@/features/auth/session";
import type { NextDraw } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { useUserBets } from "./mockBets";

/** 最多顯示幾注，其餘到「我的注單」看（避免下很多注時把大廳拉得很長） */
const MAX_SHOWN = 4;

/** 本期已下注的注單（大廳桌面版） */
export function PlacedBets({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Betting");
  const user = useSession((s) => s.user);
  const bets = useUserBets(user?.username).filter((b) => b.drawNo === next?.drawNo);

  if (bets.length === 0) return <p className="m-0 text-[13px] text-muted">{t("placedEmpty")}</p>;

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {bets.slice(0, MAX_SHOWN).map((bet) => (
          <li key={bet.id} className="flex gap-1 rounded-button bg-sunken px-2.5 py-2">
            {bet.numbers.map((n) => (
              <Ball key={n} number={n} size="sm" className="size-6.5 text-[13px]" />
            ))}
          </li>
        ))}
      </ul>
      {bets.length > MAX_SHOWN && (
        <Link href="/bets" className="text-[13px] text-gold no-underline hover:underline">
          {t("placedMore", { count: bets.length - MAX_SHOWN })}
        </Link>
      )}
    </>
  );
}
