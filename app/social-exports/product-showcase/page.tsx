import type { Metadata } from "next";
import {
  ProductShowcaseStage,
  type ProductShowcaseTheme,
} from "@/components/social-exports/product-showcase/ProductShowcaseStage";
import {
  resolveSprayRevealVariant,
  sprayRevealFormats,
  type SprayRevealFormat,
} from "@/components/social-exports/spray-reveal/sprayRevealVariants";

export const metadata: Metadata = {
  title: "Product showcase | Interni video eksport",
  robots: { index: false, follow: false },
};

/*
 * Interna scena: product page hero blok (tekst + spray reveal vizuel) kao
 * realan deo stranice proizvoda, u light i dark temi. Nije linkovana u
 * navigaciji, nije u sitemapu, nosi noindex.
 *   ?theme=light|dark
 *   ?format=story|feed|square|wide
 *   ?product=cosmos-spray|basecoat|filler-kit
 *   ?render=1 [&time=MS]  deterministički režim za MP4 render
 */
export default async function ProductShowcaseExportPage({
  searchParams,
}: {
  searchParams: Promise<{
    theme?: string;
    format?: string;
    product?: string;
    render?: string;
    time?: string;
  }>;
}) {
  const { theme, format, product, render, time } = await searchParams;
  const resolvedTheme: ProductShowcaseTheme = theme === "light" ? "light" : "dark";
  const resolvedFormat: SprayRevealFormat =
    format && format in sprayRevealFormats ? (format as SprayRevealFormat) : "story";
  const variant = resolveSprayRevealVariant(product ?? null);
  const renderMode = render === "1" || render === "true";
  const parsedTime = time === undefined ? Number.NaN : Number(time);
  const renderTimeMs = renderMode && Number.isFinite(parsedTime) ? Math.max(0, parsedTime) : null;

  return (
    <ProductShowcaseStage
      format={resolvedFormat}
      theme={resolvedTheme}
      variant={variant}
      renderMode={renderMode}
      renderTimeMs={renderTimeMs}
    />
  );
}
