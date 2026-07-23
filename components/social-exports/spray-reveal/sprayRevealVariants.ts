/*
 * Namenski motion export: proizvod + spray reveal artwork iza njega.
 * Varijante su svesno mali config — proizvod, boja spray art-a i logo se
 * menjaju ovde (ili biraju preko ?product=), bez ikakvog redizajna scene.
 */

export type SprayRevealFormat = "story" | "feed" | "square" | "wide";

export const sprayRevealFormats: Record<
  SprayRevealFormat,
  { width: number; height: number; label: string }
> = {
  story: { width: 1080, height: 1920, label: "9:16" },
  feed: { width: 1080, height: 1350, label: "4:5" },
  square: { width: 1080, height: 1080, label: "1:1" },
  wide: { width: 1920, height: 1080, label: "16:9" },
};

export type SprayRevealVariant = {
  id: string;
  /** Slug proizvoda u katalogu (informativno; scena ne dira katalog). */
  productSlug: string | null;
  productName: string;
  brandName: string;
  brandLogoSrc: string | null;
  /** Transparentni packshot (postojeći interni asseti). */
  imageSrc: string;
  imageAlt: string;
  /** Boja spray art-a iza proizvoda. */
  sprayColor: string;
  /** Suptilni glow u pozadini kadra. */
  glowColor: string;
  /** Kategorija / tip za product-showcase kadar. */
  category: string;
  /** Kratka jednolinijska rečenica za product-showcase kadar. */
  lead: string;
};

export const sprayRevealVariants: SprayRevealVariant[] = [
  {
    id: "cosmos-spray",
    productSlug: "cosmos-spray-sprej",
    productName: "Cosmos Lac sprej",
    brandName: "Cosmos Lac",
    brandLogoSrc: "/brands/cosmos-spray.svg",
    imageSrc: "/interaction-demo/spray-paint.png",
    imageAlt: "Cosmos Lac sprej u prvom planu ispred spray poteza",
    sprayColor: "oklch(0.53 0.2 26)",
    glowColor: "oklch(0.53 0.2 26 / 0.32)",
    category: "Sprej boja",
    lead: "Akrilni sprej za precizan nanos i ujednačen, visok sjaj.",
  },
  {
    id: "basecoat",
    productSlug: "baslac-30-s510-s-serija",
    productName: "Baslac 30-S510 S serija",
    brandName: "Baslac",
    brandLogoSrc: "/brands/baslac.svg",
    imageSrc: "/interaction-demo/basecoat.png",
    imageAlt: "Baslac bazna boja u prvom planu ispred spray poteza",
    sprayColor: "oklch(0.55 0.16 248)",
    glowColor: "oklch(0.55 0.16 248 / 0.3)",
    category: "Bazna boja",
    lead: "Bazna boja za precizno usklađivanje nijanse u refinish procesu.",
  },
  {
    id: "filler-kit",
    productSlug: "rm-body-filler-white-b-2e11",
    productName: "R-M Body Filler White B 2E11",
    brandName: "R-M",
    brandLogoSrc: "/brands/rm.svg",
    imageSrc: "/interaction-demo/filler-kit.png",
    imageAlt: "R-M git u prvom planu ispred spray poteza",
    sprayColor: "oklch(0.58 0.22 27)",
    glowColor: "oklch(0.58 0.22 27 / 0.3)",
    category: "Git / punilo",
    lead: "Punilo za pripremu ravne i stabilne površine pre podloge.",
  },
];

export function resolveSprayRevealVariant(product: string | null): SprayRevealVariant {
  if (product) {
    const normalized = product.trim().toLowerCase();
    const match = sprayRevealVariants.find(
      (variant) =>
        variant.id === normalized || variant.productSlug?.toLowerCase() === normalized,
    );
    if (match) return match;
  }

  return sprayRevealVariants[0];
}
