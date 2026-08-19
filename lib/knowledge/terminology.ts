/**
 * Serbian terminology / synonym layer.
 *
 * Professionals, retail customers and manufacturers use three different
 * vocabularies for the same object. A workshop says "klarlak", the TDS says
 * "bezbojni lak", and a customer searching online types "lak za auto".
 *
 * This layer maps those together *outside* canonical product data. Product
 * names, titles and descriptions stay clean and formal; synonyms are used for
 * on-site search, guide copy and answer-intent matching.
 *
 * Two rules, both enforced by types rather than convention:
 *
 *   1. Synonyms are never rendered as hidden text or stuffed into metadata.
 *      This layer exists to *understand* what a user typed, not to game a
 *      ranking system.
 *
 *   2. Equivalence is a claim about the domain and can be wrong. "punilo" and
 *      "prajmer" are used interchangeably by some painters and treated as
 *      distinct products by others. Every term therefore carries its own
 *      `VerificationStatus` and defaults to `needs-review`.
 */

import type { VerificationStatus } from "./provenance";

export type TermRegister =
  /** The term a TDS or manufacturer would use. */
  | "formal"
  /** What a customer is likely to type into a search box. */
  | "common"
  /** Workshop slang. Often a loanword. */
  | "workshop"
  /** Same word, different spelling or regional variant. */
  | "spelling-variant"
  /** English or German term used untranslated in the trade. */
  | "loanword";

export type TerminologyTerm = {
  term: string;
  register: TermRegister;
  /**
   * Whether this term has been confirmed as genuinely interchangeable with the
   * canonical term *in the Carsystem product context*.
   *
   * Defaults to `needs-review` for everything not directly evidenced by
   * existing project data. The audit explicitly warned against assuming the
   * example pairs are universally interchangeable.
   */
  status: VerificationStatus;
  /** Why this needs care, e.g. a scope difference a reviewer must resolve. */
  reviewNote?: string;
};

export type TerminologyEntry = {
  slug: string;
  /** The single term used in canonical product data, headings and metadata. */
  canonical: string;
  /** Short neutral gloss. Not a technical claim. */
  gloss: string;
  terms: TerminologyTerm[];
  /** Related R-M category slug, where one maps cleanly. */
  rmCategorySlug?: string;
};

/** Every synonym on an entry, canonical included, lowercased. */
export function terminologyLookupTerms(entry: TerminologyEntry) {
  return [entry.canonical, ...entry.terms.map((term) => term.term)].map((term) =>
    term.toLocaleLowerCase("sr-Latn"),
  );
}

/**
 * Only synonyms an expert has confirmed. Use this anywhere a synonym would
 * influence what a user is *shown*; use the unfiltered list only for widening
 * an internal search query, where a wrong synonym costs a bad result rather
 * than a wrong technical answer.
 */
export function verifiedTerms(entry: TerminologyEntry) {
  return entry.terms.filter((term) => term.status === "expert-verified");
}

export function findTerminologyEntry(
  entries: TerminologyEntry[],
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase("sr-Latn");
  if (!needle) return undefined;
  return entries.find((entry) => terminologyLookupTerms(entry).includes(needle));
}

/** Terms awaiting expert sign-off, for the review export. */
export function unreviewedTerms(entries: TerminologyEntry[]) {
  return entries.flatMap((entry) =>
    entry.terms
      .filter((term) => term.status !== "expert-verified" && term.status !== "rejected")
      .map((term) => ({ entry, term })),
  );
}
