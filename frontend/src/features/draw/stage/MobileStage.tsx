"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CountdownDigits } from "../Countdown";
import { StagePreview } from "../StagePreview";
import { useNextDraw } from "../useNextDraw";
import { DrawStage } from "./DrawStage";
import { useStagePhase } from "./useStagePhase";

/**
 * 手機版的舞台：平常是卡片右邊的縮圖（靜態，不跑 WebGL），點一下放大成全畫面的 3D 舞台。
 * 截止到開完獎（約 40 秒）自動放大，開完自動收起；使用者自己關掉的話，這一期不再自動打開。
 * 關閉動畫的使用者不自動打開。
 */
export function MobileStage({ className }: { className?: string }) {
  const t = useTranslations("Stage");
  const next = useNextDraw();
  const reduced = useReducedMotion() ?? false;
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissedDrawAt, setDismissedDrawAt] = useState<number | null>(null);

  const phase = useStagePhase(reduced);
  const autoOpen = !reduced && phase !== null && phase.kind !== "idle" && dismissedDrawAt !== phase.drawAt;
  const open = manualOpen || autoOpen;

  const close = () => {
    setManualOpen(false);
    if (phase && phase.kind !== "idle") setDismissedDrawAt(phase.drawAt);
  };

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <button
        type="button"
        aria-label={t("open")}
        aria-expanded={open}
        onClick={() => setManualOpen(true)}
        className={cn("relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold", className)}
      >
        <StagePreview className="w-full" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel px-2 py-px text-[10px] whitespace-nowrap text-fg-soft">
          {t("tapToPlay")}
        </span>
      </button>

      {/* 放到 body 底下：外層卡片有進場動畫（transform），fixed 會變成相對卡片定位 */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("title")}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-x-0 top-0 bottom-[calc(60px+max(8px,env(safe-area-inset-bottom)))] z-40 flex flex-col bg-[radial-gradient(80%_60%_at_50%_45%,var(--color-stage-glow)_0%,var(--color-stage)_75%)] md:hidden"
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-3">
                <CountdownDigits next={next} className="text-[40px]" />
                <button
                  type="button"
                  onClick={close}
                  className="h-10 rounded-button border border-line bg-panel px-4 text-sm text-fg focus-visible:outline-2 focus-visible:outline-gold"
                >
                  {t("close")}
                </button>
              </div>
              <DrawStage className="m-3 flex-1 rounded-card border border-line" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
