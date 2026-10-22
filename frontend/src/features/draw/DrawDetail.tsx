"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import { fetchWinners, type PrizeSummary } from "./api";

/** 頭獎到三獎用金色 */
const TOP_TIERS = new Set(["FIRST", "SECOND", "THIRD"]);

/**
 * 開獎紀錄展開的一期：獎級統計 + 中獎名單。
 * - 只會出現在已經公布（開獎動畫播完）的期數：開獎紀錄本來就濾掉還沒公布的，不會提前暴露
 * - 還沒結算（沒有 prizeSummary）時顯示「結算中」，也不抓名單（結算前抓到的是空的，又會被快取）
 * - 名單在展開時才抓；結算後不會再變，一直快取
 */
export function DrawDetail({ drawNo, summary }: { drawNo: string; summary: PrizeSummary | undefined }) {
  const t = useTranslations("Draws");
  const tt = useTranslations("Tier");
  const format = useFormatter();

  if (!summary) return <p className="m-0 py-2 text-sm text-muted">{t("settling")}</p>;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-medium text-fg-soft">
          {t.rich("summary", {
            count: summary.winnerCount,
            points: format.number(summary.totalPayout),
            b: (chunks) => <b className="font-num text-base text-gold">{chunks}</b>,
          })}
        </h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium">{t("colTier")}</th>
              <th className="py-1 text-right font-medium">{t("colLines")}</th>
              <th className="py-1 text-right font-medium">{t("colPrize")}</th>
            </tr>
          </thead>
          <tbody>
            {summary.tiers.map((tier) => {
              const hit = tier.lines > 0;
              return (
                <tr key={tier.tier} className={cn("border-t border-line", !hit && "text-muted")}>
                  <td className={cn("py-1.5", hit && TOP_TIERS.has(tier.tier) && "font-bold text-gold")}>{tt(tier.tier)}</td>
                  <td className="py-1.5 text-right font-num text-[15px] tabular-nums">{format.number(tier.lines)}</td>
                  <td className="py-1.5 text-right font-num text-[15px] tabular-nums">
                    {/* 沒人中頭獎：prize 是 0，彩池滾到下一期 */}
                    {tier.tier === "FIRST" && !hit ? t("rolled") : format.number(tier.prize)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <Winners drawNo={drawNo} />
    </div>
  );
}

function Winners({ drawNo }: { drawNo: string }) {
  const t = useTranslations("Draws");
  const tt = useTranslations("Tier");
  const format = useFormatter();
  const errorText = useApiErrorText();
  const query = useQuery({
    queryKey: ["draw-winners", drawNo],
    queryFn: () => fetchWinners(drawNo),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
  const data = query.data;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 text-sm font-medium text-fg-soft">
        {t("winnersTitle")}
        {data && data.winnerCount > data.winners.length && (
          <span className="ml-2 text-xs font-normal text-muted">
            {t("winnersTop", {
              shown: data.winners.length,
              total: data.winnerCount,
            })}
          </span>
        )}
      </h3>
      {query.isError && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="m-0 text-sm text-danger">{t("winnersError", { reason: errorText(query.error) })}</p>
          <Button variant="ghost" className="h-8 text-sm" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !data ? (
        <div aria-hidden="true" className="flex flex-col gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-control bg-sunken motion-reduce:animate-none" />
          ))}
        </div>
      ) : data.winners.length === 0 ? (
        <p className="m-0 text-sm text-muted">{t("noWinners")}</p>
      ) : (
        <ol className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0">
          {/* 暱稱會重複，key 用索引 */}
          {data.winners.map((w, i) => (
            <li key={i} className={cn("flex items-center gap-3 rounded-control px-3 py-1.5", w.me ? "border border-gold/40 bg-gold/8" : "bg-sunken")}>
              <span className="w-5 shrink-0 text-right font-num text-sm text-muted tabular-nums">{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="truncate">{w.nickname}</span>
                  {w.me && <span className="shrink-0 rounded-full bg-gold/15 px-2 text-[11px] font-bold text-gold">{t("me")}</span>}
                </span>
                <span className="text-xs text-fg-soft">
                  <b className={cn("font-bold", TOP_TIERS.has(w.bestTier) ? "text-gold" : "text-fg")}>{tt(w.bestTier)}</b>
                  {" · "}
                  {t("lines", { count: w.winningLines })}
                </span>
              </span>
              <span className="shrink-0 font-num text-base font-bold text-gold tabular-nums">+{format.number(w.payout)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
