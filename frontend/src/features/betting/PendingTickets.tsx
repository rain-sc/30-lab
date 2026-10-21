"use client";

import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { ClickSpark } from "@/components/fx/ClickSpark";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useBetting } from "./store";
import { usePlaceBets, type PlaceFeedback } from "./usePlaceBets";

/** 待下注列表：每注可以移除；合計和「確認下注」只在桌面版顯示，手機版由固定在底部的 MobileBetBar 負責 */
export function PendingTickets() {
  const t = useTranslations("Betting");
  const format = useFormatter();
  const removePending = useBetting((s) => s.removePending);
  const { pending, cost, closed, disabled, submitting, submit, feedback } = usePlaceBets();

  return (
    <div className="flex h-full flex-col gap-2.5">
      <h2 className="m-0 text-base">{t("pending")}</h2>

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

      <div className="mt-auto hidden flex-col gap-2.5 pt-1 md:flex">
          <div className="flex items-baseline justify-between border-t border-line pt-2.5 text-sm">
            <span className="text-muted">{t("ticketCount", { count: pending.length })}</span>
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
          <Feedback feedback={feedback} />
      </div>
    </div>
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
