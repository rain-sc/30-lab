"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useDrawFeed } from "./feed";
import { sampleRecentDraws } from "./mock";
import { ResultBalls } from "./ResultBalls";
import type { NextDraw } from "./useNextDraw";

/** 近期開獎：期數、時間、號碼，新的在上；前端沒收到真實結果的期數用示例補上，並標「示例」 */
export function RecentDraws({ next, count }: { next: NextDraw | null; count: number }) {
  const format = useFormatter();
  const t = useTranslations("Live");
  const results = useDrawFeed((s) => s.results);
  // 開獎動畫播完才列出（見 NextDraw.revealedDrawAt）
  const revealedDrawAt = next?.revealedDrawAt;
  const draws = useMemo(
    () => (revealedDrawAt ? sampleRecentDraws(revealedDrawAt, count, results) : []),
    [revealedDrawAt, count, results],
  );

  if (!next) {
    return <div aria-hidden="true" className="h-40" />;
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {draws.map((d) => (
        <li
          key={d.drawNo}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line py-2.5 first:border-t-0"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-num text-[17px] tabular-nums">{d.drawNo}</span>
            <time dateTime={new Date(d.drawAt).toISOString()} className="text-sm text-muted">
              {format.dateTime(d.drawAt, { hour: "2-digit", minute: "2-digit" })}
            </time>
            {d.sample && (
              <span className="rounded-md border border-line px-1.5 text-[11px] text-muted">{t("sampleShort")}</span>
            )}
          </div>
          <ResultBalls result={d} size="xs" />
        </li>
      ))}
    </ol>
  );
}
