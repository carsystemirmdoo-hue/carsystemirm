/**
 * Technical knowledge extension for products.
 *
 * Every field here is a `Claim`, which means every field can exist in exactly
 * one of three honest states:
 *
 *   - absent            -> not relevant to this product type
 *   - Claim without value -> relevant, but we do not have a trustworthy value
 *   - Claim with value + expert-verified -> publishable
 *
 * There is deliberately no way to express "value, trust me". A value cannot be
 * rendered without travelling through `publishedValue()`, which refuses
 * anything short of `expert-verified`.
 *
 * This module defines *shape only*. No values are populated anywhere in this
 * codebase, because the source data for them currently exists only inside
 * manufacturer TDS PDFs that have not been extracted or reviewed.
 */

import type { Claim } from "./provenance";
import type {
  ApplicationMethod,
  DefectSlug,
  ProcessStepSlug,
  ProductSubstrateClaim,
} from "./entities";

/** A numeric range, e.g. film thickness 50–60 µm. */
export type Range = { min: number; max: number; unit: string };

/** A drying entry: how long, at what temperature. */
export type DryingProfileEntry = {
  /** Ambient or oven temperature in °C. */
  temperatureC: number;
  /** Duration in minutes. */
  minutes: number;
  /** What state is reached, e.g. "prašinasto suvo", "za montažu". */
  stage?: string;
};

/** Mixing ratio expressed exactly as the source document states it. */
export type MixingRatio = {
  /** Verbatim ratio string from the TDS, e.g. "4:1:1". Never recomputed. */
  ratio: string;
  /** What each position refers to, in order, e.g. ["lak", "učvršćivač", "razređivač"]. */
  components: string[];
  /** Whether the ratio is by volume or by weight. Getting this wrong is costly. */
  basis?: "volume" | "weight";
};

export type SprayGunSetup = {
  /** Nozzle diameter range in mm. */
  nozzleMm?: Range;
  /** Inlet pressure in bar. */
  pressureBar?: Range;
  gunType?: string;
};

export type SandingSpec = {
  /** Grit values as stated by the source, e.g. ["P400", "P500"]. */
  grits: string[];
  method?: "dry" | "wet" | "both";
};

/**
 * The full technical profile for a product.
 *
 * Attached to a product via `lib/knowledge/product-knowledge.ts` rather than
 * being embedded in `CarsystemProduct`, so the catalogue data layer stays
 * independent of the knowledge layer and neither import direction is circular.
 */
export type ProductTechnicalProfile = {
  /** Product slug in `lib/carsystem-data.ts`. */
  productSlug: string;

  /* -- What it goes on and where it sits in the job -- */
  substrates?: Claim<ProductSubstrateClaim[]>;
  processStep?: Claim<ProcessStepSlug>;
  applicationMethods?: Claim<ApplicationMethod[]>;

  /* -- Sequence -- */
  /** Products that may be applied immediately before this one. */
  precedingProductSlugs?: Claim<string[]>;
  /** Products that may be applied immediately after this one. */
  followingProductSlugs?: Claim<string[]>;

  /* -- Mixing -- */
  mixingRatio?: Claim<MixingRatio>;
  hardenerProductSlugs?: Claim<string[]>;
  thinnerProductSlugs?: Claim<string[]>;
  potLifeMinutes?: Claim<number>;

  /* -- Application -- */
  sprayGun?: Claim<SprayGunSetup>;
  coats?: Claim<string>;
  flashOffMinutes?: Claim<number>;
  filmThicknessMicrons?: Claim<Range>;
  sanding?: Claim<SandingSpec>;

  /* -- Curing and environment -- */
  dryingProfile?: Claim<DryingProfileEntry[]>;
  temperatureNotes?: Claim<string>;

  /* -- Compliance and yield -- */
  vocGramsPerLitre?: Claim<number>;
  coverage?: Claim<string>;

  /* -- Safety -- */
  /**
   * Warnings are claims like any other. An unverified safety warning is as
   * dangerous as a missing one, so these are never rendered unless verified.
   */
  warnings?: Claim<string[]>;

  /* -- Problem solving -- */
  solvesDefects?: Claim<DefectSlug[]>;
};

/** Field keys that carry technical claims, used by the review exporter. */
export const TECHNICAL_CLAIM_FIELDS = [
  "substrates",
  "processStep",
  "applicationMethods",
  "precedingProductSlugs",
  "followingProductSlugs",
  "mixingRatio",
  "hardenerProductSlugs",
  "thinnerProductSlugs",
  "potLifeMinutes",
  "sprayGun",
  "coats",
  "flashOffMinutes",
  "filmThicknessMicrons",
  "sanding",
  "dryingProfile",
  "temperatureNotes",
  "vocGramsPerLitre",
  "coverage",
  "warnings",
  "solvesDefects",
] as const satisfies readonly (keyof ProductTechnicalProfile)[];

export type TechnicalClaimField = (typeof TECHNICAL_CLAIM_FIELDS)[number];

/** Serbian labels for the review export and any future UI. */
export const TECHNICAL_FIELD_LABELS: Record<TechnicalClaimField, string> = {
  substrates: "Podloge",
  processStep: "Faza procesa",
  applicationMethods: "Način nanošenja",
  precedingProductSlugs: "Prethodni proizvodi u sistemu",
  followingProductSlugs: "Sledeći proizvodi u sistemu",
  mixingRatio: "Odnos mešanja",
  hardenerProductSlugs: "Učvršćivač",
  thinnerProductSlugs: "Razređivač",
  potLifeMinutes: "Vreme upotrebljivosti smeše",
  sprayGun: "Pištolj i dizna",
  coats: "Broj slojeva",
  flashOffMinutes: "Odzračivanje (flash-off)",
  filmThicknessMicrons: "Debljina sloja",
  sanding: "Brušenje",
  dryingProfile: "Sušenje",
  temperatureNotes: "Temperatura i uslovi",
  vocGramsPerLitre: "VOC",
  coverage: "Izdašnost",
  warnings: "Tehnička upozorenja",
  solvesDefects: "Rešava probleme",
};
