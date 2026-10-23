"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/session";
import { reloadCurrentDraw } from "@/features/draw/feed";
import { currentRules, useGameRules } from "@/features/draw/rules";
import { useNextDraw } from "@/features/draw/useNextDraw";
import { useBalance, type Wallet } from "@/features/wallet/api";
import { ApiError, NETWORK_ERROR } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { BETTING_CLOSED, INSUFFICIENT_POINTS, TOO_MANY_LINES, placeBet, type PlaceBetRequest } from "./api";
import { summarize, useBetting, type SelectionProblem } from "./store";

export type PlaceFeedback = { tone: "success" | "error"; text: string } | null;

const FEEDBACK_MS = 4000;

/** 失敗原因不確定（網路斷了、逾時、伺服器錯誤）：後端可能已經收到，重試時要沿用同一個 idempotencyKey */
const maybeReceived = (error: unknown) =>
  error instanceof ApiError && (error.code === NETWORK_ERROR || error.status >= 500);

const sorted = (list: number[]) => [...list].sort((a, b) => a - b);

/**
 * 確認下注：把目前玩法的那一組下到目前這一期（POST /api/tickets，一次送出 = 一張注單）。
 * - 單式送出待下注的所有注（lines）；複式送出選的號碼（numbers）；膽拖送出膽、拖（bankers、legs）
 * - idempotencyKey：每次確認下注產生一個新的；上次失敗原因不確定、而且送出的內容沒變時沿用（後端不會重複扣款）
 * - 成功：用回應的 balance 更新積分、重新抓我的注單、清掉送出的那一組
 * - 40903 已截止 → 重新抓目前期數；40902 積分不足 → 重新抓錢包
 * 待下注 / 這一組的明細（桌面）和手機的下注列共用這個 hook，各自顯示回饋。
 */
export function usePlaceBets() {
  const t = useTranslations("Betting");
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();
  const next = useNextDraw();
  const username = useSession((s) => s.user?.username);
  const mode = useBetting((s) => s.mode);
  const pending = useBetting((s) => s.pending);
  const multi = useBetting((s) => s.multi);
  const bankers = useBetting((s) => s.bankers);
  const legs = useBetting((s) => s.legs);
  const clearSubmitted = useBetting((s) => s.clearSubmitted);
  const balance = useBalance(username);
  const rules = useGameRules();
  const [feedback, setFeedback] = useState<PlaceFeedback>(null);
  /** 這次送出用的 key，和它對應的內容（期數 + 選號） */
  const attempt = useRef<{ key: string; signature: string } | null>(null);

  // 回饋顯示幾秒後自動消失（手機版會蓋在選號盤上）
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  const mutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (res, body) => {
      attempt.current = null;
      queryClient.setQueryData<Wallet>(["wallet", username], { balance: res.balance });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["jackpot"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      clearSubmitted(body.betType ?? "SINGLE");
      setFeedback({ tone: "success", text: t("placed", { count: res.ticket.lines.length, drawNo: res.ticket.drawNo }) });
    },
    onError: (error, body) => {
      if (maybeReceived(error)) {
        // 後端可能已經收到：重新抓積分和注單，畫面才會反映真實狀態（重試時沿用同一個 key，不會重複扣款）
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      } else {
        attempt.current = null;
      }
      if (!(error instanceof ApiError)) return setFeedback({ tone: "error", text: errorText(error) });
      if (error.code === BETTING_CLOSED) void reloadCurrentDraw();
      if (error.code === INSUFFICIENT_POINTS) void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      // 前端已經擋過，走到這裡多半是規則改了、這個分頁還是舊的規則：重新抓規則，並說明原因
      const violations = error.fieldViolations ?? [];
      const field = (name: string) => violations.some((v) => v.field === name);
      if (violations.length > 0 || error.code === TOO_MANY_LINES) void queryClient.invalidateQueries({ queryKey: ["game-rules"] });
      if (violations.some((v) => v.rule === "ballNumber")) return setFeedback({ tone: "error", text: t("ballNumber", { max: currentRules().maxNumber }) });
      if (field("legsEnough")) return setFeedback({ tone: "error", text: t("legsEnough", { min: currentRules().pickCount + 1 }) });
      if (field("selectionMatchesBetType")) return setFeedback({ tone: "error", text: t("selectionMismatch") });
      // 40002：單式是「每張最多 maxLinesPerTicket 注」，膽拖是「最多 maxBankerLines 注」
      if (error.code === TOO_MANY_LINES && body.betType === "BANKER") {
        return setFeedback({ tone: "error", text: t("tooManyBankerLines", { max: currentRules().maxBankerLines }) });
      }
      setFeedback({ tone: "error", text: errorText(error) });
    },
  });

  const selection = summarize({ mode, multi, bankers, legs, pending }, rules);
  const cost = selection.lines * rules.pointsPerBet;
  const closed = next?.closed ?? false;
  const disabled = !next || !username || closed || selection.problem !== null || mutation.isPending;

  /** 目前玩法要送出的內容 */
  const bodyFor = (drawNo: string, key: string): PlaceBetRequest => {
    if (mode === "MULTIPLE") return { drawNo, idempotencyKey: key, betType: "MULTIPLE", numbers: sorted(multi) };
    if (mode === "BANKER") return { drawNo, idempotencyKey: key, betType: "BANKER", bankers: sorted(bankers), legs: sorted(legs) };
    return { drawNo, idempotencyKey: key, betType: "SINGLE", lines: pending };
  };

  const submit = () => {
    if (!next || !username || mutation.isPending) return;
    // 送出前先在前端擋掉明顯會失敗的情況（後端一樣會檢查）
    if (closed) return setFeedback({ tone: "error", text: t("closed") });
    if (selection.problem) return;
    if (mode === "SINGLE" && pending.length > rules.maxLinesPerTicket) return setFeedback({ tone: "error", text: t("tooMany", { max: rules.maxLinesPerTicket }) });
    if (balance !== null && balance < cost) return setFeedback({ tone: "error", text: t("insufficient") });

    const preview = bodyFor(next.drawNo, "");
    const signature = JSON.stringify(preview);
    if (attempt.current?.signature !== signature) attempt.current = { key: crypto.randomUUID(), signature };
    mutation.mutate(bodyFor(next.drawNo, attempt.current.key));
  };

  return { mode, pending, selection, cost, closed, disabled, submitting: mutation.isPending, submit, feedback };
}

/** 還不能送出的原因 → 文字 */
export function useProblemText() {
  const t = useTranslations("Betting");
  return (problem: SelectionProblem | null) => {
    if (!problem) return "";
    switch (problem.key) {
      case "pendingEmpty":
        return "";
      case "multiTooFew":
        return t("multiTooFew", { need: problem.need, min: problem.min, max: problem.max });
      case "needBanker":
        return t("needBanker", { max: problem.max });
      case "legsTooFew":
        return t("legsTooFew", { need: problem.need, min: problem.min });
      case "tooManyLines":
        return t("tooManyBankerLinesNow", { max: problem.max, count: problem.count });
    }
  };
}

