#!/usr/bin/env node
/**
 * Norbin sync — COVERAGE GATE nad STVARNIM runtime katalogom.
 *
 *   A = aktuelni zvanični EMEA proizvodi (referentni region `en`)
 *   B = koliko ih je zastupljeno lokalno
 *   C = aktuelne zvanične EMEA oznake proizvoda
 *   D = koliko ih je zastupljeno lokalno i vezano za tačan zapis
 *
 * Norbin nema sloj brojeva artikala — jedna šifra je i proizvod i oznaka, pa je A ≡ C po
 * konstrukciji. To se ovde izričito beleži, da 100 % ne izgleda jače nego što jeste.
 *
 * Broj VIDLJIVIH kartica se MERI iz runtime modela; nikada se ne upisuje unapred.
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
const plan = readJson(PATHS.plan);
const dataset = readJson(PATHS.siteDataset, { products: [], enrichments: {} });
if (!source || !plan) throw new Error("Nedostaje source/plan — pokrenuti `npm run norbin:sync:plan`.");

const runtimeData = loadCatalogRuntime();
const ours = runtimeData.products.filter((product) => product.brandSlug === "norbin");
const bySlug = new Map(ours.map((product) => [product.slug, product]));
const families = runtimeData.families.filter((family) => family.brandSlug === "norbin");

/* -- A/B: zapisi ------------------------------------------------------------------------- */

const expected = plan.items.filter((item) => item.status === "CURRENT_EMEA");
const productRows = expected.map((item) => {
  const slugs = item.family ? item.family.members.map((member) => member.slug) : [item.slug];
  return { code: item.code, name: item.officialName, slugs, present: slugs.every((slug) => bySlug.has(slug)) };
});
const ACTIVE_PRODUCT_MISSING = productRows.filter((row) => !row.present);

/* -- C/D: oznake ------------------------------------------------------------------------- */

const codesOf = (product) =>
  new Set([product.manufacturerCode, product.sku, product.externalSku].filter((value) => typeof value === "string" && value.trim()).map((value) => value.toUpperCase()));
const ownerByCode = new Map();
for (const product of ours) for (const code of codesOf(product)) ownerByCode.set(code, [...(ownerByCode.get(code) ?? []), product.slug]);

/** Jedna šifra sme da stoji na više zapisa samo ako su to pakovanja ISTE porodice. */
const familyOf = (slug) => runtimeData.getFamilyForProduct(bySlug.get(slug))?.slug ?? slug;
const codeRows = expected.map((item) => {
  const owners = ownerByCode.get(item.code.toUpperCase()) ?? [];
  const sameFamily = new Set(owners.map(familyOf)).size === 1;
  const wanted = item.family ? item.family.members.map((member) => member.slug) : [item.slug];
  const status = !owners.length
    ? "MISSING"
    : !wanted.every((slug) => owners.includes(slug))
      ? "ATTACHED_TO_WRONG_PRODUCT"
      : owners.length === 1 || sameFamily
        ? "OK"
        : "DUPLICATE";
  return { code: item.code, owners, packaging: owners.length > 1 && sameFamily, status };
});
const ACTIVE_CODE_MISSING = codeRows.filter((row) => row.status === "MISSING");
const attachedToWrongProduct = codeRows.filter((row) => row.status === "ATTACHED_TO_WRONG_PRODUCT");
const duplicateActiveCodes = codeRows.filter((row) => row.status === "DUPLICATE");

/* -- Model kartica: mereno iz runtime-a --------------------------------------------------- */

const standalone = ours.filter((product) => !runtimeData.variantSlugs.has(product.slug));
const familyMembers = ours.filter((product) => runtimeData.variantSlugs.has(product.slug));
const cards = {
  VISIBLE_CUSTOMER_FACING_CARDS: families.length + standalone.length,
  families: families.length,
  standaloneCards: standalone.length,
  CURRENT_VISIBLE_CARDS: families.length + standalone.length,
  LEGACY_VISIBLE_CARDS: 0,
};

const availability = Object.fromEntries(
  ["SELLABLE_CURRENT", "SELLABLE_CURRENT_ZERO_STOCK", "NOT_IN_OUR_PROGRAMME"].map((key) => [key, expected.filter((item) => item.availability === key).length]),
);

const breakdown = {
  UNDERLYING_NORBIN_RECORDS: ours.length,
  importedThisSync: dataset.products.length,
  enrichedExisting: Object.keys(dataset.enrichments ?? {}).length,
  VARIANT_FAMILY_MEMBERS: familyMembers.length,
  REDIRECT_ONLY_RECORDS: familyMembers.filter((product) => runtimeData.getFamilyForProduct(product)?.presentation === "variant-pdp").length,
  CURRENT_SYSTEMS: 0,
  CURRENT_PUBLIC_TONERS: 0,
  CURRENT_OTHER_REGION: plan.summary.CURRENT_OTHER_REGION,
  UNLINKED_IN_SOURCE: plan.summary.UNLINKED_IN_SOURCE,
  OFFICIAL_REFERENCED_COMPONENT_NOT_CUSTOMER_FACING: plan.summary.OFFICIAL_REFERENCED_COMPONENT_NOT_CUSTOMER_FACING,
  OFFICIAL_PRODUCT_IMAGES: 0,
  MISSING_OFFICIAL_ASSETS: expected.length,
  VERIFIED_ARTICLE_NUMBERS: 0,
  ASSET_FILENAME_ONLY_NUMBERS: 0,
  availability,
  withTds: plan.summary.withTds,
  withoutTds: plan.summary.withoutTds,
  withSds: plan.summary.withSds,
  relations: plan.summary.relations,
  reverseRelations: plan.summary.reverseRelations,
};

/* -- Duplikati i slike -------------------------------------------------------------------- */

const slugCounts = new Map();
for (const product of ours) slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1);
const duplicateProductSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);

const referenced = new Set(ours.flatMap((product) => [product.productImage?.src, ...(product.galleryImages ?? []).map((image) => image.src)]).filter(Boolean));
const brokenImageReferences = [...referenced].filter((src) => src.startsWith("/") && !existsSync(path.join(REPO_ROOT, "public", src)));
const hotlinked = ours.filter((product) => /^https?:/.test(product.productImage?.src ?? ""));
const localImages = [...referenced].filter((src) => src.startsWith("/products/norbin/"));

const failures = [
  ...ACTIVE_PRODUCT_MISSING.map((row) => `ACTIVE_PRODUCT_MISSING: ${row.code}`),
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
    note: "Norbin nema sloj brojeva artikala: jedna šifra je i proizvod i oznaka, pa je A ≡ C po konstrukciji.",
    codesWithPackagingVariants: codeRows.filter((row) => row.packaging).map((row) => row.code),
  },
  cards,
  breakdown,
  ACTIVE_PRODUCT_MISSING,
  ACTIVE_CODE_MISSING,
  duplicateActiveCodes,
  attachedToWrongProduct,
  families: families.map((family) => ({ slug: family.slug, name: family.name, variants: family.variants.length, presentation: family.presentation })),
  standaloneCards: standalone.map((product) => ({ slug: product.slug, code: product.manufacturerCode ?? null })),
  images: { officialProductImages: 0, localCustomerOwned: localImages, brokenImageReferences, hotlinked: hotlinked.map((product) => product.slug) },
  failures,
};

writeJson(PATHS.reconciliation, result);
writeFileSync(
  PATHS.reconciliationMarkdown,
  [
    "# Norbin sync — coverage gate",
    "",
    "| mera | vrednost |",
    "| --- | --- |",
    ...Object.entries(result.coverage).filter(([, value]) => typeof value !== "object" || Array.isArray(value)).map(([key, value]) => `| ${key} | ${Array.isArray(value) ? value.join(", ") || "—" : value} |`),
    ...Object.entries(cards).map(([key, value]) => `| ${key} | ${value} |`),
    ...Object.entries(breakdown).filter(([, value]) => typeof value !== "object").map(([key, value]) => `| ${key} | ${value} |`),
    ...Object.entries(availability).map(([key, value]) => `| availability.${key} | ${value} |`),
    `| Neuspesi | ${failures.length} |`,
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ coverage: result.coverage, cards, breakdown, failures }, null, 2));
if (failures.length) process.exitCode = 1;
