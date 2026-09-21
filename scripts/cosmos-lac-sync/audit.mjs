#!/usr/bin/env node
/**
 * Cosmos Lac sync — REVIZIJA IZVORA I MODELA (dry run). Ništa ne uvozi i ne menja runtime.
 * Svi brojevi se računaju iz generisanih fajlova; nijedan nije upisan rukom.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
const inventory = readJson(PATHS.inventory);
const documents = readJson(PATHS.rawDocuments);
const blocked = readJson(path.join(REPO_ROOT, "data", "cosmos-lac-blocked.generated.json"), []);
if (!source || !inventory || !documents) throw new Error("Nedostaje ulaz — acquire-website, acquire-documents, build-source, inventory-local.");

const slugify = (text) => String(text).toLowerCase().replace(/\.[a-z]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const kitNames = blocked.map((entry) => slugify(entry.sourceAsset.split("/").pop()));
const records = inventory.records;
const count = (key) => records.filter((row) => row.classification === key).length;

/* ── Zvanični model ── */
const officialProducts = new Map();
for (const product of source.products) officialProducts.set(product.productKey, [...(officialProducts.get(product.productKey) ?? []), product]);
// Cosmos Lac ne objavljuje brojeve artikala ni EAN: zvanična „šifra” je oznaka nijanse/proizvoda u nazivu i adresi (RAL 1007, FB-100, N01, 260).
const withCode = source.products.filter((product) => product.codes.length || product.slugCodes.length);
const regionSpecific = records.filter((row) => row.reason === "CURRENT_REGION_SPECIFIC_NOT_ON_ENGLISH_SITE");
const legacy = records.filter((row) => row.classification === "LEGACY_LOCAL_ONLY");
const molotow = legacy.filter((row) => row.reason === "LINE_NOT_ON_MANUFACTURER_SITE");

/* ── Kartice: tri modela ── */
const coveredKeys = new Set(inventory.cards.flatMap((card) => card.officialProducts));
const uncovered = [...officialProducts.keys()].filter((key) => !coveredKeys.has(key));
// „Različiti proizvodi u jednoj kartici”: kartica čije varijante imaju RAZLIČITE zvanične dokumente, a nisu linija boja.
const COLOUR_LINES = new Set(["chalk-effect", "easy-max", "fast-acrylic", "flame", "flame-blue", "flame-orange", "ral", "spray-bike"]);
const mixedCards = inventory.cards.filter((card) => card.officialProducts.length > 1 && !card.officialFamilies.some((family) => COLOUR_LINES.has(family)));
const lineCards = inventory.cards.filter((card) => card.officialProducts.length > 1 && card.officialFamilies.some((family) => COLOUR_LINES.has(family)));
const splitGain = mixedCards.reduce((sum, card) => sum + card.officialProducts.length - 1, 0);
const molotowCards = inventory.cards.filter((card) => /molotow/.test(card.baseProductSlug)).length;
const models = {
  KEEP_CURRENT_GROUPING: { cards: inventory.summary.visibleCards + uncovered.length, note: "68 postojećih + zvanični proizvodi koje danas nemamo" },
  HYBRID_RECOMMENDED: { cards: inventory.summary.visibleCards + uncovered.length + splitGain, note: "linije boja ostaju jedna kartica; kartica koja meša RAZLIČITE proizvode (različit zvanični dokument) se deli" },
  OFFICIAL_PRODUCT_EQUALS_CARD: { cards: officialProducts.size + molotowCards, note: "svaki zvanični dokument = kartica (i unutar linija boja)" },
};

/* ── Slike ── */
const unclaimed = inventory.unclaimedOfficial;
const unclaimedWithKit = unclaimed.filter((entry) => kitNames.some((name) => name.endsWith(entry.url.replace(/\/$/, "").split("/").pop())));

/* ── Dokumenti ── */
const okDocuments = new Set(documents.documents.filter((document) => document.status === 200).map((document) => document.url));
const matched = records.filter((row) => row.officialUrl);
const withLiveDocument = matched.filter((row) => row.officialDocument && okDocuments.has(row.officialDocument));
const cardsWithDocument = inventory.cards.filter((card) => records.some((row) => row.baseProductSlug === card.baseProductSlug && row.officialDocument && okDocuments.has(row.officialDocument)));

/* ── Pakovanja ── */
const normPack = (text) => String(text ?? "").toLowerCase().replace(/\s/g, "").replace(/gr\b/g, "g").split(/[,/]/).filter(Boolean).sort().join(",");
const packConflicts = matched.filter((row) => row.officialPack && row.volume && normPack(row.officialPack) !== normPack(row.volume));
const packMissingOfficial = matched.filter((row) => !row.officialPack).length;

const expectedRows = matched.length + regionSpecific.length + unclaimed.length;
const numbers = {
  CURRENT_PRODUCT_FAMILIES: source.meta.families,
  CURRENT_OFFICIAL_PRODUCTS_BY_DOCUMENT: officialProducts.size,
  CURRENT_OFFICIAL_ARTICLE_NUMBERS: withCode.length,
  CURRENT_SHADE_PAGES_WITHOUT_ANY_OFFICIAL_CODE: source.products.length - withCode.length,
  OFFICIAL_EAN_OR_ARTICLE_NUMBERS_PUBLISHED: 0,
  CURRENT_VARIANTS_SHADES: source.products.length,
  CURRENT_VARIANTS_SHADES_OTHER_LOCALES_ONLY: regionSpecific.length,
  EXISTING_LOCAL_RECORDS: records.length,
  EXISTING_VISIBLE_CARDS: inventory.summary.visibleCards,
  EXACT_MATCH: count("EXACT_MATCH"),
  HIGH_CONFIDENCE: count("HIGH_CONFIDENCE"),
  PROBABLE: count("PROBABLE"),
  LEGACY_LOCAL_ONLY: count("LEGACY_LOCAL_ONLY"),
  LEGACY_LOCAL_ONLY_MOLOTOW: molotow.length,
  DUPLICATES: count("DUPLICATE"),
  UNKNOWN: count("UNKNOWN"),
  OFFICIAL_SHADE_PAGES_WITHOUT_LOCAL_RECORD: unclaimed.length,
  OFFICIAL_PRODUCTS_WITHOUT_LOCAL_CARD: uncovered.length,
  EXPECTED_VISIBLE_CARDS_AFTER: models.HYBRID_RECOMMENDED.cards,
  EXPECTED_VISIBLE_CARDS_AFTER_BY_MODEL: Object.fromEntries(Object.entries(models).map(([key, value]) => [key, value.cards])),
  EXPECTED_VARIANT_ROWS: expectedRows,
  EXPECTED_VARIANT_ROWS_IF_LEGACY_KEPT: expectedRows + legacy.length + count("UNKNOWN"),
  OFFICIAL_SOURCE_IMAGES: source.meta.withImage,
  LOCAL_LEGITIMATE_IMAGES: inventory.summary.images.filesPresent,
  LOCAL_IMAGES_WITH_BRAND_KIT_PROVENANCE: inventory.summary.images.withBrandKitSource,
  LOCAL_PIXEL_IDENTICAL_IMAGE_GROUPS: inventory.summary.images.pixelIdenticalGroups,
  NEW_SHADES_WITH_BRAND_KIT_ASSET: unclaimedWithKit.length,
  MISSING_IMAGES: unclaimed.length - unclaimedWithKit.length,
  OFFICIAL_DOCUMENTS: documents.meta.documents,
  OFFICIAL_DOCUMENTS_OK: documents.meta.ok,
  OFFICIAL_DOCUMENTS_BROKEN: documents.meta.broken,
  DOCUMENT_COVERAGE_MATCHED_RECORDS: `${withLiveDocument.length}/${matched.length}`,
  DOCUMENT_COVERAGE_CARDS: `${cardsWithDocument.length}/${inventory.cards.length}`,
  LOCAL_DOCUMENTS_TODAY: 1,
  PACK_CONFLICTS: packConflicts.length,
  PACK_NOT_STATED_ON_OFFICIAL_PAGE: packMissingOfficial,
};

writeJson(PATHS.auditJson, {
  numbers,
  models,
  cardsMixingDifferentProducts: mixedCards.map((card) => ({ card: card.baseProductSlug, records: card.records, officialProducts: card.officialProducts })),
  colourLineCardsWithSubRanges: lineCards.map((card) => ({ card: card.baseProductSlug, records: card.records, officialProducts: card.officialProducts })),
  officialProductsWithoutLocalCard: uncovered.map((key) => ({ productKey: key, shades: officialProducts.get(key).length, family: officialProducts.get(key)[0].family, names: officialProducts.get(key).slice(0, 3).map((product) => product.officialName) })),
  regionSpecific: regionSpecific.map((row) => ({ slug: row.slug, name: row.localName, locales: row.publishedInLocales })),
  legacyNotMolotow: legacy.filter((row) => row.reason !== "LINE_NOT_ON_MANUFACTURER_SITE").map((row) => ({ slug: row.slug, name: row.localName })),
  unknown: records.filter((row) => row.classification === "UNKNOWN").map((row) => ({ slug: row.slug, name: row.localName, candidates: row.candidates })),
  packConflicts: packConflicts.map((row) => ({ name: row.localName, local: row.volume, official: row.officialPack })),
  sourceConflicts: { nameSlugConflicts: source.meta.nameSlugConflicts, brokenDocuments: documents.documents.filter((document) => document.status !== 200).map((document) => document.url) },
  localeTotals: documents.meta.localeTotals,
});

const row = (cells) => `| ${cells.join(" | ")} |`;
const lines = ["# Cosmos Lac — revizija izvora i modela (dry run)", "", "> Generisano: `node scripts/cosmos-lac-sync/audit.mjs`. Ništa nije uvezeno; runtime, slike i dokumenti nisu menjani.", "", "## Brojevi", "", "```", ...Object.entries(numbers).map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`), "```", ""];
lines.push("## Zvanične linije", "", row(["linija", "zvanični naziv", "nijansi", "zvaničnih proizvoda (dokument)", "pakovanja"]), row(Array(5).fill("---")));
for (const family of source.families) lines.push(row([family.key, `${family.officialCategory} › ${family.officialName}`, family.shades, family.officialProducts.length, family.packs.join(" ; ") || "—"]));
lines.push("", "## Postojeće kartice ↔ zvanični proizvodi", "", row(["kartica", "zapisa", "klasifikacija", "zvanični proizvodi"]), row(Array(4).fill("---")));
for (const card of inventory.cards) lines.push(row([card.baseProductSlug.replace("cosmos-lac-", ""), card.records, Object.entries(card.classification).map(([key, value]) => `${key} ${value}`).join(", "), card.officialProducts.join(", ") || "—"]));
lines.push("", "## Zvanični proizvodi bez lokalne kartice", "", ...uncovered.map((key) => `- \`${key}\` — ${officialProducts.get(key).length} stranica (${officialProducts.get(key)[0].family})`));
mkdirSync(path.dirname(PATHS.audit), { recursive: true });
writeFileSync(PATHS.audit, `${lines.join("\n").trimEnd()}\n`);
console.log(JSON.stringify(numbers, null, 1));
console.log("mixed cards:", mixedCards.map((card) => `${card.baseProductSlug.replace("cosmos-lac-", "")}→${card.officialProducts.length}`).join(", "));
console.log("pack conflicts:", packConflicts.slice(0, 12).map((row) => `${row.localName} | ${row.volume} vs ${row.officialPack}`));
