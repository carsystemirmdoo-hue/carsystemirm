#!/usr/bin/env node
/**
 * SATA sync — validacija generisanog dataseta (bez runtime-a).
 *
 * Proverava ono što se ne sme desiti ni tiho: izmišljen ili dupliran broj artikla, SATA slika u
 * runtime datasetu, cena, brošura na pogrešnom jeziku, izgubljen `?ts=` token, pomerena taksonomija.
 */

import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, SCOPE_NAME } from "./lib/config.mjs";
import { europeVariants, splitFamilies } from "./lib/scope.mjs";

const dataset = readJson(PATHS.siteDataset);
const source = readJson(PATHS.source);
const rawFamilies = readJson(PATHS.rawFamilies);
const taxonomy = JSON.parse(readFileSync(PATHS.taxonomy, "utf8"));
const lock = readJson(PATHS.scopeLock);
const entries = [...dataset.products, ...Object.values(dataset.enrichments)];
const { inScope } = splitFamilies(source, taxonomy);
const official = new Map(inScope.map((family) => [family.id, new Set(europeVariants(family).map((variant) => variant.articleNumber))]));
const rawDownloads = new Map(rawFamilies.families.map((family) => [family.id, new Set(family.downloads ?? [])]));

const errors = [];
const fail = (code, detail) => errors.push({ code, ...detail });

if (dataset.meta.scope !== SCOPE_NAME) fail("SCOPE_NAME", { found: dataset.meta.scope });
if (entries.length !== lock.scope.families) fail("FAMILY_COUNT", { expected: lock.scope.families, found: entries.length });

const slugs = new Set();
const numbers = new Map();
for (const entry of entries) {
  if (slugs.has(entry.slug)) fail("DUPLICATE_SLUG", { slug: entry.slug });
  slugs.add(entry.slug);
  const allowed = official.get(entry.familyId);
  if (!allowed) { fail("FAMILY_NOT_IN_SCOPE", { family: entry.familyId }); continue; }
  for (const variant of entry.variants) {
    // Broj artikla mora doslovno postojati na zvaničnom izvoru, u OVOJ porodici.
    if (!allowed.has(variant.articleNumber)) fail("ARTICLE_NOT_OFFICIAL_MEMBER", { family: entry.familyId, articleNumber: variant.articleNumber });
    if (numbers.has(variant.articleNumber)) fail("DUPLICATE_ARTICLE_NUMBER", { articleNumber: variant.articleNumber, owners: [numbers.get(variant.articleNumber), entry.familyId] });
    numbers.set(variant.articleNumber, entry.familyId);
  }
  for (const number of allowed) if (!entry.variants.some((variant) => variant.articleNumber === number)) fail("MISSING_ARTICLE_NUMBER", { family: entry.familyId, articleNumber: number });
  const configs = entry.variants.map((variant) => variant.config);
  if (new Set(configs).size !== configs.length) fail("DUPLICATE_CONFIG_LABEL", { family: entry.familyId });
  for (const document of entry.documents) {
    if (!rawDownloads.get(entry.familyId)?.has(document.href)) fail("DOCUMENT_HREF_NOT_VERBATIM", { family: entry.familyId, href: document.href });
    if (!document.href.startsWith("https://www.sata.com/media/")) fail("DOCUMENT_NOT_OFFICIAL_HOST", { href: document.href });
    if (document.kind === "brochure" && !["en", "multilingual"].includes(document.language)) fail("BROCHURE_LANGUAGE", { family: entry.familyId, href: document.href });
    if (!["manual", "declaration", "brochure"].includes(document.kind)) fail("DOCUMENT_KIND", { kind: document.kind });
  }
  for (const field of ["productType", "shortDescription", "longDescription", "purpose"]) if (!entry.content[field]?.trim()) fail("EMPTY_CONTENT", { family: entry.familyId, field });
}

const serialized = JSON.stringify(dataset);
// Dataset sajta ne sme da sadrži nijednu SATA sliku (rights gate) ni išta nalik ceni.
if (/\.(?:webp|png|jpe?g)\b/i.test(serialized)) fail("IMAGE_URL_IN_DATASET", {});
if (/"(?:price|cena|realPrice|amount)"/i.test(serialized)) fail("PRICE_IN_DATASET", {});
if (dataset.meta.images.APPROVED_RUNTIME_IMAGES !== 0) fail("RUNTIME_IMAGE_APPROVED_WITHOUT_RIGHTS", {});

const byCategory = entries.reduce((acc, entry) => ({ ...acc, [entry.taxonomy.category]: (acc[entry.taxonomy.category] ?? 0) + 1 }), {});
const APPROVED_TAXONOMY = { oprema: 42, pribor: 13, zastita: 9, radionica: 2 };
if (JSON.stringify(Object.entries(byCategory).sort()) !== JSON.stringify(Object.entries(APPROVED_TAXONOMY).sort())) fail("TAXONOMY_DISTRIBUTION", { expected: APPROVED_TAXONOMY, found: byCategory });

const report = {
  scope: SCOPE_NAME,
  families: entries.length,
  articleNumbers: numbers.size,
  documents: entries.reduce((sum, entry) => sum + entry.documents.length, 0),
  documentsByKind: entries.flatMap((entry) => entry.documents).reduce((acc, document) => ({ ...acc, [document.kind]: (acc[document.kind] ?? 0) + 1 }), {}),
  familiesWithDocuments: entries.filter((entry) => entry.documents.length).length,
  taxonomy: byCategory,
  images: dataset.meta.images,
  errors,
};
writeJson(PATHS.validation, report);
console.log(JSON.stringify({ ...report, errors: errors.slice(0, 20), errorCount: errors.length }, null, 1));
if (errors.length) process.exitCode = 1;
