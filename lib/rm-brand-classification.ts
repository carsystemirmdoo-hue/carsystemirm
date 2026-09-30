import catalogData from "@/data/rm-catalog-products.generated.json";
import type { CarsystemProduct, RmProductMetadata } from "@/lib/carsystem-data";
import { rmBrandClassificationFromSyncEntry } from "@/lib/rmBrandClassification.mjs";

/**
 * Klasifikacija R-M proizvoda za brend stranicu (`/brendovi/rm`) — jedini izvor za izbor i
 * grupisanje proizvoda na toj stranici.
 *
 *   `catalog`   — zapis već nosi potvrđen `rmMetadata` (zapisi iz arhive); koristi se takav kakav je.
 *   `sync`      — zapis R-M sinhronizacije bez `rmMetadata`; klasifikacija se izvodi iz zvaničnih
 *                 polja sync-a (`lib/rmBrandClassification.mjs`) i živi SAMO ovde.
 *
 * Kataloški zapis se ne menja: SEO, breadcrumb, pravilo boje, filteri i pretraga i dalje čitaju
 * samo `product.rmMetadata`.
 */
export type RmBrandClassification = RmProductMetadata & {
  source: "catalog" | "sync";
  /** Oznaka kategorije kada opšta oznaka ne odgovara (npr. „Basecoat/Topcoat”); inače `null`. */
  categoryLabel: string | null;
};

type SyncEntry = Parameters<typeof rmBrandClassificationFromSyncEntry>[0] & { slug: string };

const syncEntries = new Map(
  (catalogData.products as SyncEntry[]).map((entry) => [entry.slug, entry]),
);

export function deriveRmBrandClassification(
  product: Pick<CarsystemProduct, "slug" | "rmMetadata">,
): RmBrandClassification | null {
  if (product.rmMetadata) return { ...product.rmMetadata, source: "catalog", categoryLabel: null };
  const entry = syncEntries.get(product.slug);
  const derived = entry ? rmBrandClassificationFromSyncEntry(entry) : undefined;
  return derived
    ? { ...(derived as RmProductMetadata & { categoryLabel: string | null }), source: "sync" }
    : null;
}

/** Mapa slug → klasifikacija; serijalizuje se klijentskim komponentama brend stranice. */
export type RmBrandClassifications = Record<string, RmBrandClassification>;

export function getRmBrandClassifications(
  products: Pick<CarsystemProduct, "slug" | "rmMetadata">[],
): RmBrandClassifications {
  const result: RmBrandClassifications = {};
  for (const product of products) {
    const classification = deriveRmBrandClassification(product);
    if (classification) result[product.slug] = classification;
  }
  return result;
}
