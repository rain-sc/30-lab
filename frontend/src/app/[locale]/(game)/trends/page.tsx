import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrendsView } from "@/features/game/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("trends") };
}

export default function Page() {
  return <TrendsView />;
}
