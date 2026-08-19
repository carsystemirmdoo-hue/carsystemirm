/**
 * Guide architecture.
 *
 * Guides are the authority layer: a small number of excellent, expert-reviewed
 * Serbian resources. Not an article farm.
 *
 * The governing rule from the brief is enforced here in code rather than left
 * to discipline:
 *
 *   > No indexable page should exist merely because a data record exists.
 *
 * `isGuidePublishable()` is the single gate. A guide record can sit in the
 * repository indefinitely in `draft` or `in-review` state; it produces no
 * route, no sitemap entry and no schema until an expert has verified it AND it
 * carries enough substance to deserve a URL. `generateStaticParams` and the
 * sitemap both derive from the published set, so a thin guide cannot leak into
 * the index by being forgotten.
 */

import type { Claim, KnowledgeSource } from "./provenance";
import { isPublishable } from "./provenance";
import type { DefectSlug, ProcessStepSlug, SubstrateSlug } from "./entities";

export type GuideStatus = "draft" | "in-review" | "published" | "archived";

export type GuideSection = {
  heading: string;
  /** Body copy. Expert-authored; never generated. */
  body: string;
};

export type GuideProcessStage = {
  order: number;
  title: string;
  description: string;
  /** Products relevant at this stage, by slug. */
  productSlugs?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  /** One-sentence summary used for metadata and cards. */
  summary: string;
  status: GuideStatus;

  /** The question this guide answers, if it maps to a seeded intent. */
  primaryIntentSlug?: string;

  /**
   * Main body. Expert-authored and expert-verified before publication — this is
   * the field that must never be machine-written.
   */
  body: Claim<GuideSection[]>;

  /** Ordered process, when the guide describes a procedure. */
  process?: Claim<GuideProcessStage[]>;

  /* -- Entity links -- */
  substrateSlugs?: SubstrateSlug[];
  processStepSlugs?: ProcessStepSlug[];
  defectSlugs?: DefectSlug[];

  /** Products the guide recommends. Expert-curated. */
  recommendedProductSlugs?: string[];
  /** Technical documents the guide draws on. */
  sources?: KnowledgeSource[];

  relatedGuideSlugs?: string[];
  relatedIntentSlugs?: string[];

  /** ISO dates. */
  publishedAt?: string;
  lastReviewedAt?: string;
};

/**
 * Minimum substance for a guide to earn an indexable URL.
 *
 * 120 words of guide-specific prose matches the thin-content floor proposed in
 * the audit and enforced by `scripts/validate-knowledge.mjs`.
 */
export const GUIDE_MIN_BODY_WORDS = 120;

export function guideBodyWordCount(guide: Guide) {
  const sections = guide.body.value ?? [];
  return sections
    .map((section) => `${section.heading} ${section.body}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * The single publication gate. All four conditions must hold.
 *
 * Returns a reason on failure so the validator can explain *why* a guide is
 * being withheld rather than silently dropping it.
 */
export function guidePublicationBlockers(guide: Guide): string[] {
  const blockers: string[] = [];
  if (guide.status !== "published") {
    blockers.push(`status je "${guide.status}", očekivano "published"`);
  }
  if (!guide.body.value?.length) {
    blockers.push("telo vodiča je prazno");
  }
  if (!isPublishable(guide.body.status)) {
    blockers.push(`telo vodiča nije expert-verified (${guide.body.status})`);
  }
  const words = guideBodyWordCount(guide);
  if (words < GUIDE_MIN_BODY_WORDS) {
    blockers.push(`samo ${words} reči, minimum je ${GUIDE_MIN_BODY_WORDS}`);
  }
  return blockers;
}

export function isGuidePublishable(guide: Guide) {
  return guidePublicationBlockers(guide).length === 0;
}

export function publishedGuides(guides: Guide[]) {
  return guides.filter(isGuidePublishable);
}
