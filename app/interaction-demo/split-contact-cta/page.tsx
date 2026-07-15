import type { Metadata } from "next";
import { SplitContactCtaShowcase } from "@/components/interaction-demo/SplitContactCtaShowcase";

export const metadata: Metadata = {
  title: "Split contact CTA — vertical | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni vertikalni (9:16, 1080×1920) showcase za snimanje social klipa.
 * Minimalna neutralna površina drži Studio One editorial okvir; hero je
 * netaknuti produkcijski SplitContactCta, a ?demo=1 samo deterministički
 * pokreće pravu data-pointer-active putanju interakcije.
 */
export default async function SplitContactCtaDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  return <SplitContactCtaShowcase isDemoMode={demo === "1"} />;
}
