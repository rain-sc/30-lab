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
import { register as registerAccount } from "./api";
import { RULE_PARAMS, registerSchema, type RegisterValues } from "./schemas";
import { useErrorText } from "./useErrorText";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [done, setDone] = useState(false);
  // 送出失敗的次數；每次變化，有錯誤的欄位會輕晃一下
  const [shakeSignal, setShakeSignal] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async ({ confirmPassword, ...values }: RegisterValues) => {
    void confirmPassword; // 只在前端比對，不送給後端
    await registerAccount(values);
    setDone(true);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => setShakeSignal((n) => n + 1))} noValidate className="flex flex-col gap-4">
      <Field
        id="username"
        shakeSignal={shakeSignal}
        label={t("fields.username")}
        hint={t("fields.usernameHint")}
        error={errorText(errors.username)}
      >
        {(aria) => <Input {...aria} autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("username")} />}
      </Field>

      <Field
        id="nickname"
        shakeSignal={shakeSignal}
        label={t("fields.nickname")}
        hint={t("fields.nicknameHint", RULE_PARAMS)}
        error={errorText(errors.nickname)}
      >
        {(aria) => <Input {...aria} autoComplete="nickname" {...register("nickname")} />}
      </Field>

      <Field
        id="password"
        shakeSignal={shakeSignal}
        label={t("fields.password")}
        hint={t("fields.passwordHint", RULE_PARAMS)}
        error={errorText(errors.password)}
      >
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("password")} />}
      </Field>

      <Field id="confirmPassword" shakeSignal={shakeSignal} label={t("fields.confirmPassword")} error={errorText(errors.confirmPassword)}>
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("confirmPassword")} />}
      </Field>

      <ClickSpark className="mt-1.5">
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t("register.submitting") : t("register.submit")}
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
