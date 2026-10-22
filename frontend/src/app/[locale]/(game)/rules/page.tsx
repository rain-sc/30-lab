import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RulesView } from "@/features/rules/RulesView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("rules") };
}

export default function Page() {
  return <RulesView />;
}
