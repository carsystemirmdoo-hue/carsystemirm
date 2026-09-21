#!/usr/bin/env node
/**
 * Carsystem sync · korak 5 — APPLY. Jedini korak koji menja katalog sajta.
 *
 * Čita plan (`plan.mjs` ga mora napraviti neposredno pre) i piše:
 *
 *   data/carsystem-catalog-products.generated.json   proizvodi + dopune, čita ih
 *                                                    `lib/carsystem-catalog-products.ts`
 *   data/carsystem-sync/identity-registry.json       šifra artikla → naš slug (trajno)
 *   data/carsystem-sync/published-images.generated.json
 *   public/products/carsystem/catalog/*.webp         zvanični packshotovi
 *
 * Šta NE radi: ne briše ništa (ni proizvod koji je nestao iz izvora, ni sliku),
 * ne dira ručne zapise u `lib/carsystem-data.ts`, ne upisuje cene ni zalihe.
 * Javni status svakog uvezenog proizvoda je postojeće pravilo sajta: „Na upit”.
 *
 * Idempotentno: drugi prolaz nad istim izvorom daje bajt-identične fajlove.
 * `--check` ne piše ništa i izlazi sa 1 ako bi se bilo šta promenilo.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CATALOGUE, IMAGE_CACHE_DIR, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";
import { readJson } from "./lib/http.mjs";
import { NAMED_COLOR_TOKENS } from "../../lib/productNamedColors.mjs";

const checkOnly = process.argv.includes("--check");
const PUBLISHED_IMAGES_PATH = path.join(path.dirname(PATHS.imageManifest), "published-images.generated.json");
const LOCALIZATION_DIR = path.join(path.dirname(PATHS.localization), "localization");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const manifest = readJson(PATHS.imageManifest);
const documentManifest = readJson(path.join(path.dirname(PATHS.imageManifest), "document-manifest.generated.json"), { documents: [] });
const registry = readJson(PATHS.identityRegistry, { products: {} });
const published = readJson(PUBLISHED_IMAGES_PATH, { images: {} });
if (!plan || !source || !manifest) throw new Error("Nedostaje plan/source/manifest — pokrenuti `npm run carsystem:sync:plan`.");
if (plan.summary.planErrors.duplicateSlugs.length || plan.summary.planErrors.nameCollisions.length) {
  throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);
}

const localization = {};
for (const file of readdirSync(LOCALIZATION_DIR).filter((name) => name.endsWith(".json")).sort()) {
  Object.assign(localization, readJson(path.join(LOCALIZATION_DIR, file), {}));
}

const bySourceKey = new Map(source.products.map((product) => [product.sourceKey, product]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));

/* -- 1. Slike --------------------------------------------------------------- */

const imagesBySource = new Map();
for (const image of manifest.images) {
  if (!imagesBySource.has(image.sourceKey)) imagesBySource.set(image.sourceKey, []);
  imagesBySource.get(image.sourceKey).push(image);
}

const pathBySha = new Map(Object.entries(published.images).map(([publicPath, entry]) => [entry.sourceSha256, publicPath]));
const nextPublished = {};
const jobs = [];
const imagePlan = new Map(); // slug → [{src, role, source}]

for (const item of imports) {
  const list = [];
  for (const image of imagesBySource.get(item.sourceKey) ?? []) {
    if (image.error) continue;
    // Isti sadržaj (deljeni packshot) objavljuje se jednom, pod prvim slugom.
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
      nextPublished[publicPath] = { sourceSha256: image.sha256, sourceFile: image.fileName, sourceUrl: image.processedUrl, hasAlpha: image.hasAlpha };
      jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: image.index === 0, write: !checkOnly });
    }
    list.push({ src: publicPath, role: image.role, hasAlpha: image.hasAlpha });
  }
  imagePlan.set(item.slug, list);
}

// Ručni zapis čija slika dokazano prikazuje pogrešan proizvod dobija zvanični
// packshot SVOG proizvoda, istim tokom kao i uvezeni proizvodi (keš → WebP →
// `catalog/<naš slug>.webp`). Ručni zapis i njegova stara slika se ne diraju.
const enrichmentImages = new Map(); // localSlug → {src, role, hasAlpha}
for (const match of plan.localMatches) {
  if (!match.autoApply || !match.enrichment?.useOfficialImage) continue;
  const image = (imagesBySource.get(match.enrichment.sourceKey) ?? []).find((candidate) => candidate.index === 0 && !candidate.error);
  if (!image) continue;
  let publicPath = pathBySha.get(image.sha256);
  if (!publicPath) {
    publicPath = `${PUBLIC_IMAGE_URL_PREFIX}/${match.localSlug}.webp`;
    pathBySha.set(image.sha256, publicPath);
  }
  const absolute = path.join(REPO_ROOT, "public", publicPath);
  const known = published.images[publicPath];
  if (known?.sourceSha256 === image.sha256 && existsSync(absolute)) nextPublished[publicPath] = known;
  else if (!nextPublished[publicPath]) {
    nextPublished[publicPath] = { sourceSha256: image.sha256, sourceFile: image.fileName, sourceUrl: image.processedUrl, hasAlpha: image.hasAlpha };
    jobs.push({ src: path.join(IMAGE_CACHE_DIR, image.fileName), dest: absolute, publicPath, sample: false, write: !checkOnly });
  }
  enrichmentImages.set(match.localSlug, { src: publicPath, hasAlpha: image.hasAlpha, sourceUrl: image.processedUrl, sourceSha256: image.sha256 });
}

if (jobs.length && !checkOnly) {
  mkdirSync(PATHS.publicImages, { recursive: true });
  const results = JSON.parse(
    execFileSync("python3", [path.join(REPO_ROOT, "scripts/carsystem-sync/lib/publish_images.py")], {
      input: JSON.stringify(jobs),
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    }),
  );
  for (const job of jobs) Object.assign(nextPublished[job.publicPath], results[job.dest]);
}

/* -- 2. Boja serije --------------------------------------------------------- */

/** Orijentacioni tokeni za boju koju proizvođač navodi REČIMA; postojeći tokeni sajta imaju prednost. */
const WORD_TOKENS = {
  ...NAMED_COLOR_TOKENS,
  red: "#C4352D", green: "#3E8E4B", blue: "#2E6CB4", "light-blue": "#7DB1DC", turquoise: "#2AA5A2",
  orange: "#DF7A27", brown: "#6A4932", beige: "#D7C6A2", silver: "#B8BCC1", gold: "#C8A13E", purple: "#6B4FA0",
  pink: "#D9799A", anthracite: "#3A3D42",
};
const WORD_HUES = { red: 0, orange: 28, yellow: 50, green: 125, turquoise: 178, blue: 215, purple: 270, pink: 335 };

function statedColour(product) {
  for (const line of product.sections.DESCRIPTION ?? []) {
    const match = /^colou?r\s*:\s*(.+)$/i.exec(line.trim());
    if (!match) continue;
    const phrase = match[1].toLowerCase().replace(/gray/g, "grey").replace(/\b(light|dark)\s+(grey|blue)\b/g, "$1-$2");
    const word = Object.keys(WORD_TOKENS)
      .sort((a, b) => b.length - a.length)
      .find((candidate) => new RegExp(`\\b${candidate}\\b`).test(phrase));
    return { phrase: match[1].trim(), word: word ?? null, line };
  }
  return null;
}

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const lightnessOf = (hex) => (parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)) / 765;

function decideShade(item, product, primary) {
  const stated = statedColour(product);
  const sample = primary ? nextPublished[primary.src]?.sample : null;
  const file = primary ? nextPublished[primary.src]?.sourceFile : null;
  const series = `${product.officialName}, art. ${product.articles[0].articleNumber}${product.articles.length > 1 ? ` (+${product.articles.length - 1})` : ""}`;

  if (item.taxonomy.packshotShade && sample?.dominantHex) {
    const agrees = !stated?.word || WORD_HUES[stated.word] === undefined || hueDistance(WORD_HUES[stated.word], sample.dominantHue) <= 45;
    // Carsystem pakuje robu u crvene kutije: crvena na packshotu je najčešće
    // ambalaža, ne proizvod. Bez zvanično navedene crvene boje uzorak se odbacuje
    // (kartica ionako dobija crvenu brenda, ali bez lažne tvrdnje o boji serije).
    const packagingRed = hueDistance(sample.dominantHue, 0) <= 20 && stated?.word !== "red";
    if (sample.dominantShare >= 0.3 && agrees && !packagingRed) {
      return {
        color: sample.dominantHex,
        series,
        source: `carsystem.org zvanični packshot (${file}): uzorak dominantne boje, ${Math.round(sample.dominantShare * 100)}% neprovidne površine${stated ? `; zvanični opis: „${stated.line}”` : ""}`,
      };
    }
  }
  if (stated?.word && WORD_TOKENS[stated.word]) {
    return { color: WORD_TOKENS[stated.word], token: stated.word, series, source: `carsystem.org zvanični opis: „${stated.line}” (orijentacioni token, nije merena nijansa)` };
  }
  if (item.taxonomy.packshotShade && sample?.medianHex && (sample.saturatedShare ?? 1) < 0.15) {
    // Neutralan proizvod (crn/siv/beo). Čista bela na svetloj kartici je nevidljiva → topla bela sajta.
    const color = lightnessOf(sample.medianHex) > 0.86 ? NAMED_COLOR_TOKENS.white : sample.medianHex;
    return { color, series, source: `carsystem.org zvanični packshot (${file}): medijana neutralne površine proizvoda` };
  }
  return null;
}

/* -- 3. Varijante ----------------------------------------------------------- */

function variantColumn(articles) {
  const all = (key) => articles.length > 0 && articles.every((article) => article.attributes[key]);
  if (all("grit")) return { key: "grit", label: "Granulacija" };
  if (all("size")) return { key: "size", label: "Veličina" };
  if (all("volume") || all("weight")) return { key: "volume", label: "Pakovanje" };
  if (all("dimensions") || all("diameter")) return { key: "size", label: "Dimenzija" };
  return { key: "spec", label: "Specifikacija" };
}

/**
 * Napomene o dostupnosti koje PROIZVOĐAČ upisuje u samu specifikaciju artikla.
 * To je zvanična činjenica o artiklu, ne naša tvrdnja o zalihama: prenosi se u
 * kolonu statusa, a iz oznake varijante se uklanja da ostane čista mera.
 */
const MANUFACTURER_NOTES = [
  { source: /only in france available\.?/i, sr: "Proizvođač: dostupno samo u Francuskoj", label: /dostupno samo u francuskoj\.?/i },
  { source: /no(?:t)? longer in stock/i, sr: "Proizvođač: više nije na zalihama", label: /više nije na (?:zalihama|stanju)/i },
];

function buildVariants(product, sr) {
  return product.articles.map((article) => {
    const note = MANUFACTURER_NOTES.find((candidate) => candidate.source.test(article.specification ?? ""));
    const rawLabel = sr?.variants?.[article.articleNumber] ?? article.specification ?? "Standardno pakovanje";
    const label = note
      ? rawLabel.replace(note.label, "").replace(note.source, "").replace(/(^[\s/]+|[\s/]+$)/g, "").replace(/\s*\/\s*\/\s*/g, " / ").trim() || rawLabel
      : rawLabel;
    return variantRecord(article, label, note?.sr ?? null);
  });
}

function variantRecord(article, label, manufacturerNote) {
  return {
    articleNumber: article.articleNumber,
    label,
    manufacturerNote,
    officialSpecification: article.specification,
    salesPack: article.salesPack,
    packagingUnit: article.packagingUnit,
    inCatalogue: article.sources.includes("catalogue"),
    onWebsite: article.sources.includes("website"),
    hasSds: Boolean(article.sdsEndpoint),
  };
}

const tdsBySource = new Map(documentManifest.documents.map((doc) => [doc.sourceKey, doc]));
const tdsOf = (sourceKey) => {
  const doc = tdsBySource.get(sourceKey);
  return doc ? { href: doc.url, fileName: doc.fileName, sha256: doc.sha256, language: "Engleski" } : null;
};

/* -- 4. Dataset ------------------------------------------------------------- */

const slugBySourceUrl = new Map();
for (const item of plan.items) {
  const slug = item.action === "IMPORT" ? item.slug : item.action === "MATCHED_EXISTING" ? item.localSlug : null;
  if (slug) slugBySourceUrl.set(item.sourceUrl, slug);
}

/*
 * Identitet PROIZVOĐAČA za proizvode koje Carsystem samo vodi u svom katalogu (RUPES).
 *
 * Zapis ostaje Carsystem-ov (izvor, šifra artikla, opis, slika); ovde dobija brend za kupca, modelsku
 * šifru i nivo dokaza iz `third-party-manufacturers.json`. Dve provere obaraju sync:
 *   - skup proizvoda čiji zvanični naziv počinje imenom proizvođača mora biti JEDNAK spisku u fajlu;
 *   - svaka modelska šifra mora doslovno stajati u zvaničnom Carsystem nazivu ili specifikaciji artikla.
 */
const thirdParty = readJson(PATHS.thirdParty, { manufacturers: {} });
const codeKey = (text) => String(text ?? "").toUpperCase().replace(/\s+/g, "");
const thirdPartyErrors = [];
function manufacturerOf(item, product) {
  for (const maker of Object.values(thirdParty.manufacturers)) {
    const detected = new RegExp(`^${maker.detect.officialNamePrefix}\\b`, "i").test(product.officialName);
    const entry = maker.products[item.slug];
    if (detected !== Boolean(entry)) thirdPartyErrors.push({ slug: item.slug, problem: detected ? "PROIZVOD_PROIZVOĐAČA_BEZ_UNOSA" : "UNOS_ZA_PROIZVOD_KOJI_NIJE_OD_PROIZVOĐAČA" });
    if (!detected || !entry) continue;
    const articleNumbers = new Set(product.articles.map((article) => article.articleNumber));
    for (const [articleNumber, model] of Object.entries(entry.articles)) {
      const article = product.articles.find((candidate) => candidate.articleNumber === articleNumber);
      if (!articleNumbers.has(articleNumber)) { thirdPartyErrors.push({ slug: item.slug, articleNumber, problem: "ŠIFRA_ARTIKLA_NIJE_U_IZVORU" }); continue; }
      const stated = codeKey(`${product.officialName} ${article.specification ?? ""}`);
      if (!stated.includes(codeKey(model.modelCode))) thirdPartyErrors.push({ slug: item.slug, articleNumber, modelCode: model.modelCode, problem: "MODELSKA_ŠIFRA_NIJE_U_CARSYSTEM_IZVORU" });
      if (!maker.evidenceLevels[model.evidence]) thirdPartyErrors.push({ slug: item.slug, articleNumber, problem: "NEPOZNAT_NIVO_DOKAZA" });
    }
    const cardModel = entry.cardModelCode ? Object.values(entry.articles).find((model) => model.modelCode === entry.cardModelCode) : null;
    if (entry.cardModelCode && cardModel?.evidence !== "OFFICIAL_CONFIRMED") thirdPartyErrors.push({ slug: item.slug, problem: "ŠIFRA_KARTICE_BEZ_ZVANIČNE_POTVRDE" });
    return {
      brandSlug: maker.brandSlug,
      name: maker.name,
      scope: maker.scope,
      coverageGroup: maker.coverageGroup,
      classification: entry.classification,
      manufacturerStatus: entry.manufacturerStatus,
      officialName: entry.officialName,
      officialUrls: entry.officialUrls,
      modelCode: entry.cardModelCode,
      articleModelCodes: Object.fromEntries(Object.entries(entry.articles).sort(([a], [b]) => a.localeCompare(b)).map(([articleNumber, model]) => [articleNumber, { modelCode: model.modelCode, evidence: model.evidence, aliases: model.aliases ?? [] }])),
      searchTerms: entry.searchTerms,
      imageRights: maker.images.flag,
      note: entry.note ?? null,
    };
  }
  return null;
}

const products = imports.map((item) => {
  const product = bySourceKey.get(item.sourceKey);
  const sr = localization[item.sourceKey];
  const images = imagePlan.get(item.slug) ?? [];
  const [primary, ...gallery] = images;
  const meta = primary ? nextPublished[primary.src] : null;
  const taxonomy = {
    category: item.taxonomy.category,
    programSlug: item.taxonomy.programSlug,
    phaseSlug: item.taxonomy.phaseSlug,
    visualType: item.taxonomy.visualType,
  };

  return {
    slug: item.slug,
    name: item.name,
    sourceKey: item.sourceKey,
    sourceUrl: item.sourceUrl,
    officialName: product.officialName,
    officialSubtitle: product.subtitle,
    officialCategory: product.officialCategory,
    taxonomy,
    isNew: product.isNew,
    inCatalogue: product.catalogue.inCatalogue,
    cataloguePages: product.catalogue.printedPages,
    leadArticleNumber: product.articles[0].articleNumber,
    // Šifra pod kojom isti proizvod stoji u štampanom katalogu, kada je sajt prenumerisao artikal.
    legacyArticleNumbers: product.legacyArticleNumbers ?? [],
    relatedLegacySlug: item.relatedLegacySlug ?? null,
    variantColumn: variantColumn(product.articles),
    variants: buildVariants(product, sr),
    image: primary ? { src: primary.src, width: meta?.width ?? null, height: meta?.height ?? null, hasAlpha: primary.hasAlpha } : null,
    missingOfficialAsset: !primary,
    gallery: gallery.map((image) => ({ src: image.src })),
    tds: tdsOf(item.sourceKey),
    content: {
      productType: sr.productType,
      subtype: sr.subtype,
      shortDescription: sr.shortDescription,
      longDescription: sr.longDescription,
      purpose: sr.purpose,
      facts: sr.facts,
      applications: sr.applications,
      benefits: sr.benefits,
      advice: sr.advice ?? null,
    },
    shade: decideShade(item, product, primary),
    recommendedSlugs: [...new Set(product.recommendedProductUrls.map((url) => slugBySourceUrl.get(url)).filter(Boolean))],
    // Samo za proizvode drugih proizvođača; Carsystem-ovi sopstveni zapisi nemaju ovo polje.
    ...(manufacturerOf(item, product) ? { manufacturer: manufacturerOf(item, product) } : {}),
  };
});
for (const maker of Object.values(thirdParty.manufacturers)) {
  for (const slug of Object.keys(maker.products)) if (!imports.some((item) => item.slug === slug)) thirdPartyErrors.push({ slug, problem: "UNOS_ZA_NEPOSTOJEĆI_PROIZVOD" });
}
if (thirdPartyErrors.length) {
  // Isti proizvod se proverava dvaput (polje + vrednost), pa se poruke svode na jedinstvene.
  const unique = [...new Map(thirdPartyErrors.map((error) => [JSON.stringify(error), error])).values()];
  console.error(JSON.stringify({ thirdPartyErrors: unique }, null, 2));
  process.exit(1);
}

/* -- 5. Dopune postojećih ručnih zapisa ------------------------------------ */

const ENRICHMENT_LABEL_TERMS = [
  [/^P\s(\d+)$/, "P$1"],
  [/\btin incl\. hardener\b/i, "limenka sa učvršćivačem"],
  [/\bcartridge incl\. hardener\b/i, "kartuša sa učvršćivačem"],
];
const localizeEnrichmentLabel = (label) => ENRICHMENT_LABEL_TERMS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), label);

const enrichments = {};
for (const match of plan.localMatches) {
  if (!match.autoApply || !match.enrichment) continue;
  const product = bySourceKey.get(match.enrichment.sourceKey);
  enrichments[match.localSlug] = {
    sourceKey: product.sourceKey,
    sourceUrl: product.sourceUrl,
    officialName: product.officialName,
    classification: match.classification,
    inCatalogue: product.catalogue.inCatalogue,
    variantColumn: variantColumn(product.articles),
    // Ručni zapis nema SR lokalizaciju (opis je ručno pisan), pa se oznaka varijante
    // prevodi samo zatvorenim rečnikom iz LOCALIZATION_GUIDE.md; ostalo ostaje zvanično.
    variants: buildVariants(product, null).map((variant) => ({ ...variant, label: localizeEnrichmentLabel(variant.label) })),
    legacyPackages: match.enrichment.legacyPackages ?? [],
    image: enrichmentImages.has(match.localSlug)
      ? {
          ...enrichmentImages.get(match.localSlug),
          width: nextPublished[enrichmentImages.get(match.localSlug).src]?.width ?? null,
          height: nextPublished[enrichmentImages.get(match.localSlug).src]?.height ?? null,
          replaces: match.enrichment.currentImageSrc ?? null,
        }
      : null,
    tds: tdsOf(product.sourceKey),
    recommendedSlugs: [...new Set(product.recommendedProductUrls.map((url) => slugBySourceUrl.get(url)).filter(Boolean))],
  };
}

const dataset = {
  meta: {
    generator: "scripts/carsystem-sync/apply.mjs",
    catalogue: CATALOGUE.title,
    catalogueUrl: CATALOGUE.pdfUrl,
    catalogueSha256: source.summary.catalogue.sha256,
    website: "https://www.carsystem.org/en/products",
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    enrichedExisting: Object.keys(enrichments).length,
    withShade: products.filter((product) => product.shade).length,
    /*
     * Pokrivenost se od 2026-09-21 vodi u dve grupe: Carsystem-ovi SOPSTVENI proizvodi i proizvodi drugih
     * proizvođača koje Carsystem samo vodi u katalogu. Druga grupa se ne predstavlja kao Carsystem proizvod.
     */
    coverageGroups: {
      CARSYSTEM_MANUFACTURER_PRODUCTS: { products: products.filter((product) => !product.manufacturer).length, variants: products.filter((product) => !product.manufacturer).reduce((sum, product) => sum + product.variants.length, 0) },
      THIRD_PARTY_PRODUCTS_LISTED_IN_CARSYSTEM_CATALOGUE: Object.fromEntries(Object.values(thirdParty.manufacturers).map((maker) => {
        const own = products.filter((product) => product.manufacturer?.brandSlug === maker.brandSlug);
        return [maker.brandSlug, { scope: maker.scope, products: own.length, inCatalogue: own.filter((product) => product.inCatalogue).length, websiteOnly: own.filter((product) => !product.inCatalogue).length, variants: own.reduce((sum, product) => sum + product.variants.length, 0), imageRights: maker.images.flag }];
      })),
    },
  },
  products,
  enrichments,
};

/* -- 6. Registar identiteta ------------------------------------------------- */

const nextRegistry = { _comment: registry._comment ?? "Šifra artikla → naš slug. Sync ovaj fajl samo dopunjuje; red se nikad ne briše, jer je slug javni URL.", products: { ...registry.products } };
for (const item of imports) {
  const previous = registry.products[item.slug];
  nextRegistry.products[item.slug] = {
    sourceKey: item.sourceKey,
    articleNumbers: [...new Set([...(previous?.articleNumbers ?? []), ...item.articleNumbers])].sort(),
    firstSeenEdition: previous?.firstSeenEdition ?? CATALOGUE.edition,
    lastSeenEdition: CATALOGUE.edition,
  };
}
nextRegistry.products = Object.fromEntries(Object.entries(nextRegistry.products).sort(([a], [b]) => a.localeCompare(b)));

/* -- 7. Upis ---------------------------------------------------------------- */

const outputs = [
  [PATHS.siteDataset, dataset],
  [PATHS.identityRegistry, nextRegistry],
  [PUBLISHED_IMAGES_PATH, { images: Object.fromEntries(Object.entries(nextPublished).sort(([a], [b]) => a.localeCompare(b))) }],
];

const changed = [];
for (const [file, value] of outputs) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current === next) continue;
  changed.push(path.relative(REPO_ROOT, file));
  if (!checkOnly) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, next);
  }
}

const previousSlugs = new Set(Object.keys(registry.products));
const result = {
  mode: checkOnly ? "check" : "apply",
  products: products.length,
  variants: dataset.meta.variants,
  newProducts: imports.filter((item) => !previousSlugs.has(item.slug)).length,
  productsWithNewVariants: imports.filter((item) => item.change === "VARIANTS_ADDED").length,
  enrichedExisting: Object.keys(enrichments).length,
  imagesConverted: jobs.length,
  imagesPublished: Object.keys(nextPublished).length,
  withShade: dataset.meta.withShade,
  noLongerInSource: [...previousSlugs].filter((slug) => !imports.some((item) => item.slug === slug)),
  filesChanged: changed,
};
console.log(JSON.stringify(result, null, 2));
if (checkOnly && (changed.length || jobs.length)) process.exitCode = 1;
