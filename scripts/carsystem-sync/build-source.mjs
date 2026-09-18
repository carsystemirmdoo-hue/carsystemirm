#!/usr/bin/env node
/**
 * Carsystem sync · korak 2 — spajanje dva RAW izvora u jedan source dataset.
 *
 * Spoj ide ISKLJUČIVO po šifri artikla. Naziv služi samo da se objasni šifra
 * koja postoji u jednom izvoru a ne u drugom — nikad da se dva zapisa spoje.
 *
 *   katalog ∩ sajt    → artikal je u aktuelnom asortimanu i ima stranicu
 *   samo sajt         → `inCatalogue: false` (moguć phase-out; ne uvozi se kao
 *                        NOV proizvod bez odluke, vidi plan.mjs)
 *   samo katalog      → varijanta postojeće stranice, promenjena šifra ili
 *                        proizvod bez stranice (nema slike/opisa → čeka)
 *
 * Svaka razlika između izvora se beleži u `conflicts`; ništa se ne „ispravlja”
 * tiho. Korak ne dira mrežu i može se ponavljati nad istim RAW fajlovima.
 *
 * Izlaz: data/carsystem-sync/source-products.generated.json
 */

import { CATALOGUE, PATHS } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/http.mjs";
import { nameKey, parseSpecification, parseSubtitle, specKey } from "./lib/attributes.mjs";

const website = readJson(PATHS.rawWebsite);
const catalogue = readJson(PATHS.rawCatalogue);
if (!website || !catalogue) {
  throw new Error("Nedostaje RAW dataset — prvo pokrenuti acquire-website i acquire-catalogue.");
}

/** Poslednja jedna ili dve cele vrednosti reda tabele su SP i MOQ. */
function splitCatalogueRow(row) {
  const tokens = row.split(/\s+/);
  const numbers = [];
  while (tokens.length > 1 && numbers.length < 2 && /^\d+$/.test(tokens[tokens.length - 1])) {
    numbers.unshift(tokens.pop());
  }
  return { specification: tokens.join(" ").trim() || null, salesPack: numbers[0] ?? null, moq: numbers[1] ?? null };
}

const blocksByArticle = new Map();
for (const block of catalogue.products) {
  for (const article of block.articles) {
    if (!blocksByArticle.has(article.articleNumber)) blocksByArticle.set(article.articleNumber, { block, article });
  }
}

const websiteArticles = new Map();
for (const product of website.products) {
  for (const variant of product.variants) websiteArticles.set(variant.articleNumber, product);
}

const products = [];
const claimedCatalogueArticles = new Set();

for (const page of website.products) {
  const conflicts = [];
  const blocks = new Set();

  const articles = page.variants.map((variant) => {
    const hit = blocksByArticle.get(variant.articleNumber);
    const sources = ["website"];
    let catalogueRow = null;
    if (hit) {
      sources.push("catalogue");
      blocks.add(hit.block);
      claimedCatalogueArticles.add(variant.articleNumber);
      catalogueRow = splitCatalogueRow(hit.article.row);

      // Redosled delova („Fine / brown / P 240” ↔ „Fine / P 240 / brown”) nije
      // razlika u podatku; poredi se skup delova specifikacije.
      const parts = (value) =>
        String(value ?? "").split("/").map((part) => specKey(part)).filter(Boolean).sort().join("|");
      // Prelomljen red tabele u PDF-u ostavlja SKRAĆENU specifikaciju (ostatak
      // je iza kolona SP/MOQ) — prefiks zato nije sukob, nego artefakt preloma.
      const wrapped =
        catalogueRow.specification && specKey(variant.specification).startsWith(specKey(catalogueRow.specification));
      // Red PDF-a bez ikakve specifikacije u svojoj liniji (šifra sama u redu,
      // tekst u naredna tri) znači „nepročitano”, ne „drugačije”.
      if (variant.specification && catalogueRow.specification && !wrapped && parts(variant.specification) !== parts(catalogueRow.specification)) {
        conflicts.push({
          type: "SPECIFICATION_DIFFERS",
          articleNumber: variant.articleNumber,
          website: variant.specification,
          catalogue: catalogueRow.specification,
        });
      }
      if (catalogueRow.salesPack && variant.salesPack && catalogueRow.salesPack !== variant.salesPack.replace(/\D/g, "")) {
        conflicts.push({
          type: "SALES_PACK_DIFFERS",
          articleNumber: variant.articleNumber,
          website: variant.salesPack,
          catalogue: catalogueRow.salesPack,
        });
      }
    }
    return {
      articleNumber: variant.articleNumber,
      specification: variant.specification,
      salesPack: variant.salesPack,
      packagingUnit: variant.packagingUnit,
      attributes: parseSpecification(variant.specification),
      sources,
      catalogueRow,
      sdsEndpoint: variant.sdsEndpoint,
      sdsLanguages: variant.sdsLanguages,
    };
  });

  // Artikli istog kataloškog bloka koje stranica ne navodi: varijanta postoji u
  // referentnom katalogu, pa ulazi sa jasnim poreklom i prijavljuje se.
  for (const block of blocks) {
    for (const article of block.articles) {
      if (websiteArticles.has(article.articleNumber) || claimedCatalogueArticles.has(article.articleNumber)) continue;
      claimedCatalogueArticles.add(article.articleNumber);
      const row = splitCatalogueRow(article.row);
      articles.push({
        articleNumber: article.articleNumber,
        specification: row.specification,
        salesPack: row.salesPack,
        packagingUnit: row.moq,
        attributes: parseSpecification(row.specification),
        sources: ["catalogue"],
        catalogueRow: row,
        sdsEndpoint: null,
        sdsLanguages: [],
      });
      conflicts.push({
        type: "VARIANT_ONLY_IN_CATALOGUE",
        articleNumber: article.articleNumber,
        catalogue: row.specification,
        pdfPage: block.pdfPage,
      });
    }
  }

  const blockList = [...blocks];
  const catalogueNames = [...new Set(blockList.map((block) => block.name).filter(Boolean))];
  const webName = nameKey(page.officialName);
  for (const name of catalogueNames) {
    const key = nameKey(name);
    if (key && webName && !key.includes(webName) && !webName.includes(key)) {
      conflicts.push({ type: "NAME_DIFFERS", website: page.officialName, catalogue: name });
    }
  }

  const inCatalogue = articles.some((article) => article.sources.includes("catalogue"));
  const webOnlyArticles = articles.filter((article) => !article.sources.includes("catalogue"));
  if (inCatalogue && webOnlyArticles.length) {
    conflicts.push({
      type: "VARIANT_ONLY_ON_WEBSITE",
      articleNumbers: webOnlyArticles.map((article) => article.articleNumber),
    });
  }

  products.push({
    sourceKey: `${page.categoryKey}/${page.slug}`,
    origin: "website+catalogue",
    // Aktivna stranica na carsystem.org je prvi autoritet za trenutni status proizvoda.
    active: page.active !== false,
    sourceUrl: page.sourceUrl,
    officialName: page.officialName,
    subtitle: page.subtitle,
    categoryKey: page.categoryKey,
    officialCategory: page.officialCategory,
    productAttributes: parseSubtitle(page.subtitle),
    officialDescription: page.officialDescription,
    sections: page.sections,
    articles,
    legacyArticleNumbers: [],
    images: page.images,
    documents: page.documents,
    videos: page.videos,
    recommendedProductUrls: page.recommendedProductUrls,
    relatedProductUrls: page.relatedProductUrls,
    listingPosition: page.listingPosition,
    catalogue: {
      edition: CATALOGUE.edition,
      inCatalogue,
      pdfPages: [...new Set(blockList.map((block) => block.pdfPage))].sort((a, b) => a - b),
      printedPages: [...new Set(blockList.flatMap((block) => block.printedPages))].sort((a, b) => a - b),
      names: catalogueNames,
      markedNew: blockList.some((block) => block.markedNew),
    },
    markedNewOnWebsite: page.markedNew,
    isNew: page.markedNew || blockList.some((block) => block.markedNew),
    conflicts,
  });
}

/* -- Šifre koje postoje samo u katalogu, van blokova vezanih za stranice ---- */

const pagesByName = new Map();
for (const product of products) {
  const key = nameKey(product.officialName);
  if (!pagesByName.has(key)) pagesByName.set(key, []);
  pagesByName.get(key).push(product);
}

for (const block of catalogue.products) {
  const orphans = block.articles.filter((article) => !claimedCatalogueArticles.has(article.articleNumber));
  if (!orphans.length) continue;
  for (const article of orphans) claimedCatalogueArticles.add(article.articleNumber);

  // Isti zvanični naziv na sajtu, ali druga šifra: artikal je prenumerisan u
  // jednom od izvora. Ne dodaje se kao varijanta (bio bi duplikat iste stvari).
  const sameName = block.name ? pagesByName.get(nameKey(block.name)) ?? [] : [];
  if (sameName.length === 1) {
    // Sajt je noviji izvor: šifra sa sajta je trenutna, kataloška ostaje kao
    // istorijski identifikator (kupac je može imati na odštampanom katalogu).
    sameName[0].legacyArticleNumbers = orphans.map((article) => ({
      articleNumber: article.articleNumber,
      specification: splitCatalogueRow(article.row).specification,
      source: `${CATALOGUE.title}, PDF str. ${block.pdfPage}`,
    }));
    sameName[0].catalogue.listedUnderOtherArticle = true;
    sameName[0].catalogue.pdfPages = [block.pdfPage];
    sameName[0].catalogue.printedPages = block.printedPages;
    sameName[0].conflicts.push({
      type: "ARTICLE_NUMBER_DIFFERS",
      website: sameName[0].articles.filter((a) => a.sources.includes("website")).map((a) => a.articleNumber),
      catalogue: orphans.map((article) => ({ articleNumber: article.articleNumber, row: article.row })),
      pdfPage: block.pdfPage,
      note: "Isti zvanični naziv, različita šifra artikla u katalogu i na sajtu.",
    });
    continue;
  }

  products.push({
    sourceKey: `catalogue/${orphans[0].articleNumber}`,
    origin: "catalogue-only",
    active: false,
    sourceUrl: `${CATALOGUE.pdfUrl}#page=${block.pdfPage}`,
    officialName: block.name,
    subtitle: block.subtitle,
    categoryKey: null,
    officialCategory: block.chapter,
    productAttributes: parseSubtitle(block.subtitle),
    officialDescription: null,
    sections: {},
    articles: orphans.map((article) => {
      const row = splitCatalogueRow(article.row);
      return {
        articleNumber: article.articleNumber,
        specification: row.specification,
        salesPack: row.salesPack,
        packagingUnit: row.moq,
        attributes: parseSpecification(row.specification),
        sources: ["catalogue"],
        catalogueRow: row,
        sdsEndpoint: null,
        sdsLanguages: [],
      };
    }),
    images: [],
    documents: [],
    videos: [],
    recommendedProductUrls: [],
    relatedProductUrls: [],
    listingPosition: null,
    catalogue: {
      edition: CATALOGUE.edition,
      inCatalogue: true,
      pdfPages: [block.pdfPage],
      printedPages: block.printedPages,
      names: [block.name].filter(Boolean),
      markedNew: block.markedNew,
    },
    markedNewOnWebsite: false,
    isNew: block.markedNew,
    conflicts: [{ type: "NO_PRODUCT_PAGE", note: "Proizvod je u katalogu, ali nema stranicu na carsystem.org." }],
  });
}

products.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));

const allArticles = products.flatMap((product) => product.articles.map((article) => article.articleNumber));
const duplicateArticles = [...new Set(allArticles.filter((article, index) => allArticles.indexOf(article) !== index))];

const conflictCounts = {};
for (const product of products) {
  for (const conflict of product.conflicts) conflictCounts[conflict.type] = (conflictCounts[conflict.type] ?? 0) + 1;
}

const summary = {
  catalogue: { title: CATALOGUE.title, sourceUrl: CATALOGUE.pdfUrl, sha256: catalogue.summary.sha256 },
  website: { source: website.summary.source, productPages: website.summary.productPages },
  sourceProducts: products.length,
  sourceVariants: allArticles.length,
  duplicateArticleNumbers: duplicateArticles,
  inCatalogue: products.filter((product) => product.catalogue.inCatalogue).length,
  activeWebsiteProducts: products.filter((product) => product.active).length,
  activeWebsiteArticles: products.filter((product) => product.active).reduce((sum, product) => sum + product.articles.filter((article) => article.sources.includes("website")).length, 0),
  websiteOnly: products.filter((product) => !product.catalogue.inCatalogue).length,
  catalogueOnly: products.filter((product) => product.origin === "catalogue-only").length,
  markedNew: products.filter((product) => product.isNew).length,
  byCategory: Object.fromEntries(
    [...new Set(products.map((product) => product.categoryKey ?? "catalogue-only"))]
      .sort()
      .map((key) => [key, products.filter((product) => (product.categoryKey ?? "catalogue-only") === key).length]),
  ),
  conflicts: conflictCounts,
};

writeJson(PATHS.source, { summary, products });
console.log(JSON.stringify(summary, null, 2));
