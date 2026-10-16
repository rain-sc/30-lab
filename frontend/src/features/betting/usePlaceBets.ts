"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/session";
import { POINTS_PER_BET } from "@/features/draw/rules";
import { useNextDraw, useNow } from "@/features/draw/useNextDraw";
import { useBalance, useMockBets } from "./mockBets";
import { useBetting } from "./store";

export type PlaceFeedback = { tone: "success" | "error"; text: string } | null;

const FEEDBACK_MS = 4000;

/**
 * 確認下注：把待下注的注單下到目前這一期。
 * 【示例】寫進 mockBets（localStorage）；接上 API 後改成 POST 下注接口（用 TanStack Query 的 useMutation）。
 * 待下注列表（桌面）和手機的下注列共用這個 hook，各自顯示回饋。
 */
export function usePlaceBets() {
  const t = useTranslations("Betting");
  const next = useNextDraw();
  const user = useSession((s) => s.user);
  const pending = useBetting((s) => s.pending);
  const clearPending = useBetting((s) => s.clearPending);
  const place = useMockBets((s) => s.place);
  const balance = useBalance(user?.username, useNow());
  const [feedback, setFeedback] = useState<PlaceFeedback>(null);

  // 回饋顯示幾秒後自動消失（手機版會蓋在選號盤上）
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  const cost = pending.length * POINTS_PER_BET;
  const username = user?.username;
  const disabled = !next || !username || pending.length === 0 || next.closed;

  const submit = () => {
    if (!next || !username || pending.length === 0) return;
    if (next.closed) {
      setFeedback({ tone: "error", text: t("closed") });
      return;
    }
    if (balance !== null && balance < cost) {
      setFeedback({ tone: "error", text: t("insufficient") });
      return;
    }
    place(username, pending, next.drawNo, next.drawAt);
    clearPending();
    setFeedback({ tone: "success", text: t("placed", { count: pending.length, drawNo: next.drawNo }) });
  };

  return { pending, cost, closed: next?.closed ?? false, disabled, submit, feedback };
}
