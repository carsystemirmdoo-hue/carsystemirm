/**
 * Joins the product catalogue to the knowledge layer.
 *
 * Technical profiles are kept *outside* `CarsystemProduct` so the catalogue data
 * layer has no dependency on the knowledge layer, and so an unpopulated profile
 * costs nothing at the product level.
 *
 * Profiles for the 59 R-M products are derived automatically from the existing
 * import: each one is seeded with real `KnowledgeSource` records pointing at the
 * technical data sheet that is already in the repository, and with every
 * technical field left as an unpopulated `needs-review` claim.
 *
 * This is the honest representation of what we actually know today:
 *
 *   "A technical data sheet exists at this path, these fields are relevant to
 *    this product, and nobody has extracted or verified a value yet."
 *
 * No value is inferred from a product name, category or system. The extraction
 * step that would populate these is a separate, reviewed pipeline.
 */

import rmGeneratedRecords from "@/data/rm-imported-products.generated.json";
import rmExtraction from "@/data/knowledge/rm-technical-extraction.generated.json";
import type { Claim, KnowledgeSource } from "./provenance";
import { needsHumanReview, unknownClaim } from "./provenance";
import type { ProductSubstrateClaim, SubstrateSlug } from "./entities";
import {
  TECHNICAL_CLAIM_FIELDS,
  type ProductTechnicalProfile,
  type TechnicalClaimField,
} from "./technical";

type RmGeneratedRecord = {
  slug: string;
  canonicalName: string;
  productCode: string;
  documents?: {
    technicalDataSheet?: string;
    productInformation?: string;
  };
  taxonomy: { category: string; phaseSlug: string };
};

const rmRecords = (rmGeneratedRecords as { products: unknown[] })
  .products as unknown as RmGeneratedRecord[];

/**
 * Which technical fields are worth asking about for a given R-M category.
 *
 * This is a *relevance* judgement, not a technical claim — it decides which
 * questions appear on the expert's review sheet, never what the answers are.
 * Getting it slightly wrong costs an extra blank row, not a wrong fact.
 */
const FIELDS_BY_RM_CATEGORY: Record<string, TechnicalClaimField[]> = {
  clearcoat: [
    "substrates",
    "mixingRatio",
    "hardenerProductSlugs",
    "thinnerProductSlugs",
    "sprayGun",
    "coats",
    "flashOffMinutes",
    "filmThicknessMicrons",
    "dryingProfile",
    "vocGramsPerLitre",
    "coverage",
  ],
  "primer-filler": [
    "substrates",
    "mixingRatio",
    "hardenerProductSlugs",
    "sprayGun",
    "coats",
    "flashOffMinutes",
    "filmThicknessMicrons",
    "sanding",
    "dryingProfile",
    "followingProductSlugs",
  ],
  basecoat: [
    "substrates",
    "mixingRatio",
    "thinnerProductSlugs",
    "sprayGun",
    "coats",
    "flashOffMinutes",
    "dryingProfile",
    "followingProductSlugs",
    "coverage",
  ],
  hardener: ["mixingRatio", "precedingProductSlugs", "potLifeMinutes", "temperatureNotes"],
  thinner: ["mixingRatio", "precedingProductSlugs", "temperatureNotes"],
  additive: ["mixingRatio", "precedingProductSlugs", "temperatureNotes"],
  bodyfiller: ["substrates", "mixingRatio", "sanding", "dryingProfile", "followingProductSlugs"],
  cleaner: ["substrates", "applicationMethods", "precedingProductSlugs"],
  "polishing-compound": ["applicationMethods", "coverage"],
};

function rmSources(record: RmGeneratedRecord): KnowledgeSource[] {
  const sources: KnowledgeSource[] = [];
  if (record.documents?.technicalDataSheet) {
    sources.push({
      type: "manufacturer-technical-document",
      label: `R-M tehnički list — ${record.canonicalName}`,
      documentPath: record.documents.technicalDataSheet,
    });
  }
  if (record.documents?.productInformation) {
    sources.push({
      type: "manufacturer-product-information",
      label: `R-M informacije o proizvodu — ${record.canonicalName}`,
      documentPath: record.documents.productInformation,
    });
  }
  return sources;
}

function buildRmProfile(record: RmGeneratedRecord): ProductTechnicalProfile {
  const fields = FIELDS_BY_RM_CATEGORY[record.taxonomy.category] ?? ["substrates"];
  const sources = rmSources(record);
  const profile: ProductTechnicalProfile = { productSlug: record.slug };

  for (const field of fields) {
    // Every field starts life as an explicitly unknown claim carrying the real
    // document reference. Nothing here reads or guesses a value.
    Object.assign(profile, {
      [field]: unknownClaim(
        sources,
        sources.length
          ? "Vrednost nije izvučena iz tehničkog lista. Zahteva ekstrakciju i stručnu potvrdu."
          : "Nema dostupnog tehničkog dokumenta u projektu.",
      ),
    });
  }

  return profile;
}

/* -------------------------------------------------------------------------- */
/* Phase 3 — extracted claims                                                 */
/* -------------------------------------------------------------------------- */

type ExtractedClaim = {
  field: string;
  value?: unknown;
  rawText: string;
  section: string;
  page: number;
  documentHref: string;
  documentLabel: string;
  verificationStatus: "machine-extracted";
  extractionConfidence: "high" | "low";
  ambiguous: boolean;
  note?: string;
};

type ExtractionRecord = {
  productSlug: string;
  documentHref: string;
  claims: ExtractedClaim[];
};

const extractionRecords = (rmExtraction as { records: ExtractionRecord[] }).records;

/**
 * Fields the extractor emits that are not part of `ProductTechnicalProfile`.
 *
 * `applicationStatement` and `sequencing` are kept in the extraction dataset
 * and surfaced in the review pack, but they do not map onto a typed profile
 * field — inventing one to hold them would imply a modelled relationship the
 * source does not structurally provide.
 */
const NON_PROFILE_FIELDS = new Set(["applicationStatement", "sequencing"]);

type ExtractedSubstrateEntry = {
  slugs: string[];
  sourceText: string;
  suitability: "suitable" | "requires-primer";
  condition?: string;
  unmapped?: boolean;
};

/**
 * Reshape the extractor's substrate entries into `ProductSubstrateClaim`.
 *
 * The extractor groups by *source phrase* (one phrase can name two substrates,
 * e.g. the compound plastics line); the profile models one entry per substrate.
 * Flattening here keeps the declared type honest instead of storing a
 * differently-shaped object behind a type that claims otherwise.
 */
function toSubstrateClaims(value: unknown): ProductSubstrateClaim[] {
  const entries = (value ?? []) as ExtractedSubstrateEntry[];
  const claims: ProductSubstrateClaim[] = [];
  for (const entry of entries) {
    for (const slug of entry.slugs) {
      claims.push({
        substrateSlug: slug as SubstrateSlug,
        suitability: entry.suitability,
        note: entry.condition
          ? `${entry.sourceText} — ${entry.condition}`
          : entry.sourceText,
      });
    }
  }
  return claims;
}

function toClaim(extracted: ExtractedClaim): Claim<unknown> {
  const source: KnowledgeSource = {
    type: "manufacturer-technical-document",
    label: extracted.documentLabel,
    documentPath: extracted.documentHref,
    locator: `str. ${extracted.page}, sekcija „${extracted.section}”`,
    excerpt: extracted.rawText,
  };

  const value =
    extracted.field === "substrates"
      ? toSubstrateClaims(extracted.value)
      : extracted.value;

  return {
    // An ambiguous extraction carries no structured value on purpose: the
    // source statement is preserved in the excerpt for the reviewer instead.
    value: extracted.ambiguous ? undefined : value,
    status: "machine-extracted",
    sources: [source],
    reviewNote:
      extracted.note ??
      (extracted.ambiguous
        ? "Vrednost nije normalizovana bez tumačenja. Videti izvorni tekst."
        : undefined),
  };
}

/** Technical profiles, keyed by product slug, seeded then filled by extraction. */
export const productTechnicalProfiles: ProductTechnicalProfile[] = (() => {
  const profiles = rmRecords.map(buildRmProfile);
  const bySlug = new Map(profiles.map((profile) => [profile.productSlug, profile]));

  for (const record of extractionRecords) {
    const profile = bySlug.get(record.productSlug);
    if (!profile) continue;
    for (const extracted of record.claims) {
      if (NON_PROFILE_FIELDS.has(extracted.field)) continue;
      Object.assign(profile, { [extracted.field]: toClaim(extracted) });
    }
  }

  return profiles;
})();

const profilesBySlug = new Map(
  productTechnicalProfiles.map((profile) => [profile.productSlug, profile]),
);

export function getProductTechnicalProfile(productSlug: string) {
  return profilesBySlug.get(productSlug);
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Products suitable for a substrate.
 *
 * Returns an empty list today because no `substrates` claim is populated or
 * verified anywhere. That is the correct behaviour: the query is real, the data
 * is not there yet, and callers get nothing rather than a guess. Populating the
 * claims turns every consumer of this function on at once.
 */
export function getProductSlugsForSubstrate(substrateSlug: SubstrateSlug) {
  return productTechnicalProfiles
    .filter((profile) => {
      const claim = profile.substrates;
      if (!claim?.value || claim.status !== "expert-verified") return false;
      return claim.value.some(
        (entry: ProductSubstrateClaim) =>
          entry.substrateSlug === substrateSlug && entry.suitability !== "not-suitable",
      );
    })
    .map((profile) => profile.productSlug);
}

/**
 * Unverified evidence that a product may suit a substrate.
 *
 * Deliberately separate from `getProductSlugsForSubstrate()`, which gates on
 * `expert-verified` and drives anything user-facing. This function answers a
 * different question — *does the evidence exist yet?* — and is used only by the
 * review tooling and reporting.
 *
 * The return type carries `unverified: true` so a caller cannot accidentally
 * treat these as publishable facts.
 */
export function getSubstrateEvidence(substrateSlug: SubstrateSlug) {
  const matches: {
    productSlug: string;
    suitability: ProductSubstrateClaim["suitability"];
    note?: string;
    source?: KnowledgeSource;
    unverified: true;
  }[] = [];

  for (const profile of productTechnicalProfiles) {
    const claim = profile.substrates;
    if (!claim?.value) continue;
    for (const entry of claim.value as ProductSubstrateClaim[]) {
      if (entry.substrateSlug !== substrateSlug) continue;
      if (entry.suitability === "not-suitable") continue;
      matches.push({
        productSlug: profile.productSlug,
        suitability: entry.suitability,
        note: entry.note,
        source: claim.sources[0],
        unverified: true,
      });
    }
  }

  return matches;
}

/** Products carrying any machine-extracted substrate evidence at all. */
export function productsWithSubstrateEvidence() {
  return productTechnicalProfiles.filter((profile) =>
    Boolean(profile.substrates?.value),
  ).length;
}

/** Every claim still awaiting a human, flattened for the review exporter. */
export function pendingTechnicalClaims() {
  const pending: {
    productSlug: string;
    field: TechnicalClaimField;
    sources: KnowledgeSource[];
    reviewNote?: string;
  }[] = [];

  for (const profile of productTechnicalProfiles) {
    for (const field of TECHNICAL_CLAIM_FIELDS) {
      const claim = profile[field];
      if (needsHumanReview(claim)) {
        pending.push({
          productSlug: profile.productSlug,
          field,
          sources: claim!.sources,
          reviewNote: claim!.reviewNote,
        });
      }
    }
  }

  return pending;
}

/** Coverage statistics, used by the validator and the implementation report. */
export function technicalCoverageStats() {
  let total = 0;
  let verified = 0;
  for (const profile of productTechnicalProfiles) {
    for (const field of TECHNICAL_CLAIM_FIELDS) {
      const claim = profile[field];
      if (!claim) continue;
      total += 1;
      if (claim.value !== undefined && claim.status === "expert-verified") verified += 1;
    }
  }
  return {
    profiles: productTechnicalProfiles.length,
    claimSlots: total,
    verifiedClaims: verified,
    pendingClaims: total - verified,
  };
}
