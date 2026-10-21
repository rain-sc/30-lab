"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import type { Draw } from "./feed";
import { ResultBalls } from "./ResultBalls";
import { useDrawHistory } from "./useDrawHistory";
import type { NextDraw } from "./useNextDraw";

const PAGE_SIZE = 20;

/** 大廳的近期開獎：最新的 count 期 */
export function RecentDraws({ next, count }: { next: NextDraw | null; count: number }) {
  // 多抓一筆：最新那期還在播開獎動畫時會被濾掉，列表仍然有 count 筆
  const history = useDrawHistory(1, count + 1, next);
  return <HistoryState history={history} rows={count} draws={history.list.slice(0, count)} />;
}

/** 開獎紀錄頁：分頁 */
export function DrawHistory({ next }: { next: NextDraw | null }) {
  const t = useTranslations("Draws");
  const [page, setPage] = useState(1);
  const history = useDrawHistory(page, PAGE_SIZE, next);
  const pages = Math.max(1, Math.ceil((history.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <HistoryState history={history} rows={8} draws={history.list} />
      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-line pt-3">
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

/** 載入中（骨架）/ 錯誤（重試）/ 沒有資料 / 列表 */
function HistoryState({
  history,
  rows,
  draws,
}: {
  history: ReturnType<typeof useDrawHistory>;
  rows: number;
  draws: Draw[];
}) {
  const t = useTranslations("Draws");
  const errorText = useApiErrorText();

  if (history.isError && !history.data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 py-2">
        <p className="m-0 text-sm text-danger">{t("error", { reason: errorText(history.error) })}</p>
        <Button variant="ghost" className="h-9 text-sm" onClick={() => history.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!history.data) {
    return (
      <div aria-hidden="true" className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="my-2 h-7 animate-pulse rounded-control bg-sunken motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  if (draws.length === 0) return <p className="m-0 py-2 text-sm text-muted">{t("empty")}</p>;
  return <DrawList draws={draws} />;
}

function DrawList({ draws }: { draws: Draw[] }) {
  const format = useFormatter();
  const t = useTranslations("Draws");
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {draws.map((d) => (
        <li
          key={d.drawNo}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line py-2.5 first:border-t-0"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-num text-[17px] tabular-nums">{d.drawNo}</span>
            <time dateTime={d.drawAt} className="text-sm text-muted">
              {format.dateTime(new Date(d.drawAt), { hour: "2-digit", minute: "2-digit" })}
            </time>
            {/* 結算後才有：這期的頭獎彩池、中頭獎的注數（0 = 沒人中，滾到下一期） */}
            {d.poolAmount !== undefined && (
              <span className={cn("text-xs", d.jackpotWinners ? "font-bold text-gold" : "text-muted")}>
                {d.jackpotWinners
                  ? t("jackpotWon", { count: d.jackpotWinners, points: format.number(d.poolAmount) })
                  : t("rolledOver", { points: format.number(d.poolAmount) })}
              </span>
            )}
          </div>
          {d.numbers && d.specialNumber !== undefined && (
            <ResultBalls result={{ numbers: d.numbers, special: d.specialNumber }} size="xs" />
          )}
        </li>
      ))}
    </ol>
  );
}
