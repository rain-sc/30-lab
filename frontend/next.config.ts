import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl：讀取 src/i18n/request.ts（每個請求的語系與翻譯）
const withNextIntl = createNextIntlPlugin();

// 後端位址（Spring Boot，預設 8088，見 backend/src/main/resources/application.properties）
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8088";

const nextConfig: NextConfig = {
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
