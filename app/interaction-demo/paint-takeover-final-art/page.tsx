import type { Metadata } from "next";
import { PaintTakeoverFinalArt } from "@/components/paint-takeover/PaintTakeoverFinalArt";

export const metadata: Metadata = {
  title: "Paint takeover final art | Interaction demo",
  description:
    "Izolovani Phase 3A pregled finalne statične paint takeover kompozicije.",
};

export default async function PaintTakeoverFinalArtPage({
  searchParams,
}: {
  searchParams: Promise<{ artOnly?: string }>;
}) {
  const { artOnly } = await searchParams;

  return <PaintTakeoverFinalArt artOnly={artOnly === "1"} />;
}
