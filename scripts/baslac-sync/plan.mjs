#!/usr/bin/env node
/**
 * baslac sync, korak 4 — PLAN (dry run). Ne menja katalog.
 *
 * Odluka po zvaničnom zapisu:
 *   IMPORT                     nova kartica
 *   ENRICH_EXISTING            zapis već postoji (slug se ČUVA) → dopuna
 *   NEST_IN_SYSTEM             mixing clear/binder: činjenica sistema, bez kartice
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY     nijedno pravilo taksonomije ne odgovara
 *   SKIPPED_UNCERTAIN          zvanični TDS postoji, ali aktuelni sajt ne potvrđuje
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS, SYSTEMS } from "./lib/config.mjs";
import { loadLocalBaslac } from "./lib/local-match.mjs";

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — `npm run baslac:sync:plan`.");
const rules = readJson(PATHS.taxonomyMap).rules;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { source: {}, local: {} });
const imageManifest = readJson(PATHS.imageManifest, { images: [] });

export const slugify = (text) =>
  String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function contentHash(record) {
  const sheet = record.tds ?? {};
  return createHash("sha256")
    .update(
      JSON.stringify([
        record.code ?? record.key,
        record.officialName,
        record.role,
        record.features,
        record.relations ?? null,
        record.componentDetail ?? null,
        [sheet.revision ?? null, sheet.facts ?? null, sheet.drying ?? null, sheet.voc ?? null, sheet.introduction ?? null],
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

// Prvo pokretanje: runtime uvozi dataset kao modul, pa fajl mora da postoji.
if (!existsSync(PATHS.siteDataset)) writeJson(PATHS.siteDataset, { meta: { generator: "scripts/baslac-sync/apply.mjs", products: 0, systems: 0, enrichedExisting: 0 }, products: [], enrichments: {} });

const { records: local, runtime } = loadLocalBaslac();
/*
 * Zapisi koje je OVAJ sync napravio nisu „zatečeni lokalni zapisi”.
 *
 * Bez ove razlike drugi prolaz vidi svojih 40 uvezenih kartica u runtime katalogu, proglasi
 * ih tuđim i pređe na dopunu — pa dataset u svakom pokretanju izgleda drugačije. Registar
 * identiteta je jedini vlasnički trag: slug koji je u njemu pripada syncu.
 */
const ownSlugs = new Set(Object.keys(registry.products));
const dossier = runtime.requireModule("lib/baslac-systems.ts");
const existingFamilyCopy = new Map(
  runtime.requireModule("lib/baslac-catalog-products.ts").baslacSystemFamilies.map((family) => [family.system, { name: family.name, line: family.line, intro: family.intro, seoDescription: family.seoDescription }]),
);
const localByCode = new Map();
for (const record of local) if (record.code && !localByCode.has(record.code)) localByCode.set(record.code, record);
const localByFamily = new Map(local.filter((record) => record.familySlug).map((record) => [record.familySlug, record]));
const imagesByCode = new Map();
for (const image of (imageManifest.images ?? []).filter((entry) => !entry.error && entry.code)) imagesByCode.set(image.code, [...(imagesByCode.get(image.code) ?? []), image]);

const usedByRole = (record) => new Set((record.usedBy ?? []).map((code) => source.products.find((entry) => entry.code === code)?.role).filter(Boolean));
function resolveTaxonomy(record) {
  const roles = usedByRole(record);
  const text = `${record.officialName ?? ""} ${(record.features ?? []).join(" ")}`;
  const rule = rules.find((candidate) => {
    if (candidate.role && candidate.role !== record.role) return false;
    const when = candidate.when ?? {};
    if (when.aerosol && !/aerosol|spray|400\s?ml/i.test(text)) return false;
    if (when.usedByRole && !roles.has(when.usedByRole)) return false;
    if (when.roleIn && !when.roleIn.includes(record.role)) return false;
    if (when.nameMatches && !new RegExp(when.nameMatches, "i").test(`${record.officialName ?? ""} ${record.websiteName ?? ""}`)) return false;
    if (when.codeMatches && !new RegExp(when.codeMatches).test(record.code ?? "")) return false;
    return true;
  });
  return rule ? { category: rule.category, programSlug: rule.programSlug, phaseSlug: rule.phaseSlug, visualType: rule.visualType, rule: rule.id } : null;
}

const slugByKey = new Map(Object.entries(registry.products).map(([slug, entry]) => [entry.sourceKey, slug]));
const taken = new Set(local.map((record) => record.slug));
const planned = new Set();
function slugFor(record) {
  const known = slugByKey.get(record.sourceKey);
  if (known) return { slug: known, change: "EXISTING" };
  // `officialName` već počinje šifrom („12-20 Bodyfiller Universal") — u slug ide samo jednom.
  const base = `${BRAND.slug}-${slugify(`${record.code} ${record.displayName ?? ""}`)}`.slice(0, 80).replace(/-+$/, "");
  const slug = taken.has(base) || planned.has(base) ? `${base}-${slugify(record.code)}` : base;
  return { slug, change: "NEW" };
}

const items = [];
const localizationInput = {};

for (const system of SYSTEMS) {
  /*
   * Sistem je NOV zapis i onda kada porodica već postoji: porodica je do sada bila samo
   * zbir tonera, bez nosioca zvaničnog identiteta. Zapis sistema postaje taj nosilac i
   * ZAKLJUČAVA javno ime i postojeću adresu porodice (`familyIdentity`), pa se URL ne menja.
   */
  const existing = localByFamily.get(system.familySlug) ? system.familySlug : null;
  const record = { ...system, code: null, role: "system", officialName: system.officialName, features: [], componentDetail: source.systems.find((entry) => entry.key === system.key)?.componentDetail ?? [] };
  const hash = contentHash(record);
  const sr = localization[system.key];
  const taxonomy = resolveTaxonomy(record);
  const action = !taxonomy ? "HELD_UNMAPPED_CATEGORY" : sr && sr.sourceHash === hash ? "IMPORT" : "HELD_MISSING_LOCALIZATION";
  const systemSlug = slugify(system.officialName).startsWith(`${BRAND.slug}-`) ? slugify(system.officialName) : `${BRAND.slug}-${slugify(system.officialName)}`;
  items.push({ kind: "system", sourceKey: system.key, code: null, officialName: system.officialName, familySlug: system.familySlug, existingFamily: Boolean(existing), action, slug: systemSlug, taxonomy, components: system.components, sourceHash: hash, images: 0, missingOfficialAsset: true });
  {
    const bases = dossier.baslacAllBases.filter((base) => base.system === system.key && base.productionStatus === "ACTIVE_CONFIRMED");
    localizationInput[system.key] = {
      sourceHash: hash,
      kind: "system",
      role: "system",
      officialName: system.officialName,
      line: system.key,
      components: record.componentDetail.map((component) => ({ ...component, dossierName: dossier.baslacAllBases.find((base) => base.code === component.code)?.name ?? null, tdsFacts: source.products.find((entry) => entry.code === component.code)?.tds ?? null })),
      mixingBases: bases.length,
      lineDocument: `https://techinfo.baslac.com/en/${encodeURI(system.lineDoc)}`,
      existingFamily: system.familySlug,
      existingSiteCopy: existingFamilyCopy.get(system.key) ?? null,
      note: "Sistem za nijansiranje: nijansa se meša po formuli; pojedinačni toneri se zvanično ne objavljuju. Postojeći sajt tekst je već odobren — zadrži ton i terminologiju.",
    };
  }
}

for (const product of source.products) {
  if (product.status === "UNCERTAIN_NOT_CUSTOMER_FACING") { items.push({ kind: "product", sourceKey: product.sourceKey, code: product.code, officialName: product.officialName, action: "SKIPPED_UNCERTAIN", reason: "zvanični TDS postoji, ali aktuelni sajt ne potvrđuje", slug: null, taxonomy: null, images: 0 }); continue; }
  if (product.status === "CURRENT_MIXING_COMPONENT") { items.push({ kind: "component", sourceKey: product.sourceKey, code: product.code, officialName: product.officialName, action: "NEST_IN_SYSTEM", system: product.system, slug: localByCode.get(product.code)?.slug ?? null, taxonomy: null, images: 0 }); continue; }

  const found = localByCode.get(product.code) ?? null;
  const existing = found && ownSlugs.has(found.slug) ? null : found;
  const taxonomy = resolveTaxonomy(product);
  const hash = contentHash(product);
  const sr = localization[product.sourceKey];
  let action = existing ? "ENRICH_EXISTING" : "IMPORT";
  if (decisions.source?.[product.code]?.decision === "skip") action = "HELD_PENDING_DECISION";
  else if (!taxonomy) action = "HELD_UNMAPPED_CATEGORY";
  else if (!existing && (!sr || sr.sourceHash !== hash)) action = "HELD_MISSING_LOCALIZATION";

  let slug = existing?.slug ?? null;
  let change = existing ? "ENRICH" : null;
  if (!existing && action !== "HELD_PENDING_DECISION" && action !== "HELD_UNMAPPED_CATEGORY") { ({ slug, change } = slugFor(product)); planned.add(slug); }

  items.push({
    kind: "product", sourceKey: product.sourceKey, code: product.code, officialName: product.officialName, displayName: product.displayName, role: product.role, action, slug, change,
    existingSlug: existing?.slug ?? null, existingFamily: existing?.familySlug ?? null, promotedFromLine: product.promotedFromLine, taxonomy,
    officialImages: product.officialImages, images: (imagesByCode.get(product.code) ?? []).length,
    missingOfficialAsset: !product.officialImages.length,
    relations: product.relations, usedBy: product.usedBy, tds: product.tds.url, sourceHash: hash,
  });
  /*
   * Ulaz za SR sadržaj se piše za svaki zapis, i za one koji se samo dopunjuju: fajl je
   * keš i mora biti potpun, inače provera lokalizacije poredi tekst sa zastarelim ulazom.
   */
  {
    localizationInput[product.sourceKey] = {
      sourceHash: hash,
      code: product.code,
      officialName: product.officialName,
      displayName: product.displayName,
      websiteName: product.websiteName,
      websiteSubtitle: product.websiteSubtitle,
      role: product.role,
      features: product.features,
      relations: product.relations,
      usedBy: product.usedBy,
      category: taxonomy?.category ?? null,
      phase: taxonomy?.phaseSlug ?? null,
      onWebsitePage: Boolean(product.websiteName),
      tds: {
        url: product.tds.url,
        revision: product.tds.revision,
        introduction: product.tds.introduction,
        facts: product.tds.facts,
        drying: product.tds.drying,
        voc: product.tds.voc,
        mixing: product.tds.mixing,
      },
    };
  }
}

const count = (predicate) => items.filter(predicate).length;
const coded = items.filter((item) => item.kind === "product" && item.action !== "SKIPPED_UNCERTAIN");
const summary = {
  CURRENT_PRODUCT_FAMILIES: coded.length + count((item) => item.kind === "system"),
  CURRENT_OFFICIAL_CODES: coded.length,
  CURRENT_SYSTEMS: count((item) => item.kind === "system"),
  CURRENT_PUBLIC_TONERS: 0,
  NESTED_MIXING_COMPONENTS: count((item) => item.action === "NEST_IN_SYSTEM"),
  UNCERTAIN_NOT_CUSTOMER_FACING: count((item) => item.action === "SKIPPED_UNCERTAIN"),
  NEW_PRODUCTS_TO_IMPORT: count((item) => item.action === "IMPORT"),
  EXISTING_PRODUCTS_TO_ENRICH: count((item) => item.action === "ENRICH_EXISTING"),
  WITH_OFFICIAL_IMAGE: coded.filter((item) => !item.missingOfficialAsset).length,
  MISSING_OFFICIAL_ASSETS: coded.filter((item) => item.missingOfficialAsset).length,
  MISSING_LOCALIZATION: count((item) => item.action === "HELD_MISSING_LOCALIZATION"),
  PROMOTED_FROM_LINE: items.filter((item) => item.promotedFromLine).map((item) => item.code),
  actions: Object.fromEntries([...new Set(items.map((item) => item.action))].sort().map((action) => [action, count((item) => item.action === action)])),
  byCategory: Object.fromEntries([...new Set(coded.map((item) => item.taxonomy?.category ?? "—"))].sort().map((category) => [category, coded.filter((item) => (item.taxonomy?.category ?? "—") === category).length])),
  planErrors: {
    duplicateSlugs: [...new Set(items.filter((item) => item.slug).map((item) => item.slug))].filter((slug) => items.filter((item) => item.slug === slug).length > 1),
    duplicateCodes: coded.map((item) => item.code).filter((code, index, all) => all.indexOf(code) !== index),
  },
};

writeJson(PATHS.plan, { meta: { rule: source.meta.rule, websiteCrawledAt: source.meta.websiteCrawledAt }, summary, items });
mkdirSync(PATHS.localizationInputDir, { recursive: true });
const groups = {};
for (const [key, entry] of Object.entries(localizationInput)) (groups[entry.kind === "system" ? "systems" : entry.role ?? "other"] ??= {})[key] = entry;
for (const [group, entries] of Object.entries(groups)) writeJson(path.join(PATHS.localizationInputDir, `${group}.json`), entries);
writeFileSync(PATHS.planMarkdown, ["# baslac sync — dry run", "", "| metrika | vrednost |", "| --- | --- |", ...Object.entries(summary).filter(([, value]) => typeof value !== "object" || Array.isArray(value)).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`), ""].join("\n"));

console.log(JSON.stringify(summary, null, 1));
if (Object.values(summary.planErrors).some((list) => list.length)) process.exitCode = 1;
