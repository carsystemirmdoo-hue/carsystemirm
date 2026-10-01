/**
 * R-M catalog sync — konfiguracija.
 *
 * R-M je brend u okviru Surventisa (ranije BASF Coatings). Autoritet podataka su
 * isključivo zvanični R-M / Surventis izvori; distributeri nisu izvor ni za jedno polje,
 * a `refinish.basf.us` (severnoamerički asortiman) nije izvor za evropsko tržište.
 *
 * Arhitektura izvora (utvrđena pre pisanja parsera):
 *   1. info.rmpaint.com  — „Info R-M International”: tehnički portal proizvoda. JEDINI izvor
 *      koji nosi zvaničnu oznaku proizvoda (`field-product-unique-id`, npr. „C 2A64”),
 *      tehničku kategoriju, opis, sliku pakovanja i direktne TDS linkove
 *      (`techinfo.rmpaint.com/unicorn/<jezik>/…pdf`).
 *   2. www.rmpaint.com/en-int — marketinški sajt (Drupal): stranice proizvoda nose naziv,
 *      seriju (Pioneer / Advance / eSense …) i sliku, BEZ oznake proizvoda. Služi kao dokaz
 *      „trenutno u ponudi” i kao izvor serije/linije.
 *   3. SDS: zajednički portal (`rmpaint.com/en-int/sds`), nema linka po proizvodu.
 *
 * Jezik/tržište: `en-int` (International) — najširi evropski/regionalni asortiman na sajtu.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const BRAND = { slug: "rm", name: "R-M", manufacturer: "R-M (Surventis)" };

export const SOURCES = {
  info: { origin: "https://info.rmpaint.com", listing: "https://info.rmpaint.com/products" },
  website: { origin: "https://www.rmpaint.com", locale: "en-int", sitemap: "https://www.rmpaint.com/sitemap.xml" },
  techinfo: { origin: "https://techinfo.rmpaint.com" },
};

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 carsystem-rm-sync";

const cache = (...parts) => path.join(REPO_ROOT, ".cache", "rm-sync", ...parts);
export const PAGE_CACHE_DIR = cache("pages");
export const IMAGE_CACHE_DIR = cache("images");
export const DOCUMENT_CACHE_DIR = cache("documents");

const data = (...parts) => path.join(REPO_ROOT, "data", "rm-sync", ...parts);
export const PATHS = {
  rawInfo: data("raw", "info-portal.generated.json"),
  rawWebsite: data("raw", "website.generated.json"),
  rawDocuments: data("raw", "tds-index.generated.json"),
  source: data("source-products.generated.json"),
  identityRegistry: data("identity-registry.json"),
  decisions: data("manual-decisions.json"),
  taxonomyMap: data("taxonomy-map.json"),
  localizationDir: data("localization"),
  technicalLocalization: data("technical-localization.json"),
  localizationInputDir: path.join(REPO_ROOT, ".cache", "rm-sync", "localization-input"),
  imageManifest: data("image-manifest.generated.json"),
  publishedImages: data("published-images.generated.json"),
  plan: data("reports", "sync-plan.generated.json"),
  planCsv: data("reports", "sync-plan.generated.csv"),
  planMarkdown: data("reports", "SYNC_DRY_RUN.md"),
  reconciliation: data("reports", "reconciliation.generated.json"),
  reconciliationMarkdown: data("reports", "RECONCILIATION.md"),
  validation: data("reports", "validation.generated.json"),
  colourDecisions: data("reports", "colour-decisions.generated.json"),
  searchQa: data("reports", "search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data", "rm-catalog-products.generated.json"),
  publicImages: path.join(REPO_ROOT, "public", "products", "rm", "catalog"),
  localAudit: data("reports", "local-audit.generated.json"),
  modelReport: data("reports", "SOURCE_MODEL_AUDIT.md"),
};

export const PUBLIC_IMAGE_URL_PREFIX = "/products/rm/catalog";
