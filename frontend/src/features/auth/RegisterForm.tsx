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
import { register as registerAccount } from "./api";
import { REGISTER_VIOLATIONS, RULE_PARAMS, registerSchema, type RegisterValues } from "./schemas";
import { applyFieldViolations } from "./serverErrors";
import { useErrorText } from "./useErrorText";

const USERNAME_TAKEN = 40901;

export function RegisterForm() {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const apiErrorText = useApiErrorText();
  const router = useRouter();
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
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async ({ confirmPassword, ...values }: RegisterValues) => {
    void confirmPassword; // 只在前端比對，不送給後端
    setFormError(null);
    try {
      // 註冊成功後端會直接登入（設好 cookie）
      await registerAccount(values);
      reset();
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.code === USERNAME_TAKEN) {
        setError("username", { type: "server", message: "usernameTaken" }, { shouldFocus: true });
        shake();
        return;
      }
      if (error instanceof ApiError && applyFieldViolations(error, setError, REGISTER_VIOLATIONS)) {
        shake();
        return;
      }
      setFormError(apiErrorText(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, shake)} noValidate className="flex flex-col gap-4">
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

      {formError && <FormAlert>{formError}</FormAlert>}

      <ClickSpark className="mt-1.5">
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t("register.submitting") : t("register.submit")}
        </Button>
      </ClickSpark>
    </form>
  );
}
