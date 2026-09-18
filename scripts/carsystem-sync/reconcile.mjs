#!/usr/bin/env node
/**
 * Carsystem sync · revizija — svaki zvanični proizvod i svaka zvanična šifra
 * artikla dobijaju TAČNO JEDAN finalni status, a zbir mora da se zatvori.
 *
 * Ne menja katalog. Čita plan + source + RAW + stvarni runtime katalog i
 * dokazuje da nijedna source šifra nije izgubljena, duplirana ni priključena
 * pogrešnom proizvodu. Izlazi sa 1 ako bilo koji zbir ili invarijanta ne važi.
 *
 * Izlaz: data/carsystem-sync/reports/reconciliation.generated.json
 *        …/reconciliation-products.generated.csv
 *        …/reconciliation-articles.generated.csv
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { CATALOGUE, PATHS } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";

const REPORT_DIR = path.dirname(PATHS.plan);
const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const website = readJson(PATHS.rawWebsite);
const catalogue = readJson(PATHS.rawCatalogue);
const registry = readJson(PATHS.identityRegistry);
const dataset = readJson(PATHS.siteDataset);

const failures = [];
const expect = (condition, message) => condition || failures.push(message);

/* -- 1. Proizvodi ----------------------------------------------------------- */

const planBySource = new Map(plan.items.map((item) => [item.sourceKey, item]));

function productStatus(product, item) {
  const conflictTypes = product.conflicts.map((conflict) => conflict.type);
  switch (item.action) {
    case "IMPORT":
      return ["IMPORTED_NEW", `Uvezen kao ${item.slug}.`];
    case "MATCHED_EXISTING":
      return ["MATCHED_EXISTING", item.reason];
    case "HELD_NO_PRODUCT_PAGE":
      // Nema aktivnu stranicu na carsystem.org → nije deo website-parity cilja.
      return ["CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE", item.reason];
    case "HELD_INACTIVE_PAGE":
      return ["INACTIVE_PAGE", item.reason];
    case "EXCLUDED":
      return ["NON_PRODUCT_MARKETING_MATERIAL", item.reason];
    default:
      // Svaki drugi razlog zbog kog AKTIVAN proizvod nije u katalogu je rupa u paritetu.
      void conflictTypes;
      return [product.active ? "ACTIVE_PRODUCT_MISSING" : `OTHER_EXPLICIT_STATUS:${item.action}`, `${item.action}: ${item.reason ?? ""}`];
  }
}

const products = source.products.map((product) => {
  const item = planBySource.get(product.sourceKey);
  expect(Boolean(item), `Source proizvod bez stavke u planu: ${product.sourceKey}`);
  const [status, reason] = productStatus(product, item);
  return {
    sourceKey: product.sourceKey,
    officialName: product.officialName,
    officialSubtitle: product.subtitle,
    officialSourceUrl: product.sourceUrl,
    cataloguePresence: product.catalogue.inCatalogue,
    websitePresence: product.origin !== "catalogue-only",
    articleNumbers: product.articles.map((article) => article.articleNumber),
    newFlag: product.isNew,
    newInCatalogue: product.catalogue.markedNew,
    newOnWebsite: product.markedNewOnWebsite,
    activeOnWebsite: product.active === true,
    legacyArticleNumbers: (product.legacyArticleNumbers ?? []).map((legacy) => legacy.articleNumber),
    finalStatus: status,
    localSlug: item.slug ?? item.localSlug ?? null,
    reason,
    conflicts: product.conflicts.map((conflict) => conflict.type),
  };
});

const productTotals = {};
for (const row of products) productTotals[row.finalStatus] = (productTotals[row.finalStatus] ?? 0) + 1;
const productSum = Object.values(productTotals).reduce((sum, value) => sum + value, 0);
expect(new Set(products.map((row) => row.sourceKey)).size === products.length, "Dupli sourceKey u source datasetu.");
expect(productSum === source.products.length, `Zbir statusa proizvoda ${productSum} ≠ ${source.products.length}`);

/* -- 2. Šifre artikala ------------------------------------------------------ */

const runtime = loadCatalogRuntime();
const carsystem = runtime.products.filter((product) => product.brandSlug === "carsystem");

/** šifra → [slug…] u STVARNOM katalogu (redovi varijanti ili šifra proizvoda sa jednom varijantom). */
const runtimeOwners = new Map();
for (const product of carsystem) {
  const rows = product.detail?.variants?.content.rows ?? [];
  const ids = rows.length ? rows.map((row) => row.id) : product.manufacturerCode ? [product.manufacturerCode] : [];
  for (const id of ids) runtimeOwners.set(id, [...(runtimeOwners.get(id) ?? []), product.slug]);
}

const productRow = new Map(products.map((row) => [row.sourceKey, row]));
const PRESENT = new Set(["IMPORTED_NEW", "MATCHED_EXISTING"]);
const articles = [];
for (const product of source.products) {
  const parent = productRow.get(product.sourceKey);
  for (const article of product.articles) {
    const owners = runtimeOwners.get(article.articleNumber) ?? [];
    const shouldBePresent = PRESENT.has(parent.finalStatus);
    let integrity = "OK";
    if (shouldBePresent && owners.length === 0) integrity = "LOST";
    else if (owners.length > 1) integrity = "DUPLICATED";
    else if (shouldBePresent && owners[0] !== parent.localSlug) integrity = "WRONG_PRODUCT";
    else if (!shouldBePresent && owners.length) integrity = "PRESENT_BUT_PARENT_NOT_IMPORTED";
    articles.push({
      articleNumber: article.articleNumber,
      officialSpecification: article.specification,
      sourceKey: product.sourceKey,
      officialName: product.officialName,
      inCatalogue: article.sources.includes("catalogue"),
      onWebsite: article.sources.includes("website"),
      finalStatus: parent.finalStatus,
      localSlug: shouldBePresent ? parent.localSlug : null,
      runtimeOwners: owners,
      integrity,
    });
  }
}

const articleTotals = {};
const integrityTotals = {};
for (const row of articles) {
  articleTotals[row.finalStatus] = (articleTotals[row.finalStatus] ?? 0) + 1;
  integrityTotals[row.integrity] = (integrityTotals[row.integrity] ?? 0) + 1;
}
const articleSum = Object.values(articleTotals).reduce((sum, value) => sum + value, 0);
expect(new Set(articles.map((row) => row.articleNumber)).size === articles.length, "Ista source šifra pripada više source proizvoda.");
expect(articleSum === source.summary.sourceVariants, `Zbir statusa šifara ${articleSum} ≠ ${source.summary.sourceVariants}`);
expect(articles.every((row) => row.integrity === "OK"), `Šifre sa narušenim integritetom: ${articles.filter((row) => row.integrity !== "OK").map((row) => `${row.articleNumber}:${row.integrity}`).join(", ")}`);

// Obrnut smer: svaka zvanična šifra u našem katalogu mora poticati iz source-a.
const sourceArticles = new Set(articles.map((row) => row.articleNumber));
const foreign = [...runtimeOwners.keys()].filter((id) => /^\d{3}\.\d{3}$/.test(id) && !sourceArticles.has(id));
expect(foreign.length === 0, `Šifre u katalogu kojih nema u zvaničnom izvoru: ${foreign.join(", ")}`);

// RAW → source: nijedna šifra iz RAW fajlova ne sme da nestane pri spajanju.
const rawWebsite = new Set(website.products.flatMap((product) => product.variants.map((variant) => variant.articleNumber)));
const rawCatalogue = new Set(catalogue.products.flatMap((product) => product.articles.map((article) => article.articleNumber)));
const superseded = source.products.flatMap((product) =>
  product.conflicts.filter((conflict) => conflict.type === "ARTICLE_NUMBER_DIFFERS").flatMap((conflict) => conflict.catalogue.map((entry) => ({ articleNumber: entry.articleNumber, sourceKey: product.sourceKey, officialName: product.officialName }))),
);
const accounted = new Set([...sourceArticles, ...superseded.map((entry) => entry.articleNumber)]);
const droppedFromRaw = [...new Set([...rawWebsite, ...rawCatalogue])].filter((articleNumber) => !accounted.has(articleNumber));
expect(droppedFromRaw.length === 0, `RAW šifre koje nisu stigle u source dataset: ${droppedFromRaw.join(", ")}`);

/* -- 3. „NEW”: reproduktivno iz RAW podataka -------------------------------- */

const webNewKeys = new Set(website.products.filter((product) => product.markedNew).map((product) => `${product.categoryKey}/${product.slug}`));
const sourceByArticle = new Map();
for (const product of source.products) for (const article of product.articles) sourceByArticle.set(article.articleNumber, product.sourceKey);
const pdfNewBlocks = catalogue.products.filter((block) => block.markedNew);
const pdfNewKeys = new Set(pdfNewBlocks.map((block) => block.articles.map((article) => sourceByArticle.get(article.articleNumber)).find(Boolean)).filter(Boolean));
const name = (key) => { const row = productRow.get(key); return `${row.officialName}${row.officialSubtitle ? ` — ${row.officialSubtitle}` : ""}`; };
const newBreakdown = {
  websiteMarkedNew: [...webNewKeys].sort().map(name),
  catalogueMarkedNew: [...pdfNewKeys].sort().map(name),
  both: [...webNewKeys].filter((key) => pdfNewKeys.has(key)).sort().map(name),
  websiteOnly: [...webNewKeys].filter((key) => !pdfNewKeys.has(key)).sort().map(name),
  catalogueOnly: [...pdfNewKeys].filter((key) => !webNewKeys.has(key)).sort().map(name),
  cataloguePagesWithUnattributedNewBadge: catalogue.pages
    .map((page) => ({ pdfPage: page.pdfPage, badges: page.newMarkers, attributed: pdfNewBlocks.filter((block) => block.pdfPage === page.pdfPage).length }))
    .filter((page) => page.badges !== page.attributed),
};
const unionNew = new Set([...webNewKeys, ...pdfNewKeys]);
newBreakdown.counts = {
  website: webNewKeys.size,
  catalogueBlocks: pdfNewBlocks.length,
  catalogueProducts: pdfNewKeys.size,
  both: newBreakdown.both.length,
  websiteOnly: newBreakdown.websiteOnly.length,
  catalogueOnly: newBreakdown.catalogueOnly.length,
  union: unionNew.size,
  catalogueBadgesOnPages: catalogue.summary.newMarkers,
};
expect(unionNew.size === products.filter((row) => row.newFlag).length, `NEW unija ${unionNew.size} ≠ source isNew ${products.filter((row) => row.newFlag).length}`);

/* -- 4. Dve metrike lokalnog kataloga -------------------------------------- */

const localSlugsFromCatalogue = new Set(
  products
    .filter((row) => PRESENT.has(row.finalStatus) && (row.cataloguePresence || row.legacyArticleNumbers.length > 0))
    .map((row) => row.localSlug),
);
const handWritten = carsystem.filter((product) => !registry.products[product.slug]);
// Familija je „u katalogu” i kada je tamo pod drugom šifrom nego na sajtu
// (SOURCE_CONFLICT) — spoj po šifri je ne vidi, ali katalog je štampa.
const catalogueFamilies = products.filter((row) => row.cataloguePresence || row.legacyArticleNumbers.length > 0);
const coverage = {
  A_totalLocalCarsystemRecords: carsystem.length,
  A_breakdown: {
    importedBySync: carsystem.length - handWritten.length,
    handWritten: handWritten.length,
    handWrittenMatchedToCatalogueProduct: handWritten.filter((product) => localSlugsFromCatalogue.has(product.slug)).map((product) => product.slug),
    handWrittenMatchedToWebsiteOnlyProduct: products.filter((row) => row.finalStatus === "MATCHED_EXISTING" && !row.cataloguePresence).map((row) => row.localSlug),
    handWrittenWithoutConfirmedOfficialProduct: handWritten
      .filter((product) => !products.some((row) => row.finalStatus === "MATCHED_EXISTING" && row.localSlug === product.slug))
      .map((product) => product.slug),
  },
  B_catalogueProductFamilies: {
    edition: CATALOGUE.edition,
    inCatalogue: catalogueFamilies.length,
    representedLocally: localSlugsFromCatalogue.size,
    notRepresented: catalogueFamilies.filter((row) => !PRESENT.has(row.finalStatus)).map((row) => ({ officialName: row.officialName, status: row.finalStatus, articleNumbers: row.articleNumbers })),
  },
};
expect(dataset.products.length === carsystem.length - handWritten.length, "Dataset i runtime se ne slažu u broju uvezenih proizvoda.");

/* -- 4b. COVERAGE GATE: paritet sa aktivnim zvaničnim sajtom ---------------- */

const activeProducts = products.filter((row) => row.activeOnWebsite);
const representedProducts = activeProducts.filter(
  (row) => PRESENT.has(row.finalStatus) && carsystem.some((product) => product.slug === row.localSlug),
);
const activeArticles = articles.filter((row) => row.onWebsite && productRow.get(row.sourceKey).activeOnWebsite);
const representedArticles = activeArticles.filter((row) => row.integrity === "OK" && row.runtimeOwners.length === 1);
const legacyCollisions = products.flatMap((row) => row.legacyArticleNumbers.filter((legacy) => runtimeOwners.has(legacy)).map((legacy) => `${legacy} (${row.officialName})`));
const parity = {
  A_currentActiveProductPages: activeProducts.length,
  B_representedLocally: representedProducts.length,
  C_currentActiveArticleNumbers: activeArticles.length,
  D_representedLocally: representedArticles.length,
  coveragePercent: Number(((representedProducts.length / activeProducts.length) * 100).toFixed(2)),
  articleCoveragePercent: Number(((representedArticles.length / activeArticles.length) * 100).toFixed(2)),
  ACTIVE_PRODUCT_MISSING: activeProducts.filter((row) => !representedProducts.includes(row)).map((row) => ({ officialName: row.officialName, url: row.officialSourceUrl, status: row.finalStatus, reason: row.reason })),
  activeArticlesMissing: activeArticles.filter((row) => !representedArticles.includes(row)).map((row) => row.articleNumber),
  duplicateActiveArticleNumbers: [...runtimeOwners].filter(([, owners]) => owners.length > 1).map(([articleNumber, owners]) => ({ articleNumber, owners })),
  legacyArticleCollidesWithActive: legacyCollisions,
};
expect(parity.B_representedLocally === parity.A_currentActiveProductPages, `PARITET: zastupljeno ${parity.B_representedLocally} od ${parity.A_currentActiveProductPages} aktivnih proizvoda`);
expect(parity.D_representedLocally === parity.C_currentActiveArticleNumbers, `PARITET: zastupljeno ${parity.D_representedLocally} od ${parity.C_currentActiveArticleNumbers} aktivnih šifara`);
expect(parity.duplicateActiveArticleNumbers.length === 0, "Ista aktivna šifra na više proizvoda.");
expect(legacyCollisions.length === 0, `Istorijska šifra se sudara sa aktivnom: ${legacyCollisions.join(", ")}`);

/** Merchandising: svaka stavka pojedinačno, sa dokazom da je (ili nije) naručiv artikal. */
const merchandising = source.products
  .filter((product) => product.categoryKey === "merchandising-materials")
  .map((product) => {
    const orderable = product.active && product.articles.length > 0 && product.articles.every((article) => article.salesPack);
    return {
      officialName: product.officialName,
      url: product.sourceUrl,
      articleNumbers: product.articles.map((article) => article.articleNumber),
      specification: product.articles.map((article) => article.specification).filter(Boolean).slice(0, 3).join("; "),
      salesPack: [...new Set(product.articles.map((article) => article.salesPack))].join("/"),
      officialImages: product.images.length,
      classification: orderable ? "ORDERABLE_PRODUCT" : "NON_PRODUCT_MARKETING_MATERIAL",
      evidence: orderable ? "zvanična stranica proizvoda + šifra artikla + specifikacija + prodajno pakovanje (KP)" : "nema šifru ili prodajno pakovanje",
      localSlug: productRow.get(product.sourceKey).localSlug,
      finalStatus: productRow.get(product.sourceKey).finalStatus,
    };
  });

/* -- 5. Sukobi izvora ------------------------------------------------------- */

const conflictRows = source.products.flatMap((product) =>
  product.conflicts
    .filter((conflict) => ["SPECIFICATION_DIFFERS", "ARTICLE_NUMBER_DIFFERS", "SALES_PACK_DIFFERS", "NO_PRODUCT_PAGE", "VARIANT_ONLY_IN_CATALOGUE", "VARIANT_ONLY_ON_WEBSITE"].includes(conflict.type))
    .map((conflict) => {
      const imported = dataset.products.find((entry) => entry.sourceKey === product.sourceKey);
      const variant = imported?.variants.find((entry) => entry.articleNumber === conflict.articleNumber);
      return {
        product: product.officialName,
        type: conflict.type,
        articleNumber: conflict.articleNumber ?? conflict.articleNumbers ?? null,
        catalogueValue: conflict.catalogue ?? null,
        websiteValue: conflict.website ?? null,
        currentImportedValue: variant ? variant.officialSpecification : imported ? "(proizvod uvezen)" : "(nije uvezeno)",
        productStatus: productRow.get(product.sourceKey).finalStatus,
      };
    }),
);

/* -- Upis ------------------------------------------------------------------- */

const report = {
  catalogue: CATALOGUE.title,
  products: { total: products.length, byStatus: productTotals, sumOfStatuses: productSum },
  articles: { total: articles.length, byStatus: articleTotals, sumOfStatuses: articleSum, integrity: integrityTotals, supersededCatalogueArticlesOutsideTotal: superseded, distinctOfficialArticleNumbers: accounted.size },
  new: newBreakdown,
  parity,
  merchandising,
  coverage,
  conflicts: conflictRows,
  failures,
};
writeJson(path.join(REPORT_DIR, "reconciliation.generated.json"), { ...report, productRows: products, articleRows: articles });

const cell = (value) => `"${String(Array.isArray(value) ? value.join(" ") : value ?? "").replace(/"/g, '""')}"`;
const csv = (rows, columns) => `${[columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\n")}\n`;
writeFileSync(path.join(REPORT_DIR, "reconciliation-products.generated.csv"), csv(products, ["finalStatus", "officialName", "officialSubtitle", "officialSourceUrl", "cataloguePresence", "websitePresence", "articleNumbers", "newFlag", "newInCatalogue", "newOnWebsite", "localSlug", "reason", "conflicts"]));
writeFileSync(path.join(REPORT_DIR, "reconciliation-articles.generated.csv"), csv(articles, ["articleNumber", "officialSpecification", "officialName", "inCatalogue", "onWebsite", "finalStatus", "localSlug", "runtimeOwners", "integrity"]));

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
