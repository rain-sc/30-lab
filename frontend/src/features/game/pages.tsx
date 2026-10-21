"use client";

// 單一內容頁（手機底部分頁、桌面頁首導覽進入）：都需要「現在是哪一期」，所以是 Client Component
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MyBets } from "@/features/betting/MyBets";
import { HotCold, useHotCold } from "@/features/draw/HotCold";
import { DrawHistory } from "@/features/draw/RecentDraws";
import { useNextDraw } from "@/features/draw/useNextDraw";
import { PointsHistory } from "@/features/wallet/PointsHistory";
import { cn } from "@/lib/utils";
import { GamePage } from "./GamePage";

export function TrendsView() {
  const t = useTranslations("Lobby");
  const next = useNextDraw();
  const drawCount = useHotCold(next).data?.window;
  return (
    <GamePage title={t("hotCold")} note={drawCount ? t("hotColdNote", { count: drawCount }) : undefined}>
      <HotCold next={next} />
    </GamePage>
  );
}

export function HistoryView() {
  const t = useTranslations("Nav");
  const next = useNextDraw();
  return (
    <GamePage title={t("history")}>
      <DrawHistory next={next} />
    </GamePage>
  );
}

/** 我的注單 / 積分紀錄（同一頁，分頁籤切換；手機底部分頁不用再多一格） */
export function BetsView() {
  const t = useTranslations("Nav");
  const [tab, setTab] = useState<"tickets" | "points">("tickets");
  return (
    <GamePage title={t("bets")} card={false}>
      <div role="tablist" aria-label={t("bets")} className="mb-4 flex gap-1 rounded-button bg-sunken p-1 md:w-fit">
        {(["tickets", "points"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "h-10 flex-1 rounded-[9px] px-5 text-sm font-bold transition-colors md:flex-none",
              tab === key ? "bg-gold text-gold-ink" : "text-muted hover:text-fg",
            )}
          >
            {t(key === "tickets" ? "tabTickets" : "tabPoints")}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "tickets" ? <MyBets /> : <PointsHistory />}
      </div>
    </GamePage>
  );
}
