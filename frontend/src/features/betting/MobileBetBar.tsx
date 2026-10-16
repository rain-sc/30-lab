"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Feedback } from "./PendingTickets";
import { usePlaceBets } from "./usePlaceBets";

/** 手機版：固定在底部分頁上方的下注列（待下注幾注、合計、確認下注） */
export function MobileBetBar() {
  const t = useTranslations("Betting");
  const format = useFormatter();
  const { pending, cost, closed, disabled, submit, feedback } = usePlaceBets();
  const num = (chunks: React.ReactNode) => <b className="font-num text-[22px] tabular-nums">{chunks}</b>;

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+max(8px,env(safe-area-inset-bottom)))] z-20 px-4 pb-2 md:hidden">
      <Feedback feedback={feedback} className="mb-1.5 rounded-control bg-stage/90 py-1 empty:hidden" />
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-panel py-2 pr-2 pl-4 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col">
          <span className="text-xs text-muted">{t("pending")}</span>
          <span className="text-sm">
            {t.rich("barSummary", { count: pending.length, points: format.number(cost), b: num })}
          </span>
        </div>
        <Button onClick={submit} disabled={disabled} className="h-11.5 px-5 text-base">
          {closed ? t("closedButton") : t("submit")}
        </Button>
      </div>
    </div>
  );
}
