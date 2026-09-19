/**
 * baslac catalog sync — konfiguracija.
 *
 * baslac je Surventis brend (ranije BASF Coatings). Autoritet su isključivo aktuelni zvanični
 * izvori; distributeri i mirori chartova nisu izvor ni za jedno polje.
 *
 * Arhitektura izvora (utvrđena u auditu):
 *   1. baslac.com/en-emea — 5 stranica kategorija; dokaz da je proizvod U PONUDI, naziv,
 *      osobine i packshot. Drupal, isti sistem kao rmpaint.com.
 *   2. baslac.com/en-emea/technical-data-sheets — zvanični INDEKS dokumenata (9 strana).
 *      Fajl koji nije ni ovde ni na stranici kategorije NIJE dokaz aktuelnosti.
 *   3. techinfo.baslac.com/en/ — otvoren direktorijum tehničkih listova.
 *
 * Model (odobren): jedna zvanična šifra = jedna kartica; 4 sistema za nijansiranje nose
 * svoje mixing clear/binder komponente kao ugnježdene činjenice; toneri se zvanično ne
 * objavljuju pojedinačno i ne dobijaju kartice.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const BRAND = { slug: "baslac", name: "baslac", manufacturer: "baslac (Surventis)" };

export const SOURCES = {
  website: { origin: "https://www.baslac.com", locale: "en-emea" },
  techinfo: { origin: "https://techinfo.baslac.com", language: "en" },
};

export const CATEGORY_PAGES = ["baslac-clearcoats", "baslac-primers", "baslac-putty", "baslac-additives", "baslac-base-and-topcoats", "products-systems"];

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 carsystem-baslac-sync";

const cache = (...parts) => path.join(REPO_ROOT, ".cache", "baslac-sync", ...parts);
export const PAGE_CACHE_DIR = cache("pages");
export const IMAGE_CACHE_DIR = cache("images");
export const TDS_CACHE_DIR = cache("tds");

const data = (...parts) => path.join(REPO_ROOT, "data", "baslac-sync", ...parts);
export const PATHS = {
  rawWebsite: data("raw", "website.generated.json"),
  rawTechinfo: data("raw", "techinfo.generated.json"),
  tdsFacts: data("raw", "tds-facts.generated.json"),
  source: data("source-products.generated.json"),
  identityRegistry: data("identity-registry.json"),
  decisions: data("manual-decisions.json"),
  taxonomyMap: data("taxonomy-map.json"),
  localizationDir: data("localization"),
  localizationInputDir: cache("localization-input"),
  imageManifest: data("image-manifest.generated.json"),
  publishedImages: data("published-images.generated.json"),
  plan: data("reports", "sync-plan.generated.json"),
  planMarkdown: data("reports", "SYNC_DRY_RUN.md"),
  reconciliation: data("reports", "reconciliation.generated.json"),
  reconciliationMarkdown: data("reports", "RECONCILIATION.md"),
  validation: data("reports", "validation.generated.json"),
  searchQa: data("reports", "search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data", "baslac-catalog-products.generated.json"),
  publicImages: path.join(REPO_ROOT, "public", "products", "baslac", "catalog"),
};

export const PUBLIC_IMAGE_URL_PREFIX = "/products/baslac/catalog";

/**
 * Sistemi za nijansiranje: postojeće porodice postaju kartice sistema; CV je nov.
 *
 * `30-S01 Converter CV` pripada CV liniji, ne osnovnoj 30: tako ga vodi lokalni dosije
 * (`lib/baslac-systems.ts`), a potvrđuju i tehnički listovi — `30-S01_variant_81-30_DTM`
 * ima isti sadržaj kao `30_Line_CV_variant_81-30_DTM`.
 */
export const SYSTEMS = [
  { key: "line-30", familySlug: "baslac-line-30", officialName: "baslac Topcoat 30", lineDoc: "30_Line.pdf", components: ["30-S00"] },
  { key: "line-30-cv", familySlug: "baslac-line-30-cv", officialName: "baslac Topcoat 30 CV", lineDoc: "30_Line_CV.pdf", components: ["30-S01"] },
  { key: "line-35", familySlug: "baslac-line-35", officialName: "baslac Basecoat 35", lineDoc: "35_Line.pdf", components: ["35-M00"] },
  { key: "line-45", familySlug: "baslac-line-45", officialName: "baslac Basecoat 45", lineDoc: "45_Line.pdf", components: ["45-W00"] },
];

/** Šifre koje danas žive kao varijante linije 45, a imaju sopstveni zvanični identitet. */
export const PROMOTED_FROM_LINE = ["45-R45", "45-W10"];

/** Zvanični TDS postoji, ali aktuelni sajt ga ne potvrđuje — ne ulazi u katalog. */
export const UNCERTAIN_CODES = ["11-40"];
