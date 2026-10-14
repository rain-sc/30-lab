import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-TW", "en"],
  // 瀏覽器語言對不上任何語系時用繁中
  defaultLocale: "zh-TW",
  // 網址一律帶語系前綴：/zh-TW/...、/en/...
  localePrefix: "always",
  // 用戶手動切換語系後記住一年（預設只在瀏覽器關閉前有效）
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
