#!/usr/bin/env node
/**
 * BEFAR sync — COVERAGE GATE. Glavni kriterijum prihvatanja.
 *
 * Poredi ZVANIČNI izvor (blokovi proizvoda na aktuelnom befar.com.tr) sa STVARNIM
 * runtime katalogom sajta (isti moduli koje izvršava javni sajt), ne sa planom:
 *
 *   A = aktuelne naručive BEFAR porodice/proizvodi na sajtu proizvođača
 *   B = od toga zastupljene u našem katalogu
 *   C = aktuelne zvanične Befar šifre proizvoda
 *   D = od toga zastupljene kod nas, NA PRAVOM proizvodu
 *
 * Prolaz: B == A, D == C, 0 duplih aktivnih šifara, 0 duplih slugova,
 * 0 šifara na pogrešnom proizvodu. Izlaz ≠ 0 kada bilo šta od toga ne važi.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { BRAND, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
const plan = readJson(PATHS.plan);
if (!source || !plan) throw new Error("Nedostaje source/plan — pokrenuti `npm run befar:sync:plan`.");

const { products } = loadCatalogRuntime();
const ours = products.filter((product) => product.brandSlug === BRAND.slug);
const OFFICIAL = /^\d{5,6}[A-Z]{0,4}$/;

/** Šifre koje proizvod stvarno nosi u runtime-u: redovi tabele varijanti + `sku` u zvaničnom formatu. */
const articlesOf = (product) =>
  new Set([...(product.detail?.variants?.content?.rows ?? []).map((row) => row.id), product.sku, product.manufacturerCode].filter((value) => value && OFFICIAL.test(value)));

const slugByArticle = new Map();
const duplicateActiveCodes = [];
for (const product of ours) {
  for (const article of articlesOf(product)) {
    if (slugByArticle.has(article) && slugByArticle.get(article) !== product.slug) duplicateActiveCodes.push({ article, slugs: [slugByArticle.get(article), product.slug] });
    slugByArticle.set(article, product.slug);
  }
}

const planBySourceKey = new Map(plan.items.map((item) => [item.sourceKey, item]));
const expectedSlug = (sourceKey) => {
  const item = planBySourceKey.get(sourceKey);
  if (!item) return null;
  if (item.action === "IMPORT") return item.slug;
  if (item.action === "MATCHED_EXISTING") return item.localSlug;
  return null;
};
const ourSlugs = new Set(ours.map((product) => product.slug));

/* -- A / B ------------------------------------------------------------------------------ */

const activeFamilies = source.products.filter((product) => product.active && product.orderable);
const familyRows = activeFamilies.map((product) => {
  const slug = expectedSlug(product.sourceKey);
  const item = planBySourceKey.get(product.sourceKey);
  return {
    sourceKey: product.sourceKey,
    officialName: product.displayNameEn,
    line: product.line,
    pages: product.pages,
    classification: product.classification,
    action: item?.action ?? null,
    ourSlug: slug,
    represented: Boolean(slug && ourSlugs.has(slug)),
    reasonIfMissing: slug && ourSlugs.has(slug) ? null : item?.reason ?? "nema stavke u planu",
  };
});
const ACTIVE_PRODUCT_MISSING = familyRows.filter((row) => !row.represented);

/* -- C / D ------------------------------------------------------------------------------ */

const articleRows = [];
for (const product of activeFamilies) {
  for (const variant of product.variants) {
    const slug = expectedSlug(product.sourceKey);
    const foundOn = slugByArticle.get(variant.code) ?? null;
    articleRows.push({
      code: variant.code,
      sourceKey: product.sourceKey,
      expectedSlug: slug,
      foundOnSlug: foundOn,
      status: !foundOn ? "MISSING" : foundOn === slug ? "OK" : "ATTACHED_TO_WRONG_PRODUCT",
    });
  }
}
const ACTIVE_CODE_MISSING = articleRows.filter((row) => row.status === "MISSING");
const attachedToWrongProduct = articleRows.filter((row) => row.status === "ATTACHED_TO_WRONG_PRODUCT");

/* -- Duplikati i slike --------------------------------------------------------------------- */

const slugCounts = new Map();
for (const product of products) slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1);
const duplicateProductSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);

// Slika boje živi na REDU varijante (birač boje na PDP-u), ne u galeriji — i ona je referenca.
const referenced = new Set(
  ours
    .flatMap((product) => [
      product.productImage?.src,
      ...(product.galleryImages ?? []).map((image) => image.src),
      ...(product.detail?.variants?.content?.rows ?? []).map((row) => row.image),
    ])
    .filter(Boolean),
);
const publicFiles = existsSync(PATHS.publicImages) ? readdirSync(PATHS.publicImages).filter((file) => file.endsWith(".webp")) : [];
const orphanImages = publicFiles.map((file) => `${PUBLIC_IMAGE_URL_PREFIX}/${file}`).filter((src) => !referenced.has(src));
const brokenImageReferences = [...referenced].filter((src) => src.startsWith("/") && !existsSync(path.join(REPO_ROOT, "public", src)));
const bySha = new Map();
for (const file of publicFiles) {
  const hash = createHash("sha256").update(readFileSync(path.join(PATHS.publicImages, file))).digest("hex");
  bySha.set(hash, [...(bySha.get(hash) ?? []), file]);
}
const duplicateImages = [...bySha.values()].filter((files) => files.length > 1);
const hotlinked = ours.filter((product) => /^https?:/i.test(product.productImage?.src ?? ""));

/* -- Legacy / kolizije ---------------------------------------------------------------------- */

const syncSlugs = new Set(Object.keys(readJson(PATHS.identityRegistry, { products: {} }).products));
const legacyLocal = ours.filter((product) => !syncSlugs.has(product.slug)).map((product) => {
  const match = plan.localMatches.find((entry) => entry.localSlug === product.slug);
  return { slug: product.slug, name: product.name, classification: match?.classification ?? "LEGACY_LOCAL_ONLY", candidates: (match?.candidates ?? []).map((candidate) => `${candidate.officialName} (${candidate.codes.join(", ")})`), codes: [...articlesOf(product)] };
});

const A = familyRows.length;
const B = familyRows.filter((row) => row.represented).length;
const C = articleRows.length;
const D = articleRows.filter((row) => row.status === "OK").length;

const failures = [
  ...(B !== A ? [`B (${B}) ≠ A (${A})`] : []),
  ...(D !== C ? [`D (${D}) ≠ C (${C})`] : []),
  ...(duplicateActiveCodes.length ? [`duple aktivne šifre: ${duplicateActiveCodes.length}`] : []),
  ...(duplicateProductSlugs.length ? [`dupli slugovi: ${duplicateProductSlugs.join(", ")}`] : []),
  ...(attachedToWrongProduct.length ? [`šifre na pogrešnom proizvodu: ${attachedToWrongProduct.length}`] : []),
  ...(brokenImageReferences.length ? [`slike koje ne postoje: ${brokenImageReferences.length}`] : []),
  ...(hotlinked.length ? [`hotlinkovane slike: ${hotlinked.length}`] : []),
];

const result = {
  generatedFrom: { websiteCrawledAt: source.meta.website.crawledAt, catalogueSha256: source.meta.catalogue.sha256 },
  coverage: {
    A_currentOrderableProductFamilies: A,
    B_representedLocally: B,
    C_currentOfficialProductCodes: C,
    D_representedLocally: D,
    productCoveragePercent: A ? Number(((B / A) * 100).toFixed(2)) : 0,
    articleCoveragePercent: C ? Number(((D / C) * 100).toFixed(2)) : 0,
  },
  ACTIVE_PRODUCT_MISSING,
  ACTIVE_CODE_MISSING,
  duplicateActiveCodes,
  duplicateProductSlugs,
  attachedToWrongProduct,
  images: { published: publicFiles.length, referenced: [...referenced].filter((src) => src.startsWith(PUBLIC_IMAGE_URL_PREFIX)).length, orphanImages, duplicateImages, brokenImageReferences, hotlinked: hotlinked.map((product) => product.slug) },
  ourCatalogue: {
    befarProducts: ours.length,
    importedBySync: ours.filter((product) => syncSlugs.has(product.slug)).length,
    legacyLocal,
    officialCodesInRuntime: slugByArticle.size,
  },
  sources: {
    WEBSITE_AND_CATALOGUE: source.summary.WEBSITE_AND_CATALOGUE,
    WEBSITE_ONLY: source.summary.WEBSITE_ONLY,
    CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE_codes: source.summary.codesCatalogueOnly,
    SOURCE_CONFLICT: source.summary.SOURCE_CONFLICT,
  },
  families: familyRows,
  failures,
};
writeJson(PATHS.reconciliation, result);

const table = (rows) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
const md = [
  "# BEFAR — coverage gate",
  "",
  `Izvor: blokovi proizvoda na aktuelnom befar.com.tr (crawl ${source.meta.website.crawledAt}) prema STVARNOM runtime katalogu sajta.`,
  "",
  table([
    ["Mera", "Vrednost"],
    ["---", "---:"],
    ["A — aktuelne naručive porodice/proizvodi na sajtu proizvođača", String(A)],
    ["B — zastupljene kod nas", String(B)],
    ["C — aktuelne zvanične šifre proizvoda", String(C)],
    ["D — zastupljene kod nas, na pravom proizvodu", String(D)],
    ["Pokrivenost proizvoda", `${result.coverage.productCoveragePercent}%`],
    ["Pokrivenost šifara", `${result.coverage.articleCoveragePercent}%`],
    ["ACTIVE_PRODUCT_MISSING", String(ACTIVE_PRODUCT_MISSING.length)],
    ["ACTIVE_CODE_MISSING", String(ACTIVE_CODE_MISSING.length)],
    ["Duple aktivne šifre", String(duplicateActiveCodes.length)],
    ["Dupli slugovi", String(duplicateProductSlugs.length)],
    ["Šifre na pogrešnom proizvodu", String(attachedToWrongProduct.length)],
    ["Objavljene slike / siročad / duplikati", `${publicFiles.length} / ${orphanImages.length} / ${duplicateImages.length}`],
  ]),
  "",
  "## Naši ručni Befar zapisi",
  "",
  table([["Zapis", "Klasifikacija", "Zvanični kandidati", "Šifre koje zapis sam nosi"], ["---", "---", "---", "---"], ...legacyLocal.map((row) => [`\`${row.slug}\``, row.classification, row.candidates.join("; ") || "—", row.codes.join(", ") || "—"])]),
  "",
  failures.length ? `## NEUSPEH\n\n${failures.map((line) => `- ${line}`).join("\n")}` : "## Prolaz\n\nSvaki aktuelni naručiv BEFAR proizvod i svaka aktuelna zvanična šifra zastupljeni su u našem katalogu.",
  "",
];
writeFileSync(PATHS.reconciliationMarkdown, md.join("\n"));

console.log(JSON.stringify({ coverage: result.coverage, ACTIVE_PRODUCT_MISSING: ACTIVE_PRODUCT_MISSING.length, ACTIVE_CODE_MISSING: ACTIVE_CODE_MISSING.length, duplicateActiveCodes: duplicateActiveCodes.length, duplicateProductSlugs: duplicateProductSlugs.length, attachedToWrongProduct: attachedToWrongProduct.length, images: { published: publicFiles.length, orphan: orphanImages.length, duplicates: duplicateImages.length, broken: brokenImageReferences.length }, failures }, null, 2));
if (failures.length) process.exitCode = 1;
