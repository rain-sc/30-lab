"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ClickSpark } from "@/components/fx/ClickSpark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { login } from "./api";
import { loginSchema, type LoginValues } from "./schemas";
import { useErrorText } from "./useErrorText";

export function LoginForm() {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [done, setDone] = useState(false);
  // 送出失敗的次數；每次變化，有錯誤的欄位會輕晃一下
  const [shakeSignal, setShakeSignal] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched", // 離開欄位後才檢查，不在打字途中跳錯誤
  });

  const onSubmit = async (values: LoginValues) => {
    await login(values);
    setDone(true);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => setShakeSignal((n) => n + 1))} noValidate className="flex flex-col gap-4">
      <Field id="username" shakeSignal={shakeSignal} label={t("fields.username")} error={errorText(errors.username)}>
        {(aria) => <Input {...aria} autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("username")} />}
      </Field>

      <Field id="password" shakeSignal={shakeSignal} label={t("fields.password")} error={errorText(errors.password)}>
        {(aria) => <PasswordInput {...aria} autoComplete="current-password" {...register("password")} />}
      </Field>

      <ClickSpark className="mt-1.5">
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </ClickSpark>

      {done && (
        <p role="status" className="m-0 rounded-control border border-line bg-sunken px-3 py-2 text-sm text-muted">
          {t("mockNotice")}
        </p>
      )}
    </form>
  );
}
