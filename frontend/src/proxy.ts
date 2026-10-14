import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 的 proxy（舊名 middleware）：沒有語系前綴的網址，
// 依 cookie → Accept-Language → 預設語系的順序，導向 /zh-TW/... 或 /en/...
export default createMiddleware(routing);

export const config = {
  // 跳過 /api（轉發到後端）、Next 內部路徑、帶副檔名的靜態檔案
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
