import catalogData from "@/data/carfit-catalog-products.generated.json";

/*
 * C.A.R.FIT abrazivi za blok „Od grubog zahvata do kontrolisane površine“
 * (2026-10-19). Raspon granulacije se računa iz zvanične tabele varijanti
 * (carfitrepair.com, `officialDescriptor` „P40, 50 pcs.“), a namena je zvaničan
 * tekst proizvoda — ništa se ne zaključuje izvan tih izvora. Proizvođač ne
 * objavljuje preporuku „granulacija → korak“, pa je stranica ne izmišlja.
 */
type CatalogVariant = { officialDescriptor?: string | null; label?: string | null };
type CatalogEntry = {
  slug: string;
  name: string;
  sourceUrl: string;
  image: { src: string } | null;
  variants: CatalogVariant[];
  content?: { purpose?: string; subtype?: string } | null;
};

const entries = (catalogData as unknown as { products: CatalogEntry[] }).products;

export const CARFIT_ABRASIVE_SLUGS = [
  "carfit-gold-paper-disc",
  "carfit-color-net-disc",
  "carfit-red-film-abrasive-discs",
  "carfit-purple-ceramic-film",
  "carfit-wet-sanding-paper",
] as const;

export type CarfitAbrasive = {
  slug: string;
  name: string;
  subtype: string;
  purpose: string;
  image: string | null;
  sourceUrl: string;
  gritMin: number;
  gritMax: number;
  gritCount: number;
};

function grits(entry: CatalogEntry) {
  const values = new Set<number>();
  for (const variant of entry.variants) {
    const text = `${variant.officialDescriptor ?? ""} ${variant.label ?? ""}`;
    for (const match of text.matchAll(/P\s?(\d{2,4})\b/g)) values.add(Number(match[1]));
  }
  return [...values].sort((a, b) => a - b);
}

export function getCarfitAbrasives(): CarfitAbrasive[] {
  return CARFIT_ABRASIVE_SLUGS.flatMap((slug) => {
    const entry = entries.find((item) => item.slug === slug);
    if (!entry) return [];
    const values = grits(entry);
    if (values.length === 0) return [];
    return [
      {
        slug,
        name: entry.name.replace(/^Car Fit\s+/i, ""),
        subtype: entry.content?.subtype ?? "",
        purpose: entry.content?.purpose ?? "",
        image: entry.image?.src ?? null,
        sourceUrl: entry.sourceUrl,
        gritMin: values[0],
        gritMax: values[values.length - 1],
        gritCount: values.length,
      },
    ];
  });
}
