"use client";

import { useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const AUTH_MODES = ["login", "register"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export const authTabId = (mode: AuthMode) => `auth-tab-${mode}`;
export const authPanelId = (mode: AuthMode) => `auth-panel-${mode}`;

type AuthTabsProps = {
  value: AuthMode;
  onChange: (mode: AuthMode) => void;
};

// 登入 / 註冊分頁（受控組件），照 WAI-ARIA Tabs 的寫法：
// 只有選中的分頁可以用 Tab 鍵聚焦，左右方向鍵切換分頁。
// 金色底塊在分頁列裡用 x 位移滑動（參考 Aceternity「Tabs」）；
// 不用 layoutId，因為兩個表單高度不同，卡片會重新置中，layoutId 用絕對位置算起點會飛出去。
export function AuthTabs({ value, onChange }: AuthTabsProps) {
  const t = useTranslations("Auth");
  const tabRefs = useRef<Record<AuthMode, HTMLButtonElement | null>>({ login: null, register: null });
  const activeIndex = AUTH_MODES.indexOf(value);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = AUTH_MODES[(activeIndex + step + AUTH_MODES.length) % AUTH_MODES.length];
    onChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("tabsLabel")}
      onKeyDown={handleKeyDown}
      className="relative grid grid-cols-2 rounded-button bg-stage p-1"
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[9px] bg-gold"
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      />
      {AUTH_MODES.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            ref={(el) => {
              tabRefs.current[mode] = el;
            }}
            type="button"
            role="tab"
            id={authTabId(mode)}
            aria-selected={active}
            aria-controls={authPanelId(mode)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(mode)}
            className={cn(
              "relative h-10 rounded-[9px] text-[15px] font-bold transition-colors duration-300",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              active ? "text-gold-ink" : "text-muted hover:text-fg",
            )}
          >
            {t(`${mode}.tab`)}
          </button>
        );
      })}
    </div>
  );
}
