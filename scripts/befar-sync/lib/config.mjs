/**
 * BEFAR catalog sync — konfiguracija.
 *
 * Autoritet podataka: isključivo befar.com.tr / en.befar.com.tr (proizvođač
 * Befar, izvoz Nargil Dış Ticaret). Distributeri i webshopovi nisu izvor ni za
 * jedno polje.
 *
 * Redosled autoriteta za „da li je proizvod trenutno aktivan”:
 *   1. aktuelni zvanični sajt (blok proizvoda sa šifrom na stranici kategorije),
 *   2. zvanični digitalni katalog (PDF; adresa se ČITA sa sajta),
 *   3. naši lokalni podaci.
 *
 * Arhitektura izvora (utvrđena pre pisanja parsera): Wix sajt, 19 stranica u
 * `pages-sitemap.xml`, BEZ stranica pojedinačnih proizvoda. Proizvodi žive kao
 * blokovi (`ClassicSection`) na stranicama kategorija: slike/galerija, logo
 * linije, naslov i tabela čije su ćelije zasebni, apsolutno pozicionirani
 * tekstovi. Tabela se zato rekonstruiše iz Wix mesh rasporeda (red mreže +
 * x-pozicija), ne iz redosleda u HTML-u.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const BRAND = { slug: "befar", name: "Befar", manufacturer: "Befar (Nargil Dış Ticaret)" };

export const WEBSITE = {
  /** Engleska verzija je primarna za nazive; turska služi kao kontrola parsera (iste šifre). */
  en: { origin: "https://en.befar.com.tr", sitemap: "https://en.befar.com.tr/pages-sitemap.xml" },
  tr: { origin: "https://www.befar.com.tr", sitemap: "https://www.befar.com.tr/pages-sitemap.xml" },
  mediaHost: "https://static.wixstatic.com/media/",
};

export const CATALOGUE = {
  title: "BEFAR Product Catalog",
  /** PDF se otkriva na sajtu: svaki `_files/ugd/*.pdf` link sa bilo koje stranice. */
  filePattern: /_files\/ugd\/[\w]+\.pdf/g,
};

export const USER_AGENT = "Mozilla/5.0 (compatible; Carsystem-RM-Indjija-catalog-sync/1.0; +https://carsystemirm.com)";

/** Gitignored (`.cache/`): sirov HTML, PDF i originalne slike se ne komituju. */
export const CACHE_DIR = path.join(REPO_ROOT, ".cache/befar-sync");
export const PAGE_CACHE_DIR = path.join(CACHE_DIR, "pages");
export const IMAGE_CACHE_DIR = path.join(CACHE_DIR, "images");
export const PDF_CACHE_DIR = path.join(CACHE_DIR, "catalogue");

const DATA_DIR = path.join(REPO_ROOT, "data/befar-sync");

export const PATHS = {
  dataDir: DATA_DIR,
  rawWebsite: path.join(DATA_DIR, "raw/website.generated.json"),
  rawCatalogue: path.join(DATA_DIR, "raw/catalogue.generated.json"),
  source: path.join(DATA_DIR, "source-products.generated.json"),
  identityRegistry: path.join(DATA_DIR, "identity-registry.json"),
  decisions: path.join(DATA_DIR, "manual-decisions.json"),
  taxonomyMap: path.join(DATA_DIR, "taxonomy-map.json"),
  familyRules: path.join(DATA_DIR, "family-rules.json"),
  localizationDir: path.join(DATA_DIR, "localization"),
  localizationInputDir: path.join(CACHE_DIR, "localization-input"),
  imageManifest: path.join(DATA_DIR, "image-manifest.generated.json"),
  publishedImages: path.join(DATA_DIR, "published-images.generated.json"),
  plan: path.join(DATA_DIR, "reports/sync-plan.generated.json"),
  planCsv: path.join(DATA_DIR, "reports/sync-plan.generated.csv"),
  planMarkdown: path.join(DATA_DIR, "reports/SYNC_DRY_RUN.md"),
  reconciliation: path.join(DATA_DIR, "reports/reconciliation.generated.json"),
  reconciliationMarkdown: path.join(DATA_DIR, "reports/RECONCILIATION.md"),
  validation: path.join(DATA_DIR, "reports/validation.generated.json"),
  colourDecisions: path.join(DATA_DIR, "reports/colour-decisions.generated.json"),
  searchQa: path.join(DATA_DIR, "reports/search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data/befar-catalog-products.generated.json"),
  publicImages: path.join(REPO_ROOT, "public/products/befar/catalog"),
};

export const PUBLIC_IMAGE_URL_PREFIX = "/products/befar/catalog";
