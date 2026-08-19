import "server-only";

import type { CSSProperties } from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { getProductVisualPreset } from "@/components/product/productMotion";
import {
  getProductContentFitStyle,
  getProductImageMetrics,
  resolveContrastMode,
  type ProductContrastMode,
  type ProductImageMetrics,
} from "@/lib/product-image-metrics";
import { getProductCategorySlug } from "@/lib/product-taxonomy";
import {
  resolveProductVolume,
  resolveSizeClass,
  type ProductSizeClass,
} from "@/lib/product-scale";

/**
 * One deterministic description of how a product should be presented visually.
 *
 * This is the join point between three systems that already existed but never
 * spoke to each other:
 *
 *   - `lib/product-scale.ts`      — how big the product should be drawn;
 *   - `lib/product-taxonomy.ts`   — what kind of product it is (12 categories);
 *   - `lib/product-image-metrics` — what the actual pixels look like.
 *
 * Everything here is derived from confirmed product fields or measured pixels.
 * No specification, quantity, colour name or packaging claim is invented — the
 * palette is a decorative accent and records where it came from so it can never
 * be mistaken for product data.
 */

/**
 * Decorative scene families. `paint` and `pigment` are colour-led and may only
 * be used when the product's colour is a real attribute; everything else is
 * deliberately colour-free so a product without a confirmed shade never gets
 * an invented one.
 */
export type ProductSceneKind =
  | "pigment"
  | "paint"
  | "material-layers"
  | "material-trace"
  | "technical"
  | "silhouette-field"
  | "neutral";

export type ProductPaletteSource =
  | "variant"
  | "attribute"
  | "image-extracted"
  | "group-neutral";

export type ProductVisualRecipe = {
  slug: string;
  sceneKind: ProductSceneKind;
  paletteSource: ProductPaletteSource;
  accentColors: string[];
  productScale: ProductSizeClass;
  contrastMode: ProductContrastMode;
  /** Stable per-product seed for deterministic decorative variation. */
  seed: number;
  /** True when the product's own colour is a confirmed attribute. */
  colorIsAttribute: boolean;
  metrics: ProductImageMetrics | null;
};

/** Neutral, colour-free group palettes. Used when no shade is confirmed. */
const GROUP_NEUTRAL: Record<string, string[]> = {
  abrazivi: ["oklch(0.62 0.032 248)", "oklch(0.47 0.028 248)"],
  kitovi: ["oklch(0.7 0.036 92)", "oklch(0.52 0.03 92)"],
  maskiranje: ["oklch(0.72 0.04 84)", "oklch(0.55 0.03 84)"],
  oprema: ["oklch(0.6 0.034 232)", "oklch(0.44 0.03 232)"],
  lepkovi: ["oklch(0.66 0.036 104)", "oklch(0.5 0.03 104)"],
  ciscenje: ["oklch(0.66 0.032 210)", "oklch(0.5 0.028 210)"],
  zastita: ["oklch(0.6 0.03 250)", "oklch(0.45 0.026 250)"],
  poliranje: ["oklch(0.72 0.028 248)", "oklch(0.55 0.024 248)"],
  radionica: ["oklch(0.58 0.03 244)", "oklch(0.44 0.026 244)"],
  boje: ["oklch(0.6 0.034 244)", "oklch(0.45 0.03 244)"],
  sprejevi: ["oklch(0.6 0.034 244)", "oklch(0.45 0.03 244)"],
};

const DEFAULT_NEUTRAL = ["oklch(0.6 0.03 246)", "oklch(0.45 0.026 246)"];

/**
 * Scene per platform category. Colour-led scenes are only reachable from
 * categories where a shade is part of what the customer is buying; the rest
 * describe process, material or construction instead.
 */
const CATEGORY_SCENE: Record<string, ProductSceneKind> = {
  sprejevi: "paint",
  boje: "pigment",
  poliranje: "material-trace",
  kitovi: "material-trace",
  lepkovi: "material-trace",
  zastita: "material-trace",
  abrazivi: "material-layers",
  maskiranje: "material-layers",
  oprema: "technical",
  radionica: "technical",
  ciscenje: "technical",
  pribor: "technical",
};

/** FNV-1a — stable across server/client, no randomness, no hydration drift. */
export function productSeed(slug: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Colour is treated as a real attribute only when the data says so: a reviewed
 * `visual` token (Cosmos Lac records carry `colorSource`) or a colour-bearing
 * product type from the curated preset table. A product that merely *looks*
 * coloured in its photo never earns a colour-led scene.
 */
function hasConfirmedColor(product: CarsystemProduct): boolean {
  if (product.visual) return true;
  const preset = getProductVisualPreset(product);
  return preset.visualMode === "color-on-hover";
}

/**
 * Palette priority, highest first:
 *
 *   1. `variant`         — a reviewed shade tied to this exact variant
 *                          (official chart, RAL, or an official cap sample);
 *   2. `attribute`       — a colour token derived from a confirmed colour name
 *                          or an editorial estimate;
 *   3. `image-extracted` — the largest colour areas measured in the product's
 *                          own render at build time;
 *   4. `group-neutral`   — a colour-free group tone.
 *
 * The chosen source travels with the recipe so a decorative accent can always
 * be traced back to its evidence.
 */
function resolvePalette(
  product: CarsystemProduct,
  metrics: ProductImageMetrics | null,
  categorySlug: string | undefined,
): { accentColors: string[]; paletteSource: ProductPaletteSource } {
  const visual = product.visual;

  if (visual?.backgroundColor) {
    const isVariantGrade =
      visual.colorSource === "official-chart" ||
      visual.colorSource === "ral" ||
      visual.colorSource === "cap-sample";
    return {
      accentColors: [visual.backgroundColor],
      paletteSource: isVariantGrade ? "variant" : "attribute",
    };
  }

  const preset = getProductVisualPreset(product);
  if (preset.visualMode === "color-on-hover" && preset.accent) {
    return { accentColors: [preset.accent], paletteSource: "attribute" };
  }

  // Measured pixels only count when a cluster is large enough to be a real
  // surface of the product. `MIN_CLUSTER_SHARE` in the generator already drops
  // logos and legal text, so an empty palette here means "genuinely mixed".
  if (metrics && metrics.palette.length > 0) {
    return {
      accentColors: metrics.palette.map((entry) => entry.hex),
      paletteSource: "image-extracted",
    };
  }

  return {
    accentColors: GROUP_NEUTRAL[categorySlug ?? ""] ?? DEFAULT_NEUTRAL,
    paletteSource: "group-neutral",
  };
}

export function getProductVisualRecipe(
  product: CarsystemProduct,
  imageSrc?: string | null,
): ProductVisualRecipe {
  const src = imageSrc ?? product.productImage?.src ?? null;
  const metrics = getProductImageMetrics(src);
  const categorySlug = getProductCategorySlug(product);
  const colorIsAttribute = hasConfirmedColor(product);
  const { accentColors, paletteSource } = resolvePalette(product, metrics, categorySlug);

  const categoryScene = CATEGORY_SCENE[categorySlug ?? ""] ?? "neutral";
  // A colour-led scene without a confirmed shade would be a fabricated colour
  // claim, so it degrades to the neutral technical field instead.
  const sceneKind: ProductSceneKind =
    (categoryScene === "paint" || categoryScene === "pigment") && !colorIsAttribute
      ? "technical"
      : categoryScene;

  return {
    slug: product.slug,
    sceneKind,
    paletteSource,
    accentColors,
    productScale: resolveSizeClass(resolveProductVolume(product)),
    contrastMode: resolveContrastMode(metrics),
    seed: productSeed(product.slug),
    colorIsAttribute,
    metrics,
  };
}

/**
 * The custom properties a product visual surface needs, resolved on the server.
 *
 * Kept separate from the recipe so client surfaces receive five numbers and two
 * colours rather than the whole record — the same payload discipline that
 * `ProductVisualPresentation` established.
 */
/**
 * The accent a given scene is allowed to use.
 *
 * Colour-led scenes (`pigment`, `paint`) exist because the shade IS the
 * product, so they take the product's palette. Every other scene exists
 * precisely because colour is NOT the attribute — a blueprint drawn in a
 * masking film's packaging red says "this product is red", which is a claim
 * the product does not make. Those scenes therefore always take the
 * colour-free group tone, even when a palette could be measured from the
 * render.
 */
export function resolveSceneAccent(recipe: ProductVisualRecipe): string[] {
  if (recipe.sceneKind === "pigment" || recipe.sceneKind === "paint") {
    return recipe.accentColors;
  }
  return DEFAULT_NEUTRAL;
}

export function getProductRecipeStyle(recipe: ProductVisualRecipe): CSSProperties {
  return {
    ...getProductContentFitStyle(recipe.metrics),
    "--product-art-accent": recipe.accentColors[0] ?? DEFAULT_NEUTRAL[0],
    "--product-art-accent-2":
      recipe.accentColors[1] ?? recipe.accentColors[0] ?? DEFAULT_NEUTRAL[1],
    "--product-art-seed": recipe.seed % 1000,
  } as CSSProperties;
}
