#!/usr/bin/env node
/**
 * Norbin sync, korak 3 — PLAN (dry run). Ne menja katalog.
 *
 * Dve ose se namerno ne mešaju:
 *   CURRENT_MANUFACTURER_RANGE  — identitet dolazi ISKLJUČIVO sa zvaničnog izvora;
 *   LOCAL_AVAILABILITY          — dolazi iz commitovanog dokaza o aktivnosti artikla.
 *
 * Proizvod bez ERP potvrde je i dalje aktuelan proizvod proizvođača; njegova dostupnost je
 * „Na upit". To nije tvrdnja da ga imamo na stanju — ni za jedan zapis.
 *
 * Odluka po zapisu:
 *   IMPORT                     nova kartica
 *   ENRICH_EXISTING            zapis već postoji (slug se ČUVA) → dopuna i konsolidacija
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY     nijedno pravilo taksonomije ne odgovara
 *   SKIPPED_NOT_CUSTOMER_FACING  ručna odluka (N85-025) ili drugi region
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS, REFERENCE_REGION } from "./lib/config.mjs";
import { loadLocalNorbin } from "./lib/local-match.mjs";

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — `npm run norbin:sync:plan`.");
const rules = readJson(PATHS.taxonomyMap).rules;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { source: {}, local: {} });
const stock = readJson(PATHS.stockEvidence, { articles: [] });

export const slugify = (text) =>
  String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Sadržaj koji SR tekst sme da koristi; promena bilo čega od ovoga čini tekst zastarelim. */
export function contentHash(record) {
  return createHash("sha256")
    .update(JSON.stringify([record.code, record.officialName, record.role, record.packs, record.relations, record.usedBy, record.technical?.documentSha256 ?? null, record.technical?.claims ?? null]))
    .digest("hex")
    .slice(0, 16);
}

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

// Prvo pokretanje: runtime uvozi dataset kao modul, pa fajl mora da postoji.
if (!existsSync(PATHS.siteDataset)) writeJson(PATHS.siteDataset, { meta: { generator: "scripts/norbin-sync/apply.mjs", products: 0, enrichedExisting: 0 }, products: [], enrichments: {} });

const { records: local } = loadLocalNorbin();
const ownSlugs = new Set(Object.keys(registry.products));
const localByCode = new Map();
for (const record of local) if (record.code && !ownSlugs.has(record.slug)) localByCode.set(record.code, [...(localByCode.get(record.code) ?? []), record]);

/** Lokalna dostupnost: šifra ima artikal u ERP-u ili je nema. Status nije tvrdnja o stanju. */
const articlesByCode = new Map();
for (const article of stock.articles) articlesByCode.set(article.manufacturerCode, [...(articlesByCode.get(article.manufacturerCode) ?? []), article]);
function availabilityOf(code) {
  const articles = articlesByCode.get(code) ?? [];
  if (!articles.length) return { availability: "NOT_IN_OUR_PROGRAMME", articles: [], evidence: null };
  return {
    availability: articles.some((article) => article.status === "RECENT_STOCK_EVIDENCE") ? "SELLABLE_CURRENT" : "SELLABLE_CURRENT_ZERO_STOCK",
    articles: articles.map((article) => ({ articleId: article.articleId, pack: article.pack, status: article.status })),
    evidence: stock.source?.label ?? null,
  };
}

const roleOfCode = new Map(source.products.map((product) => [product.code, product.role]));
function resolveTaxonomy(record) {
  const usedByRoles = new Set(record.usedBy.map((entry) => roleOfCode.get(entry.code)).filter(Boolean));
  const rule = rules.find((candidate) => {
    if (candidate.role && candidate.role !== record.role) return false;
    const when = candidate.when ?? {};
    if (when.usedByRole && !usedByRoles.has(when.usedByRole)) return false;
    return true;
  });
  return rule ? { category: rule.category, programSlug: rule.programSlug, phaseSlug: rule.phaseSlug, visualType: rule.visualType, rule: rule.id } : null;
}

const slugByKey = new Map(Object.entries(registry.products).map(([slug, entry]) => [entry.sourceKey, slug]));
const taken = new Set(local.map((record) => record.slug));
function slugFor(record) {
  const known = slugByKey.get(record.sourceKey);
  if (known) return known;
  const base = `${BRAND.slug}-${slugify(record.officialName)}`.slice(0, 80).replace(/-+$/, "");
  return taken.has(base) ? `${base}-${slugify(record.code)}` : base;
}

const items = [];
const localizationInput = {};

for (const product of source.products) {
  const decision = decisions.source?.[product.code];
  if (product.status !== "CURRENT_EMEA" || decision?.decision === "skip") {
    items.push({
      kind: "product",
      sourceKey: product.sourceKey,
      code: product.code,
      officialName: product.officialName,
      action: "SKIPPED_NOT_CUSTOMER_FACING",
      status: decision?.status ?? product.status,
      reason: decision?.reason ?? (product.status === "CURRENT_OTHER_REGION" ? `aktuelan samo u regionu ${product.liveRegions.join("/")}` : "nije linkovan na aktuelnoj stranici opsega"),
      slug: null,
      taxonomy: null,
    });
    continue;
  }

  const existing = localByCode.get(product.code) ?? [];
  const taxonomy = resolveTaxonomy(product);
  const hash = contentHash(product);
  const sr = localization[product.sourceKey];
  const availability = availabilityOf(product.code);

  let action = existing.length ? "ENRICH_EXISTING" : "IMPORT";
  if (!taxonomy) action = "HELD_UNMAPPED_CATEGORY";
  else if (!existing.length && (!sr || sr.sourceHash !== hash)) action = "HELD_MISSING_LOCALIZATION";

  /*
   * Postojeća dva pakovanja jednog te istog proizvoda čuvaju svoje adrese i postaju varijante
   * jedne porodice. Nosilac javnog identiteta je zapis sa fotografijom.
   */
  const familySlug = existing.length > 1 ? `${BRAND.slug}-${slugify(product.code)}` : null;
  const members = existing
    .map((record) => ({
      slug: record.slug,
      pack: record.packages[0] ?? null,
      variantId: slugify(record.packages[0] ?? record.slug),
      hasOwnImage: record.hasImage,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  items.push({
    kind: "product",
    sourceKey: product.sourceKey,
    code: product.code,
    officialName: product.officialName,
    role: product.role,
    action,
    status: "CURRENT_EMEA",
    slug: existing.length ? existing[0].slug : taxonomy ? slugFor(product) : null,
    family: familySlug ? { slug: familySlug, name: `${BRAND.name} ${product.officialName}`, members, identityHolder: (members.find((member) => member.hasOwnImage) ?? members[0]).slug } : null,
    existingSlugs: existing.map((record) => record.slug),
    packs: product.packs,
    taxonomy,
    availability: availability.availability,
    availabilityArticles: availability.articles,
    documents: { tds: product.documents.tds, sds: product.documents.sds.length, brokenTds: false },
    relations: product.relations,
    usedBy: product.usedBy,
    missingOfficialAsset: true,
    sourceHash: hash,
  });

  if (!existing.length) {
    localizationInput[product.sourceKey] = {
      sourceHash: hash,
      code: product.code,
      officialName: product.officialName,
      officialNameSource: `${product.officialNameSource} (${product.officialNameRegion})`,
      role: product.role,
      packs: product.packs,
      category: taxonomy?.category ?? null,
      phase: taxonomy?.phaseSlug ?? null,
      tds: product.documents.tds?.href ?? null,
      sdsCount: product.documents.sds.length,
      relations: product.relations.map((relation) => ({ partnerCode: relation.partnerCode, partnerRole: relation.partnerRole, ratio: relation.ratio })),
      usedBy: product.usedBy.map((entry) => ({ code: entry.code, ratio: entry.ratio })),
      technical: product.technical
        ? { documentFileName: product.technical.documentFileName, documentSourceUrl: product.technical.documentSourceUrl, claims: product.technical.claims }
        : null,
      note: "Slika ne postoji ni kod proizvođača. Dostupnost je uvek „Na upit”. Brojeva artikala nema na izvoru.",
    };
  }
}

const emea = items.filter((item) => item.status === "CURRENT_EMEA");
/*
 * Šifra koju tehnički list imenuje kao komponentu, a izvor je nigde ne objavljuje (N85-025).
 * Nije proizvod izvora, pa je nema ni u `source.products` — postoji samo kao odredište veze.
 * Ne dobija karticu, ne ulazi u pokrivenost i ne postaje pojam pretrage.
 */
const known = new Set(source.products.map((product) => product.code));
const referencedOnly = [...new Set(source.products.flatMap((product) => product.relations.map((relation) => relation.partnerCode)))]
  .filter((code) => !known.has(code))
  .map((code) => ({ code, status: decisions.source?.[code]?.status ?? "OFFICIAL_REFERENCED_COMPONENT_NOT_CUSTOMER_FACING", decided: Boolean(decisions.source?.[code]) }));
const summary = {
  CURRENT_PRODUCT_FAMILIES: emea.length,
  CURRENT_OFFICIAL_CODES: emea.length,
  CURRENT_SYSTEMS: 0,
  CURRENT_PUBLIC_TONERS: 0,
  CURRENT_OTHER_REGION: items.filter((item) => item.status === "CURRENT_OTHER_REGION").length,
  UNLINKED_IN_SOURCE: items.filter((item) => item.status === "UNLINKED_IN_SOURCE").length,
  OFFICIAL_REFERENCED_COMPONENT_NOT_CUSTOMER_FACING: referencedOnly.length,
  officialReferencedComponents: referencedOnly.map((entry) => entry.code),
  NEW_PRODUCTS_TO_IMPORT: items.filter((item) => item.action === "IMPORT").length,
  EXISTING_PRODUCTS_TO_ENRICH: items.filter((item) => item.action === "ENRICH_EXISTING").length,
  MISSING_LOCALIZATION: items.filter((item) => item.action === "HELD_MISSING_LOCALIZATION").length,
  OFFICIAL_PRODUCT_IMAGES: 0,
  MISSING_OFFICIAL_ASSETS: emea.length,
  VERIFIED_ARTICLE_NUMBERS: 0,
  ASSET_FILENAME_ONLY_NUMBERS: 0,
  availability: Object.fromEntries(["SELLABLE_CURRENT", "SELLABLE_CURRENT_ZERO_STOCK", "NOT_IN_OUR_PROGRAMME"].map((key) => [key, emea.filter((item) => item.availability === key).length])),
  withTds: emea.filter((item) => item.documents.tds).length,
  withoutTds: emea.filter((item) => !item.documents.tds).length,
  withSds: emea.filter((item) => item.documents.sds > 0).length,
  relations: emea.reduce((sum, item) => sum + item.relations.length, 0),
  reverseRelations: emea.reduce((sum, item) => sum + item.usedBy.length, 0),
  families: emea.filter((item) => item.family).map((item) => item.family.slug),
  byCategory: Object.fromEntries([...new Set(emea.map((item) => item.taxonomy?.category ?? "—"))].sort().map((category) => [category, emea.filter((item) => (item.taxonomy?.category ?? "—") === category).length])),
  planErrors: {
    duplicateSlugs: [...new Set(items.filter((item) => item.slug).map((item) => item.slug))].filter((slug) => items.filter((item) => item.slug === slug).length > 1),
    duplicateCodes: emea.map((item) => item.code).filter((code, index, all) => all.indexOf(code) !== index),
    unmapped: items.filter((item) => item.action === "HELD_UNMAPPED_CATEGORY").map((item) => item.code),
  },
};

writeJson(PATHS.plan, { meta: { rule: source.meta.rule, referenceRegion: REFERENCE_REGION, crawledAt: source.meta.crawledAt, stockEvidence: stock.source ?? null }, summary, referencedOnly, items });
mkdirSync(PATHS.localizationInputDir, { recursive: true });
const groups = {};
for (const [key, entry] of Object.entries(localizationInput)) (groups[entry.role] ??= {})[key] = entry;
for (const [group, entries] of Object.entries(groups)) writeJson(path.join(PATHS.localizationInputDir, `${group}.json`), entries);
writeFileSync(
  PATHS.planMarkdown,
  ["# Norbin sync — dry run", "", "| metrika | vrednost |", "| --- | --- |", ...Object.entries(summary).filter(([, value]) => typeof value !== "object" || Array.isArray(value)).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`), ""].join("\n"),
);

console.log(JSON.stringify(summary, null, 1));
if (Object.values(summary.planErrors).some((list) => list.length)) process.exitCode = 1;
