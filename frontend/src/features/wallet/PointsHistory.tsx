"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/auth/session";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import { useWalletTransactions } from "./api";

const PAGE_SIZE = 20;

/** 積分紀錄（GET /api/wallet/transactions，分頁）：每筆的類型、時間、增減、變動後餘額 */
export function PointsHistory() {
  const t = useTranslations("Points");
  const format = useFormatter();
  const errorText = useApiErrorText();
  const username = useSession((s) => s.user?.username);
  const [page, setPage] = useState(1);
  const query = useWalletTransactions(username, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

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
    return <div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />;
  }
  if (query.data.list.length === 0) return <p className="m-0 py-12 text-center text-muted">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <ol className="m-0 flex list-none flex-col rounded-card border border-line bg-panel px-4 py-1 md:px-5.5">
        {query.data.list.map((tx, i) => (
          <li
            key={`${tx.createdAt}-${i}`}
            className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{t("type", { type: tx.type })}</span>
              <time dateTime={tx.createdAt} className="text-xs text-muted">
                {format.dateTime(new Date(tx.createdAt), { dateStyle: "short", timeStyle: "short" })}
              </time>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={cn("font-num text-lg font-bold tabular-nums", tx.amount > 0 ? "text-gold" : "text-fg-soft")}>
                {tx.amount > 0 ? "+" : "−"}
                {format.number(Math.abs(tx.amount))}
              </span>
              <span className="text-xs text-muted">{t("balanceAfter", { points: format.number(tx.balanceAfter) })}</span>
            </div>
          </li>
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
