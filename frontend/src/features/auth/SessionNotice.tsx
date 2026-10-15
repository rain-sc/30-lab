"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/ui/FormAlert";

// 被導回登入頁的原因（lib/api/client.ts 的 redirectToLogin 帶上的 ?reason=）
const REASONS = ["expired", "replaced"] as const;
type Reason = (typeof REASONS)[number];

/** 登入頁上方的提示：登入過期，或帳號在其他地方登入 */
export function SessionNotice() {
  const t = useTranslations("Auth.reason");
  const reason = useSearchParams().get("reason");
  if (!REASONS.includes(reason as Reason)) return null;
  return <FormAlert tone="info">{t(reason as Reason)}</FormAlert>;
}
