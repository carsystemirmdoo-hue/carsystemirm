#!/usr/bin/env node
/**
 * Cosmos Lac sync, korak 1b — ZVANIČNI DOKUMENTI i regionalna objava.
 *
 * „Download product info” na stranici proizvoda vodi na PDF pod /pdfs/products/en/. Isti PDF dele
 * sve nijanse jednog proizvoda, pa je dokument na nivou PROIZVODA, ne nijanse ni pakovanja.
 * Proverava se samo da li dokument postoji (HEAD) — ništa se ne preuzima i ne hostuje.
 */

import { mapLimit, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { LOCALES, ORIGIN, PATHS, USER_AGENT } from "./lib/config.mjs";

const raw = readJson(PATHS.rawProducts);
const urls = [...new Set(raw.products.flatMap((product) => product.documents))].sort();
const documents = [];
await mapLimit(urls, 6, async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
    documents.push({ url, status: response.status, contentType: response.headers.get("content-type"), bytes: Number(response.headers.get("content-length") ?? 0), lastModified: response.headers.get("last-modified") });
  } catch (error) {
    documents.push({ url, status: 0, error: String(error.message) });
  }
});
documents.sort((a, b) => a.url.localeCompare(b.url));
for (const document of documents) {
  const file = decodeURIComponent(document.url.split("/").pop());
  document.kind = /_tds\.pdf$/i.test(file) ? "TDS" : "PRODUCT_INFO";
  document.products = raw.products.filter((product) => product.documents.includes(document.url)).length;
}

/* Regionalna objava: broj stranica po liniji u svakom jeziku (adrese su prevedene, pa se poredi po liniji). */
const index = await (await fetch(`${ORIGIN}/sitemap_index.xml`, { headers: { "User-Agent": USER_AGENT } })).text();
const parts = [...index.matchAll(/<loc>([^<]+pran_products-sitemap\d*\.xml)<\/loc>/g)].map((match) => match[1]);
const all = [];
for (const part of parts) for (const match of (await (await fetch(part, { headers: { "User-Agent": USER_AGENT } })).text()).matchAll(/<loc>([^<]+)<\/loc>/g)) all.push(match[1]);
const perLocale = {};
for (const locale of ["en", ...LOCALES]) {
  const prefix = locale === "en" ? `${ORIGIN}/products/` : `${ORIGIN}/${locale}/products/`;
  const counts = {};
  for (const url of all.filter((entry) => entry.startsWith(prefix) && !/\.(png|jpe?g|webp)$/i.test(entry))) {
    const segments = url.slice(prefix.length).split("/").filter(Boolean);
    if (segments.length !== 3) continue;
    counts[segments[1]] = (counts[segments[1]] ?? 0) + 1;
  }
  perLocale[locale] = { total: Object.values(counts).reduce((sum, count) => sum + count, 0), byFamilySegment: counts };
}

writeJson(PATHS.rawDocuments, {
  meta: { documents: documents.length, ok: documents.filter((document) => document.status === 200).length, broken: documents.filter((document) => document.status !== 200).length, tds: documents.filter((document) => document.kind === "TDS").length, productInfo: documents.filter((document) => document.kind === "PRODUCT_INFO").length, localeTotals: Object.fromEntries(Object.entries(perLocale).map(([locale, value]) => [locale, value.total])) },
  documents,
  perLocale,
});
console.log(JSON.stringify(readJson(PATHS.rawDocuments).meta, null, 1));
