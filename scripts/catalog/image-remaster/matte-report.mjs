/**
 * Full dark-theme presentation map: EVERY active product × EVERY image its PDP
 * stage can show (main, gallery, own image of a row variant) → matte mode.
 * Mirrors `resolveImageMatte` (lib/product-image-metrics.ts) and the display
 * derivative map (lib/productImageDisplay.ts). Read-only over the catalogue.
 *
 *   node scripts/catalog/image-remaster/matte-report.mjs [--check]
 *
 * Writes data/catalog/image-remaster/MATTE_ASSIGNMENT.generated.csv and prints a summary.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data/catalog/image-remaster/MATTE_ASSIGNMENT.generated.csv");
const metrics = JSON.parse(readFileSync(path.join(ROOT, "data/product-image-metrics.generated.json"), "utf8")).images;
const display = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/image-remaster/display-map.json"), "utf8")).images;
const data = loadCatalogRuntime().requireModule("lib/carsystem-data.ts");

const matteOf = (m) => (!m || m.boxSource === "alpha" ? "cutout" : m.boxSource === "opaque-border" && m.backdrop ? "backdrop" : "photo");
const formatOf = (m) => (!m ? "square" : m.aspect < 0.8 ? "portrait" : m.aspect < 1.45 ? "square" : "landscape");
const csv = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));

const rows = [["slug", "brand", "role", "image", "display_image", "matte", "stage_format", "metrics", "backdrop"]];
const summary = { products: 0, withoutImage: 0, mainByMatte: {}, stageImagesByMatte: {}, vectorOrUnmeasured: 0 };
for (const product of data.getAllCarsystemProducts()) {
  summary.products++;
  const images = [product.productImage, ...(product.galleryImages ?? [])]
    .filter((image) => image && !image.src.includes("placeholder-product"))
    .map((image) => [image.src, null]);
  for (const variant of data.getProductVariantSelector(product)?.variants ?? []) {
    if (variant && !variant.slug && variant.image) images.push([variant.image, variant.label ?? variant.id]);
  }
  const unique = images.filter(([src], index) => images.findIndex(([other]) => other === src) === index);
  if (!unique.length) {
    summary.withoutImage++;
    rows.push([product.slug, product.brandSlug, "—", "", "", "fallback (Vizuel u pripremi)", "", "", ""]);
    continue;
  }
  const format = formatOf(metrics[display[unique[0][0]] ?? unique[0][0]]);
  unique.forEach(([src, row], index) => {
    const shown = display[src] ?? src;
    const m = metrics[shown];
    const matte = matteOf(m);
    if (!m) summary.vectorOrUnmeasured++;
    if (index === 0) summary.mainByMatte[matte] = (summary.mainByMatte[matte] ?? 0) + 1;
    summary.stageImagesByMatte[matte] = (summary.stageImagesByMatte[matte] ?? 0) + 1;
    const role = index === 0 ? "glavna" : row ? `red ${row}` : "galerija";
    rows.push([product.slug, product.brandSlug, role, src, shown === src ? "" : shown, matte, format, m ? m.boxSource : "nema (vektor/neizmereno)", m?.backdrop ?? ""]);
  });
}
const text = rows.map((row) => row.map(csv).join(",")).join("\n") + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== text) {
    console.error("MATTE_ASSIGNMENT.generated.csv nije ažuran — pokreni matte-report.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(OUT, text);
}
console.log(JSON.stringify(summary, null, 1));
