"use client";

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6px)" },
  { transform: "translateX(5px)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(0)" },
];

/**
 * 註冊時的同意勾選：年滿 18 歲、了解只用虛擬積分、讀過免責聲明和私隱聲明（只在前端檢查，後端不記錄）。
 * 連結開新分頁：在這一頁跳走的話，已經填好的欄位會不見。
 * 送出失敗（shakeSignal 變化）時和其他欄位一樣輕晃。
 */
export function AgreeField({
  error,
  shakeSignal = 0,
  ...input
}: { error?: string; shakeSignal?: number } & InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("Legal");
  const rowRef = useRef<HTMLDivElement>(null);
  const errorId = "agree-error";

  useEffect(() => {
    if (!shakeSignal || !error || !rowRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    rowRef.current.animate(SHAKE, { duration: 320, easing: "ease-out" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeSignal]);

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={rowRef} className="flex items-start gap-2.5">
        <input
          id="agree"
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="peer mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-md border-[1.5px] border-line-strong bg-sunken bg-center bg-no-repeat transition-colors checked:border-gold checked:bg-gold checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M3.5%208.5l3%203%206-7%22%20fill=%22none%22%20stroke=%22%232a1c03%22%20stroke-width=%222.2%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold aria-invalid:border-danger"
          {...input}
        />
        <label htmlFor="agree" className="cursor-pointer text-[13px] leading-relaxed text-fg-soft">
          {t.rich("agree", {
            about: (chunks) => <NewTabLink href="/about">{chunks}</NewTabLink>,
            privacy: (chunks) => <NewTabLink href={{ pathname: "/about", hash: "privacy" }}>{chunks}</NewTabLink>,
          })}
        </label>
      </div>
      {error && (
        <p id={errorId} className="m-0 pl-7.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function NewTabLink({ href, children }: { href: "/about" | { pathname: "/about"; hash: string }; children: ReactNode }) {
  const t = useTranslations("Legal");
  return (
    <Link href={href} target="_blank" rel="noopener" className="text-gold underline-offset-2 hover:underline">
      {children}
      <span className="sr-only">{t("newTab")}</span>
    </Link>
  );
}
