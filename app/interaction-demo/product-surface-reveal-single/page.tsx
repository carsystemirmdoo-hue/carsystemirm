import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
} from "@/lib/carsystem-data";
import {
  ProductSurfaceRevealSingle,
  type ProductSurfaceSingleCard,
} from "@/components/interaction-demo/ProductSurfaceRevealSingle";

export const metadata: Metadata = {
  title: "Product surface reveal — vertical | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni vertikalni (9:16) showcase za snimanje social klipa. Jedan proizvod,
 * deterministički demo loop; showcaseImageSrc je packshot sa transparentnom
 * pozadinom, samo za ovaj demo; produkcijski katalog i podaci o proizvodima
 * ostaju netaknuti.
 */
const singleEntry = {
  label: "SPRAY PAINT",
  productSlug: "cosmos-spray-300",
  showcaseImageSrc: "/interaction-demo/spray-paint.png",
};

export default async function ProductSurfaceRevealSingleDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  const product = getCarsystemProductBySlug(singleEntry.productSlug);
  const brand = product ? getCarsystemBrandBySlug(product.brandSlug) : undefined;

  if (!product || !brand) notFound();

  const card: ProductSurfaceSingleCard = {
    label: singleEntry.label,
    brand,
    product,
    showcaseImage: {
      src: singleEntry.showcaseImageSrc,
      alt: `${product.name}, packshot sa transparentnom pozadinom`,
    },
  };

  return <ProductSurfaceRevealSingle card={card} isDemoMode={demo === "1"} />;
}
