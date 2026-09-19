#!/usr/bin/env node
/**
 * R-M sync, korak 2 — RAW dataset marketinškog sajta www.rmpaint.com (lokal `en-int`).
 *
 * Stranice proizvoda NE nose oznaku proizvoda; nose tip („Hardener”), naziv, seriju
 * („Pioneer Series”), jednorečenični opis i sliku. Sajt je dokaz „trenutno u ponudi” i izvor
 * serije; oznaka se dodeljuje ukrštanjem sa info portalom (build-source.mjs), nikad ručno.
 *
 * Lista stranica se ne sastavlja ručno: čita se `sitemap.xml` (sekcija `/en-int/products/`)
 * i stranice linija/asortimana na koje vodi navigacija.
 *
 * Izlaz: data/rm-sync/raw/website.generated.json
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PAGE_CACHE_DIR, PATHS, SOURCES } from "./lib/config.mjs";
import { clean, decode, paragraphs } from "./lib/html.mjs";

const refresh = process.argv.includes("--refresh");
const { origin, locale, sitemap } = SOURCES.website;
const base = `${origin}/${locale}`;
const dir = path.join(PAGE_CACHE_DIR, "website");

const { body: sitemapXml } = await cachedFetch(sitemap, path.join(dir, "sitemap.xml"), { refresh });
const entries = [...sitemapXml.toString("utf8").matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>/g)].map(([, loc, lastmod]) => ({ loc, lastmod }));
const localeUrls = entries.filter((entry) => entry.loc.startsWith(`${base}/`) || entry.loc === base);
const productUrls = localeUrls.filter((entry) => entry.loc.startsWith(`${base}/products/`)).sort((a, b) => a.loc.localeCompare(b.loc));
const rangeUrls = localeUrls.filter((entry) => !/\/(news|products)\//.test(entry.loc) && /product|line|range|agilis|onyx|diamont|graphite|uno|basecoat|sds|technical-support|featured/i.test(entry.loc));

async function load(entry, prefix) {
  const key = entry.loc.slice(base.length + 1).replace(/\//g, "__") || "home";
  const file = path.join(dir, `${prefix}__${key}.html`);
  try {
    const { body } = await cachedFetch(entry.loc, file, { refresh });
    return { html: body.toString("utf8"), httpStatus: 200, fetchedAt: statSync(file).mtime.toISOString() };
  } catch (error) {
    return { html: "", httpStatus: Number(/HTTP (\d+)/.exec(String(error.message))?.[1] ?? 0), fetchedAt: null };
  }
}

const products = await mapLimit(productUrls, 4, async (entry) => {
  const { html, httpStatus, fetchedAt } = await load(entry, "product");
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  const hero = /paragraph-hero[\s\S]*?(?=<div class="paragraph-box)/.exec(main)?.[0] ?? main;
  const description = /paragraph-text-media[\s\S]*?<div class="fs-lg[^"]*">([\s\S]*?)<\/div>/.exec(main)?.[1] ?? null;
  // Samo slika PROIZVODA (`/files/…/product/…`): stranica nosi i opšte marketinške fotografije koje nisu packshot.
  const image = [...main.matchAll(/<img[^>]+src="([^"]+)"/g)].map((found) => found[1]).find((src) => /\/public\/product\/|\/files\/product\//.test(src)) ?? null;
  // Original bez Drupal image-style izvedbe: /files/styles/<stil>/public/<putanja>.webp?itok → /files/<putanja>
  const original = image ? decode(image).replace(/\/styles\/[^/]+\/public\//, "/").replace(/\.webp\?.*$|\?.*$/, "") : null;
  return {
    sourceUrl: entry.loc,
    slug: entry.loc.split("/").pop(),
    lastmod: entry.lastmod,
    httpStatus,
    productType: clean(/hero-badges[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(hero)?.[1]) || null,
    name: clean(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(hero)?.[1]) || null,
    series: clean(/hero-introtext[^>]*>([\s\S]*?)<\/div>/.exec(hero)?.[1]) || null,
    description: description ? paragraphs(description) : [],
    image: original ? { url: original, styledUrl: decode(image) } : null,
    pdfLinks: [...new Set([...main.matchAll(/href="([^"]+\.pdf[^"]*)"/g)].map((match) => decode(match[1])))],
    infoLinks: [...new Set([...main.matchAll(/href="(https?:\/\/(?:info|techinfo)\.rmpaint\.com[^"]*)"/g)].map((match) => decode(match[1])))],
    fetchedAt,
  };
});

const rangePages = await mapLimit(rangeUrls, 3, async (entry) => {
  const { html, httpStatus } = await load(entry, "range");
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? "";
  return {
    sourceUrl: entry.loc,
    httpStatus,
    title: clean(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main)?.[1]) || null,
    headings: [...main.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((match) => clean(match[1])).filter(Boolean),
    productLinks: [...new Set([...main.matchAll(new RegExp(`href="/${locale}/products/([^"#?]+)"`, "g"))].map((match) => match[1]))],
    outboundOfficialLinks: [...new Set([...html.matchAll(/href="(https?:\/\/[^"]*(?:rmpaint|surventis|basf|refinity)[^"]*)"/g)].map((match) => decode(match[1])).filter((url) => !url.startsWith(origin)))],
    pdfLinks: [...new Set([...main.matchAll(/href="([^"]+\.pdf[^"]*)"/g)].map((match) => decode(match[1])))],
  };
});

writeJson(PATHS.rawWebsite, {
  meta: {
    source: base,
    architecture: "Drupal; sitemap.xml po lokalima; stranica proizvoda = tip + naziv + serija + opis + slika, bez oznake proizvoda",
    crawledAt: products.map((product) => product.fetchedAt).filter(Boolean).sort()[0] ?? null,
    localesInSitemap: [...new Set(entries.map((entry) => entry.loc.split("/")[3]))].sort(),
    productPages: products.length,
    productPagesNotOk: products.filter((product) => product.httpStatus !== 200).map((product) => product.slug),
    withSeries: products.filter((product) => product.series).length,
    withImage: products.filter((product) => product.image).length,
    withCodeInName: products.filter((product) => /\b[A-Z]{1,2} ?\d[A-Z0-9]{2,4}\b/.test(product.name ?? "")).length,
    rangePages: rangePages.length,
    officialOutboundLinks: [...new Set(rangePages.flatMap((page) => page.outboundOfficialLinks))].sort(),
    pdfLinks: [...new Set([...products, ...rangePages].flatMap((page) => page.pdfLinks))].sort(),
  },
  products,
  rangePages,
});

console.log(`website: ${products.length} stranica proizvoda · ${rangePages.length} stranica linija/asortimana → ${path.relative(process.cwd(), PATHS.rawWebsite)}`);
