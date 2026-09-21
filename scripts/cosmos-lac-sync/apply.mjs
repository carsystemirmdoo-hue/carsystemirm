#!/usr/bin/env node
/**
 * Cosmos Lac sync, korak 4 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - data/cosmos-lac-catalog-products.generated.json  (čita ga lib/cosmos-lac-data.ts i next.config.ts)
 *   - data/cosmos-lac-sync/identity-registry.json      (samo dopuna)
 *
 * Postojeći `data/cosmos-lac-products.generated.json` (742 zapisa iz zvaničnog Brand Kit-a, sa slikama i
 * SHA poreklom) se NE dira i ne regeneriše: on zavisi od `tmp/cosmos-lac-assets/`, kojeg u čistom
 * checkout-u nema. Sync preko njega polaže DOPUNU (zvanični identitet, dokument, pakovanje, grupa) i
 * dodaje nove zapise sa placeholder slikom. Nijedna slika se ne preuzima.
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS, REPO_ROOT } from "./lib/config.mjs";

const checkOnly = process.argv.includes("--check");
const plan = readJson(PATHS.plan);
const local = readJson(PATHS.localDataset);
const scope = JSON.parse(readFileSync(PATHS.scope, "utf8"));
const registry = readJson(PATHS.identityRegistry, { products: {} });
if (!plan) throw new Error("Nedostaje plan — `npm run cosmos-lac:sync:plan`.");
if (!plan.meta.locked) throw new Error("Opseg nije zaključan — `node scripts/cosmos-lac-sync/plan.mjs --write-lock` posle odobrenja.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors).slice(0, 600)}`);

const DOCUMENT_TITLE = { TDS: "Tehnički list (TDS)", PRODUCT_INFO: "Informacije o proizvodu (Product info)" };
const documentOf = (entry) => (entry.document?.status === "AVAILABLE" ? { title: DOCUMENT_TITLE[entry.document.kind] ?? DOCUMENT_TITLE.PRODUCT_INFO, kind: entry.document.kind, href: entry.document.href } : null);

/* ── Dopune postojećih zapisa ── */
const enrichments = {};
for (const [slug, entry] of Object.entries(plan.enrichments).sort(([a], [b]) => a.localeCompare(b))) {
  enrichments[slug] = {
    status: entry.status,
    classification: entry.classification,
    officialUrl: entry.officialUrl,
    officialSlug: entry.officialSlug,
    officialName: entry.officialName,
    officialProduct: entry.officialProduct,
    officialCodes: entry.officialCodes,
    ...(entry.sourceTitleInconsistency ? { sourceTitleInconsistency: entry.sourceTitleInconsistency } : {}),
    ...(entry.sourceLocales ? { sourceLocales: entry.sourceLocales } : {}),
    ...(entry.previousBaseProductSlug ? { baseProductSlug: entry.baseProductSlug, previousBaseProductSlug: entry.previousBaseProductSlug } : {}),
    ...(entry.familyIdentity ? { familyIdentity: entry.familyIdentity } : {}),
    packaging: entry.packaging,
    document: documentOf(entry),
    ...(entry.document?.status === "OFFICIAL_SOURCE_BROKEN" ? { documentSourceBroken: entry.document.href } : {}),
  };
}

/* ── Novi zapisi ── */
const products = plan.products.map((product) => {
  const identity = [product.cosmosCode ? `šifra ${product.cosmosCode}` : "", product.ralCode ? `RAL ${product.ralCode}` : "", product.colorName ?? ""].filter(Boolean).join(", ");
  return {
    id: product.id,
    slug: product.slug,
    baseProductSlug: product.baseProductSlug,
    variantId: product.variantId,
    brand: BRAND.name,
    brandSlug: BRAND.slug,
    line: product.line,
    officialName: product.officialName,
    displayNameSr: product.displayNameSr,
    cosmosCode: product.cosmosCode,
    ralCode: product.ralCode,
    colorName: product.colorName,
    finish: product.finish,
    volume: product.volume,
    programSlug: product.programSlug,
    primaryCategory: product.primaryCategory,
    technicalCategory: product.technicalCategory,
    useCase: product.useCase,
    image: product.image,
    imageAlt: `${product.officialName} — vizuel u pripremi`,
    visualMode: product.visualMode,
    backgroundColor: product.backgroundColor,
    foregroundTone: product.foregroundTone,
    colorSource: product.colorSource,
    colorConfidence: product.colorConfidence,
    verificationStatus: "verified-official-source",
    sourceReference: `${product.officialUrl} (zvanična stranica proizvoda, cosmoslac.com)`,
    visualTreatment: product.visualTreatment,
    // Isti obrazac rečenice kao kod postojećih zapisa iste linije; bez tvrdnji kojih nema u izvoru.
    shortDescription: `${product.line} proizvod iz zvaničnog Cosmos Lac programa${identity ? ` — ${identity}` : ""}.`,
    seoTitle: `${product.officialName} | Carsystem i R-M`,
    seoDescription: `${product.officialName} u Cosmos Lac katalogu. Proverite namenu i pošaljite upit Carsystem i R-M timu.`,
    sync: {
      status: "CURRENT",
      classification: "NEW_FROM_OFFICIAL_SOURCE",
      isNewOfficialProduct: product.isNewOfficialProduct,
      officialUrl: product.officialUrl,
      officialSlug: product.officialSlug,
      officialName: product.officialNameSource,
      officialProduct: product.officialProduct,
      officialCodes: product.officialCodes,
      ...(product.familyIdentity ? { familyIdentity: product.familyIdentity } : {}),
      packaging: product.packaging,
      document: documentOf(product),
      imageStatus: product.imageStatus,
      templateSibling: product.templateSibling,
    },
  };
});

/* ── Preusmerenja za porodične adrese koje podela gasi ── */
const bySlug = new Map(local.map((record) => [record.slug, record]));
const redirects = [];
for (const [base, config] of Object.entries(scope.splitCards).sort(([a], [b]) => a.localeCompare(b))) {
  if (config.keepBaseFor) continue;
  const source = `/proizvodi/grupa/${config.retiredFamilySlug}`;
  const members = Object.entries(plan.enrichments).filter(([, entry]) => entry.previousBaseProductSlug === base).map(([slug]) => slug).sort();
  // Duboka veza na varijantu (`?varijanta=`) vodi na TU varijantu; njena adresa i dalje sama bira karticu naslednika.
  for (const slug of members) {
    const record = bySlug.get(slug);
    const key = record.cosmosCode ?? record.id.toUpperCase();
    redirects.push({ source, has: [{ type: "query", key: "varijanta", value: key }], destination: `/proizvodi/${slug}`, permanent: true });
  }
  redirects.push({ source, destination: `/katalog?brend=${BRAND.slug}&q=${encodeURIComponent(config.redirectQuery)}`, permanent: true });
}

const all = [...Object.values(enrichments), ...products.map((product) => product.sync)];
const dataset = {
  meta: {
    generator: "scripts/cosmos-lac-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    model: "HYBRID — linija boja = jedna kartica; različiti zvanični proizvodi = različite kartice",
    website: "https://cosmoslac.com/",
    sourceFingerprint: plan.meta.sourceFingerprint,
    measured: plan.summary.measured,
    existingRecords: Object.keys(enrichments).length,
    newRecords: products.length,
    newOfficialProducts: plan.summary.newOfficialProducts,
    status: all.reduce((acc, entry) => ({ ...acc, [entry.status]: (acc[entry.status] ?? 0) + 1 }), {}),
    packaging: {
      ...all.reduce((acc, entry) => ({ ...acc, [entry.packaging.status]: (acc[entry.packaging.status] ?? 0) + 1 }), {}),
      customerFacingDiffersFromPreviousLocalDisplay: plan.summary.packaging.customerFacingDiffersFromPreviousLocalDisplay,
      localDivergesKeptInProvenance: plan.summary.packaging.localDivergesKeptInProvenance,
    },
    documents: { recordsWithDocument: all.filter((entry) => entry.document).length, recordsWithBrokenSourceDocument: Object.values(enrichments).filter((entry) => entry.documentSourceBroken).length },
    images: { localBrandKitImagesUntouched: local.length, importedImages: 0, placeholderRecords: products.length },
    retiredFamilyRedirects: redirects.filter((entry) => !entry.has).length,
    currentOutOfScope: plan.currentOutOfScope,
    note: "Cene se ne uvoze. Postojeći Brand Kit zapisi i njihove slike se ne prepisuju — sync polaže dopunu.",
  },
  enrichments,
  products,
  redirects,
};

const nextRegistry = { ...registry, products: { ...registry.products } };
for (const product of products) nextRegistry.products[product.slug] = { officialSlug: product.sync.officialSlug, officialProduct: product.sync.officialProduct, firstSeen: registry.products?.[product.slug]?.firstSeen ?? new Date().toISOString().slice(0, 10) };

const targets = [[PATHS.siteDataset, dataset], [PATHS.identityRegistry, nextRegistry]];
const filesChanged = targets.filter(([file, value]) => JSON.stringify(readJson(file, null)) !== JSON.stringify(value)).map(([file]) => path.relative(REPO_ROOT, file));
if (!checkOnly) for (const [file, value] of targets) writeJson(file, value);
console.log(JSON.stringify({ measured: plan.summary.measured, existingRecords: dataset.meta.existingRecords, newRecords: products.length, newOfficialProducts: dataset.meta.newOfficialProducts, status: dataset.meta.status, packaging: dataset.meta.packaging, documents: dataset.meta.documents, redirects: redirects.length, filesChanged }, null, 1));
