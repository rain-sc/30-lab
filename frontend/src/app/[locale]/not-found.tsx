import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// 語系路徑下找不到頁面（例如 /zh-TW/xxx）時顯示，跟著目前語系翻譯
export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("description")}</p>
      <Link href="/" className="underline underline-offset-4">
        {t("backHome")}
      </Link>
    </main>
  );
}
