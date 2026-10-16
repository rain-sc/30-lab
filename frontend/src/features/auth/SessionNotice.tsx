"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/ui/FormAlert";
import { LOGIN_REASONS, type LoginReason } from "@/lib/api/client";

/** 登入頁上方的提示：登入過期、被別的裝置登入踢掉、或這個瀏覽器的另一個分頁登入了 */
export function SessionNotice() {
  const t = useTranslations("Auth.reason");
  const reason = useSearchParams().get("reason");
  if (!LOGIN_REASONS.includes(reason as LoginReason)) return null;
  return <FormAlert tone="info">{t(reason as LoginReason)}</FormAlert>;
}
