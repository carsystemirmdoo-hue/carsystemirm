#!/usr/bin/env node
/**
 * Cosmos Lac sync, korak 3 — PLAN (hibridni model, odobren 2026-09-21).
 *
 *   A = odobreni aktuelni zvanični PROIZVODI (zvanični dokument = proizvod), bez `CURRENT_OUT_OF_SCOPE`
 *   C = odobreni aktuelni identiteti NIJANSI/varijanti: engleske stranice u opsegu + identiteti koje
 *       zvanični sajt objavljuje samo na drugim jezicima, a naš katalog ih već vodi
 *
 * Oba broja se RAČUNAJU iz izvornog modela; ništa nije upisano rukom. Posle odobrenja se zaključavaju
 * u `scope-lock.json`, pa svaka kasnija promena (pravila ili izvora) obara plan.
 *
 * Postojećih 742 zapisa se ne prepisuje: plan im dodaje zvanični identitet, dokument, status
 * pakovanja i — za sedam kartica koje su mešale različite proizvode — novu grupu. Slike se ne diraju.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, PLACEHOLDER_IMAGE } from "./lib/config.mjs";
import { createMatcher, slugify } from "./lib/match.mjs";

const source = readJson(PATHS.source);
const sitemap = readJson(PATHS.rawSitemap);
const documents = readJson(PATHS.rawDocuments);
const local = readJson(PATHS.localDataset);
const scope = JSON.parse(readFileSync(PATHS.scope, "utf8"));
const lock = readJson(PATHS.scopeLock, null);
if (!source || !sitemap || !documents || !local) throw new Error("Nedostaje izvor — `npm run cosmos-lac:sync:acquire`.");

const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const planErrors = { scopeDrift: [], unknownRecords: [], duplicateClaims: [], slugCollisions: [], unknownScopeKeys: [], newProductMissing: [], splitMismatch: [] };

/* ── 1. Zvanični opseg ───────────────────────────────────────────────────────────────────── */
const productKeys = new Map();
for (const product of source.products) productKeys.set(product.productKey, [...(productKeys.get(product.productKey) ?? []), product]);
for (const key of [...Object.keys(scope.outOfScopeProducts), ...scope.newProducts]) if (!productKeys.has(key)) planErrors.unknownScopeKeys.push(key);
const outOfScope = new Set(Object.keys(scope.outOfScopeProducts));
const inScopeKeys = [...productKeys.keys()].filter((key) => !outOfScope.has(key)).sort();
const inScopePages = source.products.filter((product) => !outOfScope.has(product.productKey));
const okDocuments = new Set(documents.documents.filter((document) => document.status === 200).map((document) => document.url));
const documentKind = new Map(documents.documents.map((document) => [document.url, document.kind]));

/* ── 2. Pomirenje postojećih zapisa ───────────────────────────────────────────────────────── */
const match = createMatcher(source, sitemap);
const claims = new Map();
const rows = local.map((record) => {
  const result = match(record);
  if (result.official) claims.set(result.official.url, [...(claims.get(result.official.url) ?? []), record.slug]);
  return { record, result };
});
for (const { record, result } of rows) if (result.classification === "UNKNOWN") planErrors.unknownRecords.push({ slug: record.slug, candidates: result.candidates });
// Dva zapisa na istoj zvaničnoj stranici smeju biti samo varijante pakovanja (Fiberglass 1 kg / 5 kg).
for (const [url, slugs] of claims) {
  if (slugs.length < 2) continue;
  const volumes = new Set(slugs.map((slug) => local.find((record) => record.slug === slug).volume));
  if (volumes.size !== slugs.length) planErrors.duplicateClaims.push({ url, slugs });
}

const normPack = (text) => String(text ?? "").toLowerCase().replace(/\s/g, "").replace(/gr\b/g, "g").split(/[,/]/).filter(Boolean).sort().join(",");
const packLabel = (pack) => pack.trim().replace(/(\d)(ml|l|kg|gr|g)\b/gi, "$1 $2").replace(/\bgr\b/g, "g");
const packList = (official) => official.packs.flatMap((entry) => entry.split(",")).map(packLabel).filter(Boolean);
/*
 * Pakovanje koje vidi KUPAC, i odakle dolazi:
 *   OFFICIAL_CURRENT   — zvanična stranica navodi pakovanje → prikazuje se zvanično
 *   LOCAL_EXISTING     — zvanična stranica ga ne navodi, a katalog ga ima → prikazuje se postojeće
 *   SOURCE_UNSPECIFIED — nema ga ni izvor ni katalog → ne prikazuje se ništa (ne izmišlja se)
 * Lokalni podatak se NIKAD ne briše: i kada se razlikuje od zvaničnog ostaje u `local`, uz `localDiverges`.
 */
function packagingOf(record, official, sharesOfficialPage) {
  const local = record.volume ?? null;
  if (!official || !official.packs.length) return local ? { status: "LOCAL_EXISTING", customerFacing: local, official: null, local, localDiverges: false } : { status: "SOURCE_UNSPECIFIED", customerFacing: null, official: null, local: null, localDiverges: false };
  const packs = packList(official);
  // Više lokalnih zapisa na JEDNOJ zvaničnoj stranici su varijante pakovanja (Fiberglass 1 kg / 5 kg):
  // svaki prikazuje SVOJE pakovanje, a zvanična lista ga potvrđuje.
  if (sharesOfficialPage && local && packs.some((pack) => normPack(pack) === normPack(local))) return { status: "OFFICIAL_CURRENT", customerFacing: local, official: packs.join(", "), local, localDiverges: false };
  return { status: "OFFICIAL_CURRENT", customerFacing: packs.join(" / "), official: packs.join(", "), local, localDiverges: Boolean(local) && normPack(local) !== normPack(official.pack) };
}
function documentOf(official) {
  if (!official?.document) return null;
  // Dokument koji zvanični sajt ne isporučuje (404) se ne nudi kupcu; ostaje zabeležen u izvornom modelu.
  if (!okDocuments.has(official.document)) return { status: "OFFICIAL_SOURCE_BROKEN", href: official.document, kind: documentKind.get(official.document) ?? null };
  return { status: "AVAILABLE", href: official.document, kind: documentKind.get(official.document) ?? "PRODUCT_INFO" };
}

/* ── 3. Grupe (kartice) ───────────────────────────────────────────────────────────────────── */
const headOf = (products) => {
  // Zajednički početak zvaničnih naziva, bez šifre na kraju: „Tinted Wood Varnish 601” → „Tinted Wood Varnish”.
  const heads = products.map((product) => product.nameHead.replace(/\s*[-–]?\s*\b[A-Z]?\d{1,4}\b\s*$/i, "").trim());
  let prefix = heads[0] ?? "";
  for (const head of heads) while (prefix && !head.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
  return prefix.replace(/[\s\-–]+$/, "").trim() || heads[0];
};
const splitBases = new Set(Object.keys(scope.splitCards));
const groupOf = new Map(); // productKey → { base, identity }
const recordsByBase = new Map();
for (const { record } of rows) recordsByBase.set(record.baseProductSlug, [...(recordsByBase.get(record.baseProductSlug) ?? []), record]);

const enrichments = {};
const splitResult = {};
for (const { record, result } of rows) {
  const official = result.official ?? null;
  const inSplit = splitBases.has(record.baseProductSlug);
  let baseProductSlug = record.baseProductSlug;
  let familyIdentity = null;
  if (inSplit) {
    if (!official) { planErrors.splitMismatch.push({ slug: record.slug, reason: "zapis u kartici koja se deli nema zvanični proizvod" }); }
    else {
      const config = scope.splitCards[record.baseProductSlug];
      const members = rows.filter((entry) => entry.record.baseProductSlug === record.baseProductSlug && entry.result.official?.productKey === official.productKey);
      const name = `Cosmos Lac ${headOf(productKeys.get(official.productKey))}`;
      // Naslednik koji je ISTI proizvod kao stara kartica zadržava njenu grupu, pa i njenu adresu.
      baseProductSlug = config.keepBaseFor === official.productKey ? record.baseProductSlug : `cosmos-lac-${slugify(record.line)}-${slugify(official.productKey.replace(/^name:/, ""))}`;
      if (members.length > 1 && config.keepBaseFor !== official.productKey) familyIdentity = { name, slug: slugify(name) };
      (splitResult[record.baseProductSlug] ??= {})[official.productKey] = { baseProductSlug, records: members.length, card: members.length > 1 ? `family:${familyIdentity?.slug ?? "(zadržana adresa)"}` : "samostalna kartica" };
      groupOf.set(official.productKey, { base: baseProductSlug, identity: familyIdentity });
    }
  }
  const status = result.classification === "LEGACY_LOCAL_ONLY" ? "LEGACY_LOCAL_ONLY" : result.reason === "CURRENT_REGION_SPECIFIC_NOT_ON_ENGLISH_SITE" ? "CURRENT_REGION_SPECIFIC" : "CURRENT";
  enrichments[record.slug] = {
    status,
    classification: result.classification,
    matchedBy: result.by ?? null,
    reason: result.reason ?? null,
    officialUrl: official?.url ?? null,
    officialSlug: official?.slug ?? null,
    officialName: official ? (scope.sourceTitleInconsistencies[official.slug]?.identity ?? official.officialName) : null,
    sourceTitleInconsistency: official && scope.sourceTitleInconsistencies[official.slug] ? { status: "SOURCE_TITLE_INCONSISTENCY", ...scope.sourceTitleInconsistencies[official.slug] } : null,
    officialFamily: official?.family ?? null,
    officialProduct: official?.productKey ?? null,
    officialCodes: official ? [...new Set([...official.slugCodes, ...(scope.sourceTitleInconsistencies[official.slug] ? [] : official.codes)])] : [],
    // Poreklo za zapise koje engleski sajt nema: adrese istog proizvoda na drugim jezicima zvaničnog sajta.
    sourceLocales: result.locales ?? null,
    baseProductSlug,
    previousBaseProductSlug: baseProductSlug === record.baseProductSlug ? null : record.baseProductSlug,
    familyIdentity,
    packaging: packagingOf(record, official, official ? (claims.get(official.url) ?? []).length > 1 : false),
    document: documentOf(official),
  };
}

/* ── 4. Novi zapisi: zvanične stranice u opsegu koje nijedan lokalni zapis ne pokriva ────── */
const claimedUrls = new Set(claims.keys());
const FINISH_FROM_SLUG = [["polusjaj", /(^|-)(semigloss|satin)(-|$)/], ["mat", /(^|-)(matt|matte)(-|$)/], ["sjaj", /(^|-)gloss(-|$)/]];
const titleCase = (text) => (text === text.toUpperCase() ? text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).replace(/\bRal\b/g, "RAL") : text);
const siblingFor = (official) =>
  rows.find((entry) => entry.result.official?.productKey === official.productKey)?.record ??
  rows.find((entry) => entry.result.official?.family === official.family)?.record ?? null;

const usedSlugs = new Set(local.map((record) => record.slug));
const products = [];
for (const official of inScopePages.filter((page) => !claimedUrls.has(page.url)).sort((a, b) => a.url.localeCompare(b.url))) {
  const sibling = siblingFor(official);
  if (!sibling) { planErrors.newProductMissing.push({ url: official.url, reason: "nema srodnog zapisa iz iste zvanične linije" }); continue; }
  const isNewProduct = scope.newProducts.includes(official.productKey);
  const siblingSameProduct = rows.find((entry) => entry.result.official?.productKey === official.productKey);
  if (!isNewProduct && !siblingSameProduct) { planErrors.newProductMissing.push({ url: official.url, productKey: official.productKey, reason: "zvanični proizvod nije ni u opsegu novih ni van opsega" }); continue; }

  const ralCode = /(?:^|-)ral-(\d{4})(?:-|$)/.exec(official.slug)?.[1] ?? null;
  const code = official.slugCodes.find((entry) => !/^RAL /.test(entry) && entry !== ralCode) ?? null;
  // „Flame Orange Fo – 314 …” → „Flame Orange FO-314 …”: ista konvencija kao kod postojećih Flame zapisa.
  const name = titleCase(official.officialName).replace(/\s+–\s+/g, " ").replace(/\bF([bo])\s+(\d{3,4})\b/g, (_, letter, digits) => `F${letter.toUpperCase()}-${digits}`);
  const slug = `cosmos-lac-${official.slug}`;
  if (usedSlugs.has(slug)) { planErrors.slugCollisions.push(slug); continue; }
  usedSlugs.add(slug);

  let group;
  if (isNewProduct) {
    const members = productKeys.get(official.productKey).filter((page) => !claimedUrls.has(page.url));
    const groupName = `Cosmos Lac ${headOf(productKeys.get(official.productKey))}${official.isContainer && !/container/i.test(headOf(productKeys.get(official.productKey))) ? " Container" : ""}`;
    group = { base: `cosmos-lac-${slugify(sibling.line)}-${slugify(official.productKey.replace(/^name:/, ""))}${official.isContainer && !/container/.test(official.productKey) ? "-container" : ""}`, identity: members.length > 1 ? { name: groupName, slug: slugify(groupName) } : null };
  } else {
    // Nova nijansa postojećeg proizvoda ulazi u karticu u kojoj su njegove ostale nijanse.
    group = groupOf.get(official.productKey) ?? { base: enrichments[siblingSameProduct.record.slug].baseProductSlug, identity: null };
  }

  const ralSibling = ralCode ? local.find((record) => record.ralCode === ralCode && record.colorSource === "ral") : null;
  const finish = FINISH_FROM_SLUG.find(([, pattern]) => pattern.test(official.slug))?.[0] ?? null;
  products.push({
    id: `cl-${official.slug}`,
    slug,
    baseProductSlug: group.base,
    familyIdentity: group.identity,
    variantId: official.slug,
    line: sibling.line,
    officialName: `Cosmos Lac ${name}`,
    displayNameSr: `Cosmos Lac ${name}`,
    cosmosCode: code,
    ralCode,
    colorName: official.shade ? titleCase(official.shade) : null,
    finish,
    volume: official.packs.length ? packList(official).join(" / ") : null,
    programSlug: sibling.programSlug,
    primaryCategory: sibling.primaryCategory,
    technicalCategory: sibling.technicalCategory,
    useCase: sibling.useCase,
    visualTreatment: sibling.visualTreatment,
    // Nema zvaničnog Brand Kit fajla za ovu stranicu: placeholder sajta, bez slike sa sajta ili trećih strana.
    image: PLACEHOLDER_IMAGE,
    imageStatus: "NO_BRAND_KIT_ASSET",
    // Boja se preuzima samo kada je ISTI RAL već verifikovan u katalogu; inače neutralno, bez procene.
    visualMode: ralSibling ? "color-on-hover" : "neutral",
    backgroundColor: ralSibling?.backgroundColor ?? "#E7EAEE",
    foregroundTone: ralSibling?.foregroundTone ?? "dark",
    colorSource: ralSibling ? "ral" : "manual-estimate",
    colorConfidence: ralSibling ? "verified" : "provisional",
    templateSibling: sibling.slug,
    isNewOfficialProduct: isNewProduct,
    officialUrl: official.url,
    officialSlug: official.slug,
    officialNameSource: official.officialName,
    officialFamily: official.family,
    officialProduct: official.productKey,
    officialCodes: official.slugCodes,
    packaging: packagingOf({ volume: null }, official, false),
    document: documentOf(official),
  });
}
for (const key of scope.newProducts) if (!products.some((product) => product.officialProduct === key)) planErrors.newProductMissing.push({ productKey: key, reason: "odobren novi proizvod nema nijednu stranicu za uvoz" });

/* ── 5. A i C, zaključavanje ──────────────────────────────────────────────────────────────── */
const regionSpecific = Object.entries(enrichments).filter(([, entry]) => entry.status === "CURRENT_REGION_SPECIFIC");
const legacy = Object.entries(enrichments).filter(([, entry]) => entry.status === "LEGACY_LOCAL_ONLY");
const measured = {
  A_APPROVED_CURRENT_OFFICIAL_PRODUCTS: inScopeKeys.length,
  C_APPROVED_CURRENT_OFFICIAL_SHADE_VARIANT_IDENTITIES: inScopePages.length + regionSpecific.length,
  C_breakdown: { englishPagesInScope: inScopePages.length, otherLocaleIdentities: regionSpecific.length },
  officialProductsTotal: productKeys.size,
  officialPagesTotal: source.products.length,
  currentOutOfScopeProducts: outOfScope.size,
  currentOutOfScopePages: source.products.length - inScopePages.length,
  legacyLocalOnly: legacy.length,
  legacyMolotow: legacy.filter(([, entry]) => entry.reason === "LINE_NOT_ON_MANUFACTURER_SITE").length,
};
const sourceFingerprint = sha(source.products.map((product) => [product.url, product.productKey, product.packs, product.document]).concat(Object.entries(sitemap.localePaths).map(([locale, paths]) => [locale, paths.length])));
if (lock && JSON.stringify(lock.measured) !== JSON.stringify(measured)) {
  planErrors.scopeDrift.push(lock.sourceFingerprint === sourceFingerprint ? "SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE" : "SCOPE_CHANGED_WITH_SOURCE");
  planErrors.scopeDrift.push({ locked: lock.measured, measured });
}

if (process.argv.includes("--write-lock")) {
  writeJson(PATHS.scopeLock, {
    _comment: ["Izmereno iz izvornog modela i ODOBRENO (korisnik, 2026-09-21): A = zvanični proizvodi u opsegu, C = identiteti nijansi/varijanti u opsegu.", "Brojevi nisu upisani rukom — `plan.mjs --write-lock` ih piše iz merenja. Svaka kasnija razlika obara plan (SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE / SCOPE_CHANGED_WITH_SOURCE)."],
    approvedOn: "2026-09-21",
    sourceFingerprint,
    measured,
  });
}

const count = (key) => Object.values(enrichments).filter((entry) => entry.classification === key).length;
const packaging = [...Object.values(enrichments), ...products].reduce((acc, entry) => ({ ...acc, [entry.packaging.status]: (acc[entry.packaging.status] ?? 0) + 1 }), {});
packaging.customerFacingDiffersFromPreviousLocalDisplay = Object.entries(enrichments).filter(([slug, entry]) => normPack(entry.packaging.customerFacing) !== normPack(local.find((record) => record.slug === slug).volume)).length;
packaging.localDivergesKeptInProvenance = Object.values(enrichments).filter((entry) => entry.packaging.localDiverges).length;
writeJson(PATHS.plan, {
  meta: { model: "HYBRID", sourceFingerprint, locked: Boolean(lock) },
  summary: {
    measured,
    classification: Object.fromEntries(["EXACT_MATCH", "HIGH_CONFIDENCE", "PROBABLE", "LEGACY_LOCAL_ONLY", "DUPLICATE", "UNKNOWN"].map((key) => [key, count(key)])),
    enrichedExisting: Object.values(enrichments).filter((entry) => entry.officialUrl || entry.sourceLocales).length,
    newRecords: products.length,
    newOfficialProducts: [...new Set(products.filter((product) => product.isNewOfficialProduct).map((product) => product.officialProduct))],
    regionSpecific: regionSpecific.length,
    splitCards: splitResult,
    packaging,
    documents: { available: [...Object.values(enrichments), ...products].filter((entry) => entry.document?.status === "AVAILABLE").length, broken: [...Object.values(enrichments), ...products].filter((entry) => entry.document?.status === "OFFICIAL_SOURCE_BROKEN").length },
    sourceTitleInconsistencies: Object.values(enrichments).filter((entry) => entry.sourceTitleInconsistency).length,
    planErrors,
  },
  currentOutOfScope: [...outOfScope].map((key) => ({ productKey: key, status: "CURRENT_OUT_OF_SCOPE", pages: productKeys.get(key)?.length ?? 0, reason: scope.outOfScopeProducts[key] })),
  enrichments,
  products,
});

console.log(JSON.stringify({ measured, locked: Boolean(lock), newRecords: products.length, newOfficialProducts: [...new Set(products.filter((product) => product.isNewOfficialProduct).map((product) => product.officialProduct))], regionSpecific: regionSpecific.length, legacy: legacy.length, packaging, splitCards: Object.fromEntries(Object.entries(splitResult).map(([base, parts]) => [base, Object.keys(parts).length])), planErrors: Object.fromEntries(Object.entries(planErrors).map(([key, list]) => [key, list.length])) }, null, 1));
if (Object.values(planErrors).some((list) => list.length)) process.exitCode = 1;
