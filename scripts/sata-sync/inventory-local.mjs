#!/usr/bin/env node
/**
 * SATA sync — inventar SVEGA što u repozitorijumu već postoji za SATA (samo čitanje).
 *
 * Meri se stvarni runtime (kartice, ne sirovi zapisi), a uz njega i slojevi koji nisu proizvodi:
 * porodice koje imenuje brend stranica (`lib/sata-brand-data.ts`) i brojevi artikala koje navodi
 * dokumentacija. Poređenje je po ZVANIČNOM NAZIVU porodice (doslovno, posle normalizacije razmaka i
 * veličine slova) i po broju artikla — nikad po sličnosti naziva.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje izvorni model — `node scripts/sata-sync/build-source.mjs`.");

// Crtica je tipografija, ne identitet: „LCS — the Liner” i zvanično „LCS - the Liner” su isti naziv.
const norm = (text) => String(text ?? "").toLowerCase().replace(/[\u2012-\u2015]/g, "-").replace(/\s+/g, " ").trim();
const familyByName = new Map(source.families.map((family) => [norm(family.officialName), family]));
const articleIndex = new Map();
for (const family of source.families) for (const variant of family.variants) articleIndex.set(variant.articleNumber, { where: "family", family: family.id, familyName: family.officialName, region: variant.region });
for (const family of source.unlistedFamilies) for (const variant of family.variants) articleIndex.set(variant.articleNumber, { where: "unlistedFamily", family: family.parentId, familyName: family.commonNamePrefix, region: variant.region });
for (const article of source.standalone) articleIndex.set(article.articleNumber, { where: "standalone", role: article.role, region: article.region });

/* ── 1. Runtime zapisi i kartice ── */
const runtime = loadCatalogRuntime();
const ours = runtime.products.filter((product) => product.brandSlug === "sata");
const cards = runtime.listing.canonical.filter((product) => product.brandSlug === "sata");

const records = ours.map((product) => {
  const official = familyByName.get(norm(product.name));
  const family = runtime.getFamilyForProduct(product);
  return {
    slug: product.slug,
    displayName: product.name,
    sku: product.sku ?? null,
    skuIsManufacturerNumber: false,
    manufacturerCode: product.manufacturerCode ?? null,
    image: product.productImage?.src ?? null,
    hasRealImage: Boolean(product.productImage?.src && !/placeholder/.test(product.productImage.src)),
    documents: (product.documents ?? []).length,
    program: product.programSlug,
    phase: product.phaseSlug,
    category: product.taxonomyCategory ?? null,
    localFamily: family?.slug ?? null,
    redirectOnly: runtime.variantSlugs.has(product.slug),
    classification: official ? (official.region === "CURRENT" ? "EXACT_MATCH" : "HIGH_CONFIDENCE") : "LEGACY_LOCAL_ONLY",
    officialFamily: official ? { id: official.id, name: official.officialName, url: official.url, variants: official.variantCountEurope } : null,
    note: official ? "Lokalni zapis je PORODICA (bez broja artikla) i doslovno nosi zvanični naziv porodice." : null,
  };
});

/* ── 2. Porodice koje imenuje brend stranica ── */
const brandData = runtime.requireModule("lib/sata-brand-data.ts");
const mentioned = (brandData.sataFamilyGroups ?? []).flatMap((group) => group.families.map((family) => ({ group: group.id, name: family.name })));
const brandFamilies = mentioned.map((entry) => {
  const exact = familyByName.get(norm(entry.name)) ?? familyByName.get(norm(`SATA ${entry.name}`));
  // Naziv grupe koji pokriva više zvaničnih porodica („SATAjet 100 B F” → „SATAjet 100 B”, osa „Nozzle type”).
  const asAxisValue = exact
    ? null
    : source.families.find(
        (family) =>
          norm(entry.name).startsWith(`${norm(family.officialName)} `) &&
          // pod-linija je ili vrednost ose („P”), ili doslovno stoji u zvaničnim nazivima artikala („SATAjet 100 B F RP 1.6”)
          (Object.values(family.axes).flat().some((value) => norm(entry.name).endsWith(` ${norm(value)}`)) ||
            family.variants.some((variant) => norm(variant.name).includes(`${norm(entry.name)} `))),
      );
  const prefixOf = exact || asAxisValue ? [] : source.families.filter((family) => norm(family.officialName).startsWith(norm(entry.name)) || norm(family.officialName).includes(norm(entry.name)));
  return {
    ...entry,
    classification: exact ? "EXACT_MATCH" : asAxisValue ? "HIGH_CONFIDENCE" : prefixOf.length ? "PROBABLE" : "UNKNOWN",
    official: exact ? exact.id : asAxisValue ? `${asAxisValue.id} (pod-linija zvanične porodice, ne zasebna porodica)` : prefixOf.map((family) => `${family.id} ${family.officialName}`),
  };
});

/* ── 3. Brojevi artikala koje navodi lokalna dokumentacija i kod ── */
const FILES = ["lib/sata-brand-data.ts", "lib/carsystem-data.ts", "docs/SATA_RESEARCH.md", "docs/SATA_CONTENT_ASSET_MAP.md"];
const cited = new Map();
for (const file of FILES) {
  const full = path.join(REPO_ROOT, file);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, "utf8");
  // Samo brojevi uz „art.” ili u adresi sata.com — go broj u tekstu nije dokaz da je broj artikla.
  for (const match of text.matchAll(/(?:art\.\s*|sata\.com\/[^\s)|]*\/)(\d{5,8})\b/g)) {
    if (!cited.has(match[1])) cited.set(match[1], new Set());
    cited.get(match[1]).add(file);
  }
}
const citedArticles = [...cited].map(([articleNumber, files]) => ({
  articleNumber,
  files: [...files],
  official: articleIndex.get(articleNumber) ?? null,
  classification: articleIndex.has(articleNumber) ? "EXACT_MATCH" : "UNKNOWN",
})).sort((a, b) => a.articleNumber.localeCompare(b.articleNumber, "en", { numeric: true }));

/* ── 4. Lokalni fajlovi ── */
const list = (dir) => (existsSync(path.join(REPO_ROOT, dir)) ? readdirSync(path.join(REPO_ROOT, dir)) : []);
const assets = {
  productImages: list("public/products/sata"),
  brandAssets: list("public/brands").filter((file) => /sata/i.test(file)),
  brandMono: list("public/brands/mono").filter((file) => /sata/i.test(file)),
  components: list("components/brand/sata"),
  manufacturerStaging: list("assets/manufacturer/sata"),
};

const count = (rows, key) => rows.filter((row) => row.classification === key).length;
writeJson(PATHS.inventory, {
  summary: {
    underlyingRecords: ours.length,
    variantFamilyMembers: ours.filter((product) => runtime.getFamilyForProduct(product)).length,
    redirectOnlyRecords: ours.filter((product) => runtime.variantSlugs.has(product.slug)).length,
    visibleCards: cards.length,
    records: { EXACT_MATCH: count(records, "EXACT_MATCH"), HIGH_CONFIDENCE: count(records, "HIGH_CONFIDENCE"), PROBABLE: 0, LEGACY_LOCAL_ONLY: count(records, "LEGACY_LOCAL_ONLY"), DUPLICATE: 0, UNKNOWN: 0 },
    brandPageFamilies: { total: brandFamilies.length, EXACT_MATCH: count(brandFamilies, "EXACT_MATCH"), HIGH_CONFIDENCE: count(brandFamilies, "HIGH_CONFIDENCE"), PROBABLE: count(brandFamilies, "PROBABLE"), UNKNOWN: count(brandFamilies, "UNKNOWN") },
    citedArticleNumbers: { total: citedArticles.length, EXACT_MATCH: count(citedArticles, "EXACT_MATCH"), UNKNOWN: count(citedArticles, "UNKNOWN") },
  },
  records,
  brandFamilies,
  citedArticles,
  assets,
});
console.log(JSON.stringify(readJson(PATHS.inventory).summary, null, 1));
