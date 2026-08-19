#!/usr/bin/env node
/**
 * Phase 5 — Carsystem manufacturer catalogue acquisition.
 *
 * Carsystem is a Vosschemie brand (info@vosschemie.de), published on a TYPO3
 * site whose official sitemap enumerates every product page. The sitemap is the
 * discovery source — not guessed URLs, and not the distributor catalogues that
 * also carry these products.
 *
 * Page grammar, surveyed across all ten categories before writing this parser
 * rather than assumed from R-M/baslac:
 *
 *   h1[itemprop=name]                     official product name
 *   p.productdetail-infos__subheader      subtitle / product type
 *   p[itemprop=description]               official description
 *   a[title="Technisches Merkblatt"]      TDS PDF
 *   table rows (Art.-Nr./Spezifikation/KP/VE)   article numbers = variants
 *   data-url .../safetydatasheets/{art}/{LANG}  per-article SDS endpoint
 *   h2.image-teaser__headline + ul        BESCHREIBUNG / EINSATZGEBIET /
 *                                         VORTEILE / ANWENDUNGSHINWEIS
 *
 * TDS and SDS exist only for chemical categories; abrasives, masking and PPE
 * legitimately have none. That is recorded, not treated as a failure.
 *
 * Output: data/knowledge/carsystem-catalog.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const SITEMAP = "https://www.carsystem.org/sitemap.xml";
const ORIGIN = "https://www.carsystem.org";
const OUT = "data/knowledge/carsystem-catalog.generated.json";
const CACHE_DIR =
  "/private/tmp/claude-501/-Users-miledulic-Desktop-Projects-carsystem/c98f9ba4-a1be-4643-8c30-b265835d9d44/scratchpad/cs/pages";
const accessedAt = new Date().toISOString();
const CONCURRENCY = 6;

mkdirSync(CACHE_DIR, { recursive: true });

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&szlig;/g, "ß")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&#\d+;/g, "");

const stripTags = (value) => decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchPage(url) {
  const key = url.replace(`${ORIGIN}/produkte/detail/`, "").replace(/[/?=&]/g, "__");
  const file = path.join(CACHE_DIR, `${key}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const html = await fetchText(url);
  writeFileSync(file, html);
  return html;
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          out[index] = await worker(items[index]);
        } catch (error) {
          out[index] = { sourceUrl: items[index], error: String(error.message ?? error) };
        }
      }
    }),
  );
  return out;
}

/* -- 1. DISCOVER ------------------------------------------------------------ */

const indexXml = await fetchText(SITEMAP);
const subSitemaps = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));

const productUrls = new Set();
const sourceInventory = [];
for (const sitemap of subSitemaps) {
  const xml = await fetchText(sitemap);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  const kind = /sitemap=([a-z]+)/.exec(sitemap)?.[1] ?? "unknown";
  sourceInventory.push({ sitemap, kind, urls: locs.length });
  if (kind !== "products") continue;
  for (const loc of locs) {
    // One sitemap entry is a query-string fallback with no slug; it is not a
    // product page and would 404 as a detail route.
    if (loc.includes("?category=")) continue;
    productUrls.add(loc);
  }
}

const urls = [...productUrls].sort();
console.log(`Sitemap: ${subSitemaps.length} pod-sitemapa, ${urls.length} stranica proizvoda.`);

/* -- 2. PARSE --------------------------------------------------------------- */

/**
 * Section bodies are not uniform: BESCHREIBUNG/EINSATZGEBIET/VORTEILE use a
 * bullet list, while ANWENDUNGSHINWEIS uses a paragraph. Matching only <ul>
 * silently dropped the application notes on 140 pages — which is where the
 * category-specific data lives (max RPM for abrasives, accessory references).
 */
const SECTION_RE =
  /<h2[^>]*image-teaser__headline[^>]*>\s*([A-ZÄÖÜß ]{3,40}?)\s*<\/h2>\s*((?:<ul>[\s\S]*?<\/ul>|<p>[\s\S]*?<\/p>))?/g;

function parseProduct(url, html) {
  const pathMatch = /\/produkte\/detail\/([^/]+)\/([^/?]+)/.exec(url);
  if (!pathMatch) return { sourceUrl: url, error: "URL ne odgovara obrascu" };
  const [, category, slug] = pathMatch;

  const name = stripTags(/<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  const subtitle = stripTags(
    /<p[^>]*productdetail-infos__subheader[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "",
  );
  const description = stripTags(
    /<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "",
  );

  // Bullet sections. Kept per-heading so BESCHREIBUNG (what it is) is never
  // merged with EINSATZGEBIET (where it is used).
  const sections = {};
  let sectionMatch;
  SECTION_RE.lastIndex = 0;
  while ((sectionMatch = SECTION_RE.exec(html)) !== null) {
    const heading = sectionMatch[1].trim();
    const body = sectionMatch[2] ?? "";
    const items = body.includes("<li>")
      ? [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1]))
      : [stripTags(body)].filter(Boolean);
    if (items.length) sections[heading] = items;
  }

  // Article table — each row is a purchasable variant of this product.
  const variants = [];
  for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const cell = (label) =>
      stripTags(
        new RegExp(`data-label="${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>([\\s\\S]*?)</td>`).exec(
          row,
        )?.[1] ?? "",
      );
    const articleNumber = cell("Art.-Nr.");
    if (!articleNumber) continue;
    const sdsUrl = /data-url="([^"]*safetydatasheets[^"]*)"/.exec(row)?.[1];
    variants.push({
      articleNumber,
      specification: cell("Spezifikation") || undefined,
      packUnit: cell("KP") || undefined,
      packagingUnit: cell("VE") || undefined,
      sdsEndpoint: sdsUrl ? `${ORIGIN}${decode(sdsUrl)}` : undefined,
    });
  }

  const tds = /<a[^>]+href="([^"]*\/datasheets\/[^"]*\.pdf)"/i.exec(html)?.[1];

  // Product images live under /fileadmin/_processed_ and are named after the
  // article number; site chrome (flags, icons, logos) is excluded.
  const images = [
    ...new Set(
      [...html.matchAll(/(?:src|data-src)="(\/fileadmin\/[^"]+\.(?:png|jpe?g|webp))"/gi)].map(
        (m) => m[1],
      ),
    ),
  ].filter((image) => !/flags|icon|logo|sprite|placeholder/i.test(image));

  const related = [
    ...new Set(
      [...html.matchAll(/href="(\/produkte\/detail\/[^"?]+)"/g)].map((m) => m[1]),
    ),
  ].filter((link) => !link.endsWith(`/${slug}`));

  return {
    sourceUrl: url,
    slug,
    category,
    officialName: name || undefined,
    subtitle: subtitle || undefined,
    officialDescription: description || undefined,
    sections,
    variants,
    articleNumbers: variants.map((variant) => variant.articleNumber),
    tdsUrl: tds ? `${ORIGIN}${tds}` : undefined,
    imageUrls: images.map((image) => `${ORIGIN}${image}`),
    relatedProductUrls: related.map((link) => `${ORIGIN}${link}`),
    accessedAt,
  };
}

console.log(`Preuzimanje ${urls.length} stranica (paralelno ${CONCURRENCY})…`);

const parsed = await mapLimit(urls, CONCURRENCY, async (url) => {
  const html = await fetchPage(url);
  return parseProduct(url, html);
});

const products = parsed.filter((entry) => entry && !entry.error);
const failures = parsed.filter((entry) => entry?.error);

/* -- 3. Categories ---------------------------------------------------------- */

const categories = new Map();
for (const product of products) {
  const bucket = categories.get(product.category) ?? {
    key: product.category,
    url: `${ORIGIN}/produkte/kategorie/${product.category}`,
    productSlugs: [],
    articleCount: 0,
  };
  bucket.productSlugs.push(product.slug);
  bucket.articleCount += product.variants.length;
  categories.set(product.category, bucket);
}

const summary = {
  generatedAt: accessedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  officialWebsite: ORIGIN,
  discoveryMethod: "zvanični TYPO3 sitemap (sitemap=products)",
  sitemaps: sourceInventory,
  productPagesInSitemap: urls.length,
  productsParsed: products.length,
  parseFailures: failures.length,
  categories: categories.size,
  totalArticleNumbers: products.reduce((sum, p) => sum + p.variants.length, 0),
  withOfficialDescription: products.filter((p) => p.officialDescription).length,
  withSections: products.filter((p) => Object.keys(p.sections).length).length,
  withTds: products.filter((p) => p.tdsUrl).length,
  withSdsEndpoint: products.filter((p) => p.variants.some((v) => v.sdsEndpoint)).length,
  sdsEndpoints: products.reduce(
    (sum, p) => sum + p.variants.filter((v) => v.sdsEndpoint).length,
    0,
  ),
  withImages: products.filter((p) => p.imageUrls.length).length,
  distinctImages: new Set(products.flatMap((p) => p.imageUrls)).size,
  sectionHeadings: [...new Set(products.flatMap((p) => Object.keys(p.sections)))],
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    { summary, categories: [...categories.values()], products, failures },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(summary, null, 2));
