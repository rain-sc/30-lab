"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { ApiError, SESSION_REPLACED } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { fetchMe, logout, type User } from "./api";

type State =
  | { kind: "checking" }
  | { kind: "signedIn"; user: User }
  | { kind: "guest"; replaced?: boolean }
  | { kind: "error"; message: string };

/**
 * 首頁暫時用的登入狀態（大廳做好後會換掉）：已登入顯示暱稱和登出，未登入顯示登入連結。
 * 每次頁面顯示都重新查一次：Next 會把離開的頁面隱藏保留（Activity），回來時 effect 會重新執行，
 * 所以登入、登出後回到首頁，狀態會是最新的。
 */
export function SessionStatus() {
  const t = useTranslations("Session");
  const apiErrorText = useApiErrorText();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => !cancelled && setState({ kind: "signedIn", user }))
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setState({ kind: "guest", replaced: error.code === SESSION_REPLACED });
        } else {
          setState({ kind: "error", message: apiErrorText(error) });
        }
      });
    return () => {
      cancelled = true;
    };
    // apiErrorText 每次渲染都是新函式，只在掛載 / 重新顯示時查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setState({ kind: "guest" });
    }
  };

  if (state.kind === "checking") {
    return (
      <p role="status" className="m-0 text-sm text-muted">
        {t("checking")}
      </p>
    );
  }

  if (state.kind === "signedIn") {
    return (
      <div role="status" className="flex flex-col items-center gap-3">
        <p className="m-0 text-fg">
          {t.rich("signedInAs", {
            nickname: state.user.nickname ?? "",
            b: (chunks) => <b className="font-bold text-gold">{chunks}</b>,
          })}
          <span className="ml-2 text-sm text-muted">@{state.user.username}</span>
        </p>
        <Button variant="ghost" loading={loggingOut} onClick={handleLogout} className="h-10 text-sm">
          {t("logout")}
        </Button>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center gap-2">
      <p className="m-0 text-sm text-muted">
        {state.kind === "error" ? state.message : state.replaced ? t("replaced") : t("guest")}
      </p>
      <Link href="/login" className="font-medium text-gold underline-offset-4 hover:underline">
        {t("toLogin")}
      </Link>
    </div>
  );
}
