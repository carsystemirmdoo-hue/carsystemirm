import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCarsystemBrandBySlug, getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { CursorStatesShowcase } from "@/components/interaction-demo/CursorStatesShowcase";

export const metadata: Metadata = {
  title: "Cursor states | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni pregled svih data-cursor stanja (text, headline, link, button,
 * card, image, image-open) na jednoj strani, sa toggle-om za light/dark
 * temu. Koristi stvarne proizvodne komponente (ProductVisualSurface,
 * ThemeToggle) umesto da ponavlja njihovu logiku.
 */
export default function CursorStatesDemoPage() {
  const product = getCarsystemProductBySlug("rm-body-filler-white-b-2e11");
  const brand = product ? getCarsystemBrandBySlug(product.brandSlug) : undefined;

  if (!product || !brand) notFound();

  return <CursorStatesShowcase product={product} brand={brand} />;
}
