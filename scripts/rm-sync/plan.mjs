#!/usr/bin/env node
/**
 * R-M sync, korak 6 — PLAN (dry run). Ne menja katalog.
 *
 * Odluka po zvaničnom zapisu (`action`):
 *   IMPORT                     nov zapis (1 zvanična oznaka = 1 zapis; website-only sistem bez oznake)
 *   ENRICH_EXISTING            već ga vodimo (uvoz iz dostavljene arhive ili ručni zapis) → dopuna, slug ostaje
 *   HELD_PENDING_DECISION      isključeno ručnom odlukom
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY     nijedno pravilo taksonomije ne odgovara
 *
 * Idempotentnost: slug se čita iz registra po oznaci, ne izvodi se iz naziva. Plan ne upisuje
 * nijednu veličinu celog runtime kataloga (vidi scripts/lib/crossSyncDeterminism.test.mjs).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS } from "./lib/config.mjs";
import { matchLocalProducts } from "./lib/local-match.mjs";
import { resolveTaxonomy } from "./lib/taxonomy.mjs";

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — pokrenuti acquire + build-source.");
const imageManifest = readJson(PATHS.imageManifest, { images: [] });
const taxonomyRules = readJson(PATHS.taxonomyMap).rules;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { source: {}, local: {} });

export const slugify = (text) => String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Hash zvaničnih činjenica iz kojih nastaje SR tekst: promena izvora → tekst je zastareo. */
export function contentHash(record) {
  const tds = record.tds ?? {};
  return createHash("sha256")
    .update(JSON.stringify([record.code, record.officialName, record.kind, record.role, record.series, record.line, record.introduction ?? record.description, tds.revision ?? null, tds.application ?? null, tds.keyFeatures ?? null, tds.mixingRatio ?? null, record.relations ?? null, record.systemComponents ?? null]))
    .digest("hex")
    .slice(0, 16);
}

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

// Prvo pokretanje: runtime katalog uvozi dataset kao modul, pa fajl mora da postoji.
if (!existsSync(PATHS.siteDataset)) writeJson(PATHS.siteDataset, { meta: { generator: "scripts/rm-sync/apply.mjs", products: 0 }, products: [], enrichments: {} });

const syncSlugs = new Set(Object.keys(registry.products));
const { matches: localMatches, allSlugs } = matchLocalProducts(source, syncSlugs);
const byCode = new Map(source.products.map((product) => [product.code, product]));

/** Lokalni zapis koji JESTE ovaj zvanični zapis: tačna oznaka u izvoru, ili ručna odluka za HIGH_CONFIDENCE. */
const localByCode = new Map();
for (const match of localMatches) {
  if (match.classification === "EXACT_MATCH") localByCode.set(match.officialCodes[0], match);
  const manual = decisions.local?.[match.slug];
  if (manual?.code && match.classification === "HIGH_CONFIDENCE_MATCH" && match.officialCodes.includes(manual.code)) localByCode.set(manual.code, { ...match, byManualDecision: manual.note ?? true });
}

const slugByCode = new Map(Object.entries(registry.products).map(([slug, entry]) => [entry.sourceKey, slug]));
const takenSlugs = new Set([...allSlugs].filter((slug) => !syncSlugs.has(slug)));
const plannedSlugs = new Set();
function slugFor(record) {
  const known = slugByCode.get(record.sourceKey);
  if (known) return { slug: known, change: "EXISTING" };
  // Zvanični naziv već počinje oznakom („C 2A64 GlossTOP+”), pa slug nosi i oznaku i naziv
  // bez ponavljanja; sistemi („ONYX HD”) daju čist naziv.
  const base = `${BRAND.slug}-${slugify(record.officialName)}`;
  const slug = takenSlugs.has(base) || plannedSlugs.has(base) ? `${base}-${slugify(record.sourceKey)}` : base;
  return { slug, change: "NEW" };
}

const imagesByKey = new Map();
// Zamenska sličica portala („Image missing”) nije slika proizvoda — zapis ostaje MISSING_OFFICIAL_ASSET.
for (const image of (imageManifest.images ?? []).filter((image) => !image.error && !image.placeholder)) imagesByKey.set(image.sourceKey, [...(imagesByKey.get(image.sourceKey) ?? []), image]);

const records = [
  ...source.products,
  // Website-only sistem: nema zvaničnu oznaku, pa ne ulazi u pokrivenost šifara; taksonomija i odnosi iz proizvoda linije.
  ...source.websiteOnlySystems.map((system) => ({ ...system, officialName: system.name, role: "basecoat-topcoat", series: null, line: system.name, introduction: system.description, relations: { hardeners: [], thinners: [], otherMentioned: [] }, usedBy: [], tds: null, websiteOnly: true })),
];

const items = [];
const localizationInput = {};
for (const record of records.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))) {
  const taxonomy = resolveTaxonomy(record, byCode, taxonomyRules);
  const hash = contentHash(record);
  const sr = localization[record.sourceKey];
  const local = record.code ? localByCode.get(record.code) ?? null : null;
  const images = imagesByKey.get(record.sourceKey) ?? [];

  let action = local ? "ENRICH_EXISTING" : "IMPORT";
  let reason = local ? `${local.classification}: ${local.evidence}` : null;
  if (decisions.source?.[record.code ?? record.sourceKey]?.decision === "skip") { action = "HELD_PENDING_DECISION"; reason = decisions.source[record.code ?? record.sourceKey].note ?? "ručna odluka"; }
  else if (!taxonomy) { action = "HELD_UNMAPPED_CATEGORY"; reason = `nijedno pravilo taksonomije ne odgovara ulozi „${record.role}”`; }
  else if (!local && !sr) { action = "HELD_MISSING_LOCALIZATION"; reason = "nema SR sadržaja"; }
  else if (!local && sr.sourceHash !== hash) { action = "HELD_MISSING_LOCALIZATION"; reason = `SR sadržaj je zastareo (izvor ${hash}, tekst ${sr.sourceHash})`; }

  let slug = local?.slug ?? null;
  let change = local ? "ENRICH" : null;
  if (!local && (action === "IMPORT" || action === "HELD_MISSING_LOCALIZATION")) { ({ slug, change } = slugFor(record)); plannedSlugs.add(slug); }

  items.push({
    sourceKey: record.sourceKey,
    code: record.code ?? null,
    officialName: record.officialName,
    kind: record.kind,
    role: record.role,
    series: record.series,
    line: record.line,
    status: record.status,
    documentationGap: record.documentationGap ?? null,
    action,
    reason,
    slug,
    change,
    taxonomy,
    missingOfficialAsset: !local && !images.length,
    images: images.length,
    hasLocalization: Boolean(sr) && sr.sourceHash === hash,
    sourceHash: hash,
  });

  if (!local) {
    const tds = record.tds ?? {};
    localizationInput[record.sourceKey] = {
      sourceHash: hash,
      code: record.code ?? null,
      officialName: record.officialName,
      name: record.name,
      kind: record.kind,
      role: record.role,
      series: record.series,
      line: record.line,
      technologyTags: record.technologyTags ?? [],
      introduction: record.introduction,
      documentationGap: record.documentationGap ?? null,
      tds: record.tds ? { revision: tds.revision, subtitle: tds.subtitle, application: tds.application, keyFeatures: tds.keyFeatures, mixingRatio: tds.mixingRatio, hardenerRows: tds.hardenerRows, thinnerRows: tds.thinnerRows, potLife: tds.potLife, flashOff: tds.flashOff, filmThickness: tds.filmThickness, drying: tds.drying, nozzle: tds.nozzle, voc: tds.voc } : null,
      relations: Object.fromEntries(Object.entries(record.relations ?? {}).map(([key, codes]) => [key, codes.map((code) => `${code} — ${byCode.get(code)?.officialName ?? code}`)])),
      usedBy: (record.usedBy ?? []).map((code) => `${code} — ${byCode.get(code)?.officialName ?? code}`),
      systemComponents: record.systemComponents ?? [],
      lineProducts: (record.lineProducts ?? []).map((code) => `${code} — ${byCode.get(code)?.officialName ?? code}`),
      category: taxonomy?.category ?? null,
    };
  }
}

const count = (predicate) => items.filter(predicate).length;
const coded = items.filter((item) => item.code);
const slugCounts = new Map();
for (const item of items.filter((entry) => entry.slug)) slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);

const summary = {
  CURRENT_CODED_PRODUCTS: coded.length,
  CURRENT_WEBSITE_ONLY_SYSTEMS: items.filter((item) => !item.code).map((item) => item.officialName),
  CURRENT_CODES: new Set(coded.map((item) => item.code)).size,
  SYSTEMS: count((item) => item.kind === "system"),
  STANDALONE_COMPONENTS: count((item) => item.kind === "component"),
  SYSTEM_COMPONENTS_WITHOUT_CARDS: source.systemComponents.length,
  LEGACY_LOCAL_ONLY: localMatches.filter((match) => match.classification === "LEGACY_LOCAL_ONLY").map((match) => match.slug),
  DOCUMENTATION_GAPS: items.filter((item) => item.documentationGap).map((item) => item.code),
  WEBSITE_ORPHANS: source.websiteOrphans.map((orphan) => orphan.slug),
  NEW_PRODUCTS_TO_IMPORT: count((item) => item.change === "NEW" || (item.change === "EXISTING")),
  NEW_THIS_RUN: count((item) => item.change === "NEW"),
  EXISTING_PRODUCTS_TO_ENRICH: count((item) => item.action === "ENRICH_EXISTING"),
  MISSING_OFFICIAL_ASSETS: items.filter((item) => item.missingOfficialAsset).map((item) => item.code ?? item.officialName),
  MISSING_LOCALIZATION: count((item) => item.action === "HELD_MISSING_LOCALIZATION"),
  actions: Object.fromEntries([...new Set(items.map((item) => item.action))].sort().map((action) => [action, count((item) => item.action === action)])),
  byCategory: Object.fromEntries([...new Set(items.map((item) => item.taxonomy?.category ?? "—"))].sort().map((category) => [category, count((item) => (item.taxonomy?.category ?? "—") === category)])),
  planErrors: {
    duplicateSlugs: [...slugCounts.entries()].filter(([, total]) => total > 1).map(([slug]) => slug),
    duplicateCodes: coded.map((item) => item.code).filter((code, index, all) => all.indexOf(code) !== index),
    localRecordForTwoCodes: [...localByCode.values()].map((match) => match.slug).filter((slug, index, all) => all.indexOf(slug) !== index),
  },
};

writeJson(PATHS.plan, { meta: { rule: source.meta.rule, infoPortalCrawledAt: source.meta.infoPortalCrawledAt, websiteCrawledAt: source.meta.websiteCrawledAt }, summary, items });

mkdirSync(PATHS.localizationInputDir, { recursive: true });
const groups = {};
for (const [key, entry] of Object.entries(localizationInput)) (groups[entry.role === "commercial-vehicle" ? "graphite-hd" : entry.role ?? "other"] ??= {})[key] = entry;
for (const [group, entries] of Object.entries(groups)) writeJson(path.join(PATHS.localizationInputDir, `${group}.json`), entries);

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
writeFileSync(PATHS.planCsv, [["code", "officialName", "kind", "role", "series", "action", "slug", "category", "images", "documentationGap"].join(","), ...items.map((item) => [item.code, item.officialName, item.kind, item.role, item.series, item.action, item.slug, item.taxonomy?.category, item.images, item.documentationGap].map(csvCell).join(","))].join("\n") + "\n");
writeFileSync(PATHS.planMarkdown, ["# R-M sync — dry run", "", "| metrika | vrednost |", "| --- | --- |", ...Object.entries(summary).filter(([, value]) => typeof value !== "object" || Array.isArray(value)).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`), "", "## Akcije", "", ...Object.entries(summary.actions).map(([action, total]) => `- ${action}: ${total}`), "", "## Kategorije", "", ...Object.entries(summary.byCategory).map(([category, total]) => `- ${category}: ${total}`), ""].join("\n"));

console.log(JSON.stringify(summary, null, 1));
if (Object.values(summary.planErrors).some((list) => list.length)) process.exitCode = 1;
