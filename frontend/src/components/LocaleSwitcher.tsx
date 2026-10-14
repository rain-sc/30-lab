"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// 語言名稱用該語言自己的寫法，不翻譯（看不懂目前語言的人也找得到自己的語言）
const LOCALE_NAMES: Record<(typeof routing.locales)[number], string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  // 不含語系前綴的路徑，切換後停在同一頁
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex gap-3 text-sm">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === locale ? "true" : undefined}
          className={l === locale ? "font-semibold" : "text-zinc-500 underline underline-offset-4"}
        >
          {LOCALE_NAMES[l]}
        </Link>
      ))}
    </nav>
  );
}
