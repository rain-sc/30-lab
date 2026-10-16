"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useMockBets } from "@/features/betting/mockBets";
import { useBetting } from "@/features/betting/store";
import { useRouter } from "@/i18n/navigation";
import { ApiError, redirectToLogin, SESSION_REPLACED } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { fetchMe } from "./api";
import { useSession } from "./session";

type State = { kind: "checking" } | { kind: "ready" } | { kind: "error"; message: string };

/**
 * 遊戲頁面要登入才能看：確認登入狀態後才顯示內容。
 * - 未登入 → 導向登入頁（不帶原因，第一次來的人不該看到「登入已過期」）；被別處登入踢掉 → 登入頁顯示原因
 * - 連不上後端 → 顯示錯誤和重試（不能永遠停在載入中）
 * - 每次顯示都重新確認：離開遊戲頁面時版面會被 Activity 隱藏保留，回來時 effect 會重新執行
 * 也在這裡把存在瀏覽器的選號、示例注單讀回 store（見 betting/store.ts 的 skipHydration）。
 */
export function GameSessionGate({ children }: { children: ReactNode }) {
  const apiErrorText = useApiErrorText();
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);
  const [state, setState] = useState<State>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void useBetting.persist.rehydrate();
    void useMockBets.persist.rehydrate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (cancelled) return;
        setUser(user);
        setState({ kind: "ready" });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          if (error.code === SESSION_REPLACED) redirectToLogin("replaced");
          else router.replace("/login");
          return;
        }
        setState({ kind: "error", message: apiErrorText(error) });
      });
    return () => {
      cancelled = true;
    };
    // apiErrorText、router 每次渲染都是新的；只在顯示時、按重試時查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = () => {
    setState({ kind: "checking" });
    setAttempt((n) => n + 1);
  };

  return (
    <>
      {/*
        內容一直渲染，確認登入前用 hidden 藏起來：
        - Next 的 instant navigation 驗證要看得到頁面（不渲染的話會報「segment was dropped」）
        - 確認完立刻顯示，不用等頁面再渲染一次
        頁面內容在確認前不能打需要登入的 API（目前都是示例資料，沒有這個問題）
      */}
      <div hidden={state.kind !== "ready"} className="flex flex-1 flex-col">
        {children}
      </div>
      {state.kind === "checking" && <Checking />}
      {state.kind === "error" && <LoadError message={state.message} onRetry={retry} />}
    </>
  );
}

const STATUS_CLASS = "flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center";

function Checking() {
  const t = useTranslations("Game");
  return (
    <div role="status" className={STATUS_CLASS}>
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-3 border-gold border-r-transparent motion-reduce:animate-none"
      />
      <p className="m-0 text-sm text-muted">{t("checking")}</p>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("Game");
  return (
    <div role="alert" className={STATUS_CLASS}>
      <p className="m-0 text-danger">{message}</p>
      <Button variant="ghost" className="h-11 text-base" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
