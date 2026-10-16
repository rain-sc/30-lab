import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/AuthCard";
import { SessionNotice } from "@/features/auth/SessionNotice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("pageTitle") };
}

// 登入、註冊共用這一頁，用分頁切換（見 AuthCard）
export default function LoginPage() {
  const t = useTranslations("Auth");

  return (
    <>
      {/* 畫面上的標題由分頁表示，h1 給螢幕閱讀器 */}
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <SessionNotice />
      <AuthCard />
    </>
  );
}
