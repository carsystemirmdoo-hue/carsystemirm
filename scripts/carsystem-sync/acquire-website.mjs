#!/usr/bin/env node
/**
 * Carsystem sync · korak 1a — RAW dataset sa zvaničnog EN sajta.
 *
 * Isti TYPO3 sajt i ista gramatika stranice koju je `acquire-carsystem-catalog`
 * (DE, knowledge sloj) već ispitao; ovde se čita EN izdanje jer je referentni
 * katalog 2026/27 na engleskom, pa se nazivi i specifikacije porede 1:1.
 *
 *   sitemap=products                       otkrivanje (ne pogađaju se URL-ovi)
 *   meta[itemprop=sku|category]            vodeća šifra i zvanična kategorija
 *   h1[itemprop=name] / __subheader        naziv i podnaslov (tip proizvoda)
 *   .productdetail-mainslider__item        SOPSTVENE slike (+ data-zoom-image original)
 *   table Art.No./Specification/KP/VE      šifre artikala = varijante
 *   data-url …/safetydatasheets/{art}/{L}  SDS endpoint po artiklu
 *   a[href*=/datasheets/]                  TDS
 *   js-productRequired-slider              „We recommend” (preporučen pribor)
 *   h2.image-teaser__headline + ul|p       DESCRIPTION / AREA OF APPLICATION /
 *                                          BENEFITS / APPLICATION ADVICE
 *   /products/category/{key}/page/{n}      redosled u kategoriji + oznaka „New”
 *
 * Upotreba: node scripts/carsystem-sync/acquire-website.mjs [--refresh]
 * Izlaz:    data/carsystem-sync/raw/website-en.generated.json
 */

import path from "node:path";

import { LISTING_CACHE_DIR, ORIGIN, PAGE_CACHE_DIR, PATHS, WEBSITE } from "./lib/config.mjs";
import { cachedFetch, fetchBuffer, mapLimit, writeJson } from "./lib/http.mjs";

const refresh = process.argv.includes("--refresh");
const CONCURRENCY = 5;

const ENTITIES = {
  "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
  "&szlig;": "ß", "&auml;": "ä", "&ouml;": "ö", "&uuml;": "ü", "&Auml;": "Ä", "&Ouml;": "Ö",
  "&Uuml;": "Ü", "&reg;": "®", "&trade;": "™", "&deg;": "°", "&micro;": "µ", "&times;": "×",
  "&ndash;": "–", "&mdash;": "—", "&sup2;": "²", "&sup3;": "³", "&frac12;": "½", "&eacute;": "é",
};

const decode = (value) =>
  value
    .replace(/&[a-zA-Z0-9]+;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const text = (html) => decode(String(html ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const absolute = (href) => (href.startsWith("http") ? href : `${ORIGIN}${href}`);
const cacheKey = (url) => url.replace(`${ORIGIN}/`, "").replace(/[^a-zA-Z0-9._-]+/g, "__");

/* -- 1. Otkrivanje ---------------------------------------------------------- */

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));

const sitemapIndex = (await fetchBuffer(WEBSITE.sitemapIndex)).toString("utf8");
const sitemaps = [];
const productUrls = new Set();
for (const sitemapUrl of locs(sitemapIndex)) {
  const kind = /sitemap=([a-z]+)/.exec(sitemapUrl)?.[1] ?? "unknown";
  const urls = locs((await fetchBuffer(sitemapUrl)).toString("utf8"));
  sitemaps.push({ sitemap: sitemapUrl, kind, urls: urls.length });
  if (kind !== "products") continue;
  for (const url of urls) {
    // Sitemap nosi i jedan query-string fallback bez sluga; to nije stranica proizvoda.
    if (url.startsWith(WEBSITE.detailPrefix)) productUrls.add(url);
  }
}
const urls = [...productUrls].sort();
console.log(`Sitemap: ${urls.length} stranica proizvoda.`);

/* -- 2. Stranica proizvoda -------------------------------------------------- */

const SECTION_RE =
  /<h2[^>]*image-teaser__headline[^>]*>\s*([^<]{3,60}?)\s*<\/h2>\s*((?:<ul>[\s\S]*?<\/ul>|<p>[\s\S]*?<\/p>))?/g;

function parseProduct(url, html) {
  const match = /\/products\/detail\/([^/]+)\/([^/?#]+)/.exec(url);
  if (!match) return { sourceUrl: url, error: "URL ne odgovara obrascu" };
  const [, categoryKey, slug] = match;

  const meta = (prop) =>
    decode(new RegExp(`<meta itemprop="${prop}" content="([^"]*)"`).exec(html)?.[1] ?? "").trim();

  const sections = {};
  SECTION_RE.lastIndex = 0;
  for (let section; (section = SECTION_RE.exec(html)); ) {
    const heading = text(section[1]).toUpperCase();
    const body = section[2] ?? "";
    const items = body.includes("<li")
      ? [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((item) => text(item[1])).filter(Boolean)
      : [text(body)].filter(Boolean);
    if (items.length) sections[heading] = items;
  }

  const variants = [];
  for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const cell = (label) =>
      text(new RegExp(`data-label="${label.replace(/\./g, "\\.")}"[^>]*>([\\s\\S]*?)</td>`).exec(row)?.[1]);
    const articleNumber = cell("Art.No.");
    if (!articleNumber) continue;
    // SDS je <select> sa jednim endpointom po jeziku; cHash je vezan za URL.
    const sds = Object.fromEntries(
      [...row.matchAll(/<option value="([^"]*\/safetydatasheets\/[^"/]+\/([A-Z]{2})\?[^"]*)"/g)].map((option) => [
        option[2],
        absolute(decode(option[1])),
      ]),
    );
    variants.push({
      articleNumber,
      specification: cell("Specification") || null,
      salesPack: cell("KP") || null,
      packagingUnit: cell("VE") || null,
      sdsEndpoint: sds.EN ?? null,
      sdsLanguages: Object.keys(sds).sort(),
    });
  }

  // Samo slike iz glavnog slajdera su slike OVOG proizvoda; preporuke i srodni
  // proizvodi niže na stranici nose tuđe packshotove.
  const images = [];
  for (const item of html.match(/<div class="productdetail-mainslider__item"[\s\S]*?<\/div>/g) ?? []) {
    const original = /data-zoom-image="([^"]+)"/.exec(item)?.[1];
    const img = /<img[^>]*src="([^"]+)"(?:[^>]*width="(\d+)")?(?:[^>]*height="(\d+)")?(?:[^>]*alt="([^"]*)")?/.exec(item);
    if (!original && !img) continue;
    images.push({
      originalUrl: original ? absolute(decode(original)) : null,
      processedUrl: img ? absolute(decode(img[1])) : null,
      processedWidth: img?.[2] ? Number(img[2]) : null,
      processedHeight: img?.[3] ? Number(img[3]) : null,
      alt: img?.[4] ? decode(img[4]).trim() : "",
    });
  }

  const documents = [
    ...new Map(
      [...html.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*?(?:title="([^"]*)")?[^>]*>/gi)].map((doc) => [
        doc[1],
        { url: absolute(decode(doc[1])), title: decode(doc[2] ?? "").trim() || null },
      ]),
    ).values(),
  ].map((doc) => ({
    ...doc,
    kind: /\/datasheets\//.test(doc.url) ? "tds" : "other",
  }));

  const recommendedBlock = /js-productRequired-slider[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/.exec(html)?.[0] ?? "";
  const detailLinks = (fragment) => [
    ...new Set([...fragment.matchAll(/href="(\/en\/products\/detail\/[^"?#]+)"/g)].map((link) => absolute(link[1]))),
  ].filter((link) => !link.endsWith(`/${slug}`));
  const recommended = detailLinks(recommendedBlock);

  const videos = [
    ...new Set(
      [...html.matchAll(/(?:src|data-src|href)="(https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be|vimeo\.com)[^"]+)"/g)].map(
        (video) => decode(video[1]),
      ),
    ),
  ];

  const officialName = text(/<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]) || null;
  return {
    sourceUrl: url,
    // Stranica je „aktivna” kada je sitemap navodi, server je vrati sa 200 (inače
    // je u `failures`) i kada zaista nosi proizvod: naziv + bar jednu šifru artikla.
    active: Boolean(officialName) && variants.length > 0,
    categoryKey,
    slug,
    officialCategory: meta("category") || null,
    leadSku: meta("sku") || null,
    officialName,
    subtitle: text(/<p[^>]*productdetail-infos__subheader[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1]) || null,
    officialDescription: text(/<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1]) || null,
    sections,
    variants,
    images,
    documents,
    recommendedProductUrls: recommended,
    relatedProductUrls: detailLinks(html).filter((link) => !recommended.includes(link)),
    videos,
  };
}

let fetched = 0;
const parsed = await mapLimit(urls, CONCURRENCY, async (url) => {
  try {
    const { body, fromCache } = await cachedFetch(url, path.join(PAGE_CACHE_DIR, `${cacheKey(url)}.html`), { refresh });
    if (!fromCache) fetched += 1;
    return parseProduct(url, body.toString("utf8"));
  } catch (error) {
    return { sourceUrl: url, error: String(error.message ?? error) };
  }
});

const products = parsed.filter((entry) => !entry.error);
const failures = parsed.filter((entry) => entry.error);

/* -- 3. Listinzi kategorija: redosled i „New” ------------------------------- */

const categoryKeys = [...new Set(products.map((product) => product.categoryKey))].sort();
const listingFacts = new Map();
const categories = [];

for (const key of categoryKeys) {
  let position = 0;
  let pages = 0;
  const seen = new Set();
  // Paginacija je 1-bazna (`page/0` i `page/1` su ista prva strana).
  for (let page = 1; page < 80; page += 1) {
    const url = `${WEBSITE.categoryPrefix}${key}/page/${page}`;
    let html;
    try {
      html = (await cachedFetch(url, path.join(LISTING_CACHE_DIR, `${key}__${page}.html`), { refresh })).body.toString("utf8");
    } catch {
      break;
    }
    const items = html.match(/<div class="productlist__item">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) ?? [];
    let added = 0;
    for (const item of items) {
      const href = /href="(\/en\/products\/detail\/[^"?#]+)"/.exec(item)?.[1];
      if (!href) continue;
      const productUrl = absolute(href);
      if (seen.has(productUrl)) continue;
      seen.add(productUrl);
      added += 1;
      position += 1;
      listingFacts.set(productUrl, {
        listingPosition: position,
        markedNew: /class="productlist__new"/.test(item),
      });
    }
    pages += 1;
    // Stranica van opsega vraća iste ili nula stavki — tu se listing završava.
    if (!added) break;
  }
  categories.push({
    key,
    url: `${WEBSITE.categoryPrefix}${key}`,
    officialName: products.find((product) => product.categoryKey === key)?.officialCategory ?? null,
    listedProducts: seen.size,
    listingPages: pages,
  });
}

for (const product of products) {
  const facts = listingFacts.get(product.sourceUrl);
  product.listingPosition = facts?.listingPosition ?? null;
  product.markedNew = facts?.markedNew ?? false;
  product.inCategoryListing = Boolean(facts);
}

const summary = {
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  source: "carsystem.org — zvanični EN sajt",
  locale: WEBSITE.locale,
  discoveryMethod: "zvanični TYPO3 sitemap (sitemap=products)",
  sitemaps,
  productPages: urls.length,
  productsParsed: products.length,
  parseFailures: failures.length,
  categories: categories.length,
  articleNumbers: products.reduce((sum, product) => sum + product.variants.length, 0),
  distinctArticleNumbers: new Set(products.flatMap((product) => product.variants.map((v) => v.articleNumber))).size,
  activeProductPages: products.filter((product) => product.active).length,
  inactiveProductPages: products.filter((product) => !product.active).map((product) => product.sourceUrl),
  markedNew: products.filter((product) => product.markedNew).length,
  notInCategoryListing: products.filter((product) => !product.inCategoryListing).length,
  withImages: products.filter((product) => product.images.length).length,
  withTds: products.filter((product) => product.documents.some((doc) => doc.kind === "tds")).length,
  withSds: products.filter((product) => product.variants.some((variant) => variant.sdsEndpoint)).length,
  sectionHeadings: [...new Set(products.flatMap((product) => Object.keys(product.sections)))].sort(),
};

// `acquiredAt` je namerno van `products`: ponovljeno pokretanje nad istim
// kešom daje isti sadržaj proizvoda, pa diff pokazuje samo stvarne promene.
writeJson(PATHS.rawWebsite, {
  acquiredAt: new Date().toISOString().slice(0, 10),
  summary,
  categories,
  products,
  failures,
});

console.log(JSON.stringify({ ...summary, sitemaps: undefined, fetchedFromNetwork: fetched }, null, 2));
if (failures.length) {
  console.error(`Neuspelih stranica: ${failures.length}`);
  process.exitCode = 1;
}
