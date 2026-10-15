"use client";

import { useTranslations } from "next-intl";
import { ApiError, NETWORK_ERROR } from "./client";

/**
 * 把 API 錯誤翻譯成目前語系的文字（錯誤訊息的 i18n 由前端負責，後端的 msg 只當備用）。
 * 找翻譯的順序：完整錯誤碼（40901）→ 同一個 HTTP 狀態的通用碼（40900）→ 4xx / 5xx 的通用碼（40000 / 50000）。
 */
export function useApiErrorText() {
  const t = useTranslations("ApiErrors");

  return (error: unknown): string => {
    if (!(error instanceof ApiError)) return t("50000");
    if (error.code === NETWORK_ERROR) return t("network");

    const candidates = [
      String(error.code),
      `${Math.floor(error.code / 100)}00`,
      error.code < 50000 ? "40000" : "50000",
    ];
    const key = candidates.find((k) => t.has(k as never));
    return key ? t(key as never) : error.backendMsg;
  };
}
