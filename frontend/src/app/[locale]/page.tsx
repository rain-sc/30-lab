import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

// 暫時的首頁：驗證 i18n 骨架，之後換成大廳
export default function Home() {
  const t = useTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("tagline")}</p>
      <p className="text-sm text-zinc-500">{t("comingSoon")}</p>
      <LocaleSwitcher />
    </main>
  );
}
