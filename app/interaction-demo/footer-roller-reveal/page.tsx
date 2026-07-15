import type { Metadata } from "next";
import { FooterRollerRevealShowcase } from "@/components/interaction-demo/FooterRollerRevealShowcase";

export const metadata: Metadata = {
  title: "Footer roller reveal — vertical | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni vertikalni (9:16) showcase za snimanje social klipa. Minimalna
 * neutralna površina pre footera daje scroll kontekst; sam footer je
 * netaknuti produkcijski Footer/FooterReveal, a ?demo=1 samo skroluje
 * stranicu deterministički.
 */
export default async function FooterRollerRevealDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  return <FooterRollerRevealShowcase isDemoMode={demo === "1"} />;
}
