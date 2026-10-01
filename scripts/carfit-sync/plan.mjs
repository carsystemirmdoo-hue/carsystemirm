#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 6 — PLAN (dry run). Ne menja katalog.
 *
 * Ulaz:  source dataset, manifesti slika i dokumenata, naš runtime katalog,
 *        identity registar, ručne odluke, SR lokalizacija, taxonomy mapa.
 * Izlaz: reports/sync-plan.generated.json (+ .csv, SYNC_DRY_RUN.md) i ulaz za
 *        lokalizaciju u `.cache/carfit-sync/localization-input/`.
 *
 * Odluka po zvaničnom proizvodu (`action`):
 *   IMPORT                     ulazi u katalog (nov ili već uvezen — vidi `change`)
 *   MATCHED_EXISTING           već ga vodimo ručno → dopuna šifara, ne duplikat
 *   HELD_PENDING_DECISION      isključeno ručnom odlukom
 *   HELD_INACTIVE_PAGE         stranica više nije objavljena / ne vraća 200
 *   REPRESENTED_BY_OWNER       jedina šifra stranice pripada drugom proizvodu (isti artikal
 *                              pod drugim nazivom) → predstavlja ga vlasnik šifre
 *   HELD_NOT_ORDERABLE         stranica bez ijedne šifre, ni u PDF-u
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY     zvanična kategorija nema mapping
 *
 * WEBSITE_ONLY proizvod se uvozi ISTO kao i onaj koji je i u PDF-u: aktivna
 * stranica sa šifrom je dovoljan dokaz. PROBABLE ručni zapis ne zadržava svog
 * kandidata — zvanični proizvod se uvozi zasebno, a veza ide u `relatedLegacySlug`.
 *
 * Idempotentnost: slug se čita iz registra po `sourceKey` / šifri artikla, ne
 * izvodi se svaki put iz naziva. Isti izvor → isti plan → bajt-identičan dataset.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, CATALOGUE, PATHS } from "./lib/config.mjs";
import { isCompanionRole } from "./lib/components.mjs";
import { loadLocalProducts, matchLocalProduct } from "./lib/local-match.mjs";
import { contentHash, displayVariants } from "./lib/variants.mjs";

const source = readJson(PATHS.source);
const imageManifest = readJson(PATHS.imageManifest);
const documentManifest = readJson(PATHS.documentManifest, { documents: [] });
if (!source || !imageManifest) throw new Error("Nedostaje source dataset ili manifest slika — pokrenuti prethodne korake.");

const taxonomy = readJson(PATHS.taxonomyMap).categories;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { source: {}, articles: {}, local: {} });

/* -- Lokalizacija ------------------------------------------------------------------ */

const localization = {};
if (existsSync(PATHS.localizationDir)) {
  for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) {
    Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
  }
}

/* -- Taksonomija --------------------------------------------------------------------- */

function resolveTaxonomy(product) {
  const leaf = product.subcategory?.slug ?? product.category?.slug ?? null;
  const entry = leaf ? taxonomy[leaf] : null;
  if (!entry) return null;
  const rule = (entry.rules ?? []).find((candidate) => new RegExp(candidate.name, "i").test(product.officialName));
  const chosen = rule ?? entry.default;
  return {
    officialCategory: [product.category?.name, product.subcategory?.name].filter(Boolean).join(" › "),
    officialCategorySlug: leaf,
    category: chosen.category,
    programSlug: chosen.programSlug,
    phaseSlug: chosen.phaseSlug,
    visualType: chosen.visualType,
    packshotShade: Boolean(chosen.packshotShade),
    materialColour: Boolean(chosen.materialColour),
    rule: rule ? `name ~ /${rule.name}/` : "default",
  };
}

/* -- Naš katalog i matching ------------------------------------------------------------ */

// Prvo pokretanje: runtime katalog uvozi dataset kao modul, pa fajl mora da postoji
// i pre nego što ga apply prvi put napiše.
if (!existsSync(PATHS.siteDataset)) {
  writeJson(PATHS.siteDataset, { meta: { generator: "scripts/carfit-sync/apply.mjs", catalogue: CATALOGUE.title, products: 0, variants: 0 }, products: [], enrichments: {} });
}

const syncSlugs = new Set(Object.keys(registry.products));
const { local, allSlugs } = loadLocalProducts(syncSlugs);

const primaryImageBySha = new Map(imageManifest.images.filter((image) => image.role === "primary").map((image) => [image.sha256, image.sourceKey]));
const catalogueOnlyArticles = new Set(source.catalogueOnly.flatMap((family) => family.articles.map((article) => article.articleNumber)));

const localMatches = local.map((record) => {
  const manual = decisions.local?.[record.slug];
  if (manual?.sourceKey) {
    return { localSlug: record.slug, classification: "HIGH_CONFIDENCE_MATCH", sourceKey: manual.sourceKey, officialName: null, evidence: [`ručna odluka: ${manual.note ?? ""}`], autoApply: true };
  }
  if (manual?.decision === "keep-separate") {
    const match = matchLocalProduct(record, source.products, primaryImageBySha, catalogueOnlyArticles);
    return { ...match, autoApply: false, evidence: [...match.evidence, `ručna odluka: ne spajati (${manual.note ?? ""})`] };
  }
  return matchLocalProduct(record, source.products, primaryImageBySha, catalogueOnlyArticles);
});
const matchBySourceKey = new Map(localMatches.filter((match) => match.autoApply && match.sourceKey).map((match) => [match.sourceKey, match]));
const probableBySourceKey = new Map(localMatches.filter((match) => !match.autoApply && match.sourceKey).map((match) => [match.sourceKey, match]));

/* -- Slug ---------------------------------------------------------------------------------- */

const slugify = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/®|™/g, "")
    .replace(/&/g, " and ")
    .replace(/°\s?c/gi, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/*
 * Preimenovan slug (`slugRenames` u ručnim odlukama) ostaje u registru sa `renamedTo` — stara
 * adresa je javni URL i trajno preusmerava na novu — ali više ne nosi identitet zapisa.
 */
const slugRenames = decisions.slugRenames ?? {};
const liveRegistry = Object.entries(registry.products).filter(([, entry]) => !entry.renamedTo);
const slugBySourceKey = new Map(liveRegistry.map(([slug, entry]) => [entry.sourceKey, slug]));
const slugByArticle = new Map(liveRegistry.flatMap(([slug, entry]) => entry.articleNumbers.map((article) => [article, slug])));
const takenSlugs = new Set([...allSlugs].filter((slug) => !syncSlugs.has(slug)));
const plannedSlugs = new Set();

function slugFor(product, articleNumbers) {
  const known = slugBySourceKey.get(product.sourceKey) ?? articleNumbers.map((article) => slugByArticle.get(article)).find(Boolean);
  if (known) {
    const slug = slugRenames[known]?.to ?? known;
    const renamedFrom = Object.entries(slugRenames).filter(([, rename]) => rename.to === slug).map(([previous]) => previous).sort();
    return renamedFrom.length ? { slug, change: "RENAMED", renamedFrom } : { slug, change: "EXISTING" };
  }
  const base = `${BRAND.slug}-${slugify(product.officialName)}`;
  let slug = base;
  if (takenSlugs.has(slug) || plannedSlugs.has(slug) || syncSlugs.has(slug)) slug = `${base}-${slugify(articleNumbers[0] ?? product.sourceKey)}`;
  return { slug, change: "NEW" };
}

/* -- Stavke plana ------------------------------------------------------------------------ */

const imagesBySource = new Map();
for (const image of imageManifest.images) imagesBySource.set(image.sourceKey, [...(imagesBySource.get(image.sourceKey) ?? []), image]);
const documentsBySource = new Map();
for (const document of documentManifest.documents) documentsBySource.set(document.sourceKey, [...(documentsBySource.get(document.sourceKey) ?? []), document]);

const items = [];
const localizationInput = {};

for (const product of [...source.products].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))) {
  const variants = displayVariants(product);
  const articleNumbers = variants.map((variant) => variant.articleNumber);
  const taxonomyResult = resolveTaxonomy(product);
  const hash = contentHash(product);
  const sr = localization[product.sourceKey];
  const match = matchBySourceKey.get(product.sourceKey) ?? null;
  const images = (imagesBySource.get(product.sourceKey) ?? []).filter((image) => !image.error);

  let action = "IMPORT";
  let reason = null;
  if (decisions.source?.[product.sourceKey]?.decision === "skip") {
    action = "HELD_PENDING_DECISION";
    reason = decisions.source[product.sourceKey].note ?? "ručna odluka";
  } else if (!product.active) {
    action = "HELD_INACTIVE_PAGE";
    reason = "stranica nije objavljena ili ne vraća HTTP 200";
  } else if (!articleNumbers.length && product.variants.length) {
    action = "REPRESENTED_BY_OWNER";
    reason = `sve šifre stranice (${product.variants.map((variant) => variant.articleNumber).join(", ")}) vode se uz proizvod „${product.variants[0].sharedFrom}”`;
  } else if (!articleNumbers.length) {
    action = "HELD_NOT_ORDERABLE";
    reason = "stranica ne navodi šifru artikla, a ni PDF nema porodicu istog naziva";
  } else if (!taxonomyResult) {
    action = "HELD_UNMAPPED_CATEGORY";
    reason = `zvanična kategorija „${product.subcategory?.slug ?? product.category?.slug}” nema mapping`;
  } else if (match) {
    action = "MATCHED_EXISTING";
    reason = `${match.classification}: ${match.evidence.join("; ")}`;
  } else if (!sr) {
    action = "HELD_MISSING_LOCALIZATION";
    reason = "nema SR sadržaja";
  } else if (sr.sourceHash !== hash) {
    action = "HELD_MISSING_LOCALIZATION";
    reason = `SR sadržaj je zastareo (izvor ${hash}, prevod ${sr.sourceHash})`;
  }

  const lead =
    variants.find((variant) => variant.onWebsite && !isCompanionRole(variant.componentRole)) ?? variants.find((variant) => variant.onWebsite) ?? variants[0] ?? null;

  let slug = null;
  let change = null;
  let renamedFrom = [];
  if (action === "IMPORT" || action === "HELD_MISSING_LOCALIZATION") {
    ({ slug, change, renamedFrom = [] } = slugFor(product, [...articleNumbers, ...variants.flatMap((variant) => variant.alternateArticleNumbers.map((alternate) => alternate.articleNumber))]));
    plannedSlugs.add(slug);
  }

  items.push({
    sourceKey: product.sourceKey,
    officialName: product.officialName,
    url: product.url,
    classification: product.classification,
    sourceConflict: Boolean(product.sourceConflict),
    action,
    reason,
    slug,
    change,
    ...(renamedFrom.length ? { renamedFrom } : {}),
    localSlug: match?.localSlug ?? null,
    representedBySourceKey: action === "REPRESENTED_BY_OWNER" ? product.variants[0].sharedFrom : null,
    relatedLegacySlug: probableBySourceKey.get(product.sourceKey)?.localSlug ?? null,
    taxonomy: taxonomyResult,
    leadArticleNumber: lead?.articleNumber ?? null,
    articleNumbers,
    websiteArticleNumbers: variants.filter((variant) => variant.onWebsite).map((variant) => variant.articleNumber),
    // Drugi zvanični zapis ISTE varijante (slovna razlika sajt ↔ PDF): nije varijanta, ali vodi na isti slug.
    alternateArticleNumbers: variants.flatMap((variant) => variant.alternateArticleNumbers.map((alternate) => alternate.articleNumber)),
    sharedArticleNumbers: product.variants.filter((variant) => !variant.owned).map((variant) => ({ articleNumber: variant.articleNumber, owner: variant.sharedFrom })),
    hasComponents: variants.some((variant) => variant.component),
    images: images.length,
    missingOfficialAsset: images.length === 0,
    documents: (documentsBySource.get(product.sourceKey) ?? []).filter((document) => document.ok).length,
    contentHash: hash,
    localized: Boolean(sr && sr.sourceHash === hash),
  });

  // Ulaz za lokalizaciju: samo zvanične činjenice, grupisano po zvaničnoj kategoriji.
  const group = product.subcategory?.slug ?? product.category?.slug ?? "uncategorised";
  (localizationInput[group] ??= {})[product.sourceKey] = {
    sourceHash: hash,
    needsLocalization: !(sr && sr.sourceHash === hash),
    officialName: product.officialName,
    officialNameDe: product.officialNameDe,
    officialCategory: taxonomyResult?.officialCategory ?? null,
    ourCategory: taxonomyResult?.category ?? null,
    url: product.url,
    content: product.content,
    variants: variants.map((variant) => ({
      articleNumber: variant.articleNumber,
      component: variant.component,
      descriptor: variant.descriptor,
      catalogueRowText: variant.catalogueRowText,
      onWebsite: variant.onWebsite,
      alternateArticleNumbers: variant.alternateArticleNumbers.map((alternate) => alternate.articleNumber),
    })),
  };
}

/* -- Provere plana ------------------------------------------------------------------------ */

const importing = items.filter((item) => item.action === "IMPORT");
const slugCounts = new Map();
for (const item of items.filter((entry) => entry.slug)) slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
const articleOwners = new Map();
for (const item of items.filter((entry) => entry.action === "IMPORT" || entry.action === "MATCHED_EXISTING" || entry.action === "HELD_MISSING_LOCALIZATION")) {
  for (const article of item.articleNumbers) articleOwners.set(article, [...(articleOwners.get(article) ?? []), item.sourceKey]);
}

const activeProducts = source.products.filter((product) => product.active && product.orderable);
const activeArticles = new Set(activeProducts.flatMap((product) => product.variants.filter((variant) => variant.owned).map((variant) => variant.articleNumber)));
const directlyRepresented = new Set(items.filter((item) => item.action === "IMPORT" || item.action === "MATCHED_EXISTING").map((item) => item.sourceKey));
const representedKeys = new Set([
  ...directlyRepresented,
  ...items.filter((item) => item.action === "REPRESENTED_BY_OWNER" && directlyRepresented.has(item.representedBySourceKey)).map((item) => item.sourceKey),
]);
const representedArticles = new Set(items.filter((item) => representedKeys.has(item.sourceKey)).flatMap((item) => item.websiteArticleNumbers));
const localArticlesBefore = new Set(local.flatMap((record) => record.ownArticleNumbers));

const countClass = (label) => localMatches.filter((match) => match.classification === label).length;

const summary = {
  CURRENT_ACTIVE_WEBSITE_PRODUCTS: activeProducts.length,
  CURRENT_ACTIVE_ARTICLE_NUMBERS: activeArticles.size,
  CATALOGUE_PRODUCTS: new Set(readJson(PATHS.rawCatalogue).families.filter((family) => !family.inheritedHeading).map((family) => `${family.pdfPage}:${family.name}`)).size,
  CATALOGUE_ARTICLE_NUMBERS: source.summary.catalogueArticleNumbers,
  LOCAL_PRODUCTS_BEFORE: local.length,
  LOCAL_ARTICLE_NUMBERS_BEFORE: localArticlesBefore.size,
  EXACT_MATCH: countClass("EXACT_MATCH"),
  HIGH_CONFIDENCE_MATCH: countClass("HIGH_CONFIDENCE_MATCH"),
  PROBABLE_MATCH: countClass("PROBABLE_MATCH"),
  LEGACY_NOT_ON_CURRENT_WEBSITE: countClass("LEGACY_NOT_ON_CURRENT_WEBSITE"),
  LOCAL_ONLY_UNKNOWN: countClass("LOCAL_ONLY_UNKNOWN"),
  WEBSITE_AND_CATALOGUE: source.summary.WEBSITE_AND_CATALOGUE,
  WEBSITE_ONLY: source.summary.WEBSITE_ONLY,
  CATALOGUE_ONLY: source.summary.CATALOGUE_ONLY,
  SOURCE_CONFLICT: source.summary.SOURCE_CONFLICT,
  MISSING_PRODUCTS: activeProducts.filter((product) => !representedKeys.has(product.sourceKey)).length,
  MISSING_VARIANTS: [...activeArticles].filter((article) => !representedArticles.has(article)).length,
  MISSING_IMAGES: items.filter((item) => item.missingOfficialAsset).length,
  actions: Object.fromEntries([...new Set(items.map((item) => item.action))].sort().map((action) => [action, items.filter((item) => item.action === action).length])),
  newProducts: importing.filter((item) => item.change === "NEW").length,
  existingProducts: importing.filter((item) => item.change === "EXISTING").length,
  renamedProducts: importing.filter((item) => item.change === "RENAMED").length,
  planErrors: {
    duplicateSlugs: [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug),
    slugCollidesWithExisting: importing.filter((item) => item.change === "NEW" && takenSlugs.has(item.slug)).map((item) => item.slug),
    articleOnMultipleProducts: [...articleOwners.entries()].filter(([, owners]) => owners.length > 1).map(([article, owners]) => ({ article, owners })),
  },
};

writeJson(PATHS.plan, {
  meta: { catalogue: CATALOGUE.title, websiteCrawledAt: source.meta.website.crawledAt, rule: source.meta.rule },
  summary,
  localMatches,
  items,
  catalogueOnly: source.catalogueOnly.map((family) => ({
    status: "CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE",
    officialName: family.officialName,
    cataloguePage: family.cataloguePage,
    chapter: family.chapter,
    articleNumbers: family.articles.map((article) => article.articleNumber),
    firstRow: family.articles[0]?.rowText ?? null,
  })),
});

/* -- CSV ------------------------------------------------------------------------------------ */

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
writeFileSync(
  PATHS.planCsv,
  [
    ["sourceKey", "officialName", "classification", "action", "change", "slug", "localSlug", "ourCategory", "leadArticle", "articles", "images", "documents", "reason"].join(","),
    ...items.map((item) =>
      [item.sourceKey, item.officialName, item.classification, item.action, item.change, item.slug, item.localSlug, item.taxonomy?.category, item.leadArticleNumber, item.articleNumbers.length, item.images, item.documents, item.reason]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n") + "\n",
);

/* -- Ulaz za lokalizaciju (gitignored) ----------------------------------------------------- */

mkdirSync(PATHS.localizationInputDir, { recursive: true });
for (const [group, entries] of Object.entries(localizationInput)) writeJson(path.join(PATHS.localizationInputDir, `${group}.json`), entries);

/* -- Markdown -------------------------------------------------------------------------------- */

const table = (rows) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
const md = [];
md.push("# C.A.R.FIT catalog sync — DRY RUN", "");
md.push(`Primarni izvor: aktivne stranice proizvoda na ${source.meta.website.source}/en/ (crawl ${source.meta.website.crawledAt}).`, "");
md.push(`Sekundarni izvor: **${CATALOGUE.title}** — ${source.meta.catalogue.sourceUrl}`, "");
md.push(`sha256 \`${source.meta.catalogue.sha256}\` · ${source.meta.catalogue.pdfPages} strana.`, "");
md.push("Generisano komandom `npm run carfit:sync:plan`. Ovaj korak ne menja katalog.", "");
md.push("## Zbir", "", table([["Metrika", "Vrednost"], ["---", "---:"], ...Object.entries(summary).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, String(value)])]), "");
md.push("## Akcije", "", table([["Akcija", "Proizvoda"], ["---", "---:"], ...Object.entries(summary.actions).map(([key, value]) => [key, String(value)])]), "");
md.push("## Naši postojeći C.A.R.FIT zapisi", "");
md.push(
  table([
    ["Naš zapis", "Klasifikacija", "Zvanični proizvod", "Dokaz"],
    ["---", "---", "---", "---"],
    ...localMatches.map((match) => [`\`${match.localSlug}\``, match.classification, match.officialName ?? "—", match.evidence.join("; ")]),
  ]),
  "",
);
md.push("## Mapiranje kategorija", "");
const byMapping = new Map();
for (const item of items) {
  if (!item.taxonomy) continue;
  const key = `${item.taxonomy.officialCategory} → ${item.taxonomy.category}`;
  byMapping.set(key, (byMapping.get(key) ?? 0) + 1);
}
md.push(table([["C.A.R.FIT kategorija → naša", "Proizvoda"], ["---", "---:"], ...[...byMapping.entries()].sort().map(([key, value]) => [key, String(value)])]), "");
md.push("## Samo na sajtu (WEBSITE_ONLY) — ulaze u katalog", "");
md.push(table([["Proizvod", "Šifara", "Akcija"], ["---", "---:", "---"], ...items.filter((item) => item.classification === "WEBSITE_ONLY").map((item) => [item.officialName, String(item.articleNumbers.length), item.action])]), "");
md.push("## Samo u PDF katalogu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`", "");
md.push(
  table([
    ["PDF porodica", "Str.", "Šifre"],
    ["---", "---:", "---"],
    ...source.catalogueOnly.map((family) => [family.officialName ?? `(tabela bez naslova, ispod „${family.inheritedHeadingFrom}”) ${family.articles[0]?.rowText.slice(0, 60)}`, String(family.cataloguePage), family.articles.map((article) => article.articleNumber).join(", ")]),
  ]),
  "",
);
md.push("## Konflikti zvaničnih izvora", "");
md.push(table([["Tip", "Šifra", "Nalaz", "Razrešenje"], ["---", "---", "---", "---"], ...source.conflicts.map((conflict) => [conflict.type, conflict.articleNumber, conflict.detail.replace(/\|/g, "/"), conflict.resolution])]), "");
const held = items.filter((item) => item.action.startsWith("HELD"));
md.push("## Zadržano", "");
md.push(held.length ? table([["Proizvod", "Akcija", "Razlog"], ["---", "---", "---"], ...held.map((item) => [item.officialName, item.action, item.reason ?? ""])]) : "Nema zadržanih proizvoda.", "");
writeFileSync(PATHS.planMarkdown, md.join("\n"));

console.log(JSON.stringify({ ...summary, planErrors: summary.planErrors }, null, 2));
const hasErrors = Object.values(summary.planErrors).some((list) => list.length);
if (hasErrors) process.exitCode = 1;
