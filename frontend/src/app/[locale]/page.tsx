import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

// 暫時的首頁，之後換成大廳
export default function Home() {
  const t = useTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("tagline")}</p>
      <p className="text-sm text-muted">{t("comingSoon")}</p>
      <Link href="/login" className="font-medium text-gold underline-offset-4 hover:underline">
        {t("toLogin")}
      </Link>
      <LocaleSwitcher />
    </main>
  );
}
