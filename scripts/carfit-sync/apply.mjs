#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 7 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - public/products/carfit/catalog/*.webp     (zvanične slike → cut-out WebP)
 *   - data/carfit-sync/published-images.generated.json
 *   - data/carfit-catalog-products.generated.json  (čita ga lib/carfit-catalog-products.ts)
 *   - data/carfit-sync/identity-registry.json      (samo dopuna; red se nikad ne briše)
 *
 * Ručni zapisi u lib/carsystem-data.ts se NE menjaju: prepoznat ručni zapis
 * dobija dopunu (tabelu zvaničnih šifara) kroz `enrichments` u datasetu.
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili
 * (idempotentnost = prazna lista).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { NAMED_COLOR_TOKENS } from "../../lib/productNamedColors.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, CATALOGUE, IMAGE_CACHE_DIR, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";
import { COMPONENT_LABEL_SR, isCompanionRole } from "./lib/components.mjs";
import { displayVariants } from "./lib/variants.mjs";

const checkOnly = process.argv.includes("--check");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const imageManifest = readJson(PATHS.imageManifest);
const documentManifest = readJson(PATHS.documentManifest, { documents: [] });
const registry = readJson(PATHS.identityRegistry, { products: {} });
const published = readJson(PATHS.publishedImages, { images: {} });
if (!plan || !source || !imageManifest) throw new Error("Nedostaje plan/source/manifest — pokrenuti `npm run carfit:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);

const localization = {};
if (existsSync(PATHS.localizationDir)) {
  for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) {
    Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
  }
}

const bySourceKey = new Map(source.products.map((product) => [product.sourceKey, product]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));
const slugBySourceKey = new Map([
  ...imports.map((item) => [item.sourceKey, item.slug]),
  ...plan.items.filter((item) => item.action === "MATCHED_EXISTING").map((item) => [item.sourceKey, item.localSlug]),
]);

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
    // Isti sadržaj se objavljuje jednom, pod prvim slugom (deduplikacija po sha256).
    let publicPath = pathBySha.get(image.sha256);
    if (!publicPath) {
      publicPath = `${PUBLIC_IMAGE_URL_PREFIX}/${item.slug}${image.index === 0 ? "" : `-${image.index + 1}`}.webp`;
      pathBySha.set(image.sha256, publicPath);
    }
    const absolute = path.join(REPO_ROOT, "public", publicPath);
    const known = published.images[publicPath];
    const upToDate = known?.sourceSha256 === image.sha256 && existsSync(absolute) && (image.index !== 0 || known.sample);
    if (upToDate) nextPublished[publicPath] = known;
    else if (!nextPublished[publicPath]) {
      nextPublished[publicPath] = { sourceSha256: image.sha256, sourceFile: image.fileName, sourceUrl: image.url };
      jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: image.index === 0, write: !checkOnly });
    }
    list.push({ src: publicPath, role: image.role });
  }
  imagePlan.set(item.slug, list);
}

if (jobs.length && !checkOnly) {
  mkdirSync(PATHS.publicImages, { recursive: true });
  const results = JSON.parse(
    execFileSync("python3", ["-W", "ignore", path.join(REPO_ROOT, "scripts/carfit-sync/lib/publish_images.py")], {
      input: JSON.stringify(jobs),
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    }),
  );
  for (const job of jobs) Object.assign(nextPublished[job.publicPath], results[job.dest]);
}

/* -- 2. Boja kartice ------------------------------------------------------------------- */

/** Orijentacioni tokeni za boju koju proizvođač navodi REČIMA; postojeći tokeni sajta imaju prednost. */
const WORD_TOKENS = {
  ...NAMED_COLOR_TOKENS,
  red: "#C4352D", green: "#3E8E4B", blue: "#2E6CB4", "dark-blue": "#1F3F7A", orange: "#DF7A27", brown: "#6A4932",
  beige: "#D7C6A2", ivory: "#E4DCC4", silver: "#B8BCC1", gold: "#C8A13E", purple: "#6B4FA0", pink: "#D9799A",
};
const WORD_HUES = { red: 0, orange: 28, yellow: 50, green: 125, blue: 215, "dark-blue": 220, purple: 270, pink: 335 };
const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const lightnessOf = (hex) => (parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)) / 765;

/** Zvanično „Color” polje → JEDNA reč-boja. Više boja („black, grey”) = boja nije osobina porodice. */
function statedColour(product) {
  const phrase = product.facts.colour;
  if (!phrase) return null;
  const normalized = phrase.toLowerCase().replace(/gray/g, "grey").replace(/\b(light|dark)\s+(grey|blue)\b/g, "$1-$2").replace(/violet/g, "purple");
  const words = Object.keys(WORD_TOKENS).sort((a, b) => b.length - a.length).filter((candidate) => new RegExp(`\\b${candidate}\\b`).test(normalized));
  // „light-grey” sadrži i „grey”: kraći pogodak unutar dužeg se ne broji.
  const distinct = words.filter((word) => !words.some((other) => other !== word && other.includes(word)));
  return { phrase, word: distinct.length === 1 ? distinct[0] : null, multiple: distinct.length > 1 };
}

function decideShade(item, product, primary) {
  const stated = statedColour(product);
  const entry = primary ? nextPublished[primary.src] : null;
  const sample = entry?.sample ?? null;
  const articles = item.websiteArticleNumbers;
  const series = `${product.officialName}, art. ${articles[0] ?? item.leadArticleNumber}${articles.length > 1 ? ` (+${articles.length - 1})` : ""}`;

  if (item.taxonomy.packshotShade && sample?.dominantHex) {
    const agrees = !stated?.word || WORD_HUES[stated.word] === undefined || hueDistance(WORD_HUES[stated.word], sample.dominantHue) <= 45;
    // C.A.R.FIT crvena (#E20613) je boja etikete i ambalaže. Crvena na packshotu se
    // prihvata samo kada proizvođač i rečima kaže da je proizvod crven.
    const packagingRed = hueDistance(sample.dominantHue, 0) <= 20 && stated?.word !== "red";
    if (sample.dominantShare >= 0.3 && agrees && !packagingRed && !stated?.multiple) {
      return {
        decision: "PACKSHOT_SAMPLE",
        shade: {
          color: sample.dominantHex,
          series,
          source: `carfitrepair.com zvanična slika (${entry.sourceFile}): uzorak dominantne boje, ${Math.round(sample.dominantShare * 100)}% površine proizvoda${stated ? `; zvanično „Color: ${stated.phrase}”` : ""}`,
        },
      };
    }
  }
  if ((item.taxonomy.materialColour || item.taxonomy.packshotShade) && stated?.word && WORD_TOKENS[stated.word]) {
    return {
      decision: "STATED_COLOUR",
      shade: { color: WORD_TOKENS[stated.word], token: stated.word, series, source: `carfitrepair.com „Color: ${stated.phrase}” (orijentacioni token, nije merena nijansa)` },
    };
  }
  if (item.taxonomy.packshotShade && !stated?.multiple && sample?.medianHex && (sample.saturatedShare ?? 1) < 0.15) {
    const color = lightnessOf(sample.medianHex) > 0.86 ? NAMED_COLOR_TOKENS.white : sample.medianHex;
    return { decision: "PACKSHOT_NEUTRAL", shade: { color, series, source: `carfitrepair.com zvanična slika (${entry.sourceFile}): medijana neutralne površine proizvoda` } };
  }
  if (stated && /colou?rless|transparent|farblos/i.test(stated.phrase) && !stated.word) {
    return { decision: "KEEP_BRAND", shade: null, reason: `„Color: ${stated.phrase}” — bezbojan materijal nema boju kartice` };
  }
  const reason = stated?.multiple
    ? `više boja u porodici („${stated.phrase}”) — boja je osobina varijante, ne porodice`
    : stated && !item.taxonomy.materialColour
      ? `„Color: ${stated.phrase}” postoji, ali kategorija nije označena kao materialColour (boja ambalaže/spreja se ne proglašava bojom materijala)`
      : stated
        ? `„Color: ${stated.phrase}” nije prepoznata reč-boja`
        : "proizvođač ne navodi boju; hemija u ambalaži ne dobija boju sa slike";
  return { decision: stated && !stated.word && !stated.multiple ? "NEEDS_MANUAL_REVIEW" : "KEEP_BRAND", shade: null, reason };
}

/* -- 3. Varijante ------------------------------------------------------------------------ */

/**
 * Ključ kolone bira `getPrimaryVariantColumn` (lib/carsystem-data.ts) po listi
 * prioriteta: …grit, size, volume, …, pack. Kolona „Fabričko pakovanje” ima ključ
 * `pack`, pa ključ van liste („variant”) gubi od nje i birač varijanti na PDP-u
 * bi nudio „Na upit / Na upit”. Zato opšta kolona nosi ključ `size`.
 */
function variantColumn(variants) {
  const all = (key) => variants.length > 0 && variants.every((variant) => variant.attributes?.[key]);
  if (variants.some((variant) => variant.component && isCompanionRole(variant.componentRole))) return { key: "size", label: "Komponenta / pakovanje" };
  if (all("grit")) return { key: "grit", label: "Granulacija" };
  if (all("volume") || all("weight")) return { key: "volume", label: "Pakovanje" };
  if (all("dimensions") || all("length")) return { key: "size", label: "Dimenzija" };
  return { key: "size", label: "Varijanta" };
}

function buildVariants(product, sr) {
  return displayVariants(product).map((variant) => ({
    articleNumber: variant.articleNumber,
    label: sr?.variants?.[variant.articleNumber] ?? variant.descriptor ?? "Standardno pakovanje",
    component: variant.component,
    componentRole: variant.componentRole,
    componentLabel: variant.component ? COMPONENT_LABEL_SR[variant.componentRole] : null,
    officialDescriptor: variant.descriptor,
    // Broj komada: sa stranice („50 pcs.”) ili iz kolone „Pcs./pack” PDF kataloga.
    pieces: variant.attributes?.pieces ?? null,
    pcsPerPack: variant.pcsPerPack ?? null,
    onWebsite: variant.onWebsite,
    inCatalogue: variant.inCatalogue,
    shorthandOf: variant.shorthandOf ?? null,
    // Drugi zvanični zapis iste šifre (npr. PDF 4-204-3600 uz sajt 4-304-3600): pretraživ, nije varijanta.
    alternateArticleNumbers: (variant.alternateArticleNumbers ?? []).map((alternate) => ({ articleNumber: alternate.articleNumber, source: alternate.source })),
  }));
}

function documentsFor(sourceKey) {
  return documentManifest.documents
    .filter((document) => document.sourceKey === sourceKey && document.ok)
    .map((document) => ({ kind: document.kind, component: document.component, href: document.href, fileName: document.fileName, language: /_GB_en|english|-en\b/i.test(document.fileName) ? "Engleski" : null }));
}

/* -- 4. Dataset ---------------------------------------------------------------------------- */

// Stranica čija je jedina šifra u vlasništvu drugog proizvoda = isti artikal pod drugim nazivom.
const aliasPagesByOwner = new Map();
for (const item of plan.items.filter((entry) => entry.action === "REPRESENTED_BY_OWNER")) {
  const list = aliasPagesByOwner.get(item.representedBySourceKey) ?? [];
  list.push({ officialName: item.officialName, url: item.url, articleNumbers: item.sharedArticleNumbers.map((shared) => shared.articleNumber) });
  aliasPagesByOwner.set(item.representedBySourceKey, list);
}

const colourDecisions = [];
const products = imports.map((item) => {
  const product = bySourceKey.get(item.sourceKey);
  const sr = localization[item.sourceKey];
  const images = imagePlan.get(item.slug) ?? [];
  const primary = images[0] ?? null;
  const primaryEntry = primary ? nextPublished[primary.src] : null;
  const variants = buildVariants(product, sr);
  const colour = decideShade(item, product, primary);
  colourDecisions.push({ slug: item.slug, officialName: product.officialName, decision: colour.decision, color: colour.shade?.color ?? null, stated: product.facts.colour, reason: colour.reason ?? colour.shade?.source });

  return {
    slug: item.slug,
    name: `Car Fit ${sr.displayName ?? product.officialName}`,
    sourceKey: item.sourceKey,
    sourceUrl: product.url,
    officialName: product.officialName,
    officialCategory: item.taxonomy.officialCategory,
    classification: product.classification,
    taxonomy: { category: item.taxonomy.category, programSlug: item.taxonomy.programSlug, phaseSlug: item.taxonomy.phaseSlug, visualType: item.taxonomy.visualType },
    inCatalogue: product.classification === "WEBSITE_AND_CATALOGUE",
    cataloguePages: product.cataloguePages,
    leadArticleNumber: item.leadArticleNumber,
    articleNumberSource: product.articleNumberSource,
    relatedLegacySlug: item.relatedLegacySlug,
    // Atributi (granulacija, zapremina…) su na izvornim varijantama, ne na izgrađenim redovima.
    variantColumn: variantColumn(displayVariants(product)),
    variants,
    sharedArticles: item.sharedArticleNumbers.map((shared) => ({ articleNumber: shared.articleNumber, ownerSlug: slugBySourceKey.get(shared.owner) ?? null })),
    aliasPages: aliasPagesByOwner.get(item.sourceKey) ?? [],
    image: primary ? { src: primary.src, width: primaryEntry?.width ?? null, height: primaryEntry?.height ?? null, hasAlpha: Boolean(primaryEntry?.hasAlpha), processing: primaryEntry?.mode ?? null } : null,
    missingOfficialAsset: !primary,
    gallery: images.slice(1).map((image) => ({ src: image.src })),
    documents: documentsFor(item.sourceKey),
    content: {
      productType: sr.productType,
      subtype: sr.subtype,
      shortDescription: sr.shortDescription,
      longDescription: sr.longDescription,
      purpose: sr.purpose,
      facts: sr.facts ?? [],
      applications: sr.applications ?? [],
      benefits: sr.benefits ?? [],
      substrates: sr.substrates ?? [],
      advice: sr.advice ?? null,
    },
    shade: colour.shade,
  };
});

const decisions = readJson(PATHS.decisions, { local: {} });
const enrichments = {};
for (const match of plan.localMatches.filter((entry) => entry.autoApply && entry.sourceKey)) {
  const product = bySourceKey.get(match.sourceKey);
  const sr = localization[match.sourceKey];
  const variants = buildVariants(product, sr);
  // Ručni zapis čiji NAZIV opisuje jednu varijantu („… 4 x 5 m”), a dokazano je cela
  // zvanična porodica: uz ručnu odluku dobija zvanični naziv i opis porodice. Slug
  // (javni URL) i sam zapis u lib/carsystem-data.ts ostaju netaknuti.
  const useOfficialPresentation = Boolean(decisions.local?.[match.localSlug]?.useOfficialPresentation) && Boolean(sr);
  const lead = variants.find((variant) => match.matchedArticleNumbers?.includes(variant.articleNumber)) ?? variants[0];
  enrichments[match.localSlug] = {
    sourceKey: match.sourceKey,
    sourceUrl: product.url,
    officialName: product.officialName,
    classification: match.classification,
    evidence: match.evidence,
    inCatalogue: product.classification === "WEBSITE_AND_CATALOGUE",
    variantColumn: variantColumn(displayVariants(product)),
    variants,
    documents: documentsFor(match.sourceKey),
    presentation: useOfficialPresentation
      ? {
          name: `Car Fit ${sr.displayName ?? product.officialName}`,
          officialName: product.officialName,
          leadArticleNumber: lead.articleNumber,
          productType: sr.productType,
          shortDescription: sr.shortDescription,
          longDescription: sr.longDescription,
          purpose: sr.purpose,
          facts: sr.facts ?? [],
          decision: decisions.local[match.localSlug].note ?? null,
        }
      : null,
  };
}

const dataset = {
  meta: {
    generator: "scripts/carfit-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    website: `${source.meta.website.source}/en/`,
    websiteCrawledAt: source.meta.website.crawledAt,
    catalogue: CATALOGUE.title,
    catalogueUrl: source.meta.catalogue.sourceUrl,
    catalogueSha256: source.meta.catalogue.sha256,
    products: products.length,
    variants: products.reduce((sum, entry) => sum + entry.variants.length, 0),
    enrichedExisting: Object.keys(enrichments).length,
    withShade: products.filter((entry) => entry.shade).length,
    missingOfficialAsset: products.filter((entry) => entry.missingOfficialAsset).length,
  },
  products,
  enrichments,
};

/* -- 5. Registar (samo dopuna) --------------------------------------------------------------- */

const crawlDate = source.meta.website.crawledAt.slice(0, 10);
const nextRegistry = {
  _comment: "sourceKey / šifra artikla → naš slug. Sync ovaj fajl samo dopunjuje; red se nikad ne briše, jer je slug javni URL.",
  products: { ...registry.products },
};
for (const item of imports) {
  const known = nextRegistry.products[item.slug];
  const previous = (item.renamedFrom ?? []).map((slug) => registry.products[slug]).filter(Boolean);
  nextRegistry.products[item.slug] = {
    sourceKey: item.sourceKey,
    articleNumbers: [...new Set([...(known?.articleNumbers ?? []), ...item.articleNumbers, ...(item.alternateArticleNumbers ?? [])])].sort(),
    firstSeen: known?.firstSeen ?? previous[0]?.firstSeen ?? crawlDate,
    lastSeen: crawlDate,
  };
  // Stara adresa ostaje u registru (slug je javni URL) i trajno preusmerava na novu.
  for (const slug of item.renamedFrom ?? []) nextRegistry.products[slug] = { ...registry.products[slug], renamedTo: item.slug };
}
nextRegistry.products = Object.fromEntries(Object.entries(nextRegistry.products).sort(([a], [b]) => a.localeCompare(b)));

/* Trajna preusmerenja preimenovanih adresa (ručna odluka `slugRenames`) — čita ih next.config.ts. */
dataset.redirects = Object.entries(nextRegistry.products)
  .filter(([, entry]) => entry.renamedTo)
  .map(([slug, entry]) => ({ source: `/proizvodi/${slug}`, destination: `/proizvodi/${entry.renamedTo}`, permanent: true }));

const publishedOut = {
  _comment: "Javna putanja → zvanični izvor slike. `mode`: cut-out (maska spoljne bele pozadine) | kept-background | source-alpha.",
  images: Object.fromEntries(Object.entries(nextPublished).sort(([a], [b]) => a.localeCompare(b))),
};
const colourOut = {
  summary: Object.fromEntries([...new Set(colourDecisions.map((entry) => entry.decision))].sort().map((decision) => [decision, colourDecisions.filter((entry) => entry.decision === decision).length])),
  decisions: colourDecisions,
};

/* -- 6. Upis / provera -------------------------------------------------------------------------- */

const COLOUR_REPORT = path.join(PATHS.dataDir, "reports/colour-decisions.generated.json");
const outputs = [
  [PATHS.siteDataset, dataset],
  [PATHS.identityRegistry, nextRegistry],
  [PATHS.publishedImages, publishedOut],
  [COLOUR_REPORT, colourOut],
];

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const filesChanged = outputs.filter(([file, value]) => !existsSync(file) || readFileSync(file, "utf8") !== serialize(value)).map(([file]) => path.relative(REPO_ROOT, file));

if (checkOnly) {
  console.log(JSON.stringify({ mode: "check", newProducts: imports.filter((item) => item.change === "NEW").length, imagesToPublish: jobs.length, filesChanged }, null, 2));
  if (filesChanged.length || jobs.length) process.exitCode = 1;
} else {
  for (const [file, value] of outputs) writeJson(file, value);
  console.log(
    JSON.stringify(
      { mode: "apply", products: products.length, variants: dataset.meta.variants, enrichedExisting: dataset.meta.enrichedExisting, imagesPublished: jobs.length, imagesTotal: Object.keys(nextPublished).length, withShade: dataset.meta.withShade, colour: colourOut.summary, filesChanged },
      null,
      2,
    ),
  );
}
