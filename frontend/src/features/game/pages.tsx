"use client";

// 單一內容頁（手機底部分頁、桌面頁首導覽進入）：都需要「現在是哪一期」，所以是 Client Component
import { useTranslations } from "next-intl";
import { MyBets } from "@/features/betting/MyBets";
import { HotCold, useHotCold } from "@/features/draw/HotCold";
import { DrawHistory } from "@/features/draw/RecentDraws";
import { useNextDraw } from "@/features/draw/useNextDraw";
import { GamePage } from "./GamePage";

export function TrendsView() {
  const t = useTranslations("Lobby");
  const next = useNextDraw();
  const drawCount = useHotCold(next)?.window;
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

export function BetsView() {
  const t = useTranslations("Nav");
  const tl = useTranslations("Live");
  return (
    <GamePage title={t("bets")} note={tl("sample")} card={false}>
      <MyBets />
    </GamePage>
  );
}
