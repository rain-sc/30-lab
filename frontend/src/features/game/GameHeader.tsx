"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { RollingNumber } from "@/components/fx/RollingNumber";
import { logout } from "@/features/auth/api";
import { useSession } from "@/features/auth/session";
import { useBalance, useWallet } from "@/features/wallet/api";
import { BalanceDelta } from "@/features/wallet/BalanceDelta";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { GAME_NAV } from "./nav";

// 遊戲端頁首：品牌、導覽（桌面）、積分、使用者選單（語言、登出）
export function GameHeader() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    // sticky：捲動時也看得到積分（下注扣款、派彩的數字滾動）
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-stage/85 px-4 py-3 backdrop-blur-md md:px-10 md:py-4">
      <div className="flex items-center gap-9">
        <BrandLogo />
        <nav aria-label={t("label")} className="hidden gap-1 text-[15px] md:flex">
          {GAME_NAV.filter((item) => !item.mobileOnly).map(({ href, key }) => {
            const active = pathname === href;
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control px-3.5 py-2 no-underline transition-colors",
                  active ? "bg-panel font-bold text-fg" : "text-muted hover:text-fg",
                )}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <BalancePill />
        <UserMenu />
      </div>
    </header>
  );
}

function BalancePill() {
  const t = useTranslations("Wallet");
  const user = useSession((s) => s.user);
  const balance = useBalance(user?.username);
  const wallet = useWallet(user?.username);

  // 錢包載入失敗：整顆變成重試按鈕（不能一直顯示「—」而沒有下一步）
  if (wallet.isError && balance === null) {
    return (
      <button
        type="button"
        onClick={() => wallet.refetch()}
        title={t("retryHint")}
        aria-label={t("retryHint")}
        className="inline-flex items-center gap-2 rounded-full border border-danger/50 bg-panel px-3 py-1 text-sm text-danger md:px-3.5 md:py-1.5"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
        </svg>
        {t("retry")}
      </button>
    );
  }

  return (
    <span
      className="relative inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 md:px-3.5 md:py-1.5"
    >
      <span
        aria-hidden="true"
        className="size-3 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffe3a3_0,var(--color-gold)_50%,#b9811c_100%)] md:size-3.5"
      />
      <span className="sr-only">{t("balance")}</span>
      <span className="min-w-8 font-num text-lg font-bold tabular-nums md:text-xl">
        {balance === null ? "—" : <RollingNumber value={balance} />}
      </span>
      <span className="hidden text-[13px] text-muted md:inline">{t("points")}</span>
      <BalanceDelta balance={balance} className="right-3 -bottom-1" />
    </span>
  );
}

function UserMenu() {
  const t = useTranslations("Nav");
  const router = useRouter();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 點選單外面或按 Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // 登出失敗（例如已經被登出）也一樣回登入頁
    }
    setUser(null);
    router.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 rounded-button px-2 text-sm text-fg-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span className="grid size-7 place-items-center rounded-full bg-panel font-bold text-gold uppercase">
          {(user?.nickname || user?.username || "?").slice(0, 1)}
        </span>
        <span className="hidden max-w-32 truncate md:inline">{user?.nickname || user?.username}</span>
        <svg aria-hidden="true" className="hidden md:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="sr-only">{t("menu")}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 flex w-56 flex-col gap-3 rounded-card border border-line bg-panel p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col">
            <span className="truncate font-bold">{user?.nickname}</span>
            <span className="truncate text-xs text-muted">@{user?.username}</span>
          </div>
          <LocaleSwitcher />
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="h-10 rounded-button border border-line text-sm text-fg hover:border-muted disabled:opacity-60"
          >
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
