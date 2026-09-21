/**
 * Cosmos Lac catalog sync — konfiguracija.
 *
 * Zvanični izvor je `cosmoslac.com` (WordPress, Yoast sitemap). Proizvod je stranica
 *   /products/{category}/{family}/{product}/
 * pa kategoriju i porodicu određuje SAM proizvođač — adresom. Svaka nijansa/šifra je zasebna
 * zvanična stranica; porodica je zvanična linija (RAL, Fast Acrylic, Flame Blue…).
 *
 * `robots.txt` ne zabranjuje ništa. Referentni jezik je engleski (adrese bez prefiksa); ostali
 * jezici (`el`, `bg`, `de`, `da`, `fi`, `sv`, `hu`) služe samo kao dokaz regionalne objave.
 *
 * Nije izvor: distributeri, marketplace, Google Images, katalozi trećih strana. Cene se ne uvoze.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const BRAND = { slug: "cosmos-lac", name: "Cosmos Lac", manufacturer: "Cosmos Lac S.A." };
export const ORIGIN = "https://cosmoslac.com";
export const LOCALES = ["el", "bg", "de", "da", "fi", "sv", "hu"];
export const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 carsystem-cosmos-lac-sync";

const cache = (...parts) => path.join(REPO_ROOT, ".cache", "cosmos-lac-sync", ...parts);
export const PAGE_CACHE_DIR = cache("pages");

const data = (...parts) => path.join(REPO_ROOT, "data", "cosmos-lac-sync", ...parts);
export const PATHS = {
  rawSitemap: data("raw", "sitemap.generated.json"),
  rawProducts: data("raw", "products.generated.json"),
  rawFamilies: data("raw", "families.generated.json"),
  rawDocuments: data("raw", "documents.generated.json"),
  source: data("source-products.generated.json"),
  inventory: data("reports", "local-inventory.generated.json"),
  auditJson: data("reports", "source-model-audit.generated.json"),
  audit: data("reports", "SOURCE_MODEL_AUDIT.md"),
  localDataset: path.join(REPO_ROOT, "data", "cosmos-lac-products.generated.json"),
  scope: data("scope.json"),
  baselineUrls: data("baseline-urls.json"),
  scopeLock: data("scope-lock.json"),
  plan: data("plan.generated.json"),
  identityRegistry: data("identity-registry.json"),
  validation: data("reports", "validation.generated.json"),
  reconciliation: data("reports", "reconciliation.generated.json"),
  searchQa: data("reports", "search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data", "cosmos-lac-catalog-products.generated.json"),
};

export const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";
