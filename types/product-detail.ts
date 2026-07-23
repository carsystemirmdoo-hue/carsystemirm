/**
 * Review state for public-facing product content.
 *
 * Only `confirmed` content is rendered on the public product page. The other
 * states let the data owner record missing decisions without creating empty
 * sections, placeholder copy or unverified claims in the UI.
 */
export type ContentReviewStatus =
  | "confirmed"
  | "needs_confirmation"
  | "not_applicable";

export type Reviewable<T> = T & {
  reviewStatus: ContentReviewStatus;
};

export type ReviewedSection<T> = {
  reviewStatus: ContentReviewStatus;
  content: T;
  reviewerNote?: string;
};

export type ProductQuickFact = Reviewable<{
  label: string;
  value: string;
}>;

export type ProductVariantColumn = {
  key: string;
  label: string;
};

export type ProductVariantRow = Reviewable<{
  id: string;
  values: Record<string, string>;
  slug?: string;
  image?: string;
  swatch?: string;
  isActive?: boolean;
}>;

export type ProductVariantSection = {
  title: string;
  description?: string;
  columns: ProductVariantColumn[];
  rows: ProductVariantRow[];
  note?: string;
};

export type ProductBenefit = Reviewable<{
  title: string;
  description: string;
}>;

export type ProductProcessStage = Reviewable<{
  label: string;
  detail?: string;
}>;

export type ProductProcessApplication = {
  title: string;
  description: string;
  mode: "single-phase" | "multi-phase" | "supporting-process";
  stages: ProductProcessStage[];
  usedBeforeProductSlugs?: string[];
  usedAfterProductSlugs?: string[];
};

export type ProductTechnology = {
  kicker?: string;
  title: string;
  description: string;
  facts?: ProductQuickFact[];
};

export type ProductTechnicalFact = Reviewable<{
  label: string;
  value: string;
  detail?: string;
}>;

export type ProductDetailDocument = Reviewable<{
  id: string;
  title: string;
  kind: "tds" | "sds" | "flyer" | "instructions" | "other";
  availability: "available" | "preparing";
  href?: string;
  language?: string;
  version?: string;
  publishedAt?: string;
  note?: string;
}>;

export type ProductRelationship = Reviewable<{
  productSlug: string;
  note?: string;
}>;

export type ProductRelationshipSection = {
  title: string;
  description?: string;
  items: ProductRelationship[];
};

export type ProductColorOption = {
  id: string;
  label: string;
  code?: string;
  hex?: string;
  slug?: string;
  image?: string;
  isActive?: boolean;
};

export type ProductColorOptionsSection = {
  status: ContentReviewStatus;
  title?: string;
  options: ProductColorOption[];
};

export type ProductCatalogStrategy =
  | "family-card"
  | "variant-cards"
  | "hybrid";

export type ProductFamilyVisualIdentity = {
  accent?: string;
  softAccent?: string;
  optionShape?: "round" | "pill" | "square";
};

export type ProductFamilyIdentity = {
  id: string;
  label: string;
  catalogStrategy: ProductCatalogStrategy;
  visualIdentity?: ProductFamilyVisualIdentity;
};

export type ProductVariantOption = {
  id: string;
  label: string;
  code?: string;
  swatch?: string;
  image?: string;
  detail?: string;
};

export type ProductVariantOptionGroup = {
  id: string;
  label: string;
  kind: "text" | "color" | "image";
  options: ProductVariantOption[];
};

export type ProductCommercialVariant = Reviewable<{
  id: string;
  label: string;
  optionValueIds: Record<string, string>;
  sku?: string;
  package?: string;
  dimension?: string;
  status?: string;
  slug?: string;
  image?: string;
}>;

export type ProductVariantSelectorSection = {
  title: string;
  description?: string;
  family: ProductFamilyIdentity;
  groups: ProductVariantOptionGroup[];
  variants: ProductCommercialVariant[];
  initialVariantId: string;
  note?: string;
};

export type ProductRelationType =
  | "similar"
  | "alternative"
  | "compatible"
  | "same-process-stage"
  | "next-process-step"
  | "same-brand"
  | "manual";

export type ProductRecommendation = {
  productId: string;
  relationType: ProductRelationType;
  status: ContentReviewStatus;
  priority?: number;
  internalReason?: string;
};

export type ProductFinalCta = {
  title: string;
  description: string;
  inquiryLabel: string;
  storeLabel?: string;
};

export type ProductDetailContent = {
  reviewStatus: ContentReviewStatus;
  hero?: {
    kicker?: string;
    subtype?: string;
    lead?: string;
  };
  quickFacts?: ReviewedSection<ProductQuickFact[]>;
  variants?: ReviewedSection<ProductVariantSection>;
  benefits?: ReviewedSection<{
    title: string;
    description?: string;
    items: ProductBenefit[];
  }>;
  process?: ReviewedSection<ProductProcessApplication>;
  technology?: ReviewedSection<ProductTechnology>;
  technicalFacts?: ReviewedSection<ProductTechnicalFact[]>;
  colorOptions?: ProductColorOptionsSection;
  documents?: ReviewedSection<ProductDetailDocument[]>;
  compatibleProducts?: ReviewedSection<ProductRelationshipSection>;
  alternativeProducts?: ReviewedSection<ProductRelationshipSection>;
  finalCta?: ProductFinalCta;
};
