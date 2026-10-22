"use client";

import { useTranslations } from "next-intl";
import { useGameRules } from "./rules";

/** 一行規則摘要（每注幾積分、幾分鐘一期），數字來自遊戲規則 API */
export function RulesShort({ className }: { className?: string }) {
  const t = useTranslations("Auth");
  const rules = useGameRules();
  return (
    <p className={className}>{t("rulesShort", { points: rules.pointsPerBet, minutes: rules.drawIntervalSeconds / 60 })}</p>
  );
}
