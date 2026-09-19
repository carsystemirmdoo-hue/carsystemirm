#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 3 — jedinstveni izvorni dataset (sajt × PDF katalog).
 *
 * Ključ spajanja je ISKLJUČIVO zvanična šifra artikla. Naziv se ne koristi za
 * spajanje izvora: PDF porodica koja sa stranicom sajta ne deli nijednu šifru
 * ostaje zasebna (`CATALOGUE_ONLY`), ma koliko joj naziv ličio.
 *
 * Klasifikacija proizvoda:
 *   WEBSITE_AND_CATALOGUE — stranica sajta čija je bar jedna šifra i u PDF-u
 *   WEBSITE_ONLY          — aktivna stranica, nijedna šifra u PDF-u (ULAZI u katalog)
 *   CATALOGUE_ONLY        — PDF porodica bez ijedne šifre na sajtu
 *   SOURCE_CONFLICT       — dodatna oznaka kada se zvanični izvori ne slažu
 *
 * Vlasništvo šifre: šifra koja se pojavljuje na više stranica sajta dobija
 * JEDNOG vlasnika po determinističkom pravilu (vidi `resolveOwner`), a na
 * ostalim stranicama ostaje zabeležena kao `sharedFrom` — nijedna se ne gubi i
 * nijedna nije aktivna na dva proizvoda.
 *
 * Izlaz: data/carfit-sync/source-products.generated.json
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { componentRole } from "./lib/components.mjs";

const website = readJson(PATHS.rawWebsite);
const catalogue = readJson(PATHS.rawCatalogue);
const decisions = readJson(PATHS.decisions, { source: {}, articles: {}, local: {} });
if (!website || !catalogue) throw new Error("Nedostaje RAW dataset: prvo `npm run carfit:sync:acquire`.");

/* -- PDF: jedan zapis po šifri ------------------------------------------------------ */

const catalogueByArticle = new Map();
for (const row of catalogue.articles) {
  const list = catalogueByArticle.get(row.articleNumber) ?? [];
  list.push(row);
  catalogueByArticle.set(row.articleNumber, list);
}
const catalogueFamilyOf = (row) => (row.familyIndex === null ? null : catalogue.families[row.familyIndex]);

/* -- Sajt: vlasnik šifre -------------------------------------------------------------- */

const pagesByArticle = new Map();
for (const product of website.products) {
  for (const variant of product.variants) {
    const list = pagesByArticle.get(variant.articleNumber) ?? [];
    list.push({ product, variant });
    pagesByArticle.set(variant.articleNumber, list);
  }
}

/**
 * Šifra na više stranica. Pravilo (redom, prvo koje odluči):
 *   0. ručna odluka `manual-decisions.json → articles.<šifra>.owner`,
 *   1. stranica na kojoj je šifra GLAVNA komponenta (nije učvršćivač/razređivač),
 *   2a. stranica čije druge šifre dele prefiks serije (9-171-xxxx),
 *   2b. stranica čije druge šifre stoje u istoj PDF porodici,
 *   3. starija objava (manji WordPress ID) — stabilno i ponovljivo.
 */
function resolveOwner(articleNumber, occurrences) {
  const manual = decisions.articles?.[articleNumber]?.owner;
  if (manual && occurrences.some((entry) => entry.product.sourceKey === manual)) {
    return { owner: manual, rule: "manual-decision" };
  }
  const main = occurrences.filter((entry) => componentRole(entry.variant.component) === "main");
  if (main.length === 1) return { owner: main[0].product.sourceKey, rule: "main-component" };

  const pool = main.length ? main : occurrences;

  // 2a. Serija: C.A.R.FIT numeriše porodicu istim prefiksom (9-171-0905 / -1205 / -1905).
  // Stranica čije DRUGE šifre dele prefiks je matična stranica te serije.
  const prefix = articleNumber.slice(0, articleNumber.lastIndexOf("-"));
  // „Druga šifra” svedoči samo ako je ISKLJUČIVO na toj stranici — inače bi par
  // deljenih šifara (7-401-1000 / 7-401-5000) svedočio sam za sebe na obe stranice.
  const exclusive = (other) => new Set((pagesByArticle.get(other.articleNumber) ?? []).map((entry) => entry.product.sourceKey)).size === 1;
  const series = pool.filter((entry) => entry.product.variants.some((other) => exclusive(other) && other.articleNumber.startsWith(`${prefix}-`)));
  if (series.length === 1) return { owner: series[0].product.sourceKey, rule: "article-series-prefix" };

  // 2b. PDF porodica: tabela (i njen nastavak na istoj strani pod istim naslovom)
  // u kojoj je šifra sadrži i druge šifre tačno jedne od stranica.
  const familyKey = (row) => {
    const family = catalogueFamilyOf(row);
    return family ? `${family.pdfPage}:${family.name}` : null;
  };
  const key = catalogueByArticle.get(articleNumber)?.map(familyKey).find(Boolean) ?? null;
  if (key) {
    const sharing = pool.filter((entry) =>
      entry.product.variants.some(
        (other) => exclusive(other) && catalogueByArticle.get(other.articleNumber)?.some((row) => familyKey(row) === key),
      ),
    );
    if (sharing.length === 1) return { owner: sharing[0].product.sourceKey, rule: "catalogue-family" };
  }
  const oldest = [...pool].sort((a, b) => a.product.id - b.product.id)[0];
  return { owner: oldest.product.sourceKey, rule: "oldest-page" };
}

const sharedArticles = [];
const ownerOf = new Map();
for (const [articleNumber, allOccurrences] of pagesByArticle) {
  // Ponavljanje na istoj stranici nije deljenje između proizvoda.
  const occurrences = [...new Map(allOccurrences.map((entry) => [entry.product.sourceKey, entry])).values()];
  if (occurrences.length === 1) {
    ownerOf.set(articleNumber, occurrences[0].product.sourceKey);
    continue;
  }
  const { owner, rule } = resolveOwner(articleNumber, occurrences);
  ownerOf.set(articleNumber, owner);
  sharedArticles.push({
    articleNumber,
    pages: occurrences.map((entry) => ({ sourceKey: entry.product.sourceKey, officialName: entry.product.officialName, component: entry.variant.component, descriptor: entry.variant.descriptor })),
    owner,
    rule,
  });
}

/* -- Konflikti izvora ------------------------------------------------------------------ */

const conflicts = [];
const normalizeMeasure = (value) => (value ? value.replace(",", ".").replace(/\s+/g, "").toLowerCase().replace(/^0+(?=\d)/, "") : null);
const sameMeasure = (a, b) => {
  const x = /^([\d.]+)(.*)$/.exec(normalizeMeasure(a) ?? "");
  const y = /^([\d.]+)(.*)$/.exec(normalizeMeasure(b) ?? "");
  if (!x || !y) return true;
  const factor = { l: 1000, ml: 1, kg: 1000, g: 1 };
  const xv = Number(x[1]) * (factor[x[2]] ?? 1);
  const yv = Number(y[1]) * (factor[y[2]] ?? 1);
  return Math.abs(xv - yv) < 1e-6;
};

for (const shared of sharedArticles) {
  conflicts.push({
    type: "ARTICLE_ON_MULTIPLE_WEBSITE_PAGES",
    articleNumber: shared.articleNumber,
    detail: shared.pages.map((page) => `${page.officialName} (${page.descriptor ?? "bez opisa"})`).join(" ↔ "),
    resolution: `vlasnik: ${shared.owner} (pravilo: ${shared.rule}); na ostalim stranicama šifra ostaje zabeležena kao deljena`,
  });
}
for (const duplicate of catalogue.meta.duplicateRows) {
  if (duplicate.sameText) continue;
  conflicts.push({
    type: "CATALOGUE_ARTICLE_LISTED_TWICE_WITH_DIFFERENT_TEXT",
    articleNumber: duplicate.articleNumber,
    detail: duplicate.rows.map((row) => `str. ${row.pdfPage}: ${row.rowText}`).join(" ↔ "),
    resolution: "štamparska greška u PDF-u; merodavan je opis sa aktivne stranice sajta, a PDF red se ne koristi za atribute",
  });
}

/* -- Proizvodi sa sajta ------------------------------------------------------------------ */

/** Da li poslednja četiri mesta šifre nose datu meru (P1000 → „1000”, 3.6 L → „360x”, 0.5 L → „050x”). */
function encodedInArticle(articleNumber, key, value) {
  const suffix = articleNumber.split("-").pop().replace(/\D/g, "");
  if (suffix.length !== 4) return false;
  if (key === "grit") return suffix === value.replace(/\D/g, "").padStart(4, "0");
  const measure = /^([\d.]+)\s?(ml|l|kg|g)$/i.exec(value.replace(",", "."));
  if (!measure) return false;
  const base = Number(measure[1]) * (/^(l|kg)$/i.test(measure[2]) ? 1000 : 1);
  return suffix.slice(0, 3) === String(Math.round(base / 10)).padStart(3, "0");
}

/** Ista šifra dva puta na ISTOJ stranici (greška u unosu na sajtu): jedan red, oba opisa. */
function mergeRepeatedOnPage(page) {
  const byArticle = new Map();
  for (const variant of page.variants) {
    const known = byArticle.get(variant.articleNumber);
    if (!known) {
      byArticle.set(variant.articleNumber, { ...variant, repeatedDescriptors: null });
      continue;
    }
    if (known.descriptor !== variant.descriptor) {
      known.repeatedDescriptors = [...(known.repeatedDescriptors ?? [known.descriptor]), variant.descriptor];
      known.descriptor = known.repeatedDescriptors.join(" / ");
    }
  }
  return [...byArticle.values()];
}

const products = website.products.map((page) => {
  const pageVariants = mergeRepeatedOnPage(page);
  for (const variant of pageVariants) {
    if (!variant.repeatedDescriptors) continue;
    conflicts.push({
      type: "ARTICLE_LISTED_TWICE_ON_SAME_PAGE",
      articleNumber: variant.articleNumber,
      sourceKey: page.sourceKey,
      detail: `${page.officialName}: ${variant.repeatedDescriptors.map((text) => `„${text}”`).join(" ↔ ")}`,
      resolution: "jedna šifra = jedan red; oba zvanična opisa ostaju u oznaci varijante dok proizvođač ne ispravi stranicu",
    });
  }
  const variants = pageVariants.map((variant) => {
    const rows = catalogueByArticle.get(variant.articleNumber) ?? [];
    const ambiguousCatalogueRow = rows.length > 1 && new Set(rows.map((row) => row.rowText)).size > 1;
    const row = ambiguousCatalogueRow ? null : rows[0] ?? null;
    const owner = ownerOf.get(variant.articleNumber);

    if (row && !variant.shorthandOf && !pageVariants.some((other) => other.shorthandOf && other.shorthandOf.startsWith(variant.articleNumber))) {
      const grit = (value) => value.replace(/^P0+/, "P");
      for (const key of ["volume", "weight", "grit"]) {
        const a = variant.attributes?.[key];
        const b = row.attributes?.[key];
        if (a && b && (key === "grit" ? grit(a) !== grit(b) : !sameMeasure(a, b))) {
          // Treći zvanični svedok je SAMA šifra: C.A.R.FIT u poslednja četiri mesta
          // upisuje meru (6-500-1000 = P1000, 4-205-3600 = 3,6 L, 7-321-0501 = 0,5 L).
          const webEncoded = encodedInArticle(variant.articleNumber, key, a);
          const catEncoded = encodedInArticle(variant.articleNumber, key, b);
          const preferred = webEncoded === catEncoded ? "website" : catEncoded ? "catalogue" : "website";
          if (preferred === "catalogue") {
            variant.descriptorCorrection = { key, from: a, to: b, websiteDescriptor: variant.descriptor };
            variant.descriptor = key === "grit"
              ? variant.descriptor.replace(/P\s?\d{2,5}/i, grit(b))
              : variant.descriptor.replace(/\d+(?:[.,]\d+)?\s?(?:ml|l|kg|g)\b/i, b.replace(" L", " l"));
            variant.attributes = { ...variant.attributes, [key]: key === "grit" ? grit(b) : b };
          }
          conflicts.push({
            type: "WEBSITE_VS_CATALOGUE_ATTRIBUTE",
            articleNumber: variant.articleNumber,
            sourceKey: page.sourceKey,
            detail: `${key}: sajt „${a}” ↔ katalog „${b}” (${row.rowText})`,
            resolution:
              preferred === "catalogue"
                ? `šifra ${variant.articleNumber} sama nosi „${b}” → greška u unosu na sajtu; prikazuje se vrednost iz kataloga`
                : webEncoded
                  ? `šifra ${variant.articleNumber} sama nosi „${a}” → greška u PDF-u; merodavna je stranica sajta`
                  : "merodavna je aktivna stranica sajta",
          });
        }
      }
    }

    return {
      articleNumber: variant.articleNumber,
      component: variant.component,
      componentRole: componentRole(variant.component),
      descriptor: variant.descriptor,
      shorthandOf: variant.shorthandOf ?? null,
      descriptorCorrection: variant.descriptorCorrection ?? null,
      possibleTypoOf: null,
      alternateArticleNumbers: [],
      descriptorRepeatedOnWebsite: false,
      attributes: variant.attributes,
      onWebsite: true,
      inCatalogue: rows.length > 0,
      cataloguePage: rows[0]?.pdfPage ?? null,
      catalogueRowText: row?.rowText ?? null,
      cataloguePcsPerPack: row?.pcsPerPack ?? null,
      owned: owner === page.sourceKey,
      sharedFrom: owner === page.sourceKey ? null : owner,
    };
  });

  // Isti opis uz RAZLIČITE šifre (kopirana linija na sajtu), a PDF ih razlikuje:
  // sajt ne može biti tačan za obe, pa PDF red ulazi u ulaz za oznaku varijante.
  const byDescriptor = new Map();
  for (const variant of variants) {
    if (!variant.descriptor || variant.shorthandOf) continue;
    const key = `${variant.component ?? ""}|${variant.descriptor}`;
    byDescriptor.set(key, [...(byDescriptor.get(key) ?? []), variant]);
  }
  for (const group of byDescriptor.values()) {
    if (group.length < 2 || group.some((variant) => !variant.catalogueRowText)) continue;
    if (new Set(group.map((variant) => variant.catalogueRowText)).size !== group.length) continue;
    for (const variant of group) variant.descriptorRepeatedOnWebsite = true;
    conflicts.push({
      type: "WEBSITE_DESCRIPTOR_REPEATED_FOR_DIFFERENT_ARTICLES",
      articleNumber: group.map((variant) => variant.articleNumber).join(", "),
      sourceKey: page.sourceKey,
      detail: `sajt: „${group[0].descriptor}” uz sve navedene šifre ↔ katalog: ${group.map((variant) => `${variant.articleNumber} „${variant.catalogueRowText}”`).join("; ")}`,
      resolution: "sajt ne može biti tačan za sve šifre; varijante se razlikuju prema redu iz PDF kataloga",
    });
  }

  const inCatalogue = variants.some((variant) => variant.inCatalogue);
  const catalogueFamilies = [
    ...new Set(
      variants.flatMap((variant) => (catalogueByArticle.get(variant.articleNumber) ?? []).map((row) => catalogueFamilyOf(row)?.name).filter(Boolean)),
    ),
  ];

  return {
    sourceKey: page.sourceKey,
    websiteId: page.id,
    url: page.url,
    officialName: page.officialName,
    officialNameDe: page.officialNameDe,
    category: page.category,
    subcategory: page.subcategory,
    classification: inCatalogue ? "WEBSITE_AND_CATALOGUE" : "WEBSITE_ONLY",
    active: page.status.active,
    // Naručiv = stranica navodi bar jednu šifru (svoju ili deljenu sa drugom stranicom).
    orderable: variants.length > 0,
    articleNumberSource: variants.length ? "website" : null,
    catalogueFamilies,
    cataloguePages: [...new Set(variants.map((variant) => variant.cataloguePage).filter(Boolean))].sort((a, b) => a - b),
    variants,
    catalogueOnlyVariants: [],
    content: {
      description: page.description,
      application: page.application,
      features: page.features,
      substrates: page.substrates,
      scopeOfDelivery: page.scopeOfDelivery,
      additionalInformation: page.additionalInformation,
      technicalData: page.technicalData,
      otherSections: page.otherSections,
    },
    facts: { colour: page.colour, base: page.base, density: page.density, voc: page.voc, flashPoint: page.flashPoint, dimensions: page.dimensions, grit: page.grit },
    images: page.images,
    documents: page.documents,
    modifiedAt: page.modifiedAt,
    crawledAt: page.crawledAt,
  };
});

const productBySourceKey = new Map(products.map((product) => [product.sourceKey, product]));

/* -- Šifre koje postoje samo u PDF-u ----------------------------------------------------- */

const websiteArticles = new Set(pagesByArticle.keys());
const catalogueOnlyRows = catalogue.articles.filter((row) => !websiteArticles.has(row.articleNumber));

/**
 * PDF red bez šifre na sajtu:
 *   - ako njegova PDF porodica (ista tabela) deli bar jednu šifru sa TAČNO jednom
 *     stranicom sajta → to je varijanta tog proizvoda koju sajt još ne navodi
 *     (`catalogueOnlyVariants`, `onWebsite: false`);
 *   - inače → zasebna porodica `CATALOGUE_ONLY`.
 */
const catalogueOnlyFamilies = new Map();
for (const row of catalogueOnlyRows) {
  const family = catalogueFamilyOf(row);
  const siblings = (family?.articleNumbers ?? []).filter((article) => websiteArticles.has(article));
  const owners = [...new Set(siblings.map((article) => ownerOf.get(article)))];
  if (owners.length === 1) {
    const target = productBySourceKey.get(owners[0]);
    if (!target.catalogueOnlyVariants.some((variant) => variant.articleNumber === row.articleNumber)) {
      target.catalogueOnlyVariants.push({
        articleNumber: row.articleNumber,
        rowText: row.rowText,
        descriptionEn: row.descriptionEn,
        attributes: row.attributes,
        pcsPerPack: row.pcsPerPack,
        cataloguePage: row.pdfPage,
        onWebsite: false,
        inCatalogue: true,
        evidence: `ista PDF tabela („${family.name}”, str. ${row.pdfPage}) kao šifre ${siblings.slice(0, 3).join(", ")}`,
      });
    }
    continue;
  }
  const key = `${row.pdfPage}:${family?.name ?? "?"}:${family?.index ?? "?"}`;
  const entry = catalogueOnlyFamilies.get(key) ?? {
    sourceKey: `catalogue/${String(row.pdfPage).padStart(2, "0")}-${(family?.name ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    classification: "CATALOGUE_ONLY",
    // Tabela bez sopstvenog naslova nasleđuje naslov prethodne — to NIJE njen naziv.
    officialName: family?.inheritedHeading ? null : family?.name ?? null,
    inheritedHeadingFrom: family?.inheritedHeading ? family.name : null,
    headingLines: family?.inheritedHeading ? [] : family?.headingLines ?? [],
    chapter: family?.chapter ?? null,
    cataloguePage: row.pdfPage,
    ambiguousWebsiteOwners: owners.length > 1 ? owners : [],
    articles: [],
  };
  entry.articles.push({ articleNumber: row.articleNumber, rowText: row.rowText, descriptionEn: row.descriptionEn, pcsPerPack: row.pcsPerPack, attributes: row.attributes });
  catalogueOnlyFamilies.set(key, entry);
}

/**
 * Moguća slovna greška u ŠIFRI na sajtu: šifra koje nema u PDF-u, a od PDF šifre
 * iste tabele (koje nema na sajtu) razlikuje se u TAČNO jednoj cifri
 * (sajt 4-304-3600 ↔ katalog 4-204-3600). Obe šifre ostaju zabeležene — ništa se
 * ne briše — ali kao JEDNA varijanta (vidi niže); opis varijante sa sajta se
 * ispravlja samo kada meru potvrđuju i PDF red i sama šifra.
 */
const oneDigitApart = (a, b) => a.length === b.length && [...a].filter((char, index) => char !== b[index]).length === 1;
// Jedna cifra razlike je redovna pojava između SERIJA (3-226-0001 adapter ↔ 3-228-0001
// adapter). Greška je verovatna samo kada prefiks šifre sa sajta ne postoji NIGDE
// drugde (ni na sajtu ni u PDF-u), a obe strane navode istu boju.
const seriesPrefix = (article) => article.slice(0, article.lastIndexOf("-"));
const prefixCount = new Map();
for (const article of new Set([...websiteArticles, ...catalogueByArticle.keys()])) prefixCount.set(seriesPrefix(article), (prefixCount.get(seriesPrefix(article)) ?? 0) + 1);
for (const product of products) {
  for (const variant of product.variants.filter((entry) => !entry.inCatalogue && !entry.shorthandOf)) {
    if (prefixCount.get(seriesPrefix(variant.articleNumber)) !== 1) continue;
    const twin = product.catalogueOnlyVariants.find(
      (candidate) =>
        oneDigitApart(candidate.articleNumber, variant.articleNumber) &&
        // isti zvanično navedeni atribut boje na obe strane (sajt „black” ↔ katalog „black”)
        Boolean(variant.attributes?.color) && variant.attributes.color === candidate.attributes?.color,
    );
    if (!twin) continue;
    let corrected = null;
    for (const key of ["volume", "weight"]) {
      const web = variant.attributes?.[key];
      const cat = twin.attributes?.[key];
      if (web && cat && !sameMeasure(web, cat) && encodedInArticle(variant.articleNumber, key, cat) && !encodedInArticle(variant.articleNumber, key, web)) {
        variant.descriptorCorrection = { key, from: web, to: cat, websiteDescriptor: variant.descriptor };
        variant.descriptor = variant.descriptor.replace(/\d+(?:[.,]\d+)?\s?(?:ml|l|kg|g)\b/i, cat.replace(" L", " l"));
        variant.attributes = { ...variant.attributes, [key]: cat };
        corrected = `${web} → ${cat}`;
      }
    }
    // Nema dokaza da postoje DVA artikla: ista boja, ista mera, jedna cifra razlike.
    // Zato je to JEDNA varijanta sa dva zvanična zapisa šifre — šifra sa sajta je
    // red tabele (sajt je merodavan za trenutno stanje), a šifra iz PDF-a ostaje
    // uz nju kao alternativni zapis: pretraživa, ali nije druga varijanta.
    variant.possibleTypoOf = twin.articleNumber;
    variant.alternateArticleNumbers = [
      ...(variant.alternateArticleNumbers ?? []),
      { articleNumber: twin.articleNumber, source: `${catalogue.meta.title}, str. ${twin.cataloguePage}`, rowText: twin.rowText, pcsPerPack: twin.pcsPerPack },
    ];
    variant.cataloguePcsPerPack ??= twin.pcsPerPack;
    product.catalogueOnlyVariants = product.catalogueOnlyVariants.filter((candidate) => candidate !== twin);
    conflicts.push({
      type: "POSSIBLE_ARTICLE_NUMBER_TYPO",
      articleNumber: variant.articleNumber,
      sourceKey: product.sourceKey,
      detail: `sajt ${variant.articleNumber} („${variant.descriptorCorrection?.websiteDescriptor ?? variant.descriptor}”) ↔ katalog ${twin.articleNumber} („${twin.rowText}”) — razlika u jednoj cifri`,
      resolution: `jedna varijanta: red tabele nosi šifru sa sajta (${variant.articleNumber}), šifra iz PDF-a (${twin.articleNumber}) je alternativni zapis iste varijante — pretraživa, nije zasebna varijanta${corrected ? `; mera varijante sa sajta ispravljena (${corrected}) jer je nose i šifra i PDF red` : ""}`,
    });
  }
}

/**
 * Stranica sajta BEZ ijedne šifre (proizvođač je na stranici nije upisao):
 * šifra se preuzima iz PDF porodice ISTOG naziva (jednina/množina se svode).
 * Ovo je jedino mesto gde naziv povezuje izvore, i važi samo kada stranica nema
 * nijednu šifru — dakle ne može da pregazi nijedan podatak sa sajta.
 */
const foldName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/s\b/g, "");
for (const product of products) {
  if (product.variants.length || product.catalogueOnlyVariants.length) continue;
  const candidates = [...catalogueOnlyFamilies.entries()].filter(([, family]) => family.officialName && foldName(family.officialName) === foldName(product.officialName));
  if (candidates.length !== 1) continue;
  const [key, family] = candidates[0];
  product.catalogueOnlyVariants = family.articles.map((article) => ({
    articleNumber: article.articleNumber,
    rowText: article.rowText,
    descriptionEn: article.descriptionEn,
    attributes: article.attributes,
    pcsPerPack: article.pcsPerPack,
    cataloguePage: family.cataloguePage,
    onWebsite: false,
    inCatalogue: true,
    evidence: `stranica sajta ne navodi šifru; PDF porodica istog naziva („${family.officialName}”, str. ${family.cataloguePage})`,
  }));
  product.classification = "WEBSITE_AND_CATALOGUE";
  product.orderable = true;
  product.articleNumberSource = "catalogue-by-exact-name";
  product.cataloguePages = [family.cataloguePage];
  catalogueOnlyFamilies.delete(key);
}

/* -- Zbir ---------------------------------------------------------------------------------- */

for (const product of products) {
  if (conflicts.some((conflict) => conflict.sourceKey === product.sourceKey || product.variants.some((variant) => variant.articleNumber === conflict.articleNumber))) {
    product.sourceConflict = true;
  }
}

const ownedArticles = products.flatMap((product) => product.variants.filter((variant) => variant.owned).map((variant) => variant.articleNumber));
const count = (label) => products.filter((product) => product.classification === label).length;

writeJson(PATHS.source, {
  meta: {
    website: { source: website.meta.source, crawledAt: website.meta.crawledAt, productPages: website.meta.productPages, activeProductPages: website.meta.activeProductPages },
    catalogue: { title: catalogue.meta.title, sourceUrl: catalogue.meta.sourceUrl, sha256: catalogue.meta.sha256, pdfPages: catalogue.meta.pdfPages, downloadedAt: catalogue.meta.downloadedAt },
    rule: "aktivna stranica na carfitrepair.com → PDF katalog → lokalni podaci; ključ spajanja je šifra artikla",
  },
  summary: {
    websiteProducts: products.length,
    websiteProductsActive: products.filter((product) => product.active).length,
    websiteProductsWithoutArticleNumber: products.filter((product) => !product.variants.length).map((product) => product.sourceKey),
    websiteArticleNumbers: websiteArticles.size,
    websiteArticleNumbersOwnedOnce: new Set(ownedArticles).size,
    catalogueArticleNumbers: catalogueByArticle.size,
    articlesInBoth: [...websiteArticles].filter((article) => catalogueByArticle.has(article)).length,
    articlesWebsiteOnly: [...websiteArticles].filter((article) => !catalogueByArticle.has(article)).length,
    articlesCatalogueOnly: catalogueOnlyRows.length,
    articlesCatalogueOnlyHeld: [...catalogueOnlyFamilies.values()].reduce((sum, family) => sum + family.articles.length, 0),
    articlesCatalogueOnlyAttachedAsVariants: products.reduce((sum, product) => sum + product.catalogueOnlyVariants.length, 0),
    articlesCatalogueOnlyAsAlternateOfWebsiteArticle: products.reduce((sum, product) => sum + product.variants.reduce((inner, variant) => inner + (variant.alternateArticleNumbers?.length ?? 0), 0), 0),
    WEBSITE_AND_CATALOGUE: count("WEBSITE_AND_CATALOGUE"),
    WEBSITE_ONLY: count("WEBSITE_ONLY"),
    CATALOGUE_ONLY: catalogueOnlyFamilies.size,
    SOURCE_CONFLICT: conflicts.length,
    sharedArticles: sharedArticles.length,
    productsWithComponents: products.filter((product) => product.variants.some((variant) => variant.component)).length,
  },
  sharedArticles,
  conflicts,
  products,
  catalogueOnly: [...catalogueOnlyFamilies.values()],
});

const summary = readJson(PATHS.source).summary;
console.log(
  `source: ${summary.websiteProducts} proizvoda sa sajta (${summary.WEBSITE_AND_CATALOGUE} i u PDF-u, ${summary.WEBSITE_ONLY} samo sajt), ` +
    `${summary.CATALOGUE_ONLY} porodica samo u PDF-u, ${summary.SOURCE_CONFLICT} konflikata`,
);
