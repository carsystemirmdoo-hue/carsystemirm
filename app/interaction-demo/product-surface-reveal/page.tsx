import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
} from "@/lib/carsystem-data";
import {
  ProductSurfaceRevealShowcase,
  type ProductSurfaceShowcaseCard,
} from "@/components/interaction-demo/ProductSurfaceRevealShowcase";

export const metadata: Metadata = {
  title: "Product surface reveal | Interni prikaz interakcije",
  robots: { index: false, follow: false },
};

/*
 * Interni showcase za snimanje interakcije. Smer reveal-a ne zavisi od
 * proizvoda: showcase ga bira po aktivaciji (ručno ~80% odozgo, demo
 * deterministički). showcaseImageSrc su packshot-ovi sa transparentnom
 * pozadinom, samo za ovaj demo; produkcijski katalog i podaci o proizvodima
 * ostaju netaknuti.
 */
const showcaseEntries = [
  {
    label: "FILLER KIT",
    productSlug: "rm-body-filler-white-b-2e11",
    showcaseImageSrc: "/interaction-demo/filler-kit.png",
  },
  {
    label: "SPRAY PAINT",
    productSlug: "cosmos-spray-300",
    showcaseImageSrc: "/interaction-demo/spray-paint.png",
  },
  {
    label: "BASECOAT",
    productSlug: "baslac-30-s510-s-serija",
    showcaseImageSrc: "/interaction-demo/basecoat.png",
  },
];

export default async function ProductSurfaceRevealDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  const cards: ProductSurfaceShowcaseCard[] = showcaseEntries.map((entry) => {
    const product = getCarsystemProductBySlug(entry.productSlug);
    const brand = product ? getCarsystemBrandBySlug(product.brandSlug) : undefined;

    if (!product || !brand) notFound();

    return {
      label: entry.label,
      brand,
      product,
      showcaseImage: {
        src: entry.showcaseImageSrc,
        alt: `${product.name}, packshot sa transparentnom pozadinom`,
      },
    };
  });

  return <ProductSurfaceRevealShowcase cards={cards} isDemoMode={demo === "1"} />;
}
