#!/usr/bin/env node
/**
 * Cosmos Lac sync, korak 1 — ZVANIČNI SAJT (sitemap → stranice proizvoda i porodica).
 *
 * Sitemap je proizvođačev sopstveni indeks: iz njega dolaze SVE stranice proizvoda, po jezicima.
 * Sa stranice proizvoda se čita samo ono što ona zaista nosi: naziv, opis, primena, osobine,
 * pakovanje, sistem kapice, slike iz galerije proizvoda, zvanični dokument i povezani proizvodi.
 *
 *   node scripts/cosmos-lac-sync/acquire-website.mjs [--refresh]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mapLimit, writeJson } from "../carsystem-sync/lib/http.mjs";
import { LOCALES, ORIGIN, PAGE_CACHE_DIR, PATHS, USER_AGENT } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
mkdirSync(PAGE_CACHE_DIR, { recursive: true });

const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'");
const plain = (html) => decode(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

async function get(url, attempt = 1) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    // Prolazni mrežni prekid nije isto što i stranica koje nema: tri pokušaja, pa tek onda greška.
    if (attempt >= 3 || /HTTP 4\d\d/.test(String(error.message))) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    return get(url, attempt + 1);
  }
}
async function cached(url) {
  const file = path.join(PAGE_CACHE_DIR, `${url.replace(`${ORIGIN}/`, "").replace(/\/$/, "").replace(/\//g, "__")}.html`);
  if (!refresh && existsSync(file)) return readFileSync(file, "utf8");
  const html = await get(url);
  writeFileSync(file, html);
  return html;
}

/* ── 1. Sitemap ── */
const index = await get(`${ORIGIN}/sitemap_index.xml`);
const parts = [...index.matchAll(/<loc>([^<]+pran_products-sitemap\d*\.xml)<\/loc>/g)].map((match) => match[1]);
const urls = new Set();
for (const part of parts) for (const match of (await get(part)).matchAll(/<loc>([^<]+)<\/loc>/g)) if (!/\.(png|jpe?g|webp|gif)$/i.test(match[1])) urls.add(match[1]);
const english = [...urls].filter((url) => /^https:\/\/cosmoslac\.com\/products\/[^/]+\/[^/]+\/[^/]+\/$/.test(url)).sort();
const byLocale = Object.fromEntries(LOCALES.map((locale) => [locale, [...urls].filter((url) => url.startsWith(`${ORIGIN}/${locale}/products/`)).length]));
// Adrese ostalih jezika (samo putanje): dokaz da je proizvod objavljen na drugom tržištu i kada ga engleski sajt nema.
const localePaths = Object.fromEntries(LOCALES.map((locale) => [locale, [...urls].filter((url) => new RegExp(`^${ORIGIN}/${locale}/products/[^/]+/[^/]+/[^/]+/$`).test(url)).map((url) => url.replace(`${ORIGIN}/${locale}/products/`, "")).sort()]));
writeJson(PATHS.rawSitemap, { meta: { index: `${ORIGIN}/sitemap_index.xml`, productSitemaps: parts.length, urls: urls.size, english: english.length, byLocale }, english, localePaths });

/* ── 2. Stranice proizvoda ── */
function section(html, title) {
  const at = html.search(new RegExp(`accordion-title[^>]*>\\s*${title}\\b`, "i"));
  if (at < 0) return null;
  const rest = html.slice(at);
  const body = /accordion-wrapper[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/.exec(rest)?.[1] ?? "";
  return body;
}

const products = [];
const failures = [];
let done = 0;
await mapLimit(english, 6, async (url) => {
  try {
    const html = await cached(url);
    const [, category, family, slug] = /\/products\/([^/]+)\/([^/]+)\/([^/]+)\/$/.exec(url);
    const main = /single-product-main[\s\S]*?(?=class="related-products"|<footer)/.exec(html)?.[0] ?? html;
    const features = section(main, "FEATURES") ?? "";
    const lists = [...features.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/g)].map((match) => [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((item) => plain(item[1])).filter(Boolean));
    // Poslednja lista u „FEATURES” je pakovanje („400ml”, „400ml & 500ml”) kada sadrži samo mere.
    const isPack = (list) => list.length > 0 && list.every((item) => /^\s*[\d.,]+\s?(ml|l|lt|kg|g|gr)\b/i.test(item));
    const packs = lists.filter(isPack).flat();
    const slider = /class="product-slider"[\s\S]*?(?=single-product-main__content)/.exec(main)?.[0] ?? "";
    const descriptionBlock = /single-product-main__content[\s\S]*?(?=accordion-container)/.exec(main)?.[0] ?? "";
    // JSON-LD: zvanični nazivi kategorije i linije (breadcrumb) i datum poslednje izmene stranice.
    const crumbs = [...html.matchAll(/"@type":"ListItem","position":\d+,"name":"((?:[^"\\]|\\.)*)"/g)].map((match) => decode(JSON.parse(`"${match[1]}"`)));
    products.push({
      url,
      breadcrumb: crumbs,
      dateModified: /"dateModified":"([^"]+)"/.exec(html)?.[1] ?? null,
      datePublished: /"datePublished":"([^"]+)"/.exec(html)?.[1] ?? null,
      slug,
      category,
      family,
      officialName: plain(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ""),
      description: [...descriptionBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((match) => plain(match[1])).filter((text) => text.length > 20),
      application: plain(section(main, "APPLICATION") ?? "") || null,
      features: lists.filter((list) => !isPack(list)).flat(),
      packs,
      capSystem: [...(section(main, "CAP SYSTEM") ?? "").matchAll(/product-cap-system__content[^>]*>([\s\S]*?)<\/div>/g)].map((match) => plain(match[1])).filter(Boolean),
      documents: [...new Set([...main.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((match) => new URL(decode(match[1]), ORIGIN).href))],
      images: [...new Set([...slider.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]))],
      isNew: /class="product-new"/.test(main),
      related: [...new Set([...html.matchAll(/href="https:\/\/cosmoslac\.com\/products\/[^/]+\/[^/]+\/([^/"]+)\/"/g)].map((match) => match[1]))].filter((other) => other !== slug),
    });
  } catch (error) {
    failures.push({ url, error: String(error.message) });
  }
  done += 1;
  if (done % 100 === 0) console.log(`  ${done}/${english.length}`);
});
products.sort((a, b) => a.url.localeCompare(b.url));

/* ── 3. Porodice: zvanični naziv linije dolazi iz breadcrumb-a njenih proizvoda ── */
const familyKeys = [...new Set(products.map((product) => `${product.category}/${product.family}`))].sort();
const families = familyKeys.map((key) => {
  const members = products.filter((product) => `${product.category}/${product.family}` === key);
  const names = new Map();
  for (const member of members) if (member.breadcrumb.length >= 2) names.set(member.breadcrumb[1], (names.get(member.breadcrumb[1]) ?? 0) + 1);
  const categoryNames = new Set(members.map((member) => member.breadcrumb[0]).filter(Boolean));
  return { key, officialCategory: [...categoryNames][0] ?? null, officialName: [...names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, nameVariants: [...names.keys()], products: members.length };
});

writeJson(PATHS.rawProducts, { meta: { source: ORIGIN, products: products.length, failures: failures.length, withDocument: products.filter((product) => product.documents.length).length, withImage: products.filter((product) => product.images.length).length, withPack: products.filter((product) => product.packs.length).length }, products, failures });
writeJson(PATHS.rawFamilies, { meta: { families: families.length }, families });
console.log(JSON.stringify({ sitemap: { english: english.length, byLocale }, products: products.length, failures: failures.length, families: families.length, withDocument: products.filter((product) => product.documents.length).length, withPack: products.filter((product) => product.packs.length).length }, null, 1));
