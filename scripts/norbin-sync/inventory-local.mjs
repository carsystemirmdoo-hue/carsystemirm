#!/usr/bin/env node
/**
 * Norbin sync — inventar SVEGA što u repozitorijumu već postoji za Norbin.
 *
 * Meri se stvarni runtime (kartice, ne sirovi zapisi), a uz njega i svi prateći slojevi:
 * generisani datasetovi, staging fajlovi proizvođača, lokalne slike, dokumentacija i
 * komponente brend stranice. Klasifikacija poredi lokalni zapis sa zvaničnim modelom.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";

const source = readJson(PATHS.source);
const byCode = new Map(source.products.map((product) => [product.code, product]));

/** Šifra iz naše interne oznake: `NORBIN-N15-020-1L` → `N15-020`. */
const codeOfSku = (sku) => /\bN\d{2}-[A-Z]?\d{2,3}\b/.exec(String(sku ?? "").toUpperCase())?.[0] ?? null;

const runtime = loadCatalogRuntime();
const ours = runtime.products.filter((product) => product.brandSlug === "norbin");
const families = runtime.families.filter((family) => family.brandSlug === "norbin");

const records = ours.map((product) => {
  const code = product.manufacturerCode ?? codeOfSku(product.sku);
  const official = code ? byCode.get(code) : null;
  const family = runtime.getFamilyForProduct(product);
  const classification = !official
    ? code
      ? "PROBABLE"
      : "LEGACY_LOCAL_ONLY"
    : official.status === "CURRENT_EMEA"
      ? "EXACT_MATCH"
      : official.status === "CURRENT_OTHER_REGION"
        ? "HIGH_CONFIDENCE_MATCH"
        : "LEGACY_LOCAL_ONLY";
  return {
    slug: product.slug,
    displayName: product.name,
    sku: product.sku ?? null,
    manufacturerCode: product.manufacturerCode ?? null,
    derivedCode: code,
    image: product.productImage?.src ?? null,
    hasOfficialImage: Boolean(product.productImage?.src && !product.productImage.src.includes("placeholder")),
    documents: (product.documents ?? []).map((document) => `${document.title}:${document.status}`),
    category: product.taxonomyCategory ?? null,
    program: product.programSlug,
    phase: product.phaseSlug,
    packages: (product.packages ?? []).map((entry) => entry.label),
    source: "lib/carsystem-data.ts (ručni zapis)",
    status: product.publicStatus ?? null,
    family: family?.slug ?? null,
    consolidated: runtime.variantSlugs.has(product.slug),
    classification,
    officialStatus: official?.status ?? null,
  };
});

/* -- Prateći slojevi ---------------------------------------------------------------------- */

const listFiles = (relative, filter = () => true) => {
  const absolute = path.join(REPO_ROOT, relative);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => filter(entry) && statSync(path.join(absolute, entry)).isFile())
    .map((entry) => ({ file: path.join(relative, entry), bytes: statSync(path.join(absolute, entry)).size }));
};

const layers = {
  runtimeRecords: records.length,
  generatedDatasets: ["norbin-catalog", "norbin-documents", "norbin-match", "norbin-tds-claims"]
    .map((name) => `data/knowledge/${name}.generated.json`)
    .filter((file) => existsSync(path.join(REPO_ROOT, file))),
  brandManifest: existsSync(path.join(REPO_ROOT, "data/knowledge/brands/norbin.manifest.generated.json")),
  images: listFiles("public/products/norbin"),
  incomingImages: listFiles("_incoming", (entry) => /norbin/i.test(entry)),
  brandLogos: ["public/brands/norbin.svg", "public/brands/mono/norbin.svg"].filter((file) => existsSync(path.join(REPO_ROOT, file))),
  components: listFiles("components/norbin-brand"),
  scripts: listFiles("scripts", (entry) => /norbin/i.test(entry)),
  docs: listFiles("docs", (entry) => /norbin/i.test(entry.toLowerCase())),
  // Staging proizvođača je NAMERNO van repozitorijuma (`assets/manufacturer/` u .gitignore).
  stagedManufacturerFiles: existsSync(path.join(REPO_ROOT, "assets/manufacturer/norbin")) ? listFiles("assets/manufacturer/norbin").length : 0,
  localOfficialPdfs: listFiles("public/documents", (entry) => /norbin/i.test(entry)).length,
};

const cards = ours.filter((product) => !runtime.variantSlugs.has(product.slug)).length + families.length;
const summary = {
  UNDERLYING_NORBIN_RECORDS: ours.length,
  VARIANT_FAMILY_MEMBERS: ours.filter((product) => runtime.variantSlugs.has(product.slug)).length,
  REDIRECT_ONLY_RECORDS: ours.filter((product) => runtime.variantSlugs.has(product.slug) && runtime.getFamilyForProduct(product)?.presentation === "variant-pdp").length,
  VISIBLE_CUSTOMER_FACING_CARDS: cards,
  CURRENT_VISIBLE_CARDS: records.filter((record) => !record.consolidated && record.classification === "EXACT_MATCH").length + families.length,
  LEGACY_VISIBLE_CARDS: records.filter((record) => !record.consolidated && record.classification === "LEGACY_LOCAL_ONLY").length,
  byClassification: Object.fromEntries(
    ["EXACT_MATCH", "HIGH_CONFIDENCE_MATCH", "PROBABLE", "LEGACY_LOCAL_ONLY", "DUPLICATE", "UNKNOWN"].map((key) => [key, records.filter((record) => record.classification === key).length]),
  ),
  distinctCodesLocally: [...new Set(records.map((record) => record.derivedCode).filter(Boolean))],
  officialCodesWithoutLocalRecord: source.products.filter((product) => product.status === "CURRENT_EMEA" && !records.some((record) => record.derivedCode === product.code)).map((product) => product.code),
};

writeJson(PATHS.inventory, { summary, layers, records });
console.log(JSON.stringify({ summary, layers: { ...layers, images: layers.images.length, incomingImages: layers.incomingImages.length, components: layers.components.length, scripts: layers.scripts.length, docs: layers.docs.length } }, null, 1));
