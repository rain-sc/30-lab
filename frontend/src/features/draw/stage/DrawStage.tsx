"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { feedNow, useDrawFeed } from "../feed";
import { useGameRules } from "../rules";
import { StageLoading } from "../StagePreview";
import { stagePhaseAt } from "./timeline";
import { useStagePhase } from "./useStagePhase";

/** 舞台每一幀的階段：用校正過的時間 + 後端的期數資料（feed.ts） */
const phaseNow = (reduced: boolean) => stagePhaseAt(feedNow(), useDrawFeed.getState(), reduced);

/**
 * 開獎舞台（3D）。一頁只能放一個（WebGL 場景很吃資源）。
 * - three + matter 動態載入：載入完成前顯示 2D 的繞圈動畫（StagePreview）
 * - 卸載或被 Activity 隱藏時（effect 清除）釋放 WebGL；回來時重建，動畫依時間接著播
 * - reduced-motion：不攪珠、不播開球動畫，開獎一到直接擺好
 */
export function DrawStage({ className, hint = true }: { className?: string; hint?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion() ?? false;
  // 規則載入後球數變了（預設值 → 後端的設定）要重建舞台
  const { maxNumber } = useGameRules();
  const t = useTranslations("Stage");

  useEffect(() => {
    let disposed = false;
    let stage: { dispose(): void } | null = null;
    // 每次都建立新的 canvas：dispose 會 forceContextLoss，同一個 canvas 的 WebGL context 不能再用
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 size-full touch-none";
    import("./engine")
      .then(({ createStage }) => {
        if (disposed || !hostRef.current) return;
        hostRef.current.appendChild(canvas);
        stage = createStage({
          canvas,
          // 依畫布區域（狀態標籤下方）的大小對焦，不是整個卡片
          container: hostRef.current,
          getPhase: () => phaseNow(reduced),
          reducedMotion: reduced,
          maxNumber,
          onReady: () => setReady(true),
        });
      })
      .catch(() => setFailed(true)); // 不支援 WebGL 或載入失敗：留著 2D 的攪珠台，球停住
    return () => {
      disposed = true;
      stage?.dispose();
      canvas.remove();
      setReady(false);
    };
  }, [reduced, maxNumber]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* 載入前：和 canvas 同樣大小的區域，結果列、水晶球擺在 3D 的位置（StageLoading） */}
      {!ready && <StageLoading className="absolute inset-x-0 top-10 bottom-0" moving={!failed} caption={failed ? t("unsupported") : t("loading")} />}
      {/* canvas 由 effect 建立、放進這裡（React 不管理它的內容）；上方留給狀態標籤，結果列的球不會被蓋到 */}
      <div
        ref={hostRef}
        data-ready={ready || undefined}
        className={cn("absolute inset-x-0 top-10 bottom-0 transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      />
      <StageStatus reduced={reduced} hint={hint && ready} />
    </div>
  );
}

/** 舞台上的狀態標籤和操作提示（螢幕閱讀器也會讀到開獎進度） */
function StageStatus({ reduced, hint }: { reduced: boolean; hint: boolean }) {
  const t = useTranslations("Stage");
  const phase = useStagePhase(reduced);

  const label =
    phase === null
      ? ""
      : phase.kind === "mixing"
        ? t("mixing")
        : phase.kind === "drawing"
          ? t("drawing", { index: Math.min(7, phase.revealed + 1) })
          : t("drawn");

  return (
    <>
      <span
        aria-live="polite"
        className={cn(
          "absolute top-3 left-3 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm",
          phase?.kind === "idle" || phase === null ? "border-line bg-sunken/70 text-fg-soft" : "border-gold bg-sunken/70 text-gold",
          !label && "hidden",
        )}
      >
        {label}
      </span>
      {hint && phase?.kind === "idle" && (
        <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-stage/70 px-2.5 py-1 text-[11px] whitespace-nowrap text-muted">
          {t("hint")}
        </span>
      )}
    </>
  );
}
