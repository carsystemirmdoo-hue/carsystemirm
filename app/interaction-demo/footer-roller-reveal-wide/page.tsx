import type { Metadata } from "next";
import { FooterRollerRevealWideShowcase } from "@/components/interaction-demo/FooterRollerRevealWideShowcase";

export const metadata: Metadata = {
  title: "Footer roller reveal — wide | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni horizontalni (16:9, 1920×1080) showcase za Contra/portfolio
 * prezentaciju. Fiksna editorial tipografija drži levu traku, sadržaj
 * "kraja stranice" desnu; sam footer je netaknuti produkcijski
 * Footer/FooterReveal, a ?demo=1 samo skroluje stranicu deterministički.
 */
export default async function FooterRollerRevealWideDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  return <FooterRollerRevealWideShowcase isDemoMode={demo === "1"} />;
}
