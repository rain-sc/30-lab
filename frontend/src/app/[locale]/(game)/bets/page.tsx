import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BetsView } from "@/features/game/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("bets") };
}

export default function Page() {
  return <BetsView />;
}
