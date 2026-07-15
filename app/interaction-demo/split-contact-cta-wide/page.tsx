import type { Metadata } from "next";
import { SplitContactCtaWideShowcase } from "@/components/interaction-demo/SplitContactCtaWideShowcase";

export const metadata: Metadata = {
  title: "Split contact CTA — wide | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni horizontalni (16:9, 1920×1080) showcase za Contra/portfolio
 * prezentaciju. Fiksna editorial tipografija drži levu traku; hero je
 * netaknuti produkcijski SplitContactCta desno od centra, a ?demo=1 samo
 * deterministički pokreće pravu data-pointer-active putanju interakcije.
 */
export default async function SplitContactCtaWideDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  return <SplitContactCtaWideShowcase isDemoMode={demo === "1"} />;
}
