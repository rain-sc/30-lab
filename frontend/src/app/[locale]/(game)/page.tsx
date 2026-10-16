import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Lobby } from "@/features/lobby/Lobby";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("lobby") };
}

export default function LobbyPage() {
  return <Lobby />;
}
