import type { Metadata } from "next";
import { PaintTakeoverSection } from "@/components/paint-takeover/PaintTakeoverSection";

export const metadata: Metadata = {
  title: "Paint takeover proof | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

export default async function PaintTakeoverDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const { debug } = await searchParams;

  return <PaintTakeoverSection debug={debug === "1"} />;
}
