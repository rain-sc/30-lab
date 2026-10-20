"use client";

import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/ui/FormAlert";
import { useDrawFeed } from "./feed";

/** 拿不到期數資料時的提示（DrawFeed 每 10 秒自動重試，拿到後自動消失） */
export function DrawFeedError({ className }: { className?: string }) {
  const t = useTranslations("Live");
  const failed = useDrawFeed((s) => s.status === "error");
  if (!failed) return null;
  return <FormAlert className={className}>{t("feedError")}</FormAlert>;
}
