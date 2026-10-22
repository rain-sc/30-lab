import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Leaderboard } from "@/features/leaderboard/Leaderboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("leaderboard") };
}

export default function Page() {
  return <Leaderboard />;
}
