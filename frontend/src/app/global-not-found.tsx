import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// 完全對不上任何路由時顯示（不在 [locale] 底下，拿不到語系，所以中英並列）
export const metadata: Metadata = {
  title: "404 | 49 Lab",
};

export default function GlobalNotFound() {
  return (
    <html lang="zh-TW">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-semibold">找不到頁面 · Page not found</h1>
        {/* 回到 /，proxy 會依語系導向 */}
        <Link href="/" className="underline underline-offset-4">
          回到首頁 · Back to home
        </Link>
      </body>
    </html>
  );
}
