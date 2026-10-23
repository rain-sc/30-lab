import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl：讀取 src/i18n/request.ts（每個請求的語系與翻譯）
const withNextIntl = createNextIntlPlugin();

// 後端位址（Spring Boot，預設 8088，見 backend/src/main/resources/application.properties）
// 上線時 Vercel 的 BACKEND_URL 要在建置前設好：這裡在 build 時讀進設定，只改環境變數而不重新部署不會生效
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8088";

const nextConfig: NextConfig = {
  // dev server 預設只允許 localhost 載入開發用的 JS 和 HMR；用區網 IP（例如手機測試 http://192.168.0.171:3100）開時，
  // JS 會被擋掉、頁面無法互動（表單會變成瀏覽器原生送出）。允許整個 192.168.x.x 網段，路由器換 IP 也不用改
  // 只影響 next dev，正式環境沒有這個限制
  // 開發時把 /api/* 轉發到後端：瀏覽器只跟 localhost:3100 說話，不會有 CORS 問題
  // （WebSocket 不經過這裡，直接連後端，見根目錄 CLAUDE.md）
  rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 根佈局在 [locale] 底下，對不上任何路由的網址用 app/global-not-found.tsx
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
