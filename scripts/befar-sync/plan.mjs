#!/usr/bin/env node
/**
 * BEFAR sync, korak 5 — PLAN (dry run). Ne menja katalog.
 *
 * Odluka po zvaničnom proizvodu (`action`):
 *   IMPORT                     ulazi u katalog (nov ili već uvezen — vidi `change`)
 *   MATCHED_EXISTING           već ga vodimo ručno → dopuna šifara, ne duplikat
 *   HELD_PENDING_DECISION      isključeno ručnom odlukom
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY     nijedno pravilo taksonomije ne odgovara
 *
 * WEBSITE_ONLY proizvod se uvozi isto kao i onaj koji je i u katalogu. PROBABLE ručni
 * zapis ne zadržava kandidate: zvanični proizvodi se uvoze, legacy ostaje.
 *
 * Idempotentnost: slug se čita iz registra po `sourceKey` / šifri, ne izvodi se iz naziva.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, CATALOGUE, PATHS } from "./lib/config.mjs";
import { slugify } from "./lib/families.mjs";
import { loadLocalProducts, matchLocalProduct } from "./lib/local-match.mjs";

const source = readJson(PATHS.source);
const catalogue = readJson(PATHS.rawCatalogue);
const imageManifest = readJson(PATHS.imageManifest);
if (!source || !imageManifest) throw new Error("Nedostaje source dataset ili manifest slika — pokrenuti prethodne korake.");

const taxonomyRules = readJson(PATHS.taxonomyMap).rules;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { source: {}, local: {} });

/** Hash zvaničnih činjenica iz kojih je SR tekst nastao: promena izvora → zastareo tekst. */
export function contentHash(product) {
  return createHash("sha256")
    .update(JSON.stringify([product.displayNameEn, product.line, product.titleTr, product.qualifiers, product.isSet, product.variants.map((variant) => [variant.code, variant.colour, variant.size, variant.holes, variant.hardness?.stars ?? null])]))
    .digest("hex")
    .slice(0, 16);
}

const localization = {};
if (existsSync(PATHS.localizationDir)) {
  for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
}

function resolveTaxonomy(product) {
  const rule = taxonomyRules.find((candidate) => new RegExp(candidate.name, "i").test(product.displayNameEn) && (!candidate.kinds || candidate.kinds.includes(product.kind)));
  if (!rule) return null;
  return {
    officialCategories: product.categories,
    category: rule.category,
    programSlug: rule.programSlug,
    phaseSlug: rule.phaseSlug,
    visualType: rule.visualType,
    materialColour: Boolean(rule.materialColour),
    rule: `name ~ /${rule.name}/`,
  };
}

// Prvo pokretanje: runtime katalog uvozi dataset kao modul, pa fajl mora da postoji.
if (!existsSync(PATHS.siteDataset)) writeJson(PATHS.siteDataset, { meta: { generator: "scripts/befar-sync/apply.mjs", catalogue: CATALOGUE.title, products: 0, variants: 0 }, products: [], enrichments: {} });

const syncSlugs = new Set(Object.keys(registry.products));
const { local, allSlugs } = loadLocalProducts(syncSlugs);
const localMatches = local.map((record) => {
  const manual = decisions.local?.[record.slug];
  if (manual?.sourceKey) return { localSlug: record.slug, classification: "HIGH_CONFIDENCE_MATCH", sourceKey: manual.sourceKey, candidates: [], evidence: [`ručna odluka: ${manual.note ?? ""}`], autoApply: true };
  return matchLocalProduct(record, source.products);
});
const matchBySourceKey = new Map(localMatches.filter((match) => match.autoApply && match.sourceKey).map((match) => [match.sourceKey, match]));
const probableBySourceKey = new Map();
for (const match of localMatches.filter((entry) => !entry.autoApply)) for (const candidate of match.candidates) probableBySourceKey.set(candidate.sourceKey, [...(probableBySourceKey.get(candidate.sourceKey) ?? []), match.localSlug]);

const slugBySourceKey = new Map(Object.entries(registry.products).map(([slug, entry]) => [entry.sourceKey, slug]));
const slugByCode = new Map(Object.entries(registry.products).flatMap(([slug, entry]) => entry.codes.map((code) => [code, slug])));
const takenSlugs = new Set([...allSlugs].filter((slug) => !syncSlugs.has(slug)));
const plannedSlugs = new Set();

function slugFor(product) {
  // Šifra ima prednost nad ključem: ako proizvođač preimenuje blok, URL ostaje isti.
  const votes = new Map();
  for (const variant of product.variants) {
    const slug = slugByCode.get(variant.code);
    if (slug) votes.set(slug, (votes.get(slug) ?? 0) + 1);
  }
  const byCodes = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const known = byCodes ?? slugBySourceKey.get(product.sourceKey);
  if (known && !plannedSlugs.has(known)) return { slug: known, change: "EXISTING" };
  // Slug je javni URL: gradi se iz naziva sa ISPRAVLJENIM slovnim greškama (`displayName`), bez duplog „befar-befar-”.
  const base = `${BRAND.slug}-${slugify(localization[product.sourceKey]?.displayName ?? product.displayNameEn)}`.replace(/^befar-befar-/, "befar-");
  let slug = base;
  if (takenSlugs.has(slug) || plannedSlugs.has(slug) || syncSlugs.has(slug)) slug = `${base}-${product.variants[0].code.toLowerCase()}`;
  return { slug, change: "NEW" };
}

const imagesBySource = new Map();
for (const image of imageManifest.images) imagesBySource.set(image.sourceKey, [...(imagesBySource.get(image.sourceKey) ?? []), image]);
const pageTextByPdfPage = new Map((catalogue?.pages ?? []).map((page) => [page.pdfPage, page.pageText ?? []]));

const items = [];
const localizationInput = {};
for (const product of [...source.products].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))) {
  const taxonomy = resolveTaxonomy(product);
  const hash = contentHash(product);
  const sr = localization[product.sourceKey];
  const match = matchBySourceKey.get(product.sourceKey) ?? null;
  const images = (imagesBySource.get(product.sourceKey) ?? []).filter((image) => !image.error);

  let action = "IMPORT";
  let reason = null;
  if (decisions.source?.[product.sourceKey]?.decision === "skip") {
    action = "HELD_PENDING_DECISION";
    reason = decisions.source[product.sourceKey].note ?? "ručna odluka";
  } else if (!taxonomy) {
    action = "HELD_UNMAPPED_CATEGORY";
    reason = `nijedno pravilo taksonomije ne odgovara nazivu „${product.displayNameEn}”`;
  } else if (match) {
    action = "MATCHED_EXISTING";
    reason = `${match.classification}: ${match.evidence.join("; ")}`;
  } else if (!sr) {
    action = "HELD_MISSING_LOCALIZATION";
    reason = "nema SR sadržaja";
  } else if (sr.sourceHash !== hash) {
    action = "HELD_MISSING_LOCALIZATION";
    reason = `SR sadržaj je zastareo (izvor ${hash}, tekst ${sr.sourceHash})`;
  }

  let slug = null;
  let change = null;
  if (action === "IMPORT" || action === "HELD_MISSING_LOCALIZATION") {
    ({ slug, change } = slugFor(product));
    plannedSlugs.add(slug);
  }

  items.push({
    sourceKey: product.sourceKey,
    officialName: product.displayNameEn,
    line: product.line,
    kind: product.kind,
    isSet: product.isSet,
    pages: product.pages,
    classification: product.classification,
    sourceConflict: Boolean(product.sourceConflict),
    action,
    reason,
    slug,
    change,
    localSlug: match?.localSlug ?? null,
    relatedLegacySlugs: probableBySourceKey.get(product.sourceKey) ?? [],
    taxonomy,
    leadCode: product.variants[0]?.code ?? null,
    codes: product.variants.map((variant) => variant.code),
    images: images.length,
    missingOfficialAsset: images.length === 0,
    contentHash: hash,
    localized: Boolean(sr && sr.sourceHash === hash),
  });

  (localizationInput[product.line] ??= {})[product.sourceKey] = {
    sourceHash: hash,
    needsLocalization: !(sr && sr.sourceHash === hash),
    officialNameEn: product.displayNameEn,
    officialNameTr: product.titleTr,
    line: product.line,
    kind: product.kind,
    isSet: product.isSet,
    qualifiers: product.qualifiers,
    qualifierConflict: product.qualifierConflict,
    officialCategories: product.categories,
    ourCategory: taxonomy?.category ?? null,
    variants: product.variants.map((variant) => ({ code: variant.code, colour: variant.colour, size: variant.size, holes: variant.holes, hardnessStars: variant.hardness?.stars ?? null, applyWith: variant.hardness?.applyWith ?? null, cataloguePage: variant.catalogue?.pdfPage ?? null, catalogueLabel: variant.catalogue?.label ?? null, catalogueDimension: variant.catalogue?.dimension ?? null })),
    imageTitles: [...new Set(product.images.map((image) => image.title).filter(Boolean))],
    // Jedini opisni tekst koji Befar objavljuje: ostatak teksta sa strana kataloga na kojima su šifre proizvoda.
    cataloguePageText: Object.fromEntries(product.cataloguePages.map((page) => [page, pageTextByPdfPage.get(page) ?? []])),
  };
}

const importing = items.filter((item) => item.action === "IMPORT");
const slugCounts = new Map();
for (const item of items.filter((entry) => entry.slug)) slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
const codeOwners = new Map();
for (const item of items) for (const code of item.codes) codeOwners.set(code, [...(codeOwners.get(code) ?? []), item.sourceKey]);

const represented = new Set(items.filter((item) => item.action === "IMPORT" || item.action === "MATCHED_EXISTING").map((item) => item.sourceKey));
const activeCodes = new Set(source.products.flatMap((product) => product.variants.map((variant) => variant.code)));
const representedCodes = new Set(items.filter((item) => represented.has(item.sourceKey)).flatMap((item) => item.codes));
const countClass = (label) => localMatches.filter((match) => match.classification === label).length;

const summary = {
  CURRENT_ACTIVE_BEFAR_PRODUCT_FAMILIES: source.products.length,
  CURRENT_ACTIVE_BEFAR_CODES: activeCodes.size,
  CATALOGUE_FAMILIES: catalogue ? new Set(catalogue.rows.map((row) => `${row.pdfPage}:${row.column}:${row.pageHeadings[0] ?? ""}`)).size : 0,
  CATALOGUE_CODES: source.summary.catalogueCodes,
  LOCAL_PRODUCTS_BEFORE: local.length,
  LOCAL_CODES_BEFORE: new Set(local.flatMap((record) => record.ownCodes)).size,
  MATCHED: countClass("EXACT_MATCH") + countClass("HIGH_CONFIDENCE_MATCH"),
  PROBABLE: countClass("PROBABLE_MATCH"),
  LEGACY_LOCAL_ONLY: countClass("LEGACY_LOCAL_ONLY"),
  WEBSITE_AND_CATALOGUE: source.summary.WEBSITE_AND_CATALOGUE,
  WEBSITE_ONLY: source.summary.WEBSITE_ONLY,
  CATALOGUE_ONLY: source.summary.codesCatalogueOnly,
  SOURCE_CONFLICT: source.summary.SOURCE_CONFLICT,
  MISSING_PRODUCTS: source.products.filter((product) => !represented.has(product.sourceKey)).length,
  MISSING_CODES: [...activeCodes].filter((code) => !representedCodes.has(code)).length,
  MISSING_IMAGES: items.filter((item) => item.missingOfficialAsset).length,
  MISSING_DESCRIPTIONS: items.filter((item) => !item.localized && item.action !== "MATCHED_EXISTING").length,
  actions: Object.fromEntries([...new Set(items.map((item) => item.action))].sort().map((action) => [action, items.filter((item) => item.action === action).length])),
  newProducts: importing.filter((item) => item.change === "NEW").length,
  existingProducts: importing.filter((item) => item.change === "EXISTING").length,
  planErrors: {
    duplicateSlugs: [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug),
    slugCollidesWithExisting: importing.filter((item) => item.change === "NEW" && takenSlugs.has(item.slug)).map((item) => item.slug),
    codeOnMultipleProducts: [...codeOwners.entries()].filter(([, owners]) => owners.length > 1).map(([code, owners]) => ({ code, owners })),
  },
};

writeJson(PATHS.plan, {
  meta: { catalogue: CATALOGUE.title, websiteCrawledAt: source.meta.website.crawledAt, rule: source.meta.rule },
  summary,
  localMatches,
  items,
  catalogueOnly: source.catalogueOnly,
});

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
writeFileSync(
  PATHS.planCsv,
  [
    ["sourceKey", "officialName", "line", "kind", "classification", "action", "change", "slug", "ourCategory", "leadCode", "codes", "images", "reason"].join(","),
    ...items.map((item) => [item.sourceKey, item.officialName, item.line, item.kind, item.classification, item.action, item.change, item.slug, item.taxonomy?.category, item.leadCode, item.codes.length, item.images, item.reason].map(csvCell).join(",")),
  ].join("\n") + "\n",
);

mkdirSync(PATHS.localizationInputDir, { recursive: true });
for (const [line, entries] of Object.entries(localizationInput)) writeJson(path.join(PATHS.localizationInputDir, `${slugify(line)}.json`), entries);

const table = (rows) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
const md = [];
md.push("# BEFAR catalog sync — DRY RUN", "");
md.push(`Primarni izvor: aktuelni sajt ${source.meta.website.source} (kontrola: ${source.meta.website.controlSource}; crawl ${source.meta.website.crawledAt}).`, "");
md.push(`Sekundarni izvor: **${CATALOGUE.title}** — ${source.meta.catalogue.sourceUrl}`, "");
md.push(`sha256 \`${source.meta.catalogue.sha256}\` · ${source.meta.catalogue.pdfPages} strana.`, "");
md.push("Generisano komandom `npm run befar:sync:plan`. Ovaj korak ne menja katalog.", "");
md.push("## Zbir", "", table([["Metrika", "Vrednost"], ["---", "---:"], ...Object.entries(summary).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, String(value)])]), "");
md.push("## Akcije", "", table([["Akcija", "Proizvoda"], ["---", "---:"], ...Object.entries(summary.actions).map(([key, value]) => [key, String(value)])]), "");
md.push("## Naši postojeći Befar zapisi", "");
md.push(table([["Naš zapis", "Klasifikacija", "Zvanični kandidati", "Dokaz"], ["---", "---", "---", "---"], ...localMatches.map((match) => [`\`${match.localSlug}\``, match.classification, match.candidates.map((candidate) => `${candidate.officialName} (${candidate.codes.join(", ")})`).join("; ") || "—", match.evidence.join("; ")])]), "");
md.push("## Proizvodi i mapiranje kategorija", "");
md.push(table([["Linija", "Zvanični proizvod", "Šifara", "Izvor", "Naša kategorija", "Akcija"], ["---", "---", "---:", "---", "---", "---"], ...items.map((item) => [item.line, item.officialName, String(item.codes.length), item.classification, item.taxonomy?.category ?? "—", item.action])]), "");
md.push("## Samo u digitalnom katalogu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`", "");
md.push(table([["Str.", "Naslovi strane", "Šifre"], ["---:", "---", "---"], ...source.catalogueOnly.map((group) => [String(group.pdfPage), group.pageHeadings.slice(0, 3).join(" / "), group.codes.map((entry) => entry.code).join(", ")])]), "");
md.push("## Konflikti zvaničnih izvora", "");
md.push(table([["Tip", "Šifra", "Nalaz", "Razrešenje"], ["---", "---", "---", "---"], ...source.conflicts.map((conflict) => [conflict.type, conflict.code, conflict.detail.replace(/\|/g, "/"), conflict.resolution])]), "");
writeFileSync(PATHS.planMarkdown, md.join("\n"));

console.log(JSON.stringify(summary, null, 2));
if (Object.values(summary.planErrors).some((list) => list.length)) process.exitCode = 1;
