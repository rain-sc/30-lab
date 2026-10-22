import type { Metadata } from "next";
import { Barlow_Condensed, Noto_Sans_TC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { MotionProvider } from "@/components/MotionProvider";
import { SessionGuard } from "@/features/auth/SessionGuard";
import { DrawFeed } from "@/features/draw/DrawFeed";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/lib/query/QueryProvider";
import "../globals.css";

// 內文：繁中 + 英文。中文字型檔很大，Google 會切成很多小檔按需載入，所以不預載
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
});

// 數字與品牌字：倒數、積分、號碼球、49 LAB（窄體，數字等寬）
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

// cacheComponents 要求根參數至少有一個值；每個語系都在 build 時預先渲染
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${notoSansTC.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* 把目前語系的翻譯傳給 Client Component（useTranslations 在 client 也能用） */}
        <NextIntlClientProvider>
          {/* 後端資料的快取（TanStack Query） */}
          <QueryProvider>
            <MotionProvider>{children}</MotionProvider>
            {/* 同一個瀏覽器的其他分頁登入時，這個分頁變成登出 */}
            <SessionGuard />
            {/* 期數資料（後端 API + 推播）：大廳、開獎舞台、登入頁的直播面板共用 */}
            <DrawFeed />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
