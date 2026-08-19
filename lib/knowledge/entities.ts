/**
 * Core domain entities for the Carsystem refinishing knowledge layer.
 *
 * These describe the *domain*, not the website. Products, brands and categories
 * already exist in `lib/carsystem-data.ts`; this module adds the entities that
 * make the catalogue answerable rather than merely browsable:
 *
 *   Substrate    — what you are painting onto
 *   ProcessStep  — where in the refinish sequence you are
 *   Defect       — what has gone wrong, or what you are trying to prevent
 *   Application  — a substrate + process + method combination
 *
 * The relationship the audit identified as missing is:
 *
 *   problem -> substrate -> process -> product type -> compatible product
 *           -> brand -> technical documentation -> purchase path
 *
 * Substrate and Defect are the two entities that were entirely absent, and they
 * are the ones that unblock most of the seeded answer intents.
 *
 * Vocabulary here is a *controlled* list. Free-text substrate names are the
 * reason the existing `label: "Površina"` product facts cannot be queried.
 */

import type { Claim, KnowledgeSource, VerificationStatus } from "./provenance";

/* -------------------------------------------------------------------------- */
/* Substrate                                                                  */
/* -------------------------------------------------------------------------- */

export const substrateSlugs = [
  "celik",
  "pocinkovani-lim",
  "aluminijum",
  "plastika",
  "stakloplastika",
  "e-coat",
  "stari-lak",
  "poliesterski-kit",
  "temeljna-boja",
] as const;

export type SubstrateSlug = (typeof substrateSlugs)[number];

export type Substrate = {
  slug: SubstrateSlug;
  /** Canonical Serbian name used in headings and copy. */
  name: string;
  /**
   * Neutral description of the material. Must describe *what it is*, never how
   * to treat it — treatment is a technical claim and belongs in a `Claim`.
   */
  description: string;
  /** Common synonyms; resolved through the terminology layer. */
  terminologySlug?: string;
};

/* -------------------------------------------------------------------------- */
/* Process step                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ordered stages of a refinish job.
 *
 * This intentionally mirrors the existing `RefinishPhaseSlug` in
 * `lib/carsystem-data.ts` so products already carrying a `phaseSlug` map into
 * the knowledge layer without a migration, while allowing finer-grained steps
 * to be added later without touching product records.
 */
export const processStepSlugs = [
  "procena-i-priprema",
  "brusenje",
  "kitovanje",
  "temeljenje",
  "bojenje",
  "lakiranje",
  "susenje",
  "poliranje",
] as const;

export type ProcessStepSlug = (typeof processStepSlugs)[number];

export type ProcessStep = {
  slug: ProcessStepSlug;
  name: string;
  /** 1-based position in the canonical sequence. */
  order: number;
  description: string;
  /** Maps onto the existing product `phaseSlug` values where equivalent. */
  refinishPhaseSlugs: string[];
};

/* -------------------------------------------------------------------------- */
/* Defect / problem                                                           */
/* -------------------------------------------------------------------------- */

export const defectSlugs = [
  "korozija",
  "slabo-prianjanje",
  "pomorandzina-kora",
  "krateri",
  "curenje-laka",
  "mehurici",
  "matiranje-sjaja",
  "razlika-u-nijansi",
] as const;

export type DefectSlug = (typeof defectSlugs)[number];

export type Defect = {
  slug: DefectSlug;
  name: string;
  /** What the defect looks like. Observation only — no causes, no remedies. */
  description: string;
  /**
   * Causes and remedies are technical claims and must carry provenance, so they
   * are claims rather than plain strings. Empty until an expert or a document
   * supplies them.
   */
  causes: Claim<string[]>;
  remedies: Claim<string[]>;
  /** Process steps where this defect typically originates. Claim-gated. */
  relatedProcessSteps: Claim<ProcessStepSlug[]>;
};

/* -------------------------------------------------------------------------- */
/* Application                                                                */
/* -------------------------------------------------------------------------- */

export type ApplicationMethod =
  | "spray"
  | "aerosol"
  | "brush"
  | "roller"
  | "wipe"
  | "polish";

/**
 * A substrate + process-step + method combination that a product may serve.
 *
 * This is the join entity that lets "koji prajmer ide na aluminijum" resolve to
 * a product set: filter products whose `substrates` claim includes `aluminijum`
 * with a publishable suitability, and whose process step is `temeljenje`.
 */
export type Application = {
  slug: string;
  name: string;
  substrateSlug: SubstrateSlug;
  processStepSlug: ProcessStepSlug;
  methods: ApplicationMethod[];
};

/* -------------------------------------------------------------------------- */
/* Product <-> substrate suitability                                          */
/* -------------------------------------------------------------------------- */

/**
 * How suitable a product is for a substrate.
 *
 * `requires-primer` is a distinct state rather than a flavour of "suitable"
 * because it is the single most consequential distinction in refinishing —
 * "works on aluminium" and "works on aluminium once correctly primed" are
 * different answers, and conflating them damages vehicles.
 */
export type SubstrateSuitability =
  | "recommended"
  | "suitable"
  | "requires-primer"
  | "not-suitable";

export type ProductSubstrateClaim = {
  substrateSlug: SubstrateSlug;
  suitability: SubstrateSuitability;
  /** Product that must be applied first when `requires-primer`. */
  requiresPrimerProductSlug?: string;
  note?: string;
};

/* -------------------------------------------------------------------------- */
/* Registry helpers                                                           */
/* -------------------------------------------------------------------------- */

export type KnowledgeEntityKind =
  | "substrate"
  | "process-step"
  | "defect"
  | "application";

/** Shared shape for anything the review exporter has to describe generically. */
export type KnowledgeEntityRef = {
  kind: KnowledgeEntityKind;
  slug: string;
  name: string;
};

export type { Claim, KnowledgeSource, VerificationStatus };
