import "server-only";

import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import {
  getProductImageMetrics,
  resolveContrastMode,
  resolveImageMatte,
  type ProductContrastMode,
  type ProductImageMatte,
} from "@/lib/product-image-metrics";
import { getOfficialShadowV6, type OfficialShadow } from "@/lib/product-fit-model";

/**
 * A PDP stage image with everything the client stage needs to draw it.
 *
 * `contrastMode` is measured from the render's own pixels at build time rather
 * than derived from the product's colour token. The token says which shade the
 * product APPLIES; the pixels say what the packaging LOOKS like, and only the
 * second one decides whether a black bottle is about to disappear into a black
 * decorative stroke. Resolving it here — in a server component — keeps the
 * ~300 KB metrics manifest out of the client bundle.
 */
export type ProductStageImage = {
  src: string;
  alt: string;
  contrastMode: ProductContrastMode;
  /** What the file is (cut-out / photo on a flat backdrop / full photo). */
  matte: ProductImageMatte;
  /** The photo's own flat backdrop colour, for `matte: "backdrop"` only. */
  backdrop: string | null;
  /**
   * V6 fit + shadow model for THIS drawn file; absent = legacy. The stage
   * format (`resolveStageFormat`) deliberately still reads `metrics.aspect`.
   */
  officialShadow?: OfficialShadow;
};

export function toProductStageImage(
  identitySrc: string,
  alt: string,
  product?: { slug: string; brandSlug: string },
): ProductStageImage {
  // The stage draws the reviewed display derivative when one exists; its
  // metrics are measured on that same file, so geometry and pixels agree —
  // including the V6 subject box and official shadow.
  const src = toDisplayImageSrc(identitySrc);
  const metrics = getProductImageMetrics(src);
  const matte = resolveImageMatte(metrics);
  const officialShadow = product ? getOfficialShadowV6(product, src) : null;
  return {
    src,
    alt,
    contrastMode: resolveContrastMode(metrics),
    matte,
    backdrop: matte === "backdrop" ? (metrics?.backdrop ?? null) : null,
    ...(officialShadow ? { officialShadow } : {}),
  };
}

/**
 * The stage's proportions, chosen from the product's measured silhouette.
 *
 * A 5:6 frame flatters a spray can and strands a 1 L body-filler tin in empty
 * space. Because the envelope fits the product inside BOTH stage dimensions,
 * a squat product in a tall frame is always limited by width and can never use
 * the height — so the frame has to follow the product, not the other way round.
 */
export type ProductStageFormat = "portrait" | "square" | "landscape";

export function resolveStageFormat(
  metrics: ReturnType<typeof getProductImageMetrics>,
): ProductStageFormat {
  if (!metrics) return "square";
  if (metrics.aspect < 0.8) return "portrait";
  if (metrics.aspect < 1.45) return "square";
  return "landscape";
}

const PLACEHOLDER_MARKER = "placeholder-product";

export function getProductStageImages(
  product: CarsystemProduct,
): ProductStageImage[] {
  const candidates = [product.productImage, ...product.galleryImages].filter(
    (image): image is ProductImageAsset =>
      image !== null && !image.src.includes(PLACEHOLDER_MARKER),
  );

  const unique = candidates.filter(
    (image, index, all) =>
      all.findIndex((candidate) => candidate.src === image.src) === index,
  );

  return unique.map((image) => toProductStageImage(image.src, image.alt, product));
}

/**
 * Format for the whole stage, taken from the primary render.
 *
 * Deliberately not per gallery image: switching frames while the customer
 * clicks through thumbnails would move the page around them.
 */
export function getProductStageFormat(
  images: ProductStageImage[],
): ProductStageFormat {
  const primary = images[0];
  if (!primary) return "square";
  return resolveStageFormat(getProductImageMetrics(primary.src));
}
