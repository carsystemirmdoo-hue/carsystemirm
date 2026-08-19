/**
 * Decides, per answer intent, whether machine-extracted evidence now exists.
 *
 * "Evidence exists" is a deliberately weaker claim than "the question is
 * answerable". It means: a source document in this repository explicitly states
 * something bearing on the question, and a reviewer has material to work from.
 * It never means the answer is correct, complete, or fit to publish.
 *
 * Derived from the extraction dataset rather than stored on the intent records,
 * so re-running the extractor automatically updates readiness and the two
 * cannot drift apart.
 */

import type { AnswerIntent, AnswerIntentReadiness } from "./answer-intents";
import { resolveAnswerIntentReadiness } from "./answer-intents";
import type { SubstrateSlug } from "./entities";
import {
  getSubstrateEvidence,
  productTechnicalProfiles,
} from "./product-knowledge";
import type { ProductTechnicalProfile } from "./technical";

/** How many products carry a populated claim for a given field. */
function productsWithField(field: string) {
  return productTechnicalProfiles.filter((profile) => {
    const claim = (profile as unknown as Record<string, { value?: unknown } | undefined>)[
      field
    ];
    return Boolean(claim && claim.value !== undefined);
  }).length;
}

export type IntentEvidence = {
  intentSlug: string;
  hasEvidence: boolean;
  /** Human-readable account of what was found, for the review pack. */
  details: string[];
  supportingProductSlugs: string[];
};

export function resolveIntentEvidence(intent: AnswerIntent): IntentEvidence {
  const details: string[] = [];
  const supporting = new Set<string>();

  for (const slug of intent.substrateSlugs ?? []) {
    const matches = getSubstrateEvidence(slug as SubstrateSlug);
    if (matches.length) {
      const direct = matches.filter((m) => m.suitability === "suitable").length;
      const primed = matches.filter((m) => m.suitability === "requires-primer").length;
      details.push(
        `Podloga „${slug}": ${matches.length} proizvoda sa eksplicitnom izjavom (${direct} direktno, ${primed} uz prethodno temeljenje).`,
      );
      for (const match of matches) supporting.add(match.productSlug);
    }
  }

  for (const field of intent.requiredTechnicalFields ?? []) {
    const count = productsWithField(field);
    if (count > 0) {
      details.push(`Polje „${field}": izvučeno za ${count} proizvoda.`);
    }
  }

  return {
    intentSlug: intent.slug,
    hasEvidence: details.length > 0,
    details,
    supportingProductSlugs: [...supporting],
  };
}

export function resolveIntentReadinessWithEvidence(
  intent: AnswerIntent,
): { readiness: AnswerIntentReadiness; evidence: IntentEvidence } {
  const evidence = resolveIntentEvidence(intent);
  return {
    readiness: resolveAnswerIntentReadiness(intent, evidence.hasEvidence),
    evidence,
  };
}

export type { ProductTechnicalProfile };
