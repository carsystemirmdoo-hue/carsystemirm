import displayMap from "@/data/catalog/image-remaster/display-map.json";

/**
 * Display derivative of a product image, when one was reviewed and approved.
 *
 * A handful of manufacturer files carry defects that only show on a dark stage
 * (a light-grey shadow composed for white paper, a 1 px frame on the canvas
 * edge, a stair-stepped mask). Their repaired versions live under
 * `public/remastered/…` and are listed in `data/catalog/image-remaster/`
 * (`plan.json` = what and why, `display-map.json` = generated mapping).
 *
 * The ORIGINAL path stays the product's identity: catalogue data, brand syncs
 * (which use the file's SHA as match evidence) and the image inventory keep
 * reading it. Only surfaces that DRAW the product — the PDP stage and product
 * cards — ask for the display version. Small (~65 entries) and client-safe.
 */
const images = (displayMap as { images: Record<string, string> }).images;

export function toDisplayImageSrc(src: string): string {
  return images[src] ?? src;
}
