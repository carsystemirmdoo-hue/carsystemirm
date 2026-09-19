#!/usr/bin/env node
/**
 * BEFAR sync, korak 6 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - public/products/befar/catalog/*.webp           (zvanične slike, lokalno)
 *   - data/befar-sync/published-images.generated.json
 *   - data/befar-catalog-products.generated.json     (čita ga lib/befar-catalog-products.ts)
 *   - data/befar-sync/identity-registry.json         (samo dopuna)
 *   - data/befar-sync/reports/colour-decisions.generated.json
 *
 * Ručni zapisi u lib/carsystem-data.ts se NE menjaju.
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { NAMED_COLOR_TOKENS } from "../../lib/productNamedColors.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, CATALOGUE, IMAGE_CACHE_DIR, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";
import { colourSr, variantLabel, varyingKeysOf } from "./lib/labels.mjs";

const checkOnly = process.argv.includes("--check");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const imageManifest = readJson(PATHS.imageManifest);
const registry = readJson(PATHS.identityRegistry, { products: {} });
const published = readJson(PATHS.publishedImages, { images: {} });
if (!plan || !source || !imageManifest) throw new Error("Nedostaje plan/source/manifest — pokrenuti `npm run befar:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);

const localization = {};
if (existsSync(PATHS.localizationDir)) {
  for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
}

const bySourceKey = new Map(source.products.map((product) => [product.sourceKey, product]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));

/* -- 1. Slike ------------------------------------------------------------------------ */

const imagesBySource = new Map();
for (const image of imageManifest.images) imagesBySource.set(image.sourceKey, [...(imagesBySource.get(image.sourceKey) ?? []), image]);

const pathBySha = new Map(Object.entries(published.images).map(([publicPath, entry]) => [entry.sourceSha256, publicPath]));
const nextPublished = {};
const jobs = [];
const imagePlan = new Map();

for (const item of imports) {
  const list = [];
  for (const image of imagesBySource.get(item.sourceKey) ?? []) {
    if (image.error) continue;
    // Isti sadržaj (grupna fotografija koju deli više proizvoda) objavljuje se jednom.
    let publicPath = pathBySha.get(image.sha256);
    if (!publicPath) {
      publicPath = `${PUBLIC_IMAGE_URL_PREFIX}/${item.slug}${image.index === 0 ? "" : `-${image.index + 1}`}.webp`;
      pathBySha.set(image.sha256, publicPath);
    }
    const absolute = path.join(REPO_ROOT, "public", publicPath);
    const known = published.images[publicPath];
    if (known?.sourceSha256 === image.sha256 && existsSync(absolute)) nextPublished[publicPath] = known;
    else if (!nextPublished[publicPath]) {
      nextPublished[publicPath] = { sourceSha256: image.sha256, sourceMediaId: image.mediaId, sourceUrl: image.url, title: image.title ?? null };
      jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: false, keepBackground: true, write: !checkOnly });
    }
    list.push({ src: publicPath, role: image.role, title: image.title ?? null });
  }
  imagePlan.set(item.slug, list);
}

if (jobs.length && !checkOnly) {
  mkdirSync(PATHS.publicImages, { recursive: true });
  // Isti korak objave kao C.A.R.FIT (WebP, najduža strana, metapodaci), ali BEZ uklanjanja pozadine:
  // Befar snima bele boce i svetle sunđere na svetlom studijskom gradijentu, pa maska „belina
  // povezana sa ivicom” zahvata i sam proizvod (provereno na Anti Hologram / Auto Polish).
  // Cut-out ovde nije dokazivo bezbedan → fotografija ostaje cela; izvorni alfa kanal se čuva.
  const results = JSON.parse(
    execFileSync("python3", ["-W", "ignore", path.join(REPO_ROOT, "scripts/carfit-sync/lib/publish_images.py")], { input: JSON.stringify(jobs), encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }),
  );
  for (const job of jobs) {
    Object.assign(nextPublished[job.publicPath], results[job.dest]);
    if (nextPublished[job.publicPath].mode === "kept-background") nextPublished[job.publicPath].reason = "studijska fotografija proizvođača; uklanjanje pozadine nije dokazivo bezbedno";
  }
}

/* -- 2. Boja: prvo ČINJENICA varijante, pa tek onda boja kartice ---------------------------- */

const COLOUR_TOKENS = {
  ...NAMED_COLOR_TOKENS,
  orange: "#DF7A27", blue: "#2E6CB4", cream: "#E9E1C6", burgundy: "#7B2D3A", red: "#C4352D", green: "#3E8E4B", turquoise: "#2AA5A2",
};
const colourKey = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (/claret|burgundy|cherry/.test(text)) return "burgundy";
  if (/beyaz/.test(text)) return "white";
  if (/yellow-black/.test(text)) return "yellow-black";
  return ["white", "orange", "black", "yellow", "blue", "cream", "red", "grey", "green", "turquoise"].find((word) => text.includes(word)) ?? null;
};

function decideShade(item, product) {
  const variantColours = [...new Set(product.variants.map((variant) => colourKey(variant.colour)).filter(Boolean))];
  const qualifierColours = [...new Set(product.qualifiers.map(colourKey).filter(Boolean))];
  const colours = variantColours.length ? variantColours : qualifierColours;
  const series = `${product.displayNameEn}, šifre ${product.variants[0].code}${product.variants.length > 1 ? ` (+${product.variants.length - 1})` : ""}`;
  if (!item.taxonomy.materialColour) return { decision: "KEEP_BRAND", shade: null, reason: "kategorija nije označena kao materialColour (hemija/pribor u ambalaži: boja sa slike je ambalaža)" };
  if (colours.length === 1 && COLOUR_TOKENS[colours[0]]) {
    const from = variantColours.length ? `kolona „Color”: ${product.variants.find((variant) => variant.colour).colour}` : `oznaka bloka „${product.qualifiers.join(" ")}”`;
    return { decision: "STATED_COLOUR", shade: { color: COLOUR_TOKENS[colours[0]], token: colours[0], series, source: `befar.com.tr ${from} (orijentacioni token, nije merena nijansa)` } };
  }
  if (colours.length > 1) return { decision: "KEEP_BRAND", shade: null, reason: `porodica ima ${colours.length} boja (${colours.join(", ")}) — kod Befara boja znači tvrdoću/namenu i ostaje činjenica VARIJANTE (uzorak uz svaku varijantu), ne boja kartice` };
  if (colours.length === 1) return { decision: "NEEDS_MANUAL_REVIEW", shade: null, reason: `boja „${colours[0]}” nema token` };
  return { decision: "KEEP_BRAND", shade: null, reason: "proizvođač ne navodi boju" };
}

const ALL_VARIANT_KEYS = new Set(["colour", "size", "holes"]);

/* -- 3. Varijante ------------------------------------------------------------------------------ */

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

function variantColumn(product) {
  const keys = varyingKeysOf(product.variants);
  if (keys.has("colour")) return { key: "color", label: keys.has("size") ? "Boja i dimenzija" : "Boja" };
  if (keys.has("holes")) return { key: "size", label: "Broj rupa" };
  // Ključ mora biti u listi prioriteta `getPrimaryVariantColumn` PRE `pack` (vidi C.A.R.FIT sync).
  return { key: "size", label: product.variants.some((variant) => /\d\s?(gr|g|ml)\b/i.test(variant.size ?? "")) ? "Pakovanje" : "Dimenzija" };
}

function buildVariants(product, images) {
  const keys = varyingKeysOf(product.variants);
  return product.variants.map((variant) => {
    const key = colourKey(variant.colour);
    // Slajd galerije čiji zvanični naslov nosi boju („… Orange”) je slika varijanti te boje.
    const image = key && key !== "yellow-black" ? images.find((candidate) => candidate.title && colourKey(candidate.title) === key) : null;
    return {
      code: variant.code,
      label: capitalize(variantLabel(variant, keys)),
      // Pun opis (boja · dimenzija · rupe) i kada atribut NE varira: kupac traži „narandžasta 220 × 35 mm”,
      // a oznaka u biraču nosi samo ono po čemu se varijante razlikuju.
      searchLabel: variantLabel(variant, ALL_VARIANT_KEYS),
      colour: variant.colour ?? null,
      colourSr: variant.colour ? colourSr(variant.colour) : null,
      // Uzorak uz varijantu je NAŠ orijentacioni token boje; zvanični hex sa sajta ostaje u RAW datasetu.
      swatch: key && COLOUR_TOKENS[key] ? COLOUR_TOKENS[key] : null,
      size: variant.size ?? null,
      holes: variant.holes ?? null,
      hardnessStars: variant.hardness?.stars ?? null,
      applyWith: variant.hardness?.applyWith ?? null,
      boxQuantity: variant.catalogue?.boxQuantity ?? null,
      image: image?.src ?? null,
      onWebsite: true,
      inCatalogue: Boolean(variant.inCatalogue),
      cataloguePage: variant.catalogue?.pdfPage ?? null,
    };
  });
}

/* -- 4. Dataset ------------------------------------------------------------------------------------ */

const colourDecisions = [];
const products = imports.map((item) => {
  const product = bySourceKey.get(item.sourceKey);
  const sr = localization[item.sourceKey];
  const images = imagePlan.get(item.slug) ?? [];
  const primary = images[0] ?? null;
  const entry = primary ? nextPublished[primary.src] : null;
  const variants = buildVariants(product, images);
  const colour = decideShade(item, product);
  colourDecisions.push({
    slug: item.slug,
    officialName: product.displayNameEn,
    decision: colour.decision,
    color: colour.shade?.color ?? null,
    variantColours: [...new Set(product.variants.map((variant) => variant.colour).filter(Boolean))],
    colourCarriesHardness: product.variants.some((variant) => variant.hardness),
    reason: colour.reason ?? colour.shade?.source,
  });
  const displayName = sr.displayName ?? product.displayNameEn;

  return {
    slug: item.slug,
    name: `${BRAND.name} ${displayName}`.replace(/^Befar Befar /, "Befar "),
    sourceKey: item.sourceKey,
    sourceUrls: product.pages.map((page) => `${source.meta.website.source}/${page}`),
    officialName: product.displayNameEn,
    officialNameTr: product.titleTr,
    line: product.line,
    kind: product.kind,
    isSet: product.isSet,
    qualifiers: product.qualifiers,
    officialCategories: product.categories,
    classification: product.classification,
    taxonomy: { category: item.taxonomy.category, programSlug: item.taxonomy.programSlug, phaseSlug: item.taxonomy.phaseSlug, visualType: item.taxonomy.visualType },
    cataloguePages: product.cataloguePages,
    leadCode: item.leadCode,
    relatedLegacySlugs: item.relatedLegacySlugs,
    variantColumn: variantColumn(product),
    variants,
    image: primary ? { src: primary.src, width: entry?.width ?? null, height: entry?.height ?? null, hasAlpha: Boolean(entry?.hasAlpha), processing: entry?.mode ?? null } : null,
    sharedGroupImages: Boolean(product.sharedGroupImages),
    missingOfficialAsset: !primary,
    // Slajd koji je postao slika varijante ne ponavlja se u galeriji; svaki drugi zvanični snimak
    // (i drugi snimak iste boje iz bloka druge dimenzije, i „Cream Cake” bez varijante boje) ostaje u njoj.
    gallery: images.slice(1).filter((image) => !variants.some((variant) => variant.image === image.src)).map((image) => ({ src: image.src })),
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
      setContents: sr.setContents ?? [],
    },
    shade: colour.shade,
  };
});

const dataset = {
  meta: {
    generator: "scripts/befar-sync/apply.mjs",
    brand: BRAND.name,
    website: source.meta.website.source,
    websiteCrawledAt: source.meta.website.crawledAt,
    catalogue: CATALOGUE.title,
    catalogueUrl: source.meta.catalogue.sourceUrl,
    catalogueSha256: source.meta.catalogue.sha256,
    products: products.length,
    variants: products.reduce((sum, entry) => sum + entry.variants.length, 0),
    byLine: Object.fromEntries([...new Set(products.map((entry) => entry.line))].sort().map((line) => [line, products.filter((entry) => entry.line === line).length])),
    withShade: products.filter((entry) => entry.shade).length,
    missingOfficialAsset: products.filter((entry) => entry.missingOfficialAsset).length,
  },
  products,
  enrichments: {},
};

/* -- 5. Registar (samo dopuna) ----------------------------------------------------------------------- */

const crawlDate = String(source.meta.website.crawledAt ?? "").slice(0, 10);
const nextRegistry = { _comment: "sourceKey / šifra → naš slug. Sync ovaj fajl samo dopunjuje; red se nikad ne briše, jer je slug javni URL.", products: { ...registry.products } };
for (const item of imports) {
  const known = nextRegistry.products[item.slug];
  nextRegistry.products[item.slug] = { sourceKey: item.sourceKey, codes: [...new Set([...(known?.codes ?? []), ...item.codes])].sort(), firstSeen: known?.firstSeen ?? crawlDate, lastSeen: crawlDate };
}
nextRegistry.products = Object.fromEntries(Object.entries(nextRegistry.products).sort(([a], [b]) => a.localeCompare(b)));

const publishedOut = {
  _comment: "Javna putanja → zvanični izvor slike (Wix medijska biblioteka befar.com.tr). `mode`: kept-background (studijska fotografija) | source-alpha | cut-out.",
  images: Object.fromEntries(Object.entries(nextPublished).sort(([a], [b]) => a.localeCompare(b))),
};
const colourOut = {
  _comment: "Boja je kod Befara prvo činjenica VARIJANTE (tvrdoća/namena); kartica dobija boju samo kada cela porodica ima jednu boju materijala.",
  summary: Object.fromEntries([...new Set(colourDecisions.map((entry) => entry.decision))].sort().map((decision) => [decision, colourDecisions.filter((entry) => entry.decision === decision).length])),
  decisions: colourDecisions,
};

const outputs = [
  [PATHS.siteDataset, dataset],
  [PATHS.identityRegistry, nextRegistry],
  [PATHS.publishedImages, publishedOut],
  [PATHS.colourDecisions, colourOut],
];
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const filesChanged = outputs.filter(([file, value]) => !existsSync(file) || readFileSync(file, "utf8") !== serialize(value)).map(([file]) => path.relative(REPO_ROOT, file));

if (checkOnly) {
  console.log(JSON.stringify({ mode: "check", newProducts: imports.filter((item) => item.change === "NEW").length, imagesToPublish: jobs.length, filesChanged }, null, 2));
  if (filesChanged.length || jobs.length) process.exitCode = 1;
} else {
  for (const [file, value] of outputs) writeJson(file, value);
  console.log(JSON.stringify({ mode: "apply", products: products.length, variants: dataset.meta.variants, byLine: dataset.meta.byLine, imagesPublished: jobs.length, imagesTotal: Object.keys(nextPublished).length, withShade: dataset.meta.withShade, colour: colourOut.summary, filesChanged }, null, 2));
}
