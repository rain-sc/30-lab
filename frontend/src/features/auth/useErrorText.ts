"use client";

import { useTranslations } from "next-intl";
import type { FieldError } from "react-hook-form";
import { RULE_PARAMS, type AuthErrorKey } from "./schemas";

// 把 schema 裡的錯誤 key 翻譯成目前語系的文字
export function useErrorText() {
  const t = useTranslations("Auth.errors");
  return (error?: FieldError) =>
    error?.message ? t(error.message as AuthErrorKey, RULE_PARAMS) : undefined;
}
