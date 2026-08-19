/**
 * Manufacturer catalogue candidates — multi-brand product knowledge acquisition.
 *
 * Phase 3 extracted technical data for R-M products we already stock. This
 * module models the wider problem: what does each manufacturer actually make,
 * how much of it do we carry, and what evidence do we hold for each claim.
 *
 * The central safety property is `catalogStatus`. A product found on a
 * manufacturer's website is *not* a product Carsystem sells. Conflating the two
 * would put items in the catalogue that nobody can order, so a discovered
 * product starts as `manufacturer-catalog-candidate` and only a human can move
 * it to `carsystem-offered`.
 *
 * Every technical claim reuses the Phase 2 provenance model unchanged:
 * `machine-extracted` / `needs-review`, never `expert-verified` from
 * acquisition. Nothing here can reach a public page.
 */

import type { Claim, KnowledgeSource, VerificationStatus } from "./provenance";

/* -------------------------------------------------------------------------- */
/* Catalogue status                                                           */
/* -------------------------------------------------------------------------- */

export type CatalogStatus =
  /** Present in the Carsystem catalogue today (`lib/carsystem-data.ts`). */
  | "carsystem-offered"
  /**
   * Found in the manufacturer's official catalogue but not in ours.
   *
   * Must never be presented as something Carsystem sells. Requires an explicit
   * business decision to promote.
   */
  | "manufacturer-catalog-candidate"
  /** Manufacturer has discontinued it; kept so it is not re-proposed. */
  | "discontinued"
  /** A human decided this is out of scope for Carsystem. */
  | "rejected";

export const PROMOTABLE_BY_HUMAN_ONLY: readonly CatalogStatus[] = [
  "manufacturer-catalog-candidate",
];

/* -------------------------------------------------------------------------- */
/* Assets                                                                     */
/* -------------------------------------------------------------------------- */

export type AssetKind =
  | "primary-image"
  | "additional-image"
  | "packshot"
  | "tds"
  | "sds"
  | "declaration"
  | "colour-chart"
  | "brochure"
  | "other-document";

/**
 * A product asset located at the manufacturer.
 *
 * `sourceUrl` is mandatory and is the whole point of the record: we track where
 * an asset legitimately comes from. `localPath` is populated only once the file
 * has actually been fetched into the repository, so an entry with a source URL
 * and no local path is a known-but-not-downloaded asset rather than a missing
 * one.
 *
 * Third-party reseller images are deliberately not modelled — when a
 * manufacturer source exists, it is the only acceptable origin.
 */
export type ProductAsset = {
  kind: AssetKind;
  sourceUrl: string;
  /** Repository-relative public path, once fetched. */
  localPath?: string;
  fileName?: string;
  mimeType?: string;
  bytes?: number;
  sha256?: string;
  /** ISO date the URL was observed. */
  accessedAt: string;
  /** Document version/revision as stated by the source. */
  version?: string;
  language?: string;
  note?: string;
};

/* -------------------------------------------------------------------------- */
/* Technical claims                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Fields a candidate record may carry. Mirrors `ProductTechnicalProfile` plus
 * the commercial descriptors that only a manufacturer catalogue supplies.
 */
export type CandidateClaimField =
  | "officialDescription"
  | "applicationUseCase"
  | "substrates"
  | "processStep"
  | "applicationMethod"
  | "compatibleProducts"
  | "mixingRatio"
  | "hardener"
  | "thinner"
  | "potLife"
  | "coats"
  | "flashOff"
  | "drying"
  | "temperature"
  | "filmThickness"
  | "nozzle"
  | "pressure"
  | "voc"
  | "coverage"
  | "warnings"
  | "gloss"
  | "shelfLife";

/**
 * A single technical claim with full acquisition provenance.
 *
 * `sourceUrl` and `accessedAt` are required because a web source, unlike a PDF
 * in the repository, can change under us without notice.
 */
export type CandidateClaim = {
  field: CandidateClaimField;
  /** Normalised value. Absent when the source wording resists safe normalising. */
  value?: unknown;
  /** Verbatim source wording. Always retained, even when `value` is set. */
  rawText: string;
  sourceType: KnowledgeSource["type"];
  sourceUrl: string;
  documentName?: string;
  documentVersion?: string;
  /** Page, section or table, when identifiable. */
  locator?: string;
  accessedAt: string;
  status: Extract<VerificationStatus, "machine-extracted" | "needs-review">;
  extractionConfidence: "high" | "medium" | "low";
  ambiguous?: boolean;
  note?: string;
};

/* -------------------------------------------------------------------------- */
/* Product / family / brand                                                   */
/* -------------------------------------------------------------------------- */

export type CandidateVariant = {
  variantId: string;
  label: string;
  /** Colour code, RAL, size, volume — whatever the manufacturer varies by. */
  code?: string;
  volume?: string;
  finish?: string;
  colourName?: string;
  ralCode?: string;
  sourceUrl?: string;
};

export type CandidateProduct = {
  /** Stable key within the brand. */
  key: string;
  manufacturer: string;
  brand: string;
  officialProductName: string;
  productCode?: string;
  sku?: string;
  family?: string;
  series?: string;
  category?: string;
  variants: CandidateVariant[];
  catalogStatus: CatalogStatus;
  /** Slug in `lib/carsystem-data.ts` when `carsystem-offered`. */
  carsystemProductSlug?: string;
  assets: ProductAsset[];
  claims: CandidateClaim[];
  /** Where the product record itself was found. */
  discoveredAt: string;
  discoverySourceUrl: string;
};

export type CandidateFamily = {
  key: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  productKeys: string[];
};

/**
 * Where a brand's official information lives, and how reliable it proved.
 *
 * Recorded per brand because acquisition feasibility varies enormously: a
 * structured TDS portal yields hundreds of documents mechanically, while a
 * brochure-only site yields almost nothing without manual work.
 */
export type BrandSourceProfile = {
  officialWebsite?: string;
  technicalPortal?: string;
  /** Pattern for direct TDS URLs, when the portal exposes one. */
  tdsUrlPattern?: string;
  cataloguePdf?: string;
  /** How mechanically extractable this brand's data proved to be. */
  acquisitionFeasibility:
    | "structured-portal"
    | "product-pages"
    | "catalogue-pdf-only"
    | "brochure-only"
    | "no-official-source-found";
  notes: string[];
  verifiedAt: string;
};

export type BrandManifest = {
  brandSlug: string;
  brandName: string;
  manufacturer: string;
  parentCompany?: string;
  source: BrandSourceProfile;
  families: CandidateFamily[];
  products: CandidateProduct[];
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Products discovered at the manufacturer that Carsystem does not stock. */
export function manufacturerOnlyProducts(manifest: BrandManifest) {
  return manifest.products.filter(
    (product) => product.catalogStatus === "manufacturer-catalog-candidate",
  );
}

export function carsystemProducts(manifest: BrandManifest) {
  return manifest.products.filter(
    (product) => product.catalogStatus === "carsystem-offered",
  );
}

export function assetsOfKind(product: CandidateProduct, kind: AssetKind) {
  return product.assets.filter((asset) => asset.kind === kind);
}

export function hasAsset(product: CandidateProduct, kind: AssetKind) {
  return product.assets.some((asset) => asset.kind === kind);
}

/**
 * Nothing acquired in this phase may be publishable.
 *
 * Used by the validator to assert the acquisition pipeline cannot promote its
 * own findings.
 */
export function acquisitionClaimsArePublishable(manifest: BrandManifest) {
  return manifest.products.some((product) =>
    product.claims.some(
      (claim) =>
        (claim.status as string) === "expert-verified" ||
        (claim.status as string) === "imported",
    ),
  );
}

export type { Claim, KnowledgeSource, VerificationStatus };
