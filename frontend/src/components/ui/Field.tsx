"use client";

import { useEffect, useRef, type ReactNode } from "react";

type FieldProps = {
  id: string;
  label: string;
  /** 欄位說明，例如格式規則 */
  hint?: string;
  /** 已翻譯好的錯誤訊息 */
  error?: string;
  /** 每次送出失敗時加 1；有錯誤的欄位會左右輕晃一下 */
  shakeSignal?: number;
  /** 拿到 aria 屬性後渲染輸入框，讓 label、說明、錯誤和輸入框正確關聯 */
  children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6px)" },
  { transform: "translateX(5px)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(0)" },
];

export function Field({ id, label, hint, error, shakeSignal = 0, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const inputRef = useRef<HTMLDivElement>(null);

  // 用 Web Animations API 晃動，不重新掛載輸入框（重新掛載會清掉 React Hook Form 的值）
  useEffect(() => {
    if (!shakeSignal || !error || !inputRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    inputRef.current.animate(SHAKE, { duration: 320, easing: "ease-out" });
    // 只在送出失敗時（shakeSignal 變化）晃動，打字時錯誤訊息變化不晃
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeSignal]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div ref={inputRef}>{children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}</div>
      {error ? (
        <p id={errorId} className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="m-0 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
