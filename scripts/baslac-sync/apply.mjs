#!/usr/bin/env node
/**
 * baslac sync, korak 5 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - public/products/baslac/catalog/*.webp          (zvanične slike, lokalno)
 *   - data/baslac-sync/published-images.generated.json
 *   - data/baslac-catalog-products.generated.json    (čita ga lib/baslac-catalog-products.ts)
 *   - data/baslac-sync/identity-registry.json        (samo dopuna)
 *
 * Model (odobren):
 *   sistem      — nov zapis koji nosi javni identitet svoje porodice; toneri ostaju
 *                 varijante te porodice (bez zasebnih kartica), mixing komponenta je
 *                 ugnježdena činjenica sistema;
 *   proizvod    — jedna zvanična šifra = jedna kartica;
 *   promocija   — 45-R45 i 45-W10 izlaze iz porodice 45 i postaju samostalne kartice,
 *                 pod svojim POSTOJEĆIM slugom (adresa ostaje ista, sada renderuje PDP);
 *   dopuna      — zapis koji već postoji zadržava slug, sliku i lokalne PDF-ove.
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, IMAGE_CACHE_DIR, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT, SOURCES } from "./lib/config.mjs";

const checkOnly = process.argv.includes("--check");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const imageManifest = readJson(PATHS.imageManifest);
const registry = readJson(PATHS.identityRegistry, { products: {} });
const published = readJson(PATHS.publishedImages, { images: {} });
if (!plan || !source || !imageManifest) throw new Error("Nedostaje plan/source/manifest — pokrenuti `npm run baslac:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

const productByCode = new Map(source.products.map((product) => [product.code, product]));
const systemByKey = new Map(source.systems.map((system) => [system.key, system]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));
const enrichments = plan.items.filter((item) => item.action === "ENRICH_EXISTING").sort((a, b) => a.slug.localeCompare(b.slug));

/* -- 1. Slike ---------------------------------------------------------------------------- */

const imageByCode = new Map();
for (const image of imageManifest.images.filter((entry) => !entry.error)) imageByCode.set(image.code, image);

const pathBySha = new Map(Object.entries(published.images).map(([publicPath, entry]) => [entry.sourceSha256, publicPath]));
const nextPublished = {};
const jobs = [];
const imagePlan = new Map();

for (const item of imports) {
  const image = item.code ? imageByCode.get(item.code) : null;
  if (!image) continue;
  // Istu zvaničnu fotografiju (kartica koja prikazuje 50-15 i 50-20) objavljujemo jednom.
  let publicPath = pathBySha.get(image.sha256);
  if (!publicPath) {
    publicPath = `${PUBLIC_IMAGE_URL_PREFIX}/${item.slug}.webp`;
    pathBySha.set(image.sha256, publicPath);
  }
  const absolute = path.join(REPO_ROOT, "public", publicPath);
  const known = published.images[publicPath];
  if (known?.sourceSha256 === image.sha256 && existsSync(absolute)) nextPublished[publicPath] = known;
  else if (!nextPublished[publicPath]) {
    nextPublished[publicPath] = { sourceSha256: image.sha256, sourceUrl: image.url, origin: image.origin };
    /*
     * Pozadina se NE uklanja: baslac packshot je bela ili svetla ambalaža sa belom
     * etiketom, pa bi maska „belina povezana sa ivicom” pojela sam proizvod.
     */
    jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: false, keepBackground: true, write: !checkOnly });
  }
  imagePlan.set(item.slug, publicPath);
}

if (jobs.length && !checkOnly) {
  mkdirSync(PATHS.publicImages, { recursive: true });
  const results = JSON.parse(
    execFileSync("python3", ["-W", "ignore", path.join(REPO_ROOT, "scripts/carfit-sync/lib/publish_images.py")], { input: JSON.stringify(jobs), encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }),
  );
  for (const job of jobs) {
    Object.assign(nextPublished[job.publicPath], results[job.dest]);
    if (nextPublished[job.publicPath].mode === "kept-background") nextPublished[job.publicPath].reason = "zvanični packshot; uklanjanje pozadine nije dokazivo bezbedno za belu ambalažu";
  }
}

/* -- 2. Odnosi i dokumenti ---------------------------------------------------------------- */

const slugByCode = new Map(plan.items.filter((item) => item.code && item.slug && item.action !== "NEST_IN_SYSTEM").map((item) => [item.code, item.slug]));
const RELATION_BY_ROLE = { hardener: "USES_HARDENER", reducer: "USES_REDUCER", additive: "USES_ADDITIVE" };

function relationsOf(record) {
  const map = (codes, relation) =>
    (codes ?? []).map((code) => ({ code, relation, slug: slugByCode.get(code) ?? null, name: productByCode.get(code)?.officialName ?? code })).filter((entry) => entry.slug);
  const relations = [
    ...map(record.relations?.hardeners, RELATION_BY_ROLE.hardener),
    ...map(record.relations?.reducers, RELATION_BY_ROLE.reducer),
    ...map(record.relations?.additives, RELATION_BY_ROLE.additive),
  ];
  const usedBy = (record.usedBy ?? [])
    .map((code) => ({ code, relation: "USED_BY", slug: slugByCode.get(code) ?? null, name: productByCode.get(code)?.officialName ?? code }))
    .filter((entry) => entry.slug);
  return { relations, usedBy };
}

/** Zvanični list: lokalno hostovana kopija kada je imamo, inače referenca na techinfo. */
function documentsOf(tds, title) {
  if (!tds?.url) return [];
  return [{
    kind: "tds",
    title: `Tehnički list — ${title}`,
    href: tds.localPath ?? tds.url,
    language: "en",
    version: tds.revision ?? null,
    note: tds.localPath ? `Zvanični dokument sa ${new URL(tds.url).host}, lokalna kopija` : `Zvanični dokument na ${new URL(tds.url).host}`,
  }];
}

function technicalOf(tds) {
  return {
    revision: tds?.revision ?? null,
    mixingRatio: tds?.facts?.mixingRatio ?? null,
    sprayViscosity: tds?.facts?.sprayViscosity ?? null,
    potLife: tds?.facts?.potLife ?? null,
    nozzle: tds?.facts?.nozzle ?? null,
    sprayCoats: tds?.facts?.sprayCoats ?? null,
    filmThickness: tds?.facts?.filmThickness ?? null,
    flashOff: tds?.facts?.flashOff ?? null,
    sanding: tds?.facts?.sanding ?? null,
    drying: tds?.drying ?? [],
    voc: tds?.voc ?? null,
  };
}

/* -- 3. Zapisi ---------------------------------------------------------------------------- */

const websitePage = (product) => (product.websiteName ? `${SOURCES.website.origin}/${SOURCES.website.locale}/${source.products.find((entry) => entry.code === product.code)?.evidence?.find((line) => line.startsWith("stranica kategorije: "))?.slice("stranica kategorije: ".length) ?? ""}` : null);

function buildSystem(item) {
  const system = systemByKey.get(item.sourceKey);
  const sr = localization[item.sourceKey];
  const components = system.componentDetail.map((component) => ({
    code: component.code,
    officialName: productByCode.get(component.code)?.officialName ?? component.officialName,
    tds: component.tds,
    technical: technicalOf(productByCode.get(component.code)?.tds),
  }));
  return {
    slug: item.slug,
    name: system.officialName,
    sourceKey: item.sourceKey,
    code: null,
    officialName: system.officialName,
    displayName: system.officialName,
    kind: "system",
    role: "system",
    line: system.officialName,
    status: "CURRENT_SYSTEM",
    promotedFromLine: false,
    // Zapis sistema nosi javni identitet porodice i ZAKLJUČAVA njenu postojeću adresu.
    family: { baseProductSlug: system.familySlug, identity: { name: system.officialName, slug: system.familySlug } },
    sourceUrls: [`${SOURCES.website.origin}/${SOURCES.website.locale}/products-systems`, `${SOURCES.techinfo.origin}/${SOURCES.techinfo.language}/${encodeURI(system.lineDoc)}`],
    taxonomy: item.taxonomy,
    systemComponents: components,
    relations: [],
    usedBy: [],
    technical: technicalOf(system.lineDocument ? productByCode.get(system.components[0])?.tds : null),
    documents: [{
      kind: "tds",
      title: `Tehnički list — ${system.officialName}`,
      href: system.lineDocument?.localPath ?? `${SOURCES.techinfo.origin}/${SOURCES.techinfo.language}/${encodeURI(system.lineDoc)}`,
      language: "en",
      version: null,
      note: system.lineDocument?.localPath ? `Zvanični dokument sa ${new URL(SOURCES.techinfo.origin).host}, lokalna kopija` : `Zvanični dokument na ${new URL(SOURCES.techinfo.origin).host}`,
    }],
    image: null,
    missingOfficialAsset: true,
    content: contentOf(sr),
  };
}

function contentOf(sr) {
  return {
    productType: sr.productType,
    subtype: sr.subtype,
    shortDescription: sr.shortDescription,
    longDescription: sr.longDescription,
    purpose: sr.purpose,
    facts: sr.facts ?? [],
    applications: sr.applications ?? [],
    benefits: sr.benefits ?? [],
    advice: sr.advice ?? null,
  };
}

function buildProduct(item) {
  const record = productByCode.get(item.code);
  const sr = localization[item.sourceKey];
  const { relations, usedBy } = relationsOf(record);
  const publicPath = imagePlan.get(item.slug) ?? null;
  const entry = publicPath ? nextPublished[publicPath] : null;
  return {
    slug: item.slug,
    name: `${BRAND.name} ${record.officialName}`,
    sourceKey: item.sourceKey,
    code: item.code,
    officialName: record.officialName,
    displayName: record.displayName,
    kind: "product",
    role: record.role,
    line: null,
    status: record.status,
    promotedFromLine: Boolean(record.promotedFromLine),
    family: null,
    sourceUrls: [websitePage(record), record.tds.url].filter(Boolean),
    taxonomy: item.taxonomy,
    systemComponents: [],
    relations,
    usedBy,
    technical: technicalOf(record.tds),
    documents: documentsOf(record.tds, record.officialName),
    image: publicPath ? { src: publicPath, width: entry?.width ?? null, height: entry?.height ?? null, hasAlpha: Boolean(entry?.hasAlpha), processing: entry?.mode ?? null } : null,
    missingOfficialAsset: !publicPath,
    content: contentOf(sr),
  };
}

const products = imports.map((item) => (item.kind === "system" ? buildSystem(item) : buildProduct(item)));

/* -- 4. Dopuna postojećih zapisa ---------------------------------------------------------- */

const enrichmentEntries = {};
for (const item of enrichments) {
  const record = productByCode.get(item.code);
  const { relations, usedBy } = relationsOf(record);
  enrichmentEntries[item.slug] = {
    code: item.code,
    officialName: record.officialName,
    /*
     * Zapis koji je postao SAMOSTALNA kartica mora da nosi zvanično ime; dok je bio
     * varijanta linije, ime iz dosijea („Dilutant AU reducer") bilo je dovoljno. Zvanični
     * naziv je naslov iz indeksa tehničkih listova na aktuelnom sajtu.
     */
    displayName: record.promotedFromLine ? `${BRAND.name} ${record.officialName}` : null,
    kind: "product",
    role: record.role,
    status: record.status,
    /*
     * Promovisan zapis napušta porodicu 45: adresa ostaje ista, ali od sada renderuje
     * svoj PDP umesto preusmerenja na porodicu.
     */
    promotedFromLine: Boolean(record.promotedFromLine),
    detachFromFamily: Boolean(record.promotedFromLine),
    sourceUrls: [websitePage(record), record.tds.url].filter(Boolean),
    taxonomy: item.taxonomy,
    relations,
    usedBy,
    technical: technicalOf(record.tds),
    documents: documentsOf(record.tds, record.officialName),
  };
}

/* -- 5. Upis ------------------------------------------------------------------------------ */

const nested = plan.items.filter((item) => item.action === "NEST_IN_SYSTEM");
const dataset = {
  meta: {
    generator: "scripts/baslac-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    website: `${SOURCES.website.origin}/${SOURCES.website.locale}`,
    techinfo: SOURCES.techinfo.origin,
    websiteCrawledAt: source.meta.websiteCrawledAt,
    products: products.filter((product) => product.kind === "product").length,
    systems: products.filter((product) => product.kind === "system").length,
    enrichedExisting: Object.keys(enrichmentEntries).length,
    codes: products.filter((product) => product.code).length + Object.values(enrichmentEntries).filter((entry) => entry.code).length,
    nestedMixingComponents: nested.map((item) => item.code),
    promotedFromLine: [...products, ...Object.values(enrichmentEntries)].filter((entry) => entry.promotedFromLine).map((entry) => entry.code),
    note: "Toneri se zvanično ne objavljuju pojedinačno; brojevi artikala nisu javni podatak i ne upisuju se.",
  },
  products,
  enrichments: enrichmentEntries,
};

const nextRegistry = { ...registry, products: { ...registry.products }, enriched: {} };
for (const item of imports) nextRegistry.products[item.slug] = { sourceKey: item.sourceKey, code: item.code ?? null, firstSeen: registry.products[item.slug]?.firstSeen ?? new Date().toISOString().slice(0, 10) };
for (const item of enrichments) nextRegistry.enriched[item.slug] = { sourceKey: item.sourceKey, code: item.code ?? null, owner: "lib/baslac-catalog-products.ts (ručni zapisi i dosije)" };

const publishedNext = { _comment: "Objavljene zvanične slike: putanja → izvor i rezultat obrade. Sync ga piše sam.", images: nextPublished };
const targets = [[PATHS.siteDataset, dataset], [PATHS.identityRegistry, nextRegistry], [PATHS.publishedImages, publishedNext]];
const filesChanged = targets.filter(([file, value]) => JSON.stringify(readJson(file, null)) !== JSON.stringify(value)).map(([file]) => path.relative(REPO_ROOT, file));
if (!checkOnly) for (const [file, value] of targets) writeJson(file, value);

console.log(JSON.stringify({
  products: dataset.meta.products,
  systems: dataset.meta.systems,
  enrichedExisting: dataset.meta.enrichedExisting,
  nestedMixingComponents: dataset.meta.nestedMixingComponents.length,
  promotedFromLine: dataset.meta.promotedFromLine,
  imagesPublished: checkOnly ? 0 : jobs.length,
  imagesTotal: Object.keys(nextPublished).length,
  missingOfficialAsset: products.filter((product) => product.missingOfficialAsset).length,
  withRelations: products.filter((product) => product.relations.length).length,
  filesChanged,
}, null, 1));
