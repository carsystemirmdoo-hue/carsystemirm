#!/usr/bin/env node
/**
 * SATA sync, faza 2 — VALIDATE + RECONCILE nad stvarnim runtime-om.
 *
 *   A2 = odobrene kartice (plan)          B2 = kartice u runtime-u
 *   C2 = zvanični brojevi artikala u opsegu koji su VISIBLE   D2 = isti brojevi u runtime-u (red ili šifra kartice)
 *
 * Pada na: neklasifikovan ili izgubljen broj artikla, dupli broj (i prema fazi 1), isključeni artikal u runtime-u,
 * sliku ili dokument, tvrdnju da je lokalna grupa zvanična SATA porodica, promenu faze 1, slug van registra.
 */
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS } from "./lib/config.mjs";

const plan = readJson(PATHS.phase2Plan);
const dataset = readJson(PATHS.siteDataset);
const registry = readJson(PATHS.identityRegistry);
const lock = readJson(PATHS.phase2Lock);
const runtime = loadCatalogRuntime();
const taxonomy = runtime.requireModule("lib/product-taxonomy.ts");
const data = runtime.requireModule("lib/carsystem-data.ts");
const PLACEHOLDER = "/images/products/placeholder-product.svg";
const problems = {};
const add = (code, detail) => (problems[code] ??= []).push(detail);

const sata = runtime.products.filter((product) => product.brandSlug === "sata");
const bySlug = new Map(sata.map((product) => [product.slug, product]));
const cardIds = new Set(runtime.listing.canonical.filter((card) => card.brandSlug === "sata").map((card) => card.id));
const articleIdsOf = (product) => { const rows = product.detail?.variants?.content.rows ?? []; return rows.length ? rows.map((row) => row.id) : product.manufacturerCode ? [product.manufacturerCode] : []; };

/* Faza 1 netaknuta. */
const phase1 = [...dataset.products, ...Object.values(dataset.enrichments)];
const phase1Articles = phase1.flatMap((entry) => entry.variants.map((row) => row.articleNumber));
if (phase1.length !== 66 || phase1Articles.length !== 655) add("PHASE_1_CHANGED", { families: phase1.length, articles: phase1Articles.length });

/* Svaki izvorni broj: VISIBLE ili INTENTIONALLY_EXCLUDED:<razlog>. */
const owners = new Map();
for (const product of sata) for (const id of articleIdsOf(product)) owners.set(id, [...(owners.get(id) ?? []), product.slug]);
for (const [number, slugs] of owners) if (slugs.length > 1) add("DUPLICATE_ARTICLE_NUMBER", { number, slugs });
for (const [number, entry] of Object.entries(plan.articles)) {
  if (entry.status === "VISIBLE") { if (owners.get(number)?.[0] !== entry.card) add("VISIBLE_ARTICLE_NOT_ON_ITS_CARD", { number, expected: entry.card, found: owners.get(number) ?? [] }); }
  else if (/^INTENTIONALLY_EXCLUDED:[A-Z_]+$/.test(entry.status)) { if (owners.has(number)) add("EXCLUDED_ARTICLE_IN_RUNTIME", { number, slugs: owners.get(number) }); }
  else add("UNCLASSIFIED_ARTICLE", { number, status: entry.status });
  if (phase1Articles.includes(number)) add("ARTICLE_ALSO_IN_PHASE_1", { number });
}
if (Object.keys(plan.articles).length !== lock.measured.sourceArticles) add("SOURCE_ARTICLE_COUNT", { found: Object.keys(plan.articles).length, locked: lock.measured.sourceArticles });
if (JSON.stringify(plan.summary.measured) !== JSON.stringify(lock.measured)) add("MEASURED_DIFFERS_FROM_LOCK", {});

/* Kartice. */
for (const card of plan.cards) {
  const product = bySlug.get(card.slug);
  if (!product) { add("CARD_MISSING_IN_RUNTIME", card.slug); continue; }
  if (!cardIds.has(card.slug)) add("CARD_NOT_VISIBLE", card.slug);
  if (!registry.phase2?.[card.slug]) add("SLUG_NOT_LOCKED_IN_REGISTRY", card.slug);
  if (product.productImage?.src !== PLACEHOLDER || product.galleryImages.length) add("IMAGE_WITHOUT_RIGHTS", card.slug);
  if (product.documents.length || product.detail?.documents) add("INVENTED_DOCUMENT", card.slug);
  if (product.publicStatus !== "Na upit" || product.stockStatus !== "unknown") add("AVAILABILITY_CLAIM", card.slug);
  if (!taxonomy.getProductCategorySlug(product) || taxonomy.getProductCategorySlug(product) !== card.taxonomy.category) add("TAXONOMY_MISMATCH", card.slug);
  if (!data.programGroups.some((group) => group.slug === product.programSlug)) add("UNKNOWN_PROGRAM", card.slug);
  const text = JSON.stringify([product.name, product.shortDescription, product.detail]);
  if (/zvani[čc]n\w* sata porodic|official sata famil/i.test(text)) add("LOCAL_GROUP_PRESENTED_AS_OFFICIAL_FAMILY", card.slug);
  if (/\bprice\b|\bcena\b|€|\bEUR\b|\bRSD\b/i.test(JSON.stringify([product.name, product.shortDescription, product.specifications, product.detail?.variants?.content.rows.map((row) => row.values.config)]))) add("PRICE_WORDING", card.slug);
  if (/zvani[čc]ni distributer|ovla[šs][ćc]en|ekskluzivn/i.test(text)) add("RISKY_LEGAL_WORDING", card.slug);
  const rows = product.detail?.variants?.content.rows ?? [];
  if (card.variants.length > 1) {
    if (card.grouping !== "LOCAL_CATALOG_GROUPING") add("MULTI_ROW_CARD_NOT_MARKED_LOCAL", card.slug);
    if (rows.length !== card.variants.length) add("ROW_COUNT", { slug: card.slug, rows: rows.length, expected: card.variants.length });
    const labels = rows.map((row) => row.values.config);
    if (new Set(labels).size !== labels.length && !card.duplicateOfficialNames) add("ROW_LABEL_NOT_UNIQUE", card.slug);
  }
  for (const row of card.variants) if (!row.officialName) add("OFFICIAL_NAME_LOST", row.articleNumber);
  for (const slug of product.relatedProductSlugs) if (!bySlug.has(slug)) add("RELATED_FAMILY_MISSING", { slug: card.slug, related: slug });
}
/* Veze iz porodica faze 1: postojeći odeljak, samo prema živim karticama. */
for (const [familySlug, slugs] of Object.entries(dataset.phase2.links)) {
  const family = bySlug.get(familySlug);
  const linked = family?.detail?.compatibleProducts?.content.items.map((item) => item.productSlug) ?? [];
  if (!family || slugs.some((slug) => !linked.includes(slug) || !bySlug.has(slug))) add("PHASE_1_ACCESSORY_LINK", { familySlug, expected: slugs.length, linked: linked.length });
}
for (const slug of Object.keys(registry.phase2 ?? {})) if (registry.products?.[slug] || registry.enriched?.[slug]) add("PHASE_2_SLUG_COLLIDES_WITH_PHASE_1", slug);

const visibleNumbers = Object.entries(plan.articles).filter(([, entry]) => entry.status === "VISIBLE").map(([number]) => number);
const report = {
  scope: plan.meta.scope,
  coverage: { A2_approvedCards: plan.cards.length, B2_cardsInRuntime: plan.cards.filter((card) => cardIds.has(card.slug)).length, C2_visibleOfficialArticles: visibleNumbers.length, D2_articlesInRuntime: visibleNumbers.filter((number) => owners.has(number)).length },
  sourceArticles: plan.summary.measured.sourceArticles,
  excluded: { total: plan.summary.measured.excludedArticles, byReason: plan.summary.measured.excludedByReason, articles: Object.fromEntries(Object.entries(plan.articles).filter(([, entry]) => entry.status !== "VISIBLE").map(([number, entry]) => [number, entry.status])) },
  cards: { total: plan.cards.length, localFamilies: plan.summary.measured.localFamilies, singleArticle: plan.summary.measured.singleArticleCards, variantRows: plan.summary.measured.variantRows, byClassification: plan.summary.classification, byCategory: plan.summary.byCategory, nameSource: plan.summary.nameSource, duplicateOfficialNameCards: plan.summary.duplicateOfficialNameCards },
  sataRuntime: { phase1Cards: 66, phase2Cards: plan.cards.length, totalCards: cardIds.size, phase1Articles: phase1Articles.length, phase2Articles: visibleNumbers.length, totalArticles: owners.size },
  images: plan.summary.images, documents: plan.summary.documents, linkedPhase1Families: Object.keys(dataset.phase2.links).length,
  problems,
};
writeJson(PATHS.phase2Reconciliation, report);
console.log(JSON.stringify({ ...report, excluded: { total: report.excluded.total, byReason: report.excluded.byReason }, problems: Object.fromEntries(Object.entries(problems).map(([code, list]) => [code, list.length])) }, null, 1));
if (Object.keys(problems).length) { console.error(JSON.stringify(problems, null, 1).slice(0, 2000)); process.exitCode = 1; }
const { coverage } = report;
if (coverage.A2_approvedCards !== coverage.B2_cardsInRuntime || coverage.C2_visibleOfficialArticles !== coverage.D2_articlesInRuntime) process.exitCode = 1;
