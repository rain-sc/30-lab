import type { Metadata } from "next";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { CONTACT_EMAIL } from "@/features/legal/contact";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return { title: t("pageTitle") };
}

const SECTION = "rounded-2xl border border-line bg-panel px-4.5 py-4 md:px-5.5";
const FADE_UP = "animate-fade-up motion-reduce:animate-none";

// 關於與免責聲明（不用登入；設計稿：https://claude.ai/artifact/FsPcpgogpww4UbGjo5f7jq）
// 登入頁的提示、遊戲端頁尾、註冊的同意勾選都連到這裡；私隱段落的錨點是 #privacy
export default function AboutPage() {
  const t = useTranslations("Legal");
  const b = (chunks: ReactNode) => <b className="text-fg">{chunks}</b>;

  return (
    <div className="flex flex-1 flex-col bg-[radial-gradient(90%_50%_at_20%_0%,var(--color-stage-glow)_0%,var(--color-stage)_60%)]">
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-5">
        <BrandLogo />
        <LocaleSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-190 flex-col gap-4 px-4 pt-2 pb-16 md:pt-6">
        <h1 className={`m-0 text-2xl md:text-[28px] ${FADE_UP}`}>{t("title")}</h1>

        <ul
          className={`m-0 flex list-disc flex-col gap-1.5 rounded-2xl border border-gold/45 bg-[linear-gradient(180deg,rgba(244,182,63,0.10),transparent)] py-4 pr-4 pl-9 text-[15px] leading-relaxed text-fg-soft md:pr-5.5 ${FADE_UP} [animation-delay:80ms]`}
        >
          <li>{t("hero1")}</li>
          <li>{t.rich("hero2", { b })}</li>
          <li>{t.rich("hero3", { b })}</li>
        </ul>

        <div className={`flex flex-col gap-4 ${FADE_UP} [animation-delay:160ms]`}>
          <section className={SECTION}>
            <h2 className="m-0 mb-1.5 text-base">{t("playTitle")}</h2>
            <p className="m-0 text-sm leading-relaxed text-fg-soft">
              {t.rich("play", {
                rules: (chunks) => (
                  <Link href="/rules" className="text-gold underline-offset-2 hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="m-0 mb-1.5 text-base">{t("ageTitle")}</h2>
            <p className="m-0 text-sm leading-relaxed text-fg-soft">{t("age")}</p>
          </section>

          <section className={SECTION}>
            <h2 className="m-0 mb-1.5 text-base">{t("riskTitle")}</h2>
            <p className="m-0 text-sm leading-relaxed text-fg-soft">{t("risk")}</p>
            <p className="m-0 mt-1 flex items-baseline gap-2">
              <a href="tel:1834633" className="font-num text-2xl font-bold text-gold no-underline">
                1834 633
              </a>
              <span className="text-xs text-muted">{t("hotlineLabel")}</span>
            </p>
          </section>

          {/* scroll-mt：從頁尾的「私隱」連過來時，標題不會貼在畫面最上緣 */}
          <section id="privacy" className={`${SECTION} scroll-mt-6`}>
            <h2 className="m-0 mb-1.5 text-base">{t("privacyTitle")}</h2>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4.5 text-sm leading-relaxed text-fg-soft">
              <li>{t("privacyCollect")}</li>
              <li>{t("privacyUse")}</li>
              <li>{t("privacyCookie")}</li>
              <li>
                {t("privacyShare")}{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="break-all text-gold underline-offset-2 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="m-0 mb-1.5 text-base">{t("trademarkTitle")}</h2>
            <p className="m-0 text-sm leading-relaxed text-fg-soft">{t("trademark")}</p>
          </section>
        </div>

        <Link href="/" className="self-start text-sm text-gold underline-offset-2 hover:underline">
          ← {t("back")}
        </Link>
      </main>
    </div>
  );
}
