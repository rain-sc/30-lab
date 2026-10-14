import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  // [locale] 是根參數，直接從 next/root-params 讀，頁面可以靜態渲染
  const locale = await rootParams.locale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
