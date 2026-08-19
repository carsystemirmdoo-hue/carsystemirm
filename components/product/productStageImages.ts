import "server-only";

import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import {
  getProductImageMetrics,
  resolveContrastMode,
  type ProductContrastMode,
} from "@/lib/product-image-metrics";

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
};

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

  return unique.map((image) => ({
    src: image.src,
    alt: image.alt,
    contrastMode: resolveContrastMode(getProductImageMetrics(image.src)),
  }));
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
