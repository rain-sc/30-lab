"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useSession } from "@/features/auth/session";
import { useNow } from "@/features/draw/useNextDraw";
import { ApiError } from "@/lib/api/client";
import { useApiErrorText } from "@/lib/api/useApiErrorText";
import { cn } from "@/lib/utils";
import { ALREADY_CLAIMED, useClaimDailyBonus, useDailyBonus } from "./dailyBonus";

/** 距離下次可以簽到還有多久：「X 小時 Y 分」 */
export function useResetCountdown(nextResetAt: string | undefined) {
  const t = useTranslations("Wallet");
  const now = useNow();
  if (!nextResetAt || now === null) return null;
  const minutes = Math.max(1, Math.ceil((Date.parse(nextResetAt) - now) / 60_000));
  return t("dailyNext", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/**
 * 頁首的簽到按鈕（積分旁邊）
 * - 還沒簽到：「簽到 +1,000」（金色）
 * - 已簽到：桌面顯示「已簽到 · X 小時 Y 分後」；手機頁首放不下，不顯示（使用者選單裡有）
 */
export function DailyBonusButton() {
  const t = useTranslations("Wallet");
  const format = useFormatter();
  const errorText = useApiErrorText();
  const username = useSession((s) => s.user?.username);
  const bonus = useDailyBonus(username);
  const claim = useClaimDailyBonus(username);
  const countdown = useResetCountdown(bonus.data?.nextResetAt);

  if (!bonus.data) return null;

  if (bonus.data.claimed) {
    return (
      <span className="hidden items-center gap-1.5 text-[13px] text-muted lg:inline-flex">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 12l5 5 9-10" />
        </svg>
        {t("dailyClaimed")}
        {countdown && <span>· {countdown}</span>}
      </span>
    );
  }

  // 40904 是「已經簽到過」，不算錯誤（會重新抓狀態變成已簽到）
  const failed = claim.isError && !(claim.error instanceof ApiError && claim.error.code === ALREADY_CLAIMED);
  const points = format.number(bonus.data.amount);

  return (
    <button
      type="button"
      onClick={() => claim.mutate()}
      disabled={claim.isPending}
      aria-label={t("dailyClaimLabel", { points })}
      title={failed ? errorText(claim.error) : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors md:h-9",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60",
        failed ? "border-danger/50 text-danger" : "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20",
      )}
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-3-6-3-6 0M12 7c2-3 6-3 6 0" />
      </svg>
      <span className="hidden sm:inline">{t("dailyClaim", { points })}</span>
      <span className="sm:hidden">+{points}</span>
    </button>
  );
}

/** 使用者選單裡的簽到狀態（手機頁首放不下「已簽到」時，在這裡看得到） */
export function DailyBonusStatus() {
  const t = useTranslations("Wallet");
  const username = useSession((s) => s.user?.username);
  const bonus = useDailyBonus(username);
  const countdown = useResetCountdown(bonus.data?.nextResetAt);
  if (!bonus.data) return null;
  return (
    <p className="m-0 text-xs text-muted">
      {bonus.data.claimed ? `${t("dailyClaimed")} · ${countdown ?? ""}` : t("dailyAvailable")}
    </p>
  );
}
