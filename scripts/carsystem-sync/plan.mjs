#!/usr/bin/env node
/**
 * Carsystem sync · korak 4 — PLAN (dry run). Ne menja katalog.
 *
 * Ulaz:  source dataset, manifest slika, naš runtime katalog, identity registar,
 *        ručne odluke, SR lokalizacija, taxonomy mapa.
 * Izlaz: reports/sync-plan.generated.json (+ .csv, SYNC_DRY_RUN.md,
 *        CARSYSTEM_<izdanje>_NEW_PRODUCTS.md, localization-worklist).
 *
 * Odluka po zvaničnom proizvodu (`action`):
 *
 * Autoritet za „da li je proizvod TRENUTNO aktivan” (od 2026-09-18):
 *   1. aktivna zvanična stranica proizvoda na carsystem.org
 *   2. Product Catalogue (PDF)
 *   3. naši lokalni podaci
 * Proizvod sa aktivnom stranicom i šifrom artikla ulazi u katalog i kada ga PDF
 * ne navodi, i kada je merchandising. PROBABLE/AMBIGUOUS ručni zapis više ne
 * zadržava svog kandidata: takav zapis nema nijednu zvaničnu šifru, pa duplikat
 * po šifri nije moguć, a aktivan proizvod ne sme da ostane nepredstavljen.
 *
 *   IMPORT                  ulazi u katalog (nov ili već uvezen — vidi `change`)
 *   MATCHED_EXISTING        već ga imamo kao ručni zapis → dopuna, ne duplikat
 *   HELD_PENDING_DECISION   isključeno ručnom odlukom ili sudar šifara u registru
 *   HELD_INACTIVE_PAGE      stranica je u sitemap-u, ali ne nosi naziv + šifru
 *   HELD_NO_PRODUCT_PAGE    samo u PDF-u: nema zvanične stranice, slike ni opisa
 *   HELD_MISSING_LOCALIZATION  nema (svežeg) SR sadržaja
 *   HELD_UNMAPPED_CATEGORY  zvanična kategorija nema mapping
 *   EXCLUDED                kategorija označena `excluded` u taxonomy mapi
 *
 * Idempotentnost: slug se NE izvodi svaki put iz naziva, nego se čita iz
 * registra po šifri artikla. Isti izvor → isti plan → bajt-identičan dataset.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CATALOGUE, PATHS, REPO_ROOT } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/http.mjs";
import { loadLocalCarsystemProducts } from "./lib/local-catalog.mjs";
import { matchLocalProduct } from "./lib/match.mjs";
import { nameKey } from "./lib/attributes.mjs";

const LOCALIZATION_DIR = path.join(path.dirname(PATHS.localization), "localization");
const WORKLIST_PATH = path.join(path.dirname(PATHS.plan), "localization-worklist.generated.json");

const source = readJson(PATHS.source);
const manifest = readJson(PATHS.imageManifest);
if (!source || !manifest) throw new Error("Nedostaje source dataset ili manifest slika — pokrenuti prethodne korake.");

const taxonomy = readJson(PATHS.taxonomyMap).categories;
const registry = readJson(PATHS.identityRegistry, { products: {} });
const decisions = readJson(PATHS.decisions, { local: {}, source: {} });
// Runtime vidi zapis POSLE dopune; izvorna putanja slike ručnog zapisa se zato
// čita iz prethodnog dataseta, inače drugi prolaz ne bi bio idempotentan.
const previousEnrichments = readJson(PATHS.siteDataset, { enrichments: {} }).enrichments ?? {};

/* -- Lokalizacija ----------------------------------------------------------- */

/** Hash zvaničnog EN sadržaja iz kog je SR tekst nastao: promena izvora → zastareo prevod. */
export function contentHash(product) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        product.officialName,
        product.subtitle,
        product.officialDescription,
        product.sections,
        product.articles.map((article) => [article.articleNumber, article.specification]),
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

const localization = {};
if (existsSync(LOCALIZATION_DIR)) {
  for (const file of readdirSync(LOCALIZATION_DIR).filter((name) => name.endsWith(".json")).sort()) {
    Object.assign(localization, readJson(path.join(LOCALIZATION_DIR, file), {}));
  }
}

/* -- Taksonomija ------------------------------------------------------------ */

function mapTaxonomy(product) {
  const category = taxonomy[product.categoryKey];
  if (!category) return { unmapped: true };
  if (category.excluded) return { excluded: true, reason: category.reason };
  const type = product.subtitle ?? "";
  const rule = category.rules.find((candidate) => new RegExp(candidate.productType, "i").test(type));
  const target = rule ?? category.default;
  return {
    category: target.category,
    programSlug: target.programSlug,
    phaseSlug: target.phaseSlug,
    visualType: target.visualType,
    packshotShade: Boolean(target.packshotShade),
    rule: rule ? rule.productType : "default",
    note: target.note ?? null,
  };
}

/* -- Naši postojeći zapisi -------------------------------------------------- */

const syncSlugs = new Set(Object.keys(registry.products));
const { local, allSlugs } = loadLocalCarsystemProducts(syncSlugs);

const primaryImageBySha = new Map();
for (const image of manifest.images) {
  if (image.role === "primary" && !primaryImageBySha.has(image.sha256)) primaryImageBySha.set(image.sha256, image.sourceKey);
}

// Nemački zvanični nazivi istog artikla (knowledge sloj) kao alias za poređenje naziva.
const aliases = new Map();
const german = readJson(path.join(REPO_ROOT, "data/knowledge/carsystem-catalog.generated.json"), { products: [] });
const sourceKeyByArticle = new Map();
for (const product of source.products) {
  for (const article of product.articles) sourceKeyByArticle.set(article.articleNumber, product.sourceKey);
}
for (const product of german.products) {
  const key = product.articleNumbers.map((article) => sourceKeyByArticle.get(article)).find(Boolean);
  if (key && product.officialName) aliases.set(key, [...(aliases.get(key) ?? []), product.officialName]);
}

const bySourceKey = new Map(source.products.map((product) => [product.sourceKey, product]));

// sha256 zvaničnog TDS-a → proizvod (dokaz identiteta za ručni zapis koji hostuje isti PDF).
const documentManifest = readJson(path.join(path.dirname(PATHS.imageManifest), "document-manifest.generated.json"), { documents: [] });
const tdsBySha = new Map(documentManifest.documents.map((doc) => [doc.sha256, doc.sourceKey]));

const localMatches = local.map((record) => {
  const decision = decisions.local?.[record.slug];
  let match = matchLocalProduct(record, source.products, primaryImageBySha, aliases, tdsBySha);

  if (decision?.decision === "match" && bySourceKey.has(decision.sourceKey)) {
    match = { ...match, classification: "HIGH_CONFIDENCE_MATCH", autoApply: true, sourceKeys: [decision.sourceKey], decidedBy: "manual-decisions.json", decisionNote: decision.note ?? null };
  } else if (decision?.decision === "keep-separate") {
    match = { ...match, classification: "LEGACY_NOT_IN_CATALOGUE", autoApply: false, sourceKeys: [], decidedBy: "manual-decisions.json", decisionNote: decision.note ?? null };
  }

  const flags = [match.classification];
  const matched = match.autoApply ? bySourceKey.get(match.sourceKeys[0]) : null;

  if (match.classification === "LEGACY_NOT_IN_CATALOGUE" || (matched && !matched.catalogue.inCatalogue)) {
    flags.push(`LEGACY_NOT_IN_${CATALOGUE.editionKey.replace("-", "_")}`);
  }

  let enrichment = null;
  if (matched) {
    const known = new Set([...record.ownArticleNumbers, ...record.variantRowIds]);
    const missingVariants = matched.articles.filter((article) => !known.has(article.articleNumber)).map((article) => article.articleNumber);
    const incomplete = [];
    if (!record.hasVariantTable) incomplete.push("nema tabelu varijanti sa šiframa artikala");
    if (record.hasPlaceholderSku) incomplete.push(`sku je interni placeholder (${record.sku})`);
    if (!record.manufacturerCode) incomplete.push("manufacturerCode nije upisan");
    if (record.hasPlaceholderImage) incomplete.push("slika je placeholder");
    if (!record.hasTds && matched.documents.some((doc) => doc.kind === "tds")) incomplete.push("nema TDS, a zvanični postoji");
    if (missingVariants.length) flags.push("VARIANT_MISSING");
    if (incomplete.length) flags.push("EXISTING_DATA_INCOMPLETE");
    // Ručno upisana pakovanja kojih nema ni u jednom zvaničnom izvoru ostaju u
    // zapisu, ali se na PDP-u jasno odvajaju od aktuelnih šifara proizvođača.
    // Poredi se BROJČANA vrednost mere („1 kg” ≡ „1.0 kg”), i to cela mera, a ne
    // podniz („2 kg” ne sme da se „nađe” unutar zvaničnog „2.52 kg”).
    const measures = (text) =>
      [...String(text ?? "").matchAll(/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l)\b/gi)].map(
        (found) => `${Number(found[1].replace(",", "."))}${found[2].toLowerCase()}`,
      );
    const officialMeasures = new Set(matched.articles.flatMap((article) => measures(article.specification)));
    const legacyPackages = record.packages.filter((label) => {
      const own = measures(label);
      return own.length > 0 && !own.some((measure) => officialMeasures.has(measure));
    });
    enrichment = {
      sourceKey: matched.sourceKey,
      missingVariants,
      incomplete,
      legacyPackages,
      // Dokumentovana odluka: slika ručnog zapisa prikazuje pogrešan proizvod.
      useOfficialImage: Boolean(decision?.useOfficialImage),
      currentImageSrc: previousEnrichments[record.slug]?.image?.replaces ?? record.imageSrc,
    };
  }

  return { ...match, flags, enrichment };
});

const claimedBy = new Map(); // sourceKey → localSlug (auto-primenjen match)
const relatedLegacy = new Map(); // sourceKey → localSlug (PROBABLE/AMBIGUOUS: uvozi se zasebno, veza se samo beleži)
for (const match of localMatches) {
  if (match.autoApply) claimedBy.set(match.sourceKeys[0], match.localSlug);
  else for (const key of match.sourceKeys) relatedLegacy.set(key, match.localSlug);
}

/* -- Nazivi i slugovi ------------------------------------------------------- */

const nameCounts = new Map();
for (const product of source.products) {
  const key = nameKey(product.officialName);
  nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
}

/**
 * Isti zvanični naziv na više stranica (F.19 150 mm / 77 mm): razlikuje ih
 * zvanični podnaslov. Uzima se samo deo podnaslova koji se zaista razlikuje —
 * zajednički tip proizvoda („Film abrasive”) i ponovljen naziv se izostavljaju.
 */
function distinguisher(product) {
  if ((nameCounts.get(nameKey(product.officialName)) ?? 0) < 2) return null;
  const siblings = source.products.filter((other) => nameKey(other.officialName) === nameKey(product.officialName));
  const parts = (value) => String(value ?? "").split(/\s[-–]\s/).map((part) => part.trim()).filter(Boolean);
  const own = parts(product.subtitle);
  const shared = own.filter((part) => siblings.every((other) => parts(other.subtitle).some((candidate) => nameKey(candidate) === nameKey(part))));
  const unique = own.filter((part) => !shared.includes(part) && nameKey(part) !== nameKey(product.officialName));
  return (unique.length ? unique : own).join(" - ") || null;
}

/** RUPES je zaseban brend u Carsystem katalogu; „Carsystem RUPES …” bi bio netačan naziv. */
function displayName(product) {
  // Bez prefiksa kada zvanični naziv već nosi brend („Carsystem Cap Black”).
  const base = /^(rupes|carsystem)\b/i.test(product.officialName) ? product.officialName : `Carsystem ${product.officialName}`;
  const suffix = distinguisher(product);
  return suffix ? `${base} – ${suffix}` : base;
}

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const registryByArticle = new Map();
for (const [slug, entry] of Object.entries(registry.products)) {
  for (const article of entry.articleNumbers) registryByArticle.set(article, slug);
}

const mintedSlugs = new Set();
function resolveSlug(product) {
  const known = [...new Set(product.articles.map((article) => registryByArticle.get(article.articleNumber)).filter(Boolean))];
  if (known.length === 1) return { slug: known[0], minted: false };
  if (known.length > 1) return { conflict: known };
  // Slug iz zvaničnog naziva (+ razlikovni deo podnaslova), ne iz URL-a proizvođača:
  // kraći je, a posle prvog upisa ionako važi samo ono što stoji u registru.
  let slug = `carsystem-${slugify([product.officialName.replace(/^carsystem\s+/i, ""), distinguisher(product)].filter(Boolean).join(" "))}`;
  // Sudar sa ručnim zapisom ili već dodeljenim slugom razrešava vodeća šifra artikla.
  if (allSlugs.has(slug) || mintedSlugs.has(slug)) slug = `${slug}-${product.articles[0].articleNumber.replace(".", "")}`;
  mintedSlugs.add(slug);
  return { slug, minted: true };
}

/* -- Odluka po zvaničnom proizvodu ----------------------------------------- */

const primaryImage = new Map();
for (const image of manifest.images) if (image.role === "primary") primaryImage.set(image.sourceKey, image);

const items = source.products.map((product) => {
  const base = {
    sourceKey: product.sourceKey,
    officialName: product.officialName,
    subtitle: product.subtitle,
    officialCategory: product.officialCategory,
    sourceUrl: product.sourceUrl,
    articleNumbers: product.articles.map((article) => article.articleNumber),
    variantCount: product.articles.length,
    inCatalogue: product.catalogue.inCatalogue,
    isNew: product.isNew,
    conflicts: product.conflicts,
  };
  const hold = (action, reason) => ({ ...base, action, reason });

  const mapped = product.categoryKey ? mapTaxonomy(product) : { unmapped: product.origin !== "catalogue-only" };
  if (mapped.excluded) return hold("EXCLUDED", mapped.reason);
  if (claimedBy.has(product.sourceKey)) {
    return { ...hold("MATCHED_EXISTING", `Već postoji kao ručni zapis „${claimedBy.get(product.sourceKey)}”.`), localSlug: claimedBy.get(product.sourceKey) };
  }
  if (product.origin === "catalogue-only") return hold("HELD_NO_PRODUCT_PAGE", "U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa).");
  if (product.active === false) return hold("HELD_INACTIVE_PAGE", "Stranica je u sitemap-u, ali ne nosi naziv i šifru artikla.");
  if (mapped.unmapped) return hold("HELD_UNMAPPED_CATEGORY", `Zvanična kategorija „${product.categoryKey}” nema mapping.`);

  const sourceDecision = decisions.source?.[product.sourceKey]?.decision;
  if (sourceDecision === "skip") return hold("HELD_PENDING_DECISION", "Isključeno ručnom odlukom.");

  // Aktivan proizvod bez zvanične slike i dalje ulazi u katalog (sa postojećim
  // placeholder-om sajta) i nosi oznaku — slika se NE uzima iz drugog izvora.
  const image = primaryImage.get(product.sourceKey);
  const missingOfficialAsset = !image || Boolean(image.error);

  const hash = contentHash(product);
  const sr = localization[product.sourceKey];
  if (!sr) return { ...hold("HELD_MISSING_LOCALIZATION", "Nema SR sadržaja."), contentHash: hash, taxonomy: mapped };
  if (sr.sourceHash !== hash) return { ...hold("HELD_MISSING_LOCALIZATION", "SR sadržaj je zastareo: zvanični tekst se promenio."), contentHash: hash, taxonomy: mapped };

  const resolved = resolveSlug(product);
  if (resolved.conflict) return hold("HELD_PENDING_DECISION", `Šifre artikala pripadaju više uvezenih proizvoda: ${resolved.conflict.join(", ")}.`);

  const previous = registry.products[resolved.slug];
  const knownArticles = new Set(previous?.articleNumbers ?? []);
  return {
    ...base,
    action: "IMPORT",
    missingOfficialAsset,
    relatedLegacySlug: relatedLegacy.get(product.sourceKey) ?? null,
    slug: resolved.slug,
    name: displayName(product),
    taxonomy: mapped,
    contentHash: hash,
    change: !previous ? "NEW" : base.articleNumbers.some((article) => !knownArticles.has(article)) ? "VARIANTS_ADDED" : "KNOWN",
    newArticleNumbers: previous ? base.articleNumbers.filter((article) => !knownArticles.has(article)) : base.articleNumbers,
  };
});

/* -- Provere plana ---------------------------------------------------------- */

const imports = items.filter((item) => item.action === "IMPORT");
const slugCounts = new Map();
for (const item of imports) slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
const duplicateSlugs = [...slugCounts].filter(([, count]) => count > 1).map(([slug]) => slug);
const nameCollisions = [...imports.reduce((map, item) => map.set(item.name, (map.get(item.name) ?? 0) + 1), new Map())]
  .filter(([, count]) => count > 1)
  .map(([name]) => name);

const currentDataset = readJson(PATHS.siteDataset, { enrichments: {} });
const alreadyEnriched = (localSlug, articleNumber) =>
  (currentDataset.enrichments?.[localSlug]?.variants ?? []).some((variant) => variant.articleNumber === articleNumber);

const count = (predicate) => items.filter(predicate).length;
const variantSum = (predicate) => items.filter(predicate).reduce((sum, item) => sum + item.variantCount, 0);
const classCount = (name) => localMatches.filter((match) => match.flags.includes(name)).length;
const legacyFlag = `LEGACY_NOT_IN_${CATALOGUE.editionKey.replace("-", "_")}`;
const reviewConflicts = source.products.flatMap((product) =>
  product.conflicts
    .filter((conflict) => ["SPECIFICATION_DIFFERS", "ARTICLE_NUMBER_DIFFERS", "SALES_PACK_DIFFERS", "NO_PRODUCT_PAGE"].includes(conflict.type))
    .map((conflict) => ({ sourceKey: product.sourceKey, officialName: product.officialName, ...conflict })),
);

const summary = {
  catalogue: CATALOGUE.title,
  catalogueSha256: source.summary.catalogue.sha256,
  "SOURCE PRODUCTS": source.summary.sourceProducts,
  "SOURCE VARIANTS": source.summary.sourceVariants,
  "EXISTING PRODUCTS": local.length,
  "EXISTING VARIANTS": local.reduce((sum, record) => sum + record.variantRowIds.length, 0),
  "EXACT MATCHES": classCount("EXACT_MATCH"),
  "HIGH CONFIDENCE MATCHES": classCount("HIGH_CONFIDENCE_MATCH"),
  "PROBABLE MATCHES": classCount("PROBABLE_MATCH"),
  "MISSING PRODUCTS": count((item) => item.action === "IMPORT" && item.change === "NEW"),
  "MISSING VARIANTS":
    variantSum((item) => item.action === "IMPORT" && item.change === "NEW") +
    items.filter((item) => item.change === "VARIANTS_ADDED").reduce((sum, item) => sum + item.newArticleNumbers.length, 0) +
    // Varijante ručnog zapisa koje dopuna već isporučuje nisu „nedostajuće”.
    localMatches.reduce(
      (sum, match) => sum + (match.enrichment?.missingVariants.filter((article) => !alreadyEnriched(match.localSlug, article)).length ?? 0),
      0,
    ),
  variantsSuppliedByEnrichment: localMatches.reduce((sum, match) => sum + (match.enrichment?.missingVariants.length ?? 0), 0),
  AMBIGUOUS: classCount("AMBIGUOUS"),
  "LEGACY PRODUCTS": classCount(legacyFlag),
  "SOURCE CONFLICTS": reviewConflicts.length + classCount("SOURCE_CONFLICT"),
  "MISSING IMAGES": count((item) => item.action === "IMPORT" && item.missingOfficialAsset) + count((item) => item.action === "HELD_NO_PRODUCT_PAGE"),
  "MISSING IMPORTANT DATA": count((item) => item.action === "HELD_MISSING_LOCALIZATION" || item.action === "HELD_UNMAPPED_CATEGORY"),
  alreadyImported: count((item) => item.action === "IMPORT" && item.change === "KNOWN"),
  existingToEnrich: localMatches.filter((match) => match.enrichment && (match.enrichment.missingVariants.length || match.enrichment.incomplete.length)).length,
  heldPendingDecision: count((item) => item.action === "HELD_PENDING_DECISION"),
  importedWebsiteOnly: count((item) => item.action === "IMPORT" && !item.inCatalogue),
  heldInactivePage: count((item) => item.action === "HELD_INACTIVE_PAGE"),
  heldNoProductPage: count((item) => item.action === "HELD_NO_PRODUCT_PAGE"),
  excludedMerchandising: count((item) => item.action === "EXCLUDED"),
  markedNewBySource: count((item) => item.isNew),
  planErrors: { duplicateSlugs, nameCollisions },
};

writeJson(PATHS.plan, { summary, localMatches, items, reviewConflicts });

/* -- CSV -------------------------------------------------------------------- */

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
writeFileSync(
  PATHS.planCsv,
  [
    ["action", "change", "slug", "officialName", "subtitle", "officialCategory", "ourCategory", "variants", "inCatalogue", "isNew", "articleNumbers", "reason", "sourceUrl"].join(","),
    ...items.map((item) =>
      [item.action, item.change, item.slug, item.officialName, item.subtitle, item.officialCategory, item.taxonomy?.category, item.variantCount, item.inCatalogue, item.isNew, item.articleNumbers.join(" "), item.reason, item.sourceUrl]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n") + "\n",
);

/* -- Worklist za lokalizaciju ---------------------------------------------- */

const worklist = items
  .filter((item) => item.action === "HELD_MISSING_LOCALIZATION")
  .map((item) => {
    const product = bySourceKey.get(item.sourceKey);
    return {
      sourceKey: product.sourceKey,
      sourceHash: item.contentHash,
      officialCategory: product.officialCategory,
      ourCategory: item.taxonomy.category,
      officialName: product.officialName,
      subtitle: product.subtitle,
      officialDescription: product.officialDescription,
      sections: product.sections,
      variants: product.articles.map((article) => ({ articleNumber: article.articleNumber, specification: article.specification })),
    };
  });
writeJson(WORKLIST_PATH, { count: worklist.length, products: worklist });

/* -- Markdown --------------------------------------------------------------- */

const table = (rows) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
const md = [];
md.push(`# Carsystem catalog sync — DRY RUN`, "");
md.push(`Referentni izvor: **${CATALOGUE.title}** — ${CATALOGUE.pdfUrl}`, "");
md.push(`sha256 \`${source.summary.catalogue.sha256}\` · sekundarni izvor: carsystem.org (EN), ${source.summary.website.productPages} stranica proizvoda.`, "");
md.push("Generisano komandom `npm run carsystem:sync:plan`. Ovaj korak ne menja katalog.", "");
md.push("## Zbir", "", table([["Metrika", "Vrednost"], ["---", "---:"], ...Object.entries(summary).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, String(value)])]), "");
md.push("## Naši postojeći Carsystem zapisi", "");
md.push(
  table([
    ["Naš slug", "Klasifikacija", "Zvanični proizvod", "Dokaz", "Dopuna"],
    ["---", "---", "---", "---", "---"],
    ...localMatches.map((match) => [
      `\`${match.localSlug}\``,
      match.flags.join("<br>"),
      match.candidates.map((candidate) => `${candidate.officialName} — ${candidate.subtitle}`).join("<br>") || "—",
      match.evidence.map((entry) => entry.level).join(", "),
      match.enrichment ? [`+${match.enrichment.missingVariants.length} varijanti`, ...match.enrichment.incomplete].join("; ") : match.note ?? "—",
    ]),
  ]),
  "",
);
const section = (title, action, extra = (item) => item.reason ?? "") => {
  const rows = items.filter((item) => item.action === action);
  md.push(`## ${title} (${rows.length})`, "");
  if (!rows.length) return md.push("Nema.", "");
  md.push(table([["Zvanični proizvod", "Kategorija", "Varijante", "Šifre", "Napomena"], ["---", "---", "---:", "---", "---"], ...rows.map((item) => [`[${item.officialName}](${item.sourceUrl})${item.subtitle ? ` — ${item.subtitle}` : ""}`, item.officialCategory ?? "—", String(item.variantCount), item.articleNumbers.slice(0, 4).join(", ") + (item.articleNumbers.length > 4 ? " …" : ""), extra(item)])]), "");
};
section("Zadržano ručnom odlukom ili sudarom šifara", "HELD_PENDING_DECISION");
{
  const rows = items.filter((item) => item.action === "IMPORT" && !item.inCatalogue);
  md.push(`## Uvezeno sa aktivne stranice carsystem.org iako nije u katalogu ${CATALOGUE.edition} (${rows.length})`, "");
  md.push(rows.length ? table([["Zvanični proizvod", "Kategorija", "Varijante", "Naš slug"], ["---", "---", "---:", "---"], ...rows.map((item) => [`[${item.officialName}](${item.sourceUrl})${item.subtitle ? ` — ${item.subtitle}` : ""}`, item.officialCategory ?? "—", String(item.variantCount), `\`${item.slug}\``])]) : "Nema.", "");
}
section("Stranica u sitemap-u bez naziva ili šifre (neaktivna)", "HELD_INACTIVE_PAGE");
section("Samo u katalogu — nema zvaničnu stranicu ni sliku", "HELD_NO_PRODUCT_PAGE");
section("Bez SR sadržaja", "HELD_MISSING_LOCALIZATION");
section("Isključeno taxonomy mapom", "EXCLUDED");

md.push(`## Sukobi izvora za pregled (${reviewConflicts.length})`, "");
md.push(reviewConflicts.length ? table([["Proizvod", "Tip", "Sajt", "Katalog"], ["---", "---", "---", "---"], ...reviewConflicts.map((conflict) => [conflict.officialName ?? "—", conflict.type, JSON.stringify(conflict.website ?? "—"), JSON.stringify(conflict.catalogue ?? conflict.note ?? "—")])]) : "Nema.", "");

const byCategory = new Map();
for (const item of imports) byCategory.set(item.taxonomy.category, (byCategory.get(item.taxonomy.category) ?? 0) + 1);
md.push(`## Uvoz po našoj kategoriji (${imports.length})`, "", table([["Kategorija", "Proizvoda"], ["---", "---:"], ...[...byCategory].sort((a, b) => b[1] - a[1]).map(([category, total]) => [category, String(total)])]), "");
writeFileSync(PATHS.planMarkdown, md.join("\n"));

/* -- Izveštaj o novitetima -------------------------------------------------- */

const status = (item) =>
  ({
    IMPORT: item.change === "KNOWN" ? "već uvezeno" : "NEMAMO → uvozi se",
    MATCHED_EXISTING: "VEĆ IMAMO (ručni zapis)",
    HELD_PENDING_DECISION: "čeka odluku (mogući duplikat)",
    HELD_INACTIVE_PAGE: "stranica nije aktivna",
    HELD_NO_PRODUCT_PAGE: "NEMAMO — samo u katalogu, bez stranice/slike",
    HELD_MISSING_LOCALIZATION: "NEMAMO — čeka SR sadržaj",
    EXCLUDED: "merchandising — ne prodajemo",
  })[item.action] ?? item.action;

const fresh = items.filter((item) => item.isNew);
const newVariantsOfExisting = localMatches.filter((match) => match.enrichment?.missingVariants.length);
const news = [`# CARSYSTEM ${CATALOGUE.edition} — NEW PRODUCTS`, ""];
news.push(`Izvor oznake „NEW”: bedž u katalogu ${CATALOGUE.edition} (pozicijski uz tabelu artikala) i oznaka „New” na listinzima carsystem.org.`, "");
news.push(`## Proizvodi koje proizvođač označava kao nove (${fresh.length})`, "");
news.push(table([["Proizvod", "Kategorija", "Varijante", "Oznaka", "Status kod nas"], ["---", "---", "---:", "---", "---"], ...fresh.map((item) => { const product = bySourceKey.get(item.sourceKey); return [`[${item.officialName}](${item.sourceUrl})${item.subtitle ? ` — ${item.subtitle}` : ""}`, item.officialCategory ?? "—", String(item.variantCount), [product.catalogue.markedNew ? "katalog" : null, product.markedNewOnWebsite ? "sajt" : null].filter(Boolean).join(" + "), status(item)]; })]), "");
news.push(`## Nove varijante proizvoda koje već imamo (${newVariantsOfExisting.length})`, "");
news.push(newVariantsOfExisting.length ? table([["Naš zapis", "Zvanični proizvod", "Varijante koje nam nedostaju"], ["---", "---", "---"], ...newVariantsOfExisting.map((match) => [`\`${match.localSlug}\``, match.candidates[0].officialName, match.enrichment.missingVariants.join(", ")])]) : "Nema.", "");
news.push(`## Prvi put u našem katalogu`, "", `Od ${source.summary.sourceProducts} zvaničnih proizvoda, pre synca smo imali ${local.length} ručnih zapisa. Svi proizvodi sa statusom „uvozi se” u \`SYNC_DRY_RUN.md\` su novi za naš sajt, bez obzira na oznaku proizvođača.`, "");
writeFileSync(PATHS.newProductsReport, news.join("\n"));

console.log(JSON.stringify(summary, null, 2));
for (const match of localMatches) console.log(`  ${match.flags.join("+").padEnd(52)} ${match.localSlug} → ${match.candidates.map((c) => c.officialName).join(" | ") || "—"}`);
if (duplicateSlugs.length || nameCollisions.length) process.exitCode = 1;
