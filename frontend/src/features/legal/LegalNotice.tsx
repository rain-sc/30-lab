"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// 免責聲明（設計稿：https://claude.ai/artifact/FsPcpgogpww4UbGjo5f7jq）
// 公開給別人玩時，「虛擬積分、不涉及真錢、與香港賽馬會無關」要放在每個人一定會看到的地方：
// 登入頁（LegalNotice）、遊戲端每一頁的頁尾（SiteFooter）、註冊時的勾選（AgreeField），完整內容在 /about

/** 登入頁表單卡片下方：金框的重點提示 */
export function LegalNotice({ className }: { className?: string }) {
  const t = useTranslations("Legal");
  return (
    <aside
      aria-label={t("pageTitle")}
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-gold/45 bg-[linear-gradient(180deg,rgba(244,182,63,0.10),rgba(244,182,63,0.04))] px-3.5 py-3 text-[13px] leading-relaxed text-fg-soft",
        className,
      )}
    >
      <span aria-hidden="true" className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-gold text-[13px] font-extrabold text-gold-ink">
        !
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="m-0">
          <b className="text-fg">{t("noticeTitle")}</b>
          {t("noticeBody")}{" "}
          <Link href="/about" className="text-gold underline-offset-2 hover:underline">
            {t("learnMore")}
          </Link>
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {(["chipVirtual", "chipNoTopUp", "chipNoCashOut", "chipAdults"] as const).map((key) => (
            <li key={key} className="rounded-full border border-line-strong bg-sunken px-2 text-xs text-fg-soft">
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/**
 * 遊戲端每一頁的頁尾（手機在底部分頁上方）。
 * 手機大廳底部還有固定的「待下注」列（MobileBetBar）：頁尾後面多留它的高度，捲到底時頁尾才不會被蓋住
 */
export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations("Legal");
  const onLobby = usePathname() === "/";
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-300 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line px-4 py-4 text-[12.5px] text-muted md:px-10",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-fg-soft">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-gold" />
        {t("footer")}
      </span>
      <nav aria-label={t("pageTitle")} className="flex gap-3.5">
        <Link href="/about" className="text-gold underline-offset-2 hover:underline">
          {t("aboutLink")}
        </Link>
        <Link href={{ pathname: "/about", hash: "privacy" }} className="text-gold underline-offset-2 hover:underline">
          {t("privacyLink")}
        </Link>
      </nav>
      {onLobby && <div aria-hidden="true" className="h-22 w-full md:hidden" />}
    </footer>
  );
}
