#!/usr/bin/env node
/**
 * Phase 5 — Cosmos Lac acquisition (DISCOVER → ACQUIRE → PARSE).
 *
 * Cosmos publishes a WordPress site whose product post type (`pran_products`)
 * is absent from the REST API but fully listed in the Yoast sitemaps. The
 * sitemap is therefore the discovery source: it is the manufacturer's own
 * index, not a guess at URL shapes.
 *
 * URL structure carries the family relationship we need:
 *   /products/{category}/{family}/{product}/
 * which maps onto the existing 41 ProductGroups without inventing a hierarchy.
 *
 * What this collects per product: official name, code, family, category,
 * official description, primary packshot (full size, resize variants
 * discarded), and manufacturer-declared related products.
 *
 * What it deliberately does not collect: technical data sheets. Cosmos product
 * pages carry none — see the report rather than substituting a reseller's copy.
 *
 * Output: data/knowledge/cosmos-catalog.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SITEMAP_INDEX = "https://cosmoslac.com/sitemap_index.xml";
const OUT = "data/knowledge/cosmos-catalog.generated.json";
const CACHE_DIR =
  "/private/tmp/claude-501/-Users-miledulic-Desktop-Projects-carsystem/c98f9ba4-a1be-4643-8c30-b265835d9d44/scratchpad/cosmos/pages";
const accessedAt = new Date().toISOString();
const CONCURRENCY = 8;

mkdirSync(CACHE_DIR, { recursive: true });

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** Fetch with an on-disk cache so re-runs do not re-hit the manufacturer. */
async function fetchPage(url) {
  const key = url.replace(/https:\/\/cosmoslac\.com\/products\//, "").replace(/\//g, "__");
  const file = path.join(CACHE_DIR, `${key}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const html = await fetchText(url);
  writeFileSync(file, html);
  return html;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          results[index] = { error: String(error.message ?? error) };
        }
      }
    }),
  );
  return results;
}

/* -- 1. DISCOVER ------------------------------------------------------------ */

const indexXml = await fetchText(SITEMAP_INDEX);
const productSitemaps = [...indexXml.matchAll(/<loc>([^<]+pran_products[^<]*)<\/loc>/g)].map(
  (match) => match[1],
);

const urls = new Set();
for (const sitemap of productSitemaps) {
  const xml = await fetchText(sitemap);
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(match[1]);
}

// Non-English locales are separate Polylang translations of the same products.
const LOCALE = /cosmoslac\.com\/(bg|da|de|el|fi|hu|sv|fr|it|es|pl|ro|cs|sk|hr|sr|tr|nl|no|lt|lv|et)\//;
const englishUrls = [...urls].filter((url) => !LOCALE.test(url)).sort();

console.log(
  `Sitemap: ${urls.size} URL-ova ukupno, ${englishUrls.length} engleskih.`,
);

/* -- 2. ACQUIRE + PARSE ----------------------------------------------------- */

/** Strip WordPress resize suffixes so variants collapse onto one original. */
function baseImage(url) {
  return url.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");
}

const CHROME_IMAGE =
  /favicon|logo|category|placeholder|sprite|icon|flag|banner|hero-|cropped-/i;

function parseProduct(url, html) {
  const pathMatch = /cosmoslac\.com\/products\/([^/]+)\/([^/]+)\/([^/]+)\/?$/.exec(url);
  if (!pathMatch) return undefined;
  const [, category, family, slug] = pathMatch;

  const rawTitle = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  const officialName = decode(rawTitle.split("|")[0]).trim();

  const description = decode(
    /<h2[^>]*>\s*DESCRIPTION\s*<\/h2>([\s\S]{0,2500}?)(?:<h2|<section)/i
      .exec(html)?.[1]
      ?.replace(/<[^>]+>/g, " ") ?? "",
  )
    .replace(/\s+/g, " ")
    .trim();

  // Product images live under /wp-content/uploads and repeat at several resize
  // widths; keep one entry per original and prefer the un-suffixed file.
  const imageUrls = [
    ...new Set(
      [...html.matchAll(/https:\/\/cosmoslac\.com\/wp-content\/uploads\/[^"' )]+\.(?:png|jpe?g|webp)/gi)].map(
        (match) => match[0],
      ),
    ),
  ].filter((image) => !CHROME_IMAGE.test(image));

  const byBase = new Map();
  for (const image of imageUrls) {
    const base = baseImage(image);
    const existing = byBase.get(base);
    // The un-suffixed URL is the original; prefer it over any resize.
    if (!existing || image === base) byBase.set(base, image === base ? image : existing ?? image);
  }

  // The product's own packshot is the upload whose file name matches its slug.
  const slugTokens = slug.replace(/-/g, "").toLowerCase();
  const scored = [...byBase.keys()].map((image) => {
    const name = decodeURIComponent(image.split("/").pop() ?? "")
      .replace(/\.[a-z]+$/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    let score = 0;
    if (slugTokens.includes(name) || name.includes(slugTokens)) score += 10;
    const shared = name.length && slugTokens.length
      ? [...new Set(name.match(/[a-z]+|\d+/g) ?? [])].filter((token) =>
          slugTokens.includes(token),
        ).length
      : 0;
    score += shared;
    return { image, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const primary = scored[0]?.score >= 3 ? scored[0].image : undefined;

  const related = [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/cosmoslac\.com\/products\/[^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ].filter((link) => link !== url && /\/products\/[^/]+\/[^/]+\/[^/]+\//.test(link));

  // Trailing numeric token in the slug is Cosmos's product code (e.g. "251").
  const code = /(?:^|-)(\d{2,4})(?:-|$)/.exec(slug)?.[1];

  return {
    sourceUrl: url,
    slug,
    officialName,
    productCode: code,
    category,
    family,
    officialDescription: description || undefined,
    primaryImageUrl: primary,
    imageUrls: [...byBase.values()],
    relatedProductUrls: related.slice(0, 12),
    accessedAt,
  };
}

console.log(`Preuzimanje ${englishUrls.length} stranica (paralelno ${CONCURRENCY})…`);

const parsed = await mapLimit(englishUrls, CONCURRENCY, async (url) => {
  const html = await fetchPage(url);
  return parseProduct(url, html) ?? { error: "ne odgovara obrascu putanje", sourceUrl: url };
});

const products = parsed.filter((entry) => entry && !entry.error);
const failures = parsed.filter((entry) => entry?.error);

/* -- 3. Families ------------------------------------------------------------ */

const families = new Map();
for (const product of products) {
  const key = `${product.category}/${product.family}`;
  const bucket = families.get(key) ?? {
    key,
    category: product.category,
    family: product.family,
    familyUrl: `https://cosmoslac.com/products/${product.category}/${product.family}/`,
    productSlugs: [],
  };
  bucket.productSlugs.push(product.slug);
  families.set(key, bucket);
}

const summary = {
  generatedAt: accessedAt,
  brand: "Cosmos Lac",
  manufacturer: "Cosmos Lac S.A.",
  sitemapIndex: SITEMAP_INDEX,
  productSitemaps: productSitemaps.length,
  urlsInSitemap: urls.size,
  englishProductUrls: englishUrls.length,
  productsParsed: products.length,
  parseFailures: failures.length,
  families: families.size,
  withOfficialDescription: products.filter((p) => p.officialDescription).length,
  withPrimaryImage: products.filter((p) => p.primaryImageUrl).length,
  totalDistinctImages: new Set(products.flatMap((p) => p.imageUrls)).size,
  productsWithPdf: 0,
  note:
    "Stranice proizvoda ne sadrže TDS/SDS dokumente. Nijedan tehnički dokument nije pronađen na zvaničnom izvoru.",
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ summary, families: [...families.values()], products, failures }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
