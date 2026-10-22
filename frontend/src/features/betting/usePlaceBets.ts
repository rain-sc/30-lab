"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/session";
import { reloadCurrentDraw } from "@/features/draw/feed";
import { useGameRules } from "@/features/draw/rules";
import { useNextDraw } from "@/features/draw/useNextDraw";
import { useBalance, type Wallet } from "@/features/wallet/api";
import { ApiError, NETWORK_ERROR } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { BETTING_CLOSED, INSUFFICIENT_POINTS, placeBet } from "./api";
import { useBetting } from "./store";

export type PlaceFeedback = { tone: "success" | "error"; text: string } | null;

const FEEDBACK_MS = 4000;

/** 失敗原因不確定（網路斷了、逾時、伺服器錯誤）：後端可能已經收到，重試時要沿用同一個 idempotencyKey */
const maybeReceived = (error: unknown) =>
  error instanceof ApiError && (error.code === NETWORK_ERROR || error.status >= 500);

/**
 * 確認下注：把待下注的注單下到目前這一期（POST /api/tickets，一次送出 = 一張注單）。
 * - idempotencyKey：每次確認下注產生一個新的；上次失敗原因不確定、而且待下注沒變時沿用（後端不會重複扣款）
 * - 成功：用回應的 balance 更新積分、重新抓我的注單、清空待下注
 * - 40903 已截止 → 重新抓目前期數；40902 積分不足 → 重新抓錢包
 * 待下注列表（桌面）和手機的下注列共用這個 hook，各自顯示回饋。
 */
export function usePlaceBets() {
  const t = useTranslations("Betting");
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();
  const next = useNextDraw();
  const username = useSession((s) => s.user?.username);
  const pending = useBetting((s) => s.pending);
  const clearPending = useBetting((s) => s.clearPending);
  const balance = useBalance(username);
  const [feedback, setFeedback] = useState<PlaceFeedback>(null);
  /** 這次送出用的 key，和它對應的內容（期數 + 每一注） */
  const attempt = useRef<{ key: string; signature: string } | null>(null);

  // 回饋顯示幾秒後自動消失（手機版會蓋在選號盤上）
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  const mutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (res) => {
      attempt.current = null;
      queryClient.setQueryData<Wallet>(["wallet", username], { balance: res.balance });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["jackpot"] });
      clearPending();
      setFeedback({ tone: "success", text: t("placed", { count: res.ticket.lines.length, drawNo: res.ticket.drawNo }) });
    },
    onError: (error) => {
      if (maybeReceived(error)) {
        // 後端可能已經收到：重新抓積分和注單，畫面才會反映真實狀態（重試時沿用同一個 key，不會重複扣款）
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      } else {
        attempt.current = null;
      }
      if (error instanceof ApiError && error.code === BETTING_CLOSED) void reloadCurrentDraw();
      if (error instanceof ApiError && error.code === INSUFFICIENT_POINTS) {
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
      setFeedback({ tone: "error", text: errorText(error) });
    },
  });

  const { pointsPerBet, maxLinesPerTicket } = useGameRules();
  const cost = pending.length * pointsPerBet;
  const closed = next?.closed ?? false;
  const disabled = !next || !username || pending.length === 0 || closed || mutation.isPending;

  const submit = () => {
    if (!next || !username || pending.length === 0 || mutation.isPending) return;
    // 送出前先在前端擋掉明顯會失敗的情況（後端一樣會檢查）
    if (closed) return setFeedback({ tone: "error", text: t("closed") });
    if (pending.length > maxLinesPerTicket) return setFeedback({ tone: "error", text: t("tooMany", { max: maxLinesPerTicket }) });
    if (balance !== null && balance < cost) return setFeedback({ tone: "error", text: t("insufficient") });

    const signature = `${next.drawNo}|${JSON.stringify(pending)}`;
    if (attempt.current?.signature !== signature) attempt.current = { key: crypto.randomUUID(), signature };
    mutation.mutate({ drawNo: next.drawNo, idempotencyKey: attempt.current.key, lines: pending });
  };

  return { pending, cost, closed, disabled, submitting: mutation.isPending, submit, feedback };
}
