/**
 * Provenance model for the Carsystem knowledge layer.
 *
 * Every technical claim that will eventually be published — substrate
 * compatibility, mixing ratio, drying profile, nozzle size — must be able to
 * answer two separate questions:
 *
 *   1. Where did this come from?              -> `KnowledgeSource`
 *   2. Has Carsystem confirmed it is correct? -> `VerificationStatus`
 *
 * These are deliberately kept apart. A value extracted from an official R-M
 * technical data sheet has excellent provenance but is still unverified until a
 * Carsystem expert signs it off. Conversely, an expert can confirm something
 * that has no document behind it. Collapsing the two into a single "trusted"
 * flag is how unverified technical data ends up published as fact.
 *
 * Nothing in this module produces or infers values. It only records where a
 * value came from and how far through review it has travelled.
 */

/** Where a claim originated. */
export type KnowledgeSourceType =
  /** Manufacturer TDS / SDS — the strongest documentary source. */
  | "manufacturer-technical-document"
  /** Manufacturer marketing/product information sheet. Weaker than a TDS. */
  | "manufacturer-product-information"
  /** Official manufacturer website. */
  | "manufacturer-website"
  /** A named Carsystem technical expert asserted this. */
  | "carsystem-expert"
  /** Internal Carsystem data already verified through another process. */
  | "carsystem-internal-verified";

/**
 * How far a claim has travelled through review.
 *
 * Only `expert-verified` may be published as a technical assertion. Everything
 * else is either invisible to the public site or rendered without any claim of
 * correctness.
 */
export type VerificationStatus =
  /** Came in through a structured import. Not read by a human. */
  | "imported"
  /** Parsed out of a document by a script. Highest risk — always review. */
  | "machine-extracted"
  /** Queued for a human. */
  | "needs-review"
  /** A named Carsystem expert confirmed this on a known date. */
  | "expert-verified"
  /** A human looked at it and said it is wrong. Retained so it is not re-proposed. */
  | "rejected";

/** Statuses whose values may be rendered as technical fact on a public page. */
export const PUBLISHABLE_VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "expert-verified",
];

export function isPublishable(status: VerificationStatus) {
  return PUBLISHABLE_VERIFICATION_STATUSES.includes(status);
}

/**
 * A pointer back to where a claim came from.
 *
 * `documentPath` is a repository-relative public path (e.g. a file under
 * `/documents/products/rm/...`) when the source is a local document. `url` is
 * used for external sources. `locator` narrows to a page, section or table —
 * populate it whenever it is actually known, because it is what makes a claim
 * checkable by a reviewer in seconds rather than minutes.
 */
export type KnowledgeSource = {
  type: KnowledgeSourceType;
  /** Human-readable label shown to reviewers, e.g. "R-M TDS — C 2A40 AirTOP". */
  label: string;
  documentPath?: string;
  url?: string;
  /** Page, section or table reference, e.g. "str. 2, tabela 1". */
  locator?: string;
  /**
   * Short verbatim snippet supporting the claim, for fast reviewer
   * verification.
   *
   * Deliberately capped and never a substitute for the document itself —
   * these are copyrighted manufacturer sheets, so this holds the one line that
   * proves the value, not a reproduction of the section.
   */
  excerpt?: string;
  /** Document version or revision, when the source states one. */
  version?: string;
  /** ISO date of the source document, not of our review. */
  publishedAt?: string;
};

/**
 * A value plus its provenance and review state.
 *
 * `value` is intentionally optional. A `Claim<T>` with no value is a
 * well-formed, meaningful record: it says "this field is known to be relevant
 * to this product, and we do not yet have a trustworthy value for it". That is
 * the representation used everywhere unknown technical data would otherwise be
 * invented.
 */
export type Claim<T> = {
  value?: T;
  status: VerificationStatus;
  sources: KnowledgeSource[];
  /** Who verified it. Required in practice for `expert-verified`. */
  verifiedBy?: string;
  /** ISO date of the most recent human review. */
  lastReviewedAt?: string;
  /** Free-text note from the reviewer. Never rendered as a technical claim. */
  reviewNote?: string;
};

/** An explicitly unknown claim. Use instead of omitting a field or guessing. */
export function unknownClaim<T>(
  sources: KnowledgeSource[] = [],
  reviewNote?: string,
): Claim<T> {
  return { status: "needs-review", sources, reviewNote };
}

/** True when the claim carries a value that is cleared for publication. */
export function hasPublishableValue<T>(
  claim: Claim<T> | undefined,
): claim is Claim<T> & { value: T } {
  return Boolean(claim && claim.value !== undefined && isPublishable(claim.status));
}

/**
 * Read a claim for rendering. Returns `undefined` unless the claim is both
 * populated and expert-verified, so callers cannot accidentally render
 * machine-extracted data as fact.
 */
export function publishedValue<T>(claim: Claim<T> | undefined): T | undefined {
  return hasPublishableValue(claim) ? claim.value : undefined;
}

/**
 * Claims that a human still needs to look at. Drives the review export.
 *
 * Deliberately non-generic: callers iterate heterogeneous claim fields off a
 * profile, so the parameter has to accept any `Claim<…>` without the caller
 * narrowing the payload type first.
 */
export function needsHumanReview(claim: Claim<unknown> | undefined) {
  return Boolean(
    claim && (claim.status === "machine-extracted" || claim.status === "needs-review"),
  );
}
