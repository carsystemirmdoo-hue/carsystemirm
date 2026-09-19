#!/usr/bin/env node
/**
 * R-M sync — COVERAGE GATE nad STVARNIM runtime katalogom.
 *
 *   A = trenutno aktivne zvanične R-M porodice/zapisi (info portal + website-only sistem)
 *   B = koliko ih je zastupljeno lokalno
 *   C = trenutne zvanične R-M OZNAKE proizvoda (javna šifra; brojevi artikala nisu objavljeni)
 *   D = koliko ih je zastupljeno lokalno i vezano za tačan zapis
 *
 * Mora važiti B == A, D == C, ACTIVE_PRODUCT_MISSING = 0, ACTIVE_CODE_MISSING = 0,
 * DUPLICATE_ACTIVE_CODE = 0. Komponente sistema bez kartice (mixing clear / adjusting base)
 * se NE računaju u pokrivenost — izveštavaju se zasebno.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
const plan = readJson(PATHS.plan);
const dataset = readJson(PATHS.siteDataset, { products: [], enrichments: {} });
if (!source || !plan) throw new Error("Nedostaje source/plan — pokrenuti `npm run rm:sync:plan`.");

const { products: runtimeProducts } = loadCatalogRuntime();
const ours = runtimeProducts.filter((product) => product.brandSlug === "rm");
const bySlug = new Map(ours.map((product) => [product.slug, product]));

/* -- A/B: zapisi ------------------------------------------------------------------------- */

const expected = plan.items.map((item) => ({ sourceKey: item.sourceKey, code: item.code, name: item.officialName, slug: item.slug, action: item.action }));
const productRows = expected.map((entry) => ({ ...entry, present: Boolean(entry.slug && bySlug.has(entry.slug)) }));
const ACTIVE_PRODUCT_MISSING = productRows.filter((row) => !row.present);

/* -- C/D: oznake ------------------------------------------------------------------------- */

/*
 * Oznake koje zapis nosi u runtime-u. Bez provere OBLIKA: zvanični identifikator portala ume
 * da bude i imenski („ONYX HD”, „SC T2A203”, „GHD CV 12”), pa se traži doslovno poklapanje sa
 * oznakom iz plana, a ne slaganje sa šablonom. Pojmovi pretrage se NE računaju kao vlasništvo:
 * linija „AGILIS” stoji u pojmovima desetak proizvoda, a nosilac te oznake je jedan sistem.
 */
const codesOf = (product) => new Set([product.manufacturerCode, product.sku, product.externalSku].filter((value) => typeof value === "string" && value.trim()).map((value) => value.replace(/\s+/g, " ").trim()));
const ownerByCode = new Map();
for (const product of ours) for (const code of codesOf(product)) ownerByCode.set(code, [...(ownerByCode.get(code) ?? []), product.slug]);

const codeRows = plan.items
  .filter((item) => item.code)
  .map((item) => {
    const owners = ownerByCode.get(item.code) ?? [];
    return { code: item.code, slug: item.slug, owners, status: !owners.length ? "MISSING" : owners.includes(item.slug) ? (owners.length > 1 ? "DUPLICATE" : "OK") : "ATTACHED_TO_WRONG_PRODUCT" };
  });
const ACTIVE_CODE_MISSING = codeRows.filter((row) => row.status === "MISSING");
const attachedToWrongProduct = codeRows.filter((row) => row.status === "ATTACHED_TO_WRONG_PRODUCT");
const duplicateActiveCodes = codeRows.filter((row) => row.status === "DUPLICATE");

/* -- Duplikati i slike -------------------------------------------------------------------- */

const slugCounts = new Map();
for (const product of ours) slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1);
const duplicateProductSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);

const referenced = new Set(ours.flatMap((product) => [product.productImage?.src, ...(product.galleryImages ?? []).map((image) => image.src)]).filter(Boolean));
const publicFiles = existsSync(PATHS.publicImages) ? readdirSync(PATHS.publicImages).filter((file) => file.endsWith(".webp")) : [];
const orphanImages = publicFiles.map((file) => `${PUBLIC_IMAGE_URL_PREFIX}/${file}`).filter((src) => !referenced.has(src));
const brokenImageReferences = [...referenced].filter((src) => src.startsWith("/") && !existsSync(path.join(REPO_ROOT, "public", src)));
const bySha = new Map();
for (const file of publicFiles) {
  const hash = createHash("sha256").update(readFileSync(path.join(PATHS.publicImages, file))).digest("hex");
  bySha.set(hash, [...(bySha.get(hash) ?? []), file]);
}
const duplicateImages = [...bySha.values()].filter((files) => files.length > 1);
const hotlinked = ours.filter((product) => /^https?:/.test(product.productImage?.src ?? ""));

/* -- Izveštaj ----------------------------------------------------------------------------- */

const failures = [
  ...ACTIVE_PRODUCT_MISSING.map((row) => `ACTIVE_PRODUCT_MISSING: ${row.code ?? row.name}`),
  ...ACTIVE_CODE_MISSING.map((row) => `ACTIVE_CODE_MISSING: ${row.code}`),
  ...duplicateActiveCodes.map((row) => `DUPLICATE_ACTIVE_CODE: ${row.code} → ${row.owners.join(", ")}`),
  ...attachedToWrongProduct.map((row) => `ATTACHED_TO_WRONG_PRODUCT: ${row.code} → ${row.owners.join(", ")}`),
  ...duplicateProductSlugs.map((slug) => `DUPLICATE_SLUG: ${slug}`),
  ...brokenImageReferences.map((src) => `BROKEN_IMAGE: ${src}`),
  ...hotlinked.map((product) => `HOTLINKED_IMAGE: ${product.slug}`),
];

const result = {
  coverage: {
    A_currentOfficialRecords: productRows.length,
    B_representedLocally: productRows.filter((row) => row.present).length,
    C_currentOfficialCodes: codeRows.length,
    D_representedLocally: codeRows.filter((row) => row.status === "OK").length,
    productCoveragePercent: Number(((productRows.filter((row) => row.present).length / productRows.length) * 100).toFixed(1)),
    codeCoveragePercent: Number(((codeRows.filter((row) => row.status === "OK").length / codeRows.length) * 100).toFixed(1)),
  },
  breakdown: {
    importedThisSync: dataset.products.length,
    enrichedExisting: Object.keys(dataset.enrichments ?? {}).length,
    systems: plan.items.filter((item) => item.kind === "system").length,
    standaloneComponents: plan.items.filter((item) => item.kind === "component").length,
    websiteOnlySystems: plan.summary.CURRENT_WEBSITE_ONLY_SYSTEMS,
    systemComponentsWithoutCards: source.systemComponents.map((component) => component.code),
    legacyLocalOnly: plan.summary.LEGACY_LOCAL_ONLY,
    documentationGaps: plan.summary.DOCUMENTATION_GAPS,
    websiteOrphans: plan.summary.WEBSITE_ORPHANS,
    missingOfficialAssets: plan.summary.MISSING_OFFICIAL_ASSETS.length,
    runtimeRmProducts: ours.length,
  },
  ACTIVE_PRODUCT_MISSING,
  ACTIVE_CODE_MISSING,
  duplicateActiveCodes,
  attachedToWrongProduct,
  duplicateProductSlugs,
  images: { published: publicFiles.length, referenced: [...referenced].filter((src) => src.startsWith(PUBLIC_IMAGE_URL_PREFIX)).length, orphanImages, duplicateImages, brokenImageReferences, hotlinked: hotlinked.map((product) => product.slug) },
  failures,
};

writeJson(PATHS.reconciliation, result);
writeFileSync(
  PATHS.reconciliationMarkdown,
  [
    "# R-M sync — coverage gate",
    "",
    "| mera | vrednost |",
    "| --- | --- |",
    ...Object.entries(result.coverage).map(([key, value]) => `| ${key} | ${value} |`),
    ...Object.entries(result.breakdown).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`),
    `| Objavljene slike / siročad / duplikati | ${publicFiles.length} / ${orphanImages.length} / ${duplicateImages.length} |`,
    `| Neuspesi | ${failures.length} |`,
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ coverage: result.coverage, breakdown: { ...result.breakdown, systemComponentsWithoutCards: result.breakdown.systemComponentsWithoutCards.length }, ACTIVE_PRODUCT_MISSING: ACTIVE_PRODUCT_MISSING.length, ACTIVE_CODE_MISSING: ACTIVE_CODE_MISSING.length, DUPLICATE_ACTIVE_CODE: duplicateActiveCodes.length, attachedToWrongProduct: attachedToWrongProduct.length, images: { published: publicFiles.length, orphan: orphanImages.length, duplicates: duplicateImages.length, broken: brokenImageReferences.length }, failures }, null, 2));
if (failures.length) process.exitCode = 1;
