"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { GAME_NAV } from "./nav";
import { NavIcon } from "./NavIcon";

// 手機版底部分頁（桌面版用頁首的導覽）
export function TabBar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-sunken px-1 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden"
    >
      {GAME_NAV.filter((item) => !item.desktopOnly).map(({ href, key }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] no-underline transition-colors",
              active ? "text-gold" : "text-muted hover:text-fg",
            )}
          >
            <NavIcon name={key} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
