/**
 * C.A.R.FIT catalog sync — jedino mesto gde se menja izdanje kataloga.
 *
 * Autoritet podataka: isključivo carfitrepair.com (August Handel GmbH).
 * Distributeri, webshopovi i pretraživači nisu izvor ni za jedno polje.
 *
 * Redosled autoriteta za pitanje „da li je proizvod trenutno aktivan”:
 *   1. objavljena stranica proizvoda na carfitrepair.com (EN, TranslatePress),
 *   2. zvanični PDF katalog (adresa se ČITA sa /en/katalog/, ne upisuje se ovde),
 *   3. naši lokalni podaci.
 *
 * Arhitektura izvora (utvrđena pre pisanja parsera): WordPress + Yoast +
 * Elementor, otvoren REST API. Proizvod = `post` u kategoriji ispod `produkte`.
 * `/en/wp-json/…` vraća isti korpus sa engleskim prevodom (TranslatePress), a
 * `/wp-json/…` nemački original — šifre artikala moraju biti iste u oba.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const ORIGIN = "https://carfitrepair.com";
export const BRAND = { slug: "carfit", name: "C.A.R.FIT", manufacturer: "August Handel GmbH" };

export const WEBSITE = {
  locale: "en",
  home: `${ORIGIN}/en/`,
  sitemapIndex: `${ORIGIN}/sitemap_index.xml`,
  postSitemap: `${ORIGIN}/post-sitemap.xml`,
  restEn: `${ORIGIN}/en/wp-json/wp/v2`,
  restDe: `${ORIGIN}/wp-json/wp/v2`,
  /** Koren stabla kategorija proizvoda (slug je isti u oba jezika). */
  productRootCategorySlug: "produkte",
};

export const CATALOGUE = {
  edition: "2026",
  editionKey: "2026",
  title: "C.A.R.FIT Catalogue 2026",
  /** Stranica sa flipbook-om; PDF adresa se čita iz njenog `source` polja. */
  listingPage: `${ORIGIN}/en/katalog/`,
  /** Samo provera: ako sajt objavi drugi fajl, acquire to prijavljuje kao promenu izdanja. */
  expectedFilePattern: /CARFIT[^"'\\]*2026[^"'\\]*\.pdf/i,
};

/** Gitignored (`.cache/`): sirovi JSON/HTML/PDF se ne komituju, RAW dataset da. */
export const CACHE_DIR = path.join(REPO_ROOT, ".cache/carfit-sync");
export const REST_CACHE_DIR = path.join(CACHE_DIR, "rest");
export const PAGE_CACHE_DIR = path.join(CACHE_DIR, "pages");
export const IMAGE_CACHE_DIR = path.join(CACHE_DIR, "images");
export const PDF_CACHE_DIR = path.join(CACHE_DIR, "catalogue");

const DATA_DIR = path.join(REPO_ROOT, "data/carfit-sync");

export const PATHS = {
  dataDir: DATA_DIR,
  rawWebsite: path.join(DATA_DIR, "raw/website-en.generated.json"),
  rawCatalogue: path.join(DATA_DIR, `raw/catalogue-${CATALOGUE.editionKey}.generated.json`),
  source: path.join(DATA_DIR, "source-products.generated.json"),
  identityRegistry: path.join(DATA_DIR, "identity-registry.json"),
  decisions: path.join(DATA_DIR, "manual-decisions.json"),
  taxonomyMap: path.join(DATA_DIR, "taxonomy-map.json"),
  localizationDir: path.join(DATA_DIR, "localization"),
  localizationInputDir: path.join(CACHE_DIR, "localization-input"),
  imageManifest: path.join(DATA_DIR, "image-manifest.generated.json"),
  publishedImages: path.join(DATA_DIR, "published-images.generated.json"),
  documentManifest: path.join(DATA_DIR, "document-manifest.generated.json"),
  plan: path.join(DATA_DIR, "reports/sync-plan.generated.json"),
  planCsv: path.join(DATA_DIR, "reports/sync-plan.generated.csv"),
  planMarkdown: path.join(DATA_DIR, "reports/SYNC_DRY_RUN.md"),
  reconciliation: path.join(DATA_DIR, "reports/reconciliation.generated.json"),
  reconciliationMarkdown: path.join(DATA_DIR, "reports/RECONCILIATION.md"),
  validation: path.join(DATA_DIR, "reports/validation.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data/carfit-catalog-products.generated.json"),
  publicImages: path.join(REPO_ROOT, "public/products/carfit/catalog"),
};

export const PUBLIC_IMAGE_URL_PREFIX = "/products/carfit/catalog";
