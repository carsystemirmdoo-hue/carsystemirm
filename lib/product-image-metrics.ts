import "server-only";

import type { CSSProperties } from "react";
import manifest from "@/data/product-image-metrics.generated.json";

/**
 * Content geometry for a product image, measured once at build time by
 * `scripts/extract-product-image-metrics.py`.
 *
 * Why the runtime needs this
 * --------------------------
 * Official product renders arrive on a fixed square canvas (745 of 838 files
 * are 800x800) with the product occupying a very different share of it per
 * file — the median image fills only 39% of the canvas width. `object-fit:
 * contain` fits the CANVAS, so the S/M/L/XL envelope in `lib/product-scale.ts`
 * was sizing transparent padding rather than the product: a 500 ml spray can
 * and a 1 L tin both rendered at "66% of the box", but the can's own silhouette
 * ended up at 25% of it.
 *
 * These fractions let CSS fit the CONTENT BOX instead, so the scale envelope
 * finally describes the physical hierarchy it was written to describe.
 *
 * Server-only on purpose: the manifest is ~300 KB. Callers resolve the handful
 * of custom properties they need here, on the server, and hand those to the
 * client surfaces — the same reason `ProductVisualPresentation` exists.
 */
export type ProductImageMetrics = {
  /** Canvas size in px. */
  w: number;
  h: number;
  /** Opaque content box inside the canvas: [x, y, width, height] in px. */
  box: [number, number, number, number];
  /** Content width / height as a fraction of the canvas. */
  fx: number;
  fy: number;
  /** Content box origin as a fraction of the canvas. */
  ox: number;
  oy: number;
  /** Content aspect ratio (width / height). */
  aspect: number;
  /** Median relative luminance of the product pixels, 0–1. */
  luminance: number;
  tone: "very-dark" | "dark" | "mid" | "light" | "very-light";
  boxSource: "alpha" | "opaque-border" | "canvas";
  palette: { hex: string; share: number }[];
  /** Flat studio backdrop of an opaque photo (hex); absent when the backdrop is a gradient. */
  backdrop?: string;
};

type ManifestShape = {
  schemaVersion: number;
  counts: { images: number; skipped: number };
  images: Record<string, ProductImageMetrics>;
};

const images = (manifest as unknown as ManifestShape).images;

export function getProductImageMetrics(
  src: string | null | undefined,
): ProductImageMetrics | null {
  if (!src) return null;
  // Vector sources and anything outside the measured directories simply have no
  // entry — an absent record is a normal state, not an error.
  return images[src] ?? null;
}

/**
 * How a product's silhouette should be treated against decorative art.
 *
 * A black bottle in front of a black graffiti stroke is the failure this
 * exists to prevent, and its mirror (a white canister on a light stage) is the
 * same bug in the other theme. The decision comes from measured pixels, not
 * from the product's colour token, because the token describes the shade the
 * product APPLIES while the pixels describe the packaging you actually see.
 */
export type ProductContrastMode = "dark-product" | "light-product" | "balanced";

export function resolveContrastMode(
  metrics: ProductImageMetrics | null,
): ProductContrastMode {
  if (!metrics) return "balanced";
  if (metrics.tone === "very-dark" || metrics.tone === "dark") return "dark-product";
  if (metrics.tone === "very-light" || metrics.tone === "light") return "light-product";
  return "balanced";
}

/**
 * What the image file physically is, which decides how a dark surface may
 * present it.
 *
 *   cutout   — transparent render; the product sits directly on the stage.
 *   backdrop — opaque photo on a flat studio backdrop (white, light grey,
 *              lavender). Cutting it out automatically is unsafe (white tins on
 *              white paper), so a dark stage paints its plate in the photo's
 *              OWN backdrop colour: the product reads as shot in a light box
 *              instead of as a light rectangle stuck on a dark panel.
 *   photo    — full-bleed photograph (workshop, lifestyle, gradient studio);
 *              shown as a framed photo, never with a silhouette shadow.
 *
 * The light theme keeps its locked presentation; only dark-theme CSS reads this.
 */
export type ProductImageMatte = "cutout" | "backdrop" | "photo";

export function resolveImageMatte(
  metrics: ProductImageMetrics | null,
): ProductImageMatte {
  if (!metrics || metrics.boxSource === "alpha") return "cutout";
  // Only a FLAT backdrop gets a measured colour; a studio gradient is a photo.
  return metrics.boxSource === "opaque-border" && metrics.backdrop ? "backdrop" : "photo";
}

/**
 * Custom properties that let CSS fit the product's content box instead of its
 * canvas. See `ProductDetailExperience.module.css` / `ProductVisualSurface.module.css`
 * for the consuming rules; the geometry is:
 *
 *   object box  : aspect-ratio = content aspect, sized by the scale envelope
 *   image inside: width = 100% / fx, height = 100% / fy, offset by -ox / -oy
 *
 * which places the canvas so its content box lands exactly on the object box.
 * Pure CSS, no measurement in the browser, so there is no hydration difference
 * and no layout shift.
 */
export function getProductContentFitStyle(
  metrics: ProductImageMetrics | null,
): CSSProperties {
  if (!metrics) return {};

  return {
    "--product-content-aspect": metrics.aspect,
    "--product-content-fill-x": metrics.fx,
    "--product-content-fill-y": metrics.fy,
    "--product-content-offset-x": metrics.ox,
    "--product-content-offset-y": metrics.oy,
  } as CSSProperties;
}

export const productImageMetricsCounts = (manifest as unknown as ManifestShape).counts;
