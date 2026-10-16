"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { useSession } from "@/features/auth/session";
import { sampleResultFor } from "@/features/draw/mock";
import { ResultBalls } from "@/features/draw/ResultBalls";
import { useNow } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { settle, useUserBets } from "./mockBets";

/** 我的注單：依期數分組，新的在上；已開獎的顯示開獎號碼、中了哪些號碼、獎級和獎金 */
export function MyBets() {
  const t = useTranslations("MyBets");
  const format = useFormatter();
  const user = useSession((s) => s.user);
  const bets = useUserBets(user?.username);
  const now = useNow();

  const groups = useMemo(() => {
    if (now === null) return [];
    const map = new Map<string, ReturnType<typeof settle>>();
    for (const bet of settle(bets, now)) map.set(bet.drawNo, [...(map.get(bet.drawNo) ?? []), bet]);
    return [...map.entries()];
  }, [bets, now]);

  if (now === null) return <div aria-hidden="true" className="h-40" />;

  if (groups.length === 0) {
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
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {groups.map(([drawNo, list]) => {
        const drawn = list[0].result !== null;
        const won = list.reduce((sum, b) => sum + (b.result?.prize ?? 0), 0);
        return (
          <li key={drawNo} className="flex flex-col gap-3 rounded-card border border-line bg-panel p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-baseline gap-3">
                <h2 className="m-0 font-num text-lg font-bold tabular-nums">{t("drawNo", { drawNo })}</h2>
                <span className={cn("text-sm", won > 0 ? "font-bold text-gold" : "text-muted")}>
                  {!drawn ? t("waiting") : won > 0 ? t("won", { points: format.number(won) }) : t("lost")}
                </span>
              </div>
              {drawn && <ResultBalls result={sampleResultFor(drawNo)} size="xs" />}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.map((bet) => (
                <li
                  key={bet.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-sunken px-3 py-2"
                >
                  <span className="flex gap-1">
                    {bet.numbers.map((n) => {
                      const hit = bet.result?.matched.includes(n);
                      return (
                        <Ball
                          key={n}
                          number={n}
                          size="sm"
                          className={cn(
                            "size-7 text-sm",
                            bet.result && !hit && "opacity-35",
                            hit && "ring-2 ring-gold",
                          )}
                        />
                      );
                    })}
                  </span>
                  {bet.result && (
                    <span className={cn("text-sm", bet.result.tier ? "font-bold text-gold" : "text-muted")}>
                      {bet.result.tier
                        ? t("tierPrize", { tier: bet.result.tier, points: format.number(bet.result.prize) })
                        : t("hits", { count: bet.result.matched.length })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
