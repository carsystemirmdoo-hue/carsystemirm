#!/usr/bin/env node
/**
 * R-M sync, korak 7 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - public/products/rm/catalog/*.webp            (zvanične slike, lokalno)
 *   - data/rm-sync/published-images.generated.json
 *   - data/rm-catalog-products.generated.json      (čita ga lib/rm-catalog-products.ts)
 *   - data/rm-sync/identity-registry.json          (samo dopuna)
 *   - data/rm-sync/reports/colour-decisions.generated.json
 *
 * Postojećih 59 uvezenih i 2 ručna R-M zapisa se NE dupliraju: za njih se piše
 * `enrichments` (slug, slike i lokalni PDF-ovi ostaju njihovi).
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, IMAGE_CACHE_DIR, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT, SOURCES } from "./lib/config.mjs";
import { isPortalPlaceholder } from "./lib/placeholders.mjs";

const checkOnly = process.argv.includes("--check");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const imageManifest = readJson(PATHS.imageManifest);
const registry = readJson(PATHS.identityRegistry, { products: {} });
const published = readJson(PATHS.publishedImages, { images: {} });
if (!plan || !source || !imageManifest) throw new Error("Nedostaje plan/source/manifest — pokrenuti `npm run rm:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

const recordByKey = new Map([...source.products, ...source.websiteOnlySystems].map((record) => [record.sourceKey, record]));
const byCode = new Map(source.products.map((product) => [product.code, product]));
const itemByCode = new Map(plan.items.filter((item) => item.code).map((item) => [item.code, item]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));
const enrichments = plan.items.filter((item) => item.action === "ENRICH_EXISTING").sort((a, b) => a.slug.localeCompare(b.slug));

/* -- 1. Slike ---------------------------------------------------------------------------- */

const imagesByKey = new Map();
for (const image of imageManifest.images.filter((entry) => !entry.error && !isPortalPlaceholder(entry))) imagesByKey.set(image.sourceKey, [...(imagesByKey.get(image.sourceKey) ?? []), image]);

const pathBySha = new Map(Object.entries(published.images).map(([publicPath, entry]) => [entry.sourceSha256, publicPath]));
const nextPublished = {};
const jobs = [];
const imagePlan = new Map();

for (const item of imports) {
  const list = [];
  for (const image of imagesByKey.get(item.sourceKey) ?? []) {
    // Isti sadržaj (zvanična fotografija koju dele dve izvedbe sistema) objavljuje se jednom.
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
       * Pozadina se NE uklanja. R-M packshot je bela ili svetla ambalaža sa belom etiketom;
       * maska „belina povezana sa ivicom” bi pojela sam proizvod. PNG sa alfa kanalom (129 od
       * 132) ostaje providan (`source-alpha`), a neprovidne ostaju cele (`kept-background`).
       */
      jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: false, keepBackground: true, write: !checkOnly });
    }
    list.push({ src: publicPath });
  }
  imagePlan.set(item.slug, list);
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

/* -- 2. Boja kartice --------------------------------------------------------------------- */

/** Boja MATERIJALA koju izvor izričito navodi (podloge i gotove boje), ne boja ambalaže. */
const MATERIAL_COLOURS = { white: ["#E8E8E4", "bela"], "light grey": ["#C9CBC8", "svetlosiva"], grey: ["#9AA0A0", "siva"], gray: ["#9AA0A0", "siva"], "dark grey": ["#6B7071", "tamnosiva"], black: ["#23262A", "crna"], beige: ["#D8C7A6", "bež"], silver: ["#BFC4C8", "srebrna"] };
const COLOURED_ROLES = new Set(["undercoat", "bodyfiller", "basecoat-topcoat"]);

function decideShade(item, record) {
  const name = record.officialName ?? item.officialName;
  const series = `${name}, oznaka ${item.code ?? "—"}`;
  const stated = Object.entries(MATERIAL_COLOURS).filter(([word]) => new RegExp(`\\b${word}\\b`, "i").test(`${name} ${record.introduction?.join(" ") ?? ""}`)).sort((a, b) => b[0].length - a[0].length)[0];
  if (stated && COLOURED_ROLES.has(item.role)) {
    const [word, [color, label]] = stated;
    return { decision: "STATED_PRODUCT_COLOUR", shade: { color, token: label, series, source: `zvanični naziv/opis navodi boju materijala „${word}” (orijentacioni token, nije merena nijansa)` } };
  }
  if (stated) return { decision: "KEEP_BRAND", shade: null, reason: `„${stated[0]}” se pominje, ali uloga ${item.role} nije obojen materijal (boja bi bila ambalaža ili opis podloge)` };
  return { decision: "KEEP_BRAND", shade: null, reason: "izvor ne navodi boju materijala" };
}

/* -- 3. Zapisi --------------------------------------------------------------------------- */

const slugByCode = new Map(plan.items.filter((item) => item.code && item.slug).map((item) => [item.code, item.slug]));
const colourDecisions = [];

/** Odnosi iz TDS-a: samo oni čiji zapis postoji u katalogu (uvezen ili već lokalni). */
function relationsOf(record) {
  const map = (codes, relation) => (codes ?? []).map((code) => ({ code, relation, slug: slugByCode.get(code) ?? null, name: byCode.get(code)?.officialName ?? code })).filter((entry) => entry.slug);
  const relations = [...map(record.relations?.hardeners, "USES_HARDENER"), ...map(record.relations?.thinners, "USES_REDUCER"), ...map((record.relations?.otherMentioned ?? []).filter((code) => byCode.get(code)?.role === "additive"), "USES_ADDITIVE")];
  const usedBy = (record.usedBy ?? []).map((code) => ({ code, relation: "USED_BY", slug: slugByCode.get(code) ?? null, name: byCode.get(code)?.officialName ?? code })).filter((entry) => entry.slug);
  return { relations, usedBy };
}

function documentsOf(record) {
  if (!record.tds?.url) return [];
  return [{ kind: "tds", title: `Tehnički list — ${record.officialName}`, href: record.tds.url, language: "en", version: record.tds.revision ?? null, note: `Zvanični dokument na ${new URL(record.tds.url).host}` }];
}

function buildRecord(item) {
  const record = recordByKey.get(item.sourceKey);
  const sr = localization[item.sourceKey];
  const colour = decideShade(item, record);
  colourDecisions.push({ slug: item.slug, code: item.code, role: item.role, decision: colour.decision, shade: colour.shade, reason: colour.reason ?? colour.shade?.source });
  const { relations, usedBy } = relationsOf(record);
  const images = imagePlan.get(item.slug) ?? [];
  const entry = images[0] ? nextPublished[images[0].src] : null;
  const tds = record.tds ?? {};

  return {
    slug: item.slug,
    name: `${BRAND.name} ${record.name ?? record.officialName}`,
    sourceKey: item.sourceKey,
    code: item.code,
    officialName: record.officialName,
    kind: item.kind,
    role: item.role,
    series: item.series,
    line: item.line,
    technologyTags: record.technologyTags ?? [],
    status: item.status,
    documentationGap: item.documentationGap,
    sourceUrls: [record.sources?.infoPortal ?? record.sourceUrl, ...(record.sources?.website ?? []), ...(record.sources?.secondaryMarketing ?? [])].filter(Boolean),
    taxonomy: item.taxonomy,
    systemComponents: (record.systemComponents ?? []).map((code) => {
      const component = source.systemComponents.find((entry) => entry.code === code);
      return { code, role: component?.role ?? null, websitePage: component?.websitePage ?? null };
    }),
    lineProducts: (record.lineProducts ?? []).map((code) => ({ code, slug: slugByCode.get(code) ?? null, name: byCode.get(code)?.officialName ?? code })),
    relations,
    usedBy,
    technical: {
      revision: tds.revision ?? null,
      mixingRatio: tds.mixingRatio ?? null,
      potLife: tds.potLife ?? null,
      filmThickness: tds.filmThickness ?? null,
      drying: tds.drying ?? [],
      nozzle: tds.nozzle ?? null,
      voc: tds.voc ?? null,
    },
    documents: documentsOf(record),
    image: images[0] ? { src: images[0].src, width: entry?.width ?? null, height: entry?.height ?? null, hasAlpha: Boolean(entry?.hasAlpha), processing: entry?.mode ?? null } : null,
    missingOfficialAsset: !images.length,
    content: {
      productType: sr.productType,
      subtype: sr.subtype,
      shortDescription: sr.shortDescription,
      longDescription: sr.longDescription,
      purpose: sr.purpose,
      facts: sr.facts ?? [],
      applications: sr.applications ?? [],
      benefits: sr.benefits ?? [],
      advice: sr.advice ?? null,
    },
    shade: colour.shade,
  };
}

const products = imports.map(buildRecord);

/* -- 4. Dopuna postojećih zapisa ---------------------------------------------------------- */

const enrichmentEntries = {};
for (const item of enrichments) {
  const record = recordByKey.get(item.sourceKey);
  const { relations, usedBy } = relationsOf(record);
  const tds = record.tds ?? {};
  enrichmentEntries[item.slug] = {
    code: item.code,
    officialName: record.officialName,
    kind: item.kind,
    role: item.role,
    series: item.series,
    line: item.line,
    status: item.status,
    documentationGap: item.documentationGap,
    sourceUrls: [record.sources?.infoPortal, ...(record.sources?.website ?? [])].filter(Boolean),
    taxonomy: item.taxonomy,
    relations,
    usedBy,
    systemComponents: (record.systemComponents ?? []).map((code) => ({ code })),
    technical: { revision: tds.revision ?? null, mixingRatio: tds.mixingRatio ?? null, potLife: tds.potLife ?? null, filmThickness: tds.filmThickness ?? null, drying: tds.drying ?? [], nozzle: tds.nozzle ?? null, voc: tds.voc ?? null },
    documents: documentsOf(record),
  };
}

/* -- 5. Upis ------------------------------------------------------------------------------ */

const dataset = {
  meta: {
    generator: "scripts/rm-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    infoPortal: SOURCES.info.origin,
    website: `${SOURCES.website.origin}/${SOURCES.website.locale}`,
    infoPortalCrawledAt: source.meta.infoPortalCrawledAt,
    websiteCrawledAt: source.meta.websiteCrawledAt,
    products: products.length,
    enrichedExisting: Object.keys(enrichmentEntries).length,
    codes: products.filter((product) => product.code).length + Object.values(enrichmentEntries).filter((entry) => entry.code).length,
    note: "Pakovanja i brojevi artikala nisu javno objavljeni — javna zvanična šifra je oznaka proizvoda.",
  },
  products,
  enrichments: enrichmentEntries,
};

/*
 * Registar drži SAMO zapise koje je sync napravio.
 *
 * Dopunjeni zapisi (`rm:import` i ručni) ostaju vlasništvo svog sloja i moraju i u sledećem
 * prolazu biti vidljivi kao LOKALNI zapisi — inače ih poklapanje ne bi našlo, pa bi ih drugi
 * prolaz uvezao kao nove i napravio duplikat. `enriched` je samo evidencija.
 */
const nextRegistry = { ...registry, products: { ...registry.products }, enriched: {} };
for (const item of imports) nextRegistry.products[item.slug] = { sourceKey: item.sourceKey, code: item.code ?? null, firstSeen: registry.products[item.slug]?.firstSeen ?? new Date().toISOString().slice(0, 10) };
for (const item of enrichments) nextRegistry.enriched[item.slug] = { sourceKey: item.sourceKey, code: item.code ?? null, owner: "rm:import / ručni zapis" };

const publishedNext = { _comment: "Objavljene zvanične slike: putanja → izvor i rezultat obrade. Sync ga piše sam.", images: nextPublished };
const colourReport = { summary: Object.fromEntries([...new Set(colourDecisions.map((entry) => entry.decision))].sort().map((decision) => [decision, colourDecisions.filter((entry) => entry.decision === decision).length])), decisions: colourDecisions.sort((a, b) => a.slug.localeCompare(b.slug)) };

const targets = [[PATHS.siteDataset, dataset], [PATHS.identityRegistry, nextRegistry], [PATHS.publishedImages, publishedNext], [PATHS.colourDecisions, colourReport]];
const filesChanged = targets.filter(([file, value]) => JSON.stringify(readJson(file, null)) !== JSON.stringify(value)).map(([file]) => path.relative(REPO_ROOT, file));
if (!checkOnly) for (const [file, value] of targets) writeJson(file, value);

console.log(JSON.stringify({
  products: products.length,
  enrichedExisting: Object.keys(enrichmentEntries).length,
  imagesPublished: checkOnly ? 0 : jobs.length,
  imagesTotal: Object.keys(nextPublished).length,
  missingOfficialAsset: products.filter((product) => product.missingOfficialAsset).length,
  withRelations: products.filter((product) => product.relations.length).length,
  colour: colourReport.summary,
  filesChanged,
}, null, 1));
