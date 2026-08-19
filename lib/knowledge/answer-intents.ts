/**
 * Answer intent system.
 *
 * An answer intent is a real question a Serbian customer or professional asks,
 * paired with everything needed to answer it honestly: a verified answer, the
 * technical data supporting it, the applicable products, the documentation and
 * the related guide.
 *
 * The central design decision is that an intent record exists *before* an
 * answer does. A record with `readiness: "blocked-by-technical-data"` is
 * valuable: it names a question worth answering and states precisely which data
 * is missing. That is what makes the missing-data backlog visible and
 * actionable instead of implicit.
 *
 * `resolveAnswerIntentReadiness()` derives readiness from the record rather
 * than trusting a hand-set field, so an intent cannot be marked answerable
 * while its answer is still unverified.
 */

import type { Claim, VerificationStatus } from "./provenance";
import { isPublishable } from "./provenance";
import type { DefectSlug, ProcessStepSlug, SubstrateSlug } from "./entities";

export type AnswerIntentReadiness =
  /** Verified answer present; may be published. */
  | "answerable-now"
  /** Some verified material, but an important part is still missing. */
  | "partially-answerable"
  /** The answer needs product technical data nobody has extracted yet. */
  | "blocked-by-technical-data"
  /** Data exists, but a Carsystem expert has not signed off the answer. */
  | "blocked-by-expert-validation";

/** What kind of thing the question is about. Drives which hub links to it. */
export type AnswerIntentTopic =
  | "substrate"
  | "process"
  | "product-selection"
  | "defect"
  | "system"
  | "commercial";

export type AnswerIntent = {
  slug: string;
  /** The question in natural Serbian, as a person would actually ask it. */
  question: string;
  /** Other real phrasings of the same question. Used for matching, not display. */
  questionVariants?: string[];
  topic: AnswerIntentTopic;

  /**
   * The answer. Unpopulated until a Carsystem expert supplies and verifies it.
   * Never machine-generated — this is the field that would otherwise become a
   * plausible-sounding fabricated technical claim.
   */
  answer: Claim<string>;

  /** Supporting detail shown under the answer. Also expert-gated. */
  explanation?: Claim<string>;

  /* -- Entity links used to assemble the product block programmatically -- */
  substrateSlugs?: SubstrateSlug[];
  processStepSlugs?: ProcessStepSlug[];
  defectSlugs?: DefectSlug[];

  /**
   * Products explicitly curated as applicable. When empty, the product block is
   * derived from the entity links above via the technical profiles — which
   * currently yields nothing, because no profile is populated.
   */
  applicableProductSlugs?: string[];

  /** Guide that covers this question in depth. */
  relatedGuideSlug?: string;
  relatedIntentSlugs?: string[];

  /**
   * Precisely what is missing, in reviewer-facing Serbian. Required whenever
   * the intent is blocked — a blocked intent without this is just a to-do with
   * no owner.
   */
  missingData?: string[];

  /**
   * What is actually holding this intent up.
   *
   * Authored per intent rather than inferred: "koji prajmer ide na aluminijum"
   * and "gde kupiti auto lakove" both lack an answer, but only the first needs
   * data extracted from a TDS — the second needs nothing but approved wording.
   * Treating them as the same blocker would misdirect the expert's time.
   */
  primaryBlocker?: "technical-data" | "expert-validation";

  /**
   * Technical profile fields whose presence would constitute evidence for this
   * question.
   *
   * Used by `answer-intent-evidence.ts` to decide whether the *evidence* now
   * exists, which is a strictly weaker statement than the answer being
   * publishable. Authored per intent — it says what the question depends on,
   * not what the answer is.
   */
  requiredTechnicalFields?: string[];

  /** Business value if answered. Used to prioritise the expert's time. */
  priority: "high" | "medium" | "low";
};

/**
 * Derive readiness from the record's actual contents.
 *
 * Deliberately not a stored field: a stored readiness flag drifts out of sync
 * with the data and is exactly how a blocked intent gets published.
 */
export function resolveAnswerIntentReadiness(
  intent: AnswerIntent,
  /**
   * Whether machine-extracted evidence supporting this question now exists.
   *
   * Evidence can move an intent off "blocked by technical data", but it can
   * never make it answerable: extracted data is unverified by definition, so
   * the strongest it can reach is "blocked by expert validation". This is the
   * rule that stops a PDF parser from becoming a publishing authority.
   */
  hasExtractedEvidence = false,
): AnswerIntentReadiness {
  const answerVerified = Boolean(intent.answer.value) && isPublishable(intent.answer.status);
  if (answerVerified) return "answerable-now";

  // An answer exists but has not been signed off.
  if (intent.answer.value) return "blocked-by-expert-validation";

  if (intent.primaryBlocker === "expert-validation") {
    return "blocked-by-expert-validation";
  }
  if (intent.primaryBlocker === "technical-data") {
    // The data now exists but nobody has confirmed it, so the remaining
    // blocker is a human, not a document.
    if (hasExtractedEvidence) return "blocked-by-expert-validation";

    // Entity links already resolve, so the shape of the answer exists even
    // though its substance does not.
    const hasEntityLinks = Boolean(
      intent.substrateSlugs?.length ||
        intent.processStepSlugs?.length ||
        intent.defectSlugs?.length ||
        intent.applicableProductSlugs?.length,
    );
    return hasEntityLinks ? "partially-answerable" : "blocked-by-technical-data";
  }

  return intent.missingData?.length
    ? "blocked-by-technical-data"
    : "blocked-by-expert-validation";
}

/** Intents whose answer may be rendered publicly. */
export function publishableAnswerIntents(intents: AnswerIntent[]) {
  return intents.filter(
    (intent) => resolveAnswerIntentReadiness(intent) === "answerable-now",
  );
}

export function answerIntentsByReadiness(intents: AnswerIntent[]) {
  const buckets: Record<AnswerIntentReadiness, AnswerIntent[]> = {
    "answerable-now": [],
    "partially-answerable": [],
    "blocked-by-technical-data": [],
    "blocked-by-expert-validation": [],
  };
  for (const intent of intents) {
    buckets[resolveAnswerIntentReadiness(intent)].push(intent);
  }
  return buckets;
}

export const READINESS_LABELS: Record<AnswerIntentReadiness, string> = {
  "answerable-now": "ODGOVORIVO SADA",
  "partially-answerable": "DELIMIČNO ODGOVORIVO",
  "blocked-by-technical-data": "BLOKIRANO TEHNIČKIM PODACIMA",
  "blocked-by-expert-validation": "BLOKIRANO STRUČNOM VALIDACIJOM",
};

export type { Claim, VerificationStatus };
