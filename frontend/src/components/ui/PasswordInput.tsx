"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Input } from "./Input";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type" | "trailing">;

export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations("Auth.fields");
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="grid size-11 shrink-0 place-items-center rounded-control text-muted hover:text-fg focus-visible:text-fg focus-visible:outline-none"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
    />
  );
}
