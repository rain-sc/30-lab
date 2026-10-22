import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { BokehBalls } from "@/components/fx/BokehBalls";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { LivePanel } from "@/features/draw/LivePanel";
import { RulesShort } from "@/features/draw/RulesShort";

// 進場動畫：各區塊依序淡入上移（純 CSS，伺服器渲染的內容不會先透明）
const FADE_UP = "animate-fade-up motion-reduce:animate-none";

// 登入、註冊共用版面（設計稿 A「開獎直播間」）
// 桌面：左邊直播面板、右邊表單卡片；手機：直播面板在上、卡片在下
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Auth");

  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden bg-[radial-gradient(120%_50%_at_30%_0%,var(--color-stage-glow)_0%,var(--color-stage)_65%)] md:bg-[radial-gradient(90%_60%_at_20%_0%,var(--color-stage-glow)_0%,var(--color-stage)_60%)]">
      {/* 背景氛圍效果（全頁唯一一個）：模糊漂浮的號碼球 */}
      <BokehBalls />

      <header className={`flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-5 ${FADE_UP}`}>
        <BrandLogo />
        <LocaleSwitcher />
      </header>

      {/* content-center：換行成上下兩行時（平板、手機），兩行靠在一起置中，不會被拉開 */}
      <main className="mx-auto flex w-full max-w-300 flex-1 flex-wrap content-center items-center gap-5 px-4 pb-6 md:gap-14 md:px-10 md:pt-6 md:pb-12">
        <LivePanel className={`min-w-0 flex-[999_1_560px] ${FADE_UP} [animation-delay:120ms]`} />

        <SpotlightCard
          aria-label={t("cardLabel")}
          className={`mx-auto flex w-full max-w-105 flex-[1_1_360px] flex-col gap-4.5 rounded-card border border-line bg-panel p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:gap-5.5 md:p-8 lg:mx-0 ${FADE_UP} [animation-delay:240ms]`}
        >
          {children}
          <p className="m-0 text-center text-[13px] leading-relaxed text-muted">{t("footnote")}</p>
        </SpotlightCard>

        {/* 桌面版的規則在直播面板裡，手機版放在最下面 */}
        <RulesShort className={`m-0 w-full text-center text-xs text-muted md:hidden ${FADE_UP} [animation-delay:360ms]`} />
      </main>
    </div>
  );
}
