#!/usr/bin/env node
/**
 * baslac sync — COVERAGE GATE nad STVARNIM runtime katalogom.
 *
 *   A = aktuelni zvanični baslac zapisi (52 šifre + 4 sistema)
 *   B = koliko ih je zastupljeno lokalno
 *   C = aktuelne zvanične baslac OZNAKE proizvoda (brojevi artikala nisu javni)
 *   D = koliko ih je zastupljeno lokalno i vezano za tačan zapis
 *
 * Mora važiti B == A, D == C, ACTIVE_PRODUCT_MISSING = 0, ACTIVE_CODE_MISSING = 0,
 * DUPLICATE_ACTIVE_CODE = 0. Mixing komponente sistema NEMAJU karticu i ne računaju se
 * u pokrivenost — izveštavaju se zasebno, kao i toneri koji ostaju varijante porodice.
 *
 * Broj VIDLJIVIH kartica se MERI iz runtime modela (porodice + samostalni zapisi), nikada
 * se ne upisuje unapred: kartica je ono što katalog zaista prikaže.
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
if (!source || !plan) throw new Error("Nedostaje source/plan — pokrenuti `npm run baslac:sync:plan`.");

const runtimeData = loadCatalogRuntime();
const ours = runtimeData.products.filter((product) => product.brandSlug === "baslac");
const bySlug = new Map(ours.map((product) => [product.slug, product]));

/* -- A/B: zapisi ------------------------------------------------------------------------- */

const expected = plan.items
  .filter((item) => item.action === "IMPORT" || item.action === "ENRICH_EXISTING")
  .map((item) => ({ sourceKey: item.sourceKey, code: item.code, name: item.officialName, slug: item.slug, kind: item.kind, action: item.action }));
const productRows = expected.map((entry) => ({ ...entry, present: Boolean(entry.slug && bySlug.has(entry.slug)) }));
const ACTIVE_PRODUCT_MISSING = productRows.filter((row) => !row.present);

/* -- C/D: oznake ------------------------------------------------------------------------- */

/** Vlasništvo nad oznakom: samo `manufacturerCode`, `sku` i `externalSku` — ne pojmovi pretrage. */
const codesOf = (product) =>
  new Set(
    [product.manufacturerCode, product.sku, product.externalSku]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.replace(/^BASLAC-/i, "").replace(/-(\d+(?:[.,]\d+)?)(L|ML|KG)$/i, "").replace(/\s+/g, " ").trim().toUpperCase()),
  );
const ownerByCode = new Map();
for (const product of ours) for (const code of codesOf(product)) ownerByCode.set(code, [...(ownerByCode.get(code) ?? []), product.slug]);

/*
 * Jedna šifra sme da stoji na više zapisa SAMO ako su to pakovanja iste porodice
 * (`20-24` postoji kao 1 L i 4 L, a kartica je jedna). Dva zapisa u različitim porodicama
 * su stvaran duplikat i ruše gate.
 */
const familyOf = (slug) => {
  const product = bySlug.get(slug);
  const family = product ? runtimeData.getFamilyForProduct(product) : null;
  return family?.slug ?? slug;
};
const codeRows = plan.items
  .filter((item) => item.code && (item.action === "IMPORT" || item.action === "ENRICH_EXISTING"))
  .map((item) => {
    const owners = ownerByCode.get(item.code.toUpperCase()) ?? [];
    const sameFamily = new Set(owners.map(familyOf)).size === 1;
    const status = !owners.length
      ? "MISSING"
      : !owners.includes(item.slug)
        ? "ATTACHED_TO_WRONG_PRODUCT"
        : owners.length === 1 || sameFamily
          ? "OK"
          : "DUPLICATE";
    return { code: item.code, slug: item.slug, owners, packaging: owners.length > 1 && sameFamily, status };
  });
const ACTIVE_CODE_MISSING = codeRows.filter((row) => row.status === "MISSING");
const attachedToWrongProduct = codeRows.filter((row) => row.status === "ATTACHED_TO_WRONG_PRODUCT");
const duplicateActiveCodes = codeRows.filter((row) => row.status === "DUPLICATE");

/* -- Model kartica: mereno iz runtime-a --------------------------------------------------- */

const variantSlugs = runtimeData.variantSlugs;
const baslacFamilies = runtimeData.families.filter((family) => family.brandSlug === "baslac");
const standalone = ours.filter((product) => !variantSlugs.has(product.slug));
const familyMembers = ours.filter((product) => variantSlugs.has(product.slug));
const syncSlugs = new Set(dataset.products.map((product) => product.slug));
const enrichedSlugs = new Set(Object.keys(dataset.enrichments ?? {}));
const systemFamilySlugs = new Set(dataset.products.filter((product) => product.kind === "system").map((product) => product.family?.identity?.slug));

const cards = {
  VISIBLE_CUSTOMER_FACING_CARDS: baslacFamilies.length + standalone.length,
  families: baslacFamilies.length,
  standaloneCards: standalone.length,
  systemCards: baslacFamilies.filter((family) => systemFamilySlugs.has(family.slug)).length,
  currentProductCards:
    baslacFamilies.filter((family) => !systemFamilySlugs.has(family.slug) && family.variants.some((variant) => enrichedSlugs.has(variant.slug) || syncSlugs.has(variant.slug))).length +
    standalone.filter((product) => syncSlugs.has(product.slug) || enrichedSlugs.has(product.slug)).length,
  legacyStandaloneCards: standalone.filter((product) => !syncSlugs.has(product.slug) && !enrichedSlugs.has(product.slug)).map((product) => product.slug),
};

const breakdown = {
  UNDERLYING_PRODUCT_RECORDS: ours.length,
  importedThisSync: dataset.products.length,
  enrichedExisting: enrichedSlugs.size,
  VARIANT_FAMILY_MEMBERS: familyMembers.length,
  REDIRECT_ONLY_RECORDS: familyMembers.filter((product) => runtimeData.familyPath(runtimeData.getFamilyForProduct(product)) && runtimeData.getFamilyForProduct(product).presentation === "variant-pdp").length,
  LEGACY_NESTED_RECORDS: familyMembers.filter((product) => !syncSlugs.has(product.slug) && !enrichedSlugs.has(product.slug)).length,
  NESTED_MIXING_COMPONENTS: plan.items.filter((item) => item.action === "NEST_IN_SYSTEM").map((item) => item.code),
  PROMOTED_FROM_LINE: plan.summary.PROMOTED_FROM_LINE,
  UNCERTAIN_NOT_CUSTOMER_FACING: plan.items.filter((item) => item.action === "SKIPPED_UNCERTAIN").map((item) => item.code),
  CURRENT_PUBLIC_TONERS: 0,
  MISSING_OFFICIAL_ASSETS: plan.summary.MISSING_OFFICIAL_ASSETS,
};

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
    codesWithPackagingVariants: codeRows.filter((row) => row.packaging).map((row) => row.code),
  },
  cards,
  breakdown,
  ACTIVE_PRODUCT_MISSING,
  ACTIVE_CODE_MISSING,
  duplicateActiveCodes,
  attachedToWrongProduct,
  duplicateProductSlugs,
  families: baslacFamilies.map((family) => ({ slug: family.slug, name: family.name, variants: family.variants.length, presentation: family.presentation, system: systemFamilySlugs.has(family.slug) })),
  standaloneCards: standalone.map((product) => ({ slug: product.slug, sku: product.sku, source: syncSlugs.has(product.slug) ? "sync" : enrichedSlugs.has(product.slug) ? "dopunjen" : "legacy" })),
  images: { published: publicFiles.length, referenced: [...referenced].filter((src) => src.startsWith(PUBLIC_IMAGE_URL_PREFIX)).length, orphanImages, duplicateImages, brokenImageReferences, hotlinked: hotlinked.map((product) => product.slug) },
  failures,
};

writeJson(PATHS.reconciliation, result);
writeFileSync(
  PATHS.reconciliationMarkdown,
  [
    "# baslac sync — coverage gate",
    "",
    "| mera | vrednost |",
    "| --- | --- |",
    ...Object.entries(result.coverage).map(([key, value]) => `| ${key} | ${value} |`),
    ...Object.entries(cards).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`),
    ...Object.entries(breakdown).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? `${value.length}${value.length ? ` (${value.join(", ")})` : ""}` : value} |`),
    `| Objavljene slike / siročad / duplikati | ${publicFiles.length} / ${orphanImages.length} / ${duplicateImages.length} |`,
    `| Neuspesi | ${failures.length} |`,
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ coverage: result.coverage, cards, breakdown, ACTIVE_PRODUCT_MISSING: ACTIVE_PRODUCT_MISSING.length, ACTIVE_CODE_MISSING: ACTIVE_CODE_MISSING.length, DUPLICATE_ACTIVE_CODE: duplicateActiveCodes.length, attachedToWrongProduct: attachedToWrongProduct.length, images: { published: publicFiles.length, orphan: orphanImages.length, duplicates: duplicateImages.length, broken: brokenImageReferences.length }, failures }, null, 2));
if (failures.length) process.exitCode = 1;
