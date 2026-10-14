import type { routing } from "@/i18n/routing";
import type messages from "@/i18n/messages/zh-TW.json";

// next-intl 的型別：翻譯 key 打錯、語系代碼寫錯，編譯時就會報錯。
// 以繁中檔為準，en.json 要有相同的 key。
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
