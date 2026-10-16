"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ClickSpark } from "@/components/fx/ClickSpark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/ui/FormAlert";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { login } from "./api";
import { LOGIN_VIOLATIONS, loginSchema, type LoginValues } from "./schemas";
import { applyFieldViolations } from "./serverErrors";
import { useErrorText } from "./useErrorText";

export function LoginForm() {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const apiErrorText = useApiErrorText();
  const router = useRouter();
  // 不屬於單一欄位的錯誤（帳號或密碼錯誤、系統繁忙、連不到伺服器）
  const [formError, setFormError] = useState<string | null>(null);
  // 送出失敗的次數；每次變化，有錯誤的欄位會輕晃一下
  const [shakeSignal, setShakeSignal] = useState(0);
  const shake = () => setShakeSignal((n) => n + 1);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched", // 離開欄位後才檢查，不在打字途中跳錯誤
  });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      await login(values);
      // 清掉表單再離開：Next 會把這頁隱藏保留（Activity），不要留著密碼
      reset();
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && applyFieldViolations(error, setError, LOGIN_VIOLATIONS)) {
        shake();
        return;
      }
      // 40101 帳號或密碼錯誤：不說是哪一個錯，顯示在表單上方
      setFormError(apiErrorText(error));
    }
  };

  return (
    // method="post"：JS 還沒載入或載入失敗時，表單會由瀏覽器原生送出；預設的 GET 會把帳號密碼放進網址
    // （會留在瀏覽記錄、伺服器 log），POST 不會。正常情況下 handleSubmit 會攔下送出，這只是保險
    <form method="post" onSubmit={handleSubmit(onSubmit, shake)} noValidate className="flex flex-col gap-4">
      <Field id="username" shakeSignal={shakeSignal} label={t("fields.username")} error={errorText(errors.username)}>
        {(aria) => <Input {...aria} autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("username")} />}
      </Field>

      <Field id="password" shakeSignal={shakeSignal} label={t("fields.password")} error={errorText(errors.password)}>
        {(aria) => <PasswordInput {...aria} autoComplete="current-password" {...register("password")} />}
      </Field>

      {formError && <FormAlert>{formError}</FormAlert>}

      <ClickSpark className="mt-1.5">
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </ClickSpark>
    </form>
  );
}
