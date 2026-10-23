"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Feedback } from "./PendingTickets";
import { useBetting } from "./store";
import { usePlaceBets, useProblemText } from "./usePlaceBets";

/** 手機版：固定在底部分頁上方的下注列（單式：待下注幾注；複式、膽拖：這一組幾注）、合計、確認下注 */
export function MobileBetBar() {
  const t = useTranslations("Betting");
  const format = useFormatter();
  const problemText = useProblemText();
  const { mode, selection, cost, closed, disabled, submitting, submit, feedback } = usePlaceBets();
  const multi = useBetting((s) => s.multi.length);
  const bankers = useBetting((s) => s.bankers.length);
  const legs = useBetting((s) => s.legs.length);
  const num = (chunks: React.ReactNode) => <b className="font-num text-[22px] tabular-nums">{chunks}</b>;
  const problem = problemText(selection.problem);

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+max(8px,env(safe-area-inset-bottom)))] z-20 px-4 pb-2 md:hidden">
      <Feedback
        feedback={feedback ?? (problem && mode !== "SINGLE" ? { tone: "error", text: problem } : null)}
        className="mb-1.5 rounded-control bg-stage/90 py-1 empty:hidden"
      />
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-panel py-2 pr-2 pl-4 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs text-muted">
            {mode === "SINGLE" ? t("pending") : mode === "MULTIPLE" ? t("barMulti", { count: multi }) : t("barBanker", { bankers, legs })}
          </span>
          <span className="text-sm">{t.rich("barSummary", { count: selection.lines, points: format.number(cost), b: num })}</span>
        </div>
        <Button onClick={submit} disabled={disabled} loading={submitting} className="h-11.5 shrink-0 px-5 text-base">
          {closed ? t("closedButton") : t("submit")}
        </Button>
      </div>
    </div>
  );
}
