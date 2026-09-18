/**
 * Carsystem catalog sync — jedino mesto gde se menja izdanje kataloga.
 *
 * Kada izađe katalog 2027/28: promeniti `CATALOGUE` (edition, pdfUrl, slug
 * izlaznog fajla) i pokrenuti `npm run carsystem:sync`. Ništa drugo u lancu ne
 * nosi godinu u kodu.
 *
 * Autoritet podataka: isključivo carsystem.org (Vosschemie GmbH). Distributeri,
 * webshopovi i pretraživači nisu izvor ni za jedno polje.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

export const ORIGIN = "https://www.carsystem.org";
export const USER_AGENT = "Carsystem-RM-Indjija-catalog-sync/1.0 (+https://carsystemirm.com)";

export const CATALOGUE = {
  edition: "2026/27",
  editionKey: "2026-27",
  language: "EN",
  title: "CARSYSTEM Product Catalogue 2026/27 (EN)",
  listingPage: `${ORIGIN}/en/catalogues`,
  pdfUrl: `${ORIGIN}/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf`,
};

export const WEBSITE = {
  locale: "en",
  sitemapIndex: `${ORIGIN}/en/sitemap.xml`,
  detailPrefix: `${ORIGIN}/en/products/detail/`,
  categoryPrefix: `${ORIGIN}/en/products/category/`,
};

/** Gitignored (`.cache/`): sirovi HTML i PDF se ne komituju, RAW JSON da. */
export const CACHE_DIR = path.join(REPO_ROOT, ".cache/carsystem-sync");
export const PAGE_CACHE_DIR = path.join(CACHE_DIR, "pages");
export const LISTING_CACHE_DIR = path.join(CACHE_DIR, "listings");
export const IMAGE_CACHE_DIR = path.join(CACHE_DIR, "images");
export const PDF_CACHE_PATH = path.join(CACHE_DIR, `catalogue-${CATALOGUE.editionKey}-EN.pdf`);

const DATA_DIR = path.join(REPO_ROOT, "data/carsystem-sync");

export const PATHS = {
  rawWebsite: path.join(DATA_DIR, "raw/website-en.generated.json"),
  rawCatalogue: path.join(DATA_DIR, `raw/catalogue-${CATALOGUE.editionKey}.generated.json`),
  source: path.join(DATA_DIR, "source-products.generated.json"),
  identityRegistry: path.join(DATA_DIR, "identity-registry.json"),
  decisions: path.join(DATA_DIR, "manual-decisions.json"),
  taxonomyMap: path.join(DATA_DIR, "taxonomy-map.json"),
  localization: path.join(DATA_DIR, "localization-sr.json"),
  plan: path.join(DATA_DIR, "reports/sync-plan.generated.json"),
  planCsv: path.join(DATA_DIR, "reports/sync-plan.generated.csv"),
  planMarkdown: path.join(DATA_DIR, "reports/SYNC_DRY_RUN.md"),
  newProductsReport: path.join(DATA_DIR, `reports/CARSYSTEM_${CATALOGUE.editionKey.replace("-", "_")}_NEW_PRODUCTS.md`),
  imageManifest: path.join(DATA_DIR, "image-manifest.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data/carsystem-catalog-products.generated.json"),
  publicImages: path.join(REPO_ROOT, "public/products/carsystem/catalog"),
};

export const PUBLIC_IMAGE_URL_PREFIX = "/products/carsystem/catalog";
