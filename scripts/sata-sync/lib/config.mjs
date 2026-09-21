/**
 * SATA catalog sync — konfiguracija.
 *
 * OPSEG OVOG SYNCA: „SATA EMEA REFINISH FAMILY SCOPE” — odobrene aktuelne porodice za
 * auto-reparaturu i njihovi brojevi artikala. To NIJE ceo SATA katalog: industrijski program,
 * reklamni artikli, rezervni delovi i samostalan pribor (faza 2) su aktuelni kod proizvođača,
 * ali ih ovaj sync ne uvozi i ne broji kao „nedostaje”.
 *
 * SATA nije brend premaza nego OPREME: pištolji, cup sistemi, priprema vazduha, zaštita
 * disanja, čišćenje. Zvanični izvor je `sata.com`, Shopware prodavnica sa dve vrste stranica:
 *
 *   /en/<porodica>/CF<id>      PORODICA — konfigurabilan proizvod sa osama izbora
 *                              (veličina mlaznice, tehnologija RP/HVLP, digitalna jedinica…)
 *   /en/<naziv>/<broj artikla> ARTIKAL  — jedna konkretna konfiguracija, pribor ili rezervni deo
 *
 * Proizvođač dakle SAM tretira brojeve artikala kao konfiguracije jedne porodice. Zato je
 * kartica = porodica, a broj artikla = varijanta; stotine kartica po artiklu bi bile pogrešan
 * model, ne potpuniji katalog.
 *
 * `robots.txt` zabranjuje svaki URL sa upitnim stringom (`Disallow: /*?`), pa se Shopware
 * `…/switch?options=` endpoint NE koristi. Artikli se čitaju sa svojih stranica iz sitemap-a.
 *
 * Nije izvor: distributeri, marketplace, Google Images, katalozi trećih strana. Cene koje sajt
 * objavljuje se NE uvoze.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const BRAND = { slug: "sata", name: "SATA", manufacturer: "SATA GmbH & Co. KG" };

/**
 * Referentni region je međunarodni `en`. Sajt ima i `en-gb`, `en-us`, `de-de`, `de-at`,
 * `de-ch`, `fr`, `es`, `it-it`… ali nijedan za Srbiju ni za region — `en` je program koji
 * SATA nudi tržištima bez sopstvene lokalizacije. `en-us`/`en-ca` su zasebni programi
 * (drugačiji propisi o raspršivanju) i ne služe kao dokaz za našu ponudu.
 */
export const SOURCES = { website: { origin: "https://www.sata.com", locale: "en" } };
export const OTHER_LOCALES = ["en-gb", "en-us", "en-ca", "de-de", "de-at", "de-ch", "fr", "fr-ca", "fr-ch", "es", "es-us", "it-it", "it-ch"];

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 carsystem-sata-sync";

const cache = (...parts) => path.join(REPO_ROOT, ".cache", "sata-sync", ...parts);
export const PAGE_CACHE_DIR = cache("pages");
export const ARTICLE_CACHE = cache("articles.generated.json");

const data = (...parts) => path.join(REPO_ROOT, "data", "sata-sync", ...parts);
export const PATHS = {
  rawSitemap: data("raw", "sitemap.generated.json"),
  rawFamilies: data("raw", "families.generated.json"),
  rawArticles: data("raw", "articles.generated.json"),

  rawLocales: data("raw", "locale-coverage.generated.json"),
  source: data("source-products.generated.json"),
  inventory: data("reports", "local-inventory.generated.json"),
  audit: data("reports", "SOURCE_MODEL_AUDIT.md"),
  taxonomy: data("taxonomy-map.json"),
  scopeLock: data("scope-lock.json"),
  scopeReport: data("reports", "scope-reconciliation.generated.json"),
  localizationFamilies: data("localization", "families.sr.json"),
  localizationTerms: data("localization", "terms.sr.json"),
  localizationInput: data("localization-input.generated.json"),
  plan: data("plan.generated.json"),
  identityRegistry: data("identity-registry.json"),
  imageAvailability: data("reports", "image-availability.generated.json"),
  validation: data("reports", "validation.generated.json"),
  reconciliation: data("reports", "reconciliation.generated.json"),
  searchQa: data("reports", "search-qa.generated.json"),
  siteDataset: path.join(REPO_ROOT, "data", "sata-catalog-products.generated.json"),
  // Faza 2 — samostalan i vezan pribor (odobren model: data/sata-sync/phase2-scope.json).
  phase2Scope: data("phase2-scope.json"),
  phase2Lock: data("phase2-scope-lock.json"),
  phase2Localization: data("localization", "phase2.sr.json"),
  phase2Plan: data("phase2-plan.generated.json"),
  phase2Mapping: data("reports", "phase2-article-mapping.generated.csv"),
  phase2Reconciliation: data("reports", "phase2-reconciliation.generated.json"),
  phase2SearchQa: data("reports", "phase2-search-qa.generated.json"),
};

export const SCOPE_NAME = "SATA EMEA REFINISH FAMILY SCOPE";
export const PHASE2_SCOPE_NAME = "SATA PHASE 2 ACCESSORY SCOPE";

/** Kategorije sa kojih se čitaju pločice porodica. */
export const CATEGORY_PAGES = [
  "spray-guns/gravity-flow-cup-spray-guns",
  "spray-guns/pressure-fed-spray-guns",
  "spray-guns/suction-cup-spray-guns",
  "spray-guns/automatic-paint-spray-guns",
  "spray-guns/airbrush-guns",
  "spray-guns/accessories-for-spray-guns",
  "cup-systems/rps-cups",
  "cup-systems/lcs-cups",
  "cup-systems/gravity-flow-cups",
  "cup-systems/suspended-cups",
  "filter-technology",
  "respiratory-protection/full-face-respirator",
  "respiratory-protection/half-mask-respirator",
  "all-products/additional-products",
  "all-products/accessories",
  "all-products/spare-parts",
  "all-products/merchandising-items",
];
