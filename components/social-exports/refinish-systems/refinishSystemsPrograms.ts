import type {
  BrandCatalogPreview,
  ProgramCategory,
} from "@/components/home/animations/BrandEcosystemCards";
import { brandLogos, type BrandKey } from "@/components/home/BrandLogoPlate";
import { getCarsystemProductsByBrandSlug } from "@/lib/carsystem-data";

/*
 * Sadržaj i preview logika bloka „Sistemi za ceo refinish tok." — izdvojeno iz
 * nekadašnje homepage sekcije (ProgramDeckSection) da bi interni social-export
 * sistem koristio identičan sadržaj, kartice i podatke kataloga.
 */
export const programCategories: ProgramCategory[] = [
  {
    id: "boje-i-lakovi",
    number: "01",
    title: "Boje i lakovi",
    description:
      "Sistemi bojenja, bazne boje, pigmenti i bezbojni lakovi za kontrolisan završni sloj.",
    logos: ["rm", "baslac", "norbin"],
    hints: ["Bazne boje i pigmenti", "Bezbojni lakovi", "Sistemi bojenja", "Razređivači"],
  },
  {
    id: "priprema-i-abrazivi",
    number: "02",
    title: "Priprema i abrazivi",
    description: "Materijali za pripremu površine, gitovanje, prajmere, maskiranje i brušenje.",
    logos: ["carsystem", "carfit", "befar"],
    hints: ["Gitovi", "Prajmeri", "Abrazivi", "Maskiranje"],
  },
  {
    id: "pistolji-i-oprema",
    number: "03",
    title: "Pištolji i oprema",
    description: "Pištolji, pribor i radionička oprema za precizan nanos i pouzdan rad.",
    logos: ["sata", "carsystem", "autofit"],
    hints: ["Pištolji", "Oprema", "Pribor", "Potrošni delovi"],
  },
  {
    id: "poliranje",
    number: "04",
    title: "Poliranje",
    description: "Rešenja za korekciju površine, završni sjaj i profesionalnu doradu.",
    logos: ["rupes", "carsystem"],
    hints: ["Polirke", "Paste", "Sunđeri", "Završna obrada"],
  },
  {
    id: "potrosni-materijal",
    number: "05",
    title: "Potrošni materijal",
    description: "Radionički materijal za zaštitu, pripremu, nanos i svakodnevni tempo rada.",
    logos: ["carsystem", "cosmosLac", "befar"],
    hints: ["Trake", "Zaštita", "Čaše", "Krpe"],
  },
];

export const brandSlugByKey: Partial<Record<BrandKey, string>> = {
  rm: "rm",
  carsystem: "carsystem",
  baslac: "baslac",
  norbin: "norbin",
  sata: "sata",
  carfit: "carfit",
  cosmosLac: "cosmos-lac",
};

export function getDirectBrandCatalogPreview(brandKey: BrandKey): BrandCatalogPreview | null {
  const brandSlug = brandSlugByKey[brandKey];
  if (!brandSlug) return null;

  const products = getCarsystemProductsByBrandSlug(brandSlug).slice(0, 3);
  if (products.length === 0) return null;

  const brand = brandLogos[brandKey];
  return {
    ctaHref: `/brendovi/${brandSlug}`,
    ctaLabel: "Pogledajte katalog brenda",
    description: `Proizvodi iz ${brand.name} programa`,
    products,
    title: `${brand.name}: pregled kataloga`,
  };
}

function getCategoryProducts(category: ProgramCategory) {
  const products = category.logos.flatMap((brandKey) => {
    const brandSlug = brandSlugByKey[brandKey];
    return brandSlug ? getCarsystemProductsByBrandSlug(brandSlug) : [];
  });

  return Array.from(new Map(products.map((product) => [product.slug, product])).values()).slice(
    0,
    3,
  );
}

export function getBrandCatalogPreview(
  brandKey: BrandKey,
  category: ProgramCategory,
): BrandCatalogPreview | null {
  const directPreview = getDirectBrandCatalogPreview(brandKey);
  if (directPreview) return directPreview;

  const products = getCategoryProducts(category);
  if (products.length === 0) return null;

  const brand = brandLogos[brandKey];
  return {
    ctaHref: `/program/${category.id}`,
    ctaLabel: "Pogledajte ceo program",
    description: `Izbor proizvoda iz programa ${category.title.toLowerCase()} za ${brand.name}.`,
    products,
    title: `${brand.name}: pregled programa`,
  };
}

export function getDefaultPreviewBrandKey(category: ProgramCategory) {
  return category.logos.find((brandKey) => getDirectBrandCatalogPreview(brandKey)) ??
    category.logos[0] ??
    null;
}

/* ---------------------------------------------------------------------------
 * Sekvenca za video eksport
 * ------------------------------------------------------------------------- */

export type RefinishExportFormat = "story" | "feed" | "square";

export const refinishExportFormats: Record<
  RefinishExportFormat,
  { width: number; height: number; label: string }
> = {
  story: { width: 1080, height: 1920, label: "9:16" },
  feed: { width: 1080, height: 1350, label: "4:5" },
  square: { width: 1080, height: 1080, label: "1:1" },
};

export type ExportStep = {
  categoryIndex: number;
  brandKey: BrandKey;
};

export type ExportSequence = {
  steps: ExportStep[];
  /** Brend izabran query parametrom, ako je sekvenca vezana za jedan brend. */
  focusBrandKey: BrandKey | null;
  /** Kategorija izabrana query parametrom, ako je sekvenca vezana za jedan program. */
  focusCategory: ProgramCategory | null;
};

function resolveBrandKey(value: string): BrandKey | null {
  const normalized = value.trim().toLowerCase();
  const keys = Object.keys(brandLogos) as BrandKey[];

  return (
    keys.find((key) => key.toLowerCase() === normalized) ??
    keys.find((key) => brandSlugByKey[key]?.toLowerCase() === normalized) ??
    null
  );
}

/**
 * Bez parametra: svaka programska celina jednom, sa podrazumevanim brend
 * pregledom. Sa parametrom kategorije: jedna kartica, pregled po svakom njenom
 * brendu. Sa parametrom brenda: sve celine koje sadrže brend, pregled zaključan
 * na taj brend.
 */
export function resolveExportSequence(program: string | null): ExportSequence {
  if (program) {
    const categoryIndex = programCategories.findIndex(
      (category) => category.id === program.trim().toLowerCase(),
    );

    if (categoryIndex >= 0) {
      const category = programCategories[categoryIndex];
      return {
        steps: category.logos.map((brandKey) => ({ categoryIndex, brandKey })),
        focusBrandKey: null,
        focusCategory: category,
      };
    }

    const brandKey = resolveBrandKey(program);
    if (brandKey) {
      const steps = programCategories.flatMap((category, index) =>
        category.logos.includes(brandKey) ? [{ categoryIndex: index, brandKey }] : [],
      );

      if (steps.length > 0) {
        return { steps, focusBrandKey: brandKey, focusCategory: null };
      }
    }
  }

  return {
    steps: programCategories.map((category, index) => ({
      categoryIndex: index,
      brandKey: getDefaultPreviewBrandKey(category) ?? category.logos[0],
    })),
    focusBrandKey: null,
    focusCategory: null,
  };
}

/** Sve slike koje sekvenca prikazuje, za preload pre početka animacije. */
export function collectSequenceImageSrcs(sequence: ExportSequence): string[] {
  const srcs = new Set<string>();

  Object.values(brandLogos).forEach((brand) => {
    if (brand.src) srcs.add(brand.src);
  });

  sequence.steps.forEach((step) => {
    const preview = getBrandCatalogPreview(step.brandKey, programCategories[step.categoryIndex]);
    preview?.products.forEach((product) => {
      if (product.productImage) srcs.add(product.productImage.src);
    });
  });

  return Array.from(srcs);
}
