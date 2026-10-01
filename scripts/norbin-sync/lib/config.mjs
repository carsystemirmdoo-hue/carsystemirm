/**
 * Norbin catalog sync — konfiguracija (faza audita; apply još ne postoji).
 *
 * NORBIN je vrednosni refinish brend; zvanični izvor je `norbin-paint.com`, mali STATIČKI
 * sajt bez CMS-a, bez `robots.txt`, bez `sitemap.xml` i bez stranica proizvoda. Jedna
 * `norbin-range.html` po regionu JESTE katalog: tekst linka nosi šifru i zvanični naziv,
 * a MSDS blok nabraja pakovanja.
 *
 * Branding: stranica i danas (provereno 2026-09-20) nosi „© BASF Coatings GmbH 2026" i
 * „NORBIN® is a registered Trademark of BASF Coatings GmbH", iako je BASF Coatings
 * 1. jula 2026. izdvojen u Surventis. Zato se brend NE preimenuje u „by Surventis" —
 * status izvora je CURRENT_BUT_LEGACY_BRANDING i tako se i vodi.
 *
 * Nije izvor: distributeri, marketplace, Google Images, katalozi trećih strana.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const BRAND = { slug: "norbin", name: "Norbin", manufacturer: "BASF Coatings GmbH" };

export const SOURCES = {
  website: { origin: "https://www.norbin-paint.com", page: "norbin-range.html" },
};

/**
 * Regioni koje sajt objavljuje. `me`, `de` i `pl` su neobjavljeni čuvari mesta
 * („Inhalte ME/DE/PL"), a Crna Gora je regionalno najbliža našem tržištu — nema dakle
 * nijednog regionalnog izvora za naš region i to se ne premošćuje pretpostavkom.
 */
export const REGIONS = ["en", "tr", "kz", "me", "de", "pl"];

/** Region čiji je engleski naziv referentni kada isti proizvod postoji u više regiona. */
export const REFERENCE_REGION = "en";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 carsystem-norbin-sync";

const cache = (...parts) => path.join(REPO_ROOT, ".cache", "norbin-sync", ...parts);
export const PAGE_CACHE_DIR = cache("pages");
export const DOCUMENT_CACHE_DIR = cache("documents");

const data = (...parts) => path.join(REPO_ROOT, "data", "norbin-sync", ...parts);
export const PATHS = {
  rawWebsite: data("raw", "website.generated.json"),
  driftReport: data("reports", "SOURCE_DRIFT.md"),
  drift: data("reports", "source-drift.generated.json"),
  inventory: data("reports", "local-inventory.generated.json"),
  identityRegistry: data("identity-registry.json"),
  decisions: data("manual-decisions.json"),
  taxonomyMap: data("taxonomy-map.json"),
  localizationDir: data("localization"),
  technicalLocalization: data("technical-localization.json"),
  localizationInputDir: cache("localization-input"),
  plan: data("reports", "sync-plan.generated.json"),
  planMarkdown: data("reports", "SYNC_DRY_RUN.md"),
  reconciliation: data("reports", "reconciliation.generated.json"),
  reconciliationMarkdown: data("reports", "RECONCILIATION.md"),
  validation: data("reports", "validation.generated.json"),
  searchQa: data("reports", "search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data", "norbin-catalog-products.generated.json"),
  stockEvidence: path.join(REPO_ROOT, "data", "knowledge", "norbin-stock-evidence.generated.json"),
  audit: data("reports", "SOURCE_MODEL_AUDIT.md"),
  source: data("source-products.generated.json"),
  /** Prethodna akvizicija (2026-08-08), commitovana — služi kao drugi svedok. */
  knowledgeCatalog: path.join(REPO_ROOT, "data", "knowledge", "norbin-catalog.generated.json"),
  knowledgeDocuments: path.join(REPO_ROOT, "data", "knowledge", "norbin-documents.generated.json"),
  knowledgeClaims: path.join(REPO_ROOT, "data", "knowledge", "norbin-tds-claims.generated.json"),
};

/** Prefiks šifre nosi porodicu — čita se iz zvaničnih naziva, ne izmišlja se. */
export const FAMILY_BY_PREFIX = [
  [/^N15-/, "clearcoat"],
  [/^N55-/, "undercoat"],
  [/^N60-/, "bodyfiller"],
  [/^N75-/, "hardener"],
  [/^N85-/, "reducer"],
  [/^N95-/, "cleaner"],
];
