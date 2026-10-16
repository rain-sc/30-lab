"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/ui/FormAlert";
import { getSignOutReason, subscribeSignOut } from "@/lib/api/tabSession";

/**
 * 登入頁上方的提示：登入過期、被別的裝置登入踢掉、或這個瀏覽器的另一個分頁登入了。
 * 原因存在這個分頁的 sessionStorage（不放網址上）：重新整理後還在，重新登入成功時清掉。
 * 伺服器渲染時沒有 sessionStorage，先不顯示，hydrate 後才出現。
 */
export function SessionNotice() {
  const t = useTranslations("Auth.reason");
  const reason = useSyncExternalStore(subscribeSignOut, getSignOutReason, () => null);
  if (!reason) return null;
  return <FormAlert tone="info">{t(reason)}</FormAlert>;
}
