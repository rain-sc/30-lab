"use client";

import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { ClickSpark } from "@/components/fx/ClickSpark";
import { Button } from "@/components/ui/Button";
import { useGameRules } from "@/features/draw/rules";
import { cn } from "@/lib/utils";
import { choose, useBetting } from "./store";
import { usePlaceBets, useProblemText, type PlaceFeedback } from "./usePlaceBets";

const sorted = (list: number[]) => [...list].sort((a, b) => a - b);

/**
 * 選號盤旁邊的卡片：
 * - 單式：待下注列表，每注可以移除
 * - 複式、膽拖：這一組的明細（膽、拖分開）、注數的算法；待下注裡的單式保留，提示切回單式可以送出
 * 合計和「確認下注」只在桌面版顯示，手機版由固定在底部的 MobileBetBar 負責
 */
export function PendingTickets() {
  const t = useTranslations("Betting");
  const format = useFormatter();
  const problemText = useProblemText();
  const { mode, pending, selection, cost, closed, disabled, submitting, submit, feedback } = usePlaceBets();
  const problem = problemText(selection.problem);

  return (
    <div className="flex h-full flex-col gap-2.5">
      <h2 className="m-0 text-base">{mode === "SINGLE" ? t("pending") : t("selectionHeading", { mode })}</h2>

      {mode === "SINGLE" ? <PendingList /> : <SelectionDetail />}

      <div className="mt-auto hidden flex-col gap-2.5 pt-1 md:flex">
        <div className="flex items-baseline justify-between border-t border-line pt-2.5 text-sm">
          <span className="text-muted">{t("ticketCount", { count: selection.lines })}</span>
          <span>
            {t.rich("cost", {
              points: format.number(cost),
              b: (chunks) => <b className="font-num text-xl tabular-nums">{chunks}</b>,
            })}
          </span>
        </div>
        <ClickSpark className="w-full">
          <Button onClick={submit} disabled={disabled} loading={submitting} className="w-full text-base">
            {closed ? t("closedButton") : t("submit")}
          </Button>
        </ClickSpark>
        <Feedback feedback={feedback ?? (problem ? { tone: "error", text: problem } : null)} />
      </div>
      {mode !== "SINGLE" && pending.length > 0 && <p className="m-0 text-xs text-muted">{t("pendingKept", { count: pending.length })}</p>}
    </div>
  );
}

function PendingList() {
  const t = useTranslations("Betting");
  const pending = useBetting((s) => s.pending);
  const removePending = useBetting((s) => s.removePending);
  return (
    <>
      {pending.length === 0 && <p className="m-0 text-[13px] leading-relaxed text-muted">{t("pendingEmpty")}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <AnimatePresence initial={false}>
          {pending.map((ticket, i) => (
            <motion.li
              key={ticket.join("-") + i}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-1.5 rounded-button bg-sunken py-2 pr-1 pl-2.5"
            >
              <span className="flex gap-1">
                {ticket.map((n) => (
                  <Ball key={n} number={n} size="sm" className="size-6.5 text-[13px]" />
                ))}
              </span>
              <button
                type="button"
                aria-label={t("remove", { numbers: ticket.join(", ") })}
                onClick={() => removePending(i)}
                className="grid size-9 place-items-center rounded-control text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-gold"
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

/** 複式、膽拖：這一組選了什麼、展開成幾注 */
function SelectionDetail() {
  const t = useTranslations("Betting");
  const format = useFormatter();
  const mode = useBetting((s) => s.mode);
  const multi = useBetting((s) => s.multi);
  const bankers = useBetting((s) => s.bankers);
  const legs = useBetting((s) => s.legs);
  const rules = useGameRules();
  const balls = (list: number[], banker = false) => (
    <span className="flex flex-wrap gap-1">
      {sorted(list).map((n) => (
        <Ball key={n} number={n} size="sm" className={cn("size-6.5 text-[13px]", banker && "ring-2 ring-gold")} />
      ))}
    </span>
  );
  const b = (chunks: React.ReactNode) => <b className="font-num text-lg text-fg tabular-nums">{chunks}</b>;

  if (mode === "MULTIPLE") {
    const n = multi.length;
    return (
      <>
        {n === 0 ? <p className="m-0 text-[13px] text-muted">{t("multiEmpty", { min: rules.pickCount + 1, max: rules.maxMultipleNumbers })}</p> : balls(multi)}
        {n > rules.pickCount && (
          <p className="m-0 rounded-button bg-sunken px-3 py-2 text-[13px] text-fg-soft">
            {t.rich("multiFormula", { n, k: rules.pickCount, lines: format.number(choose(n, rules.pickCount)), b })}
          </p>
        )}
      </>
    );
  }
  const k = bankers.length;
  const m = legs.length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("bankersLabel", { count: k })}</span>
        {k === 0 ? <span className="text-[13px] text-muted">{t("noneYet")}</span> : balls(bankers, true)}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("legsLabel", { count: m })}</span>
        {m === 0 ? <span className="text-[13px] text-muted">{t("noneYet")}</span> : balls(legs)}
      </div>
      {k >= 1 && k + m > rules.pickCount && (
        <p className="m-0 rounded-button bg-sunken px-3 py-2 text-[13px] text-fg-soft">
          {t.rich("bankerFormula", { k, m, need: rules.pickCount - k, lines: format.number(choose(m, rules.pickCount - k)), b })}
        </p>
      )}
    </>
  );
}

export function Feedback({ feedback, className }: { feedback: PlaceFeedback; className?: string }) {
  return (
    <p
      aria-live="polite"
      className={cn("m-0 min-h-5 text-center text-[13px]", feedback?.tone === "error" ? "text-danger" : "text-gold", className)}
    >
      {feedback?.text}
    </p>
  );
}
