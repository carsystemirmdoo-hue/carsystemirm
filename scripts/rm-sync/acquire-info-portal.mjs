#!/usr/bin/env node
/**
 * R-M sync, korak 1 — RAW dataset tehničkog portala „Info R-M International” (info.rmpaint.com).
 *
 * Portal je jedini zvanični izvor sa OZNAKOM proizvoda (`field-product-unique-id`). Lista
 * proizvoda je paginirana, a tehnička kategorija je filter liste (`?category=<id>`), pa se
 * članstvo u kategoriji čita prolaskom kroz listu SVAKE kategorije — ne pogađa se iz naziva.
 *
 * Izlaz: data/rm-sync/raw/info-portal.generated.json (samo činjenice sa portala).
 *
 *   node scripts/rm-sync/acquire-info-portal.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PAGE_CACHE_DIR, PATHS, SOURCES } from "./lib/config.mjs";
import { clean, decode, field, paragraphs } from "./lib/html.mjs";

const refresh = process.argv.includes("--refresh");
const { origin, listing } = SOURCES.info;

const get = async (url, name) => (await cachedFetch(url, path.join(PAGE_CACHE_DIR, "info", name), { refresh })).body.toString("utf8");

/** Sve stranice jedne liste (cela ili jedna kategorija) → [{ path, title, code, nodeId }] */
async function crawlListing(category) {
  const items = [];
  for (let page = 0; page < 60; page += 1) {
    const query = [category ? `category=${category}` : null, `page=${page}`].filter(Boolean).join("&");
    const html = await get(`${listing}?${query}`, `listing__${category ?? "all"}__${page}.html`);
    const rows = [...html.matchAll(/<article data-history-node-id="(\d+)"[^>]*node--type-product[\s\S]*?<\/article>/g)];
    for (const [block, nodeId] of rows) {
      items.push({
        nodeId: Number(nodeId),
        path: /<a href="(\/products\/[^"]+)"/.exec(block)?.[1] ?? null,
        title: clean(/<h2>([\s\S]*?)<\/h2>/.exec(block)?.[1]),
        code: clean(field(block, "field-product-unique-id")) || null,
      });
    }
    if (!rows.length || !new RegExp(`[?&amp;]page=${page + 1}"`).test(html)) break;
  }
  return items;
}

/* -- 1. Kategorije i lista ---------------------------------------------------------------- */

const first = await get(`${listing}?page=0`, "listing__all__0.html");
const categories = [...first.matchAll(/name="category" value="(\d+)"[^>]*\/>\s*<label[^>]*>([^<]+)<\/label>/g)]
  .map(([, id, label]) => ({ id: Number(id), label: decode(label).trim() }))
  .filter((category, index, all) => all.findIndex((other) => other.id === category.id) === index);

const all = await crawlListing(null);
const categoriesByPath = new Map();
for (const category of categories) {
  for (const item of await crawlListing(category.id)) categoriesByPath.set(item.path, [...(categoriesByPath.get(item.path) ?? []), category.label]);
}

/* -- 2. Stranice proizvoda ---------------------------------------------------------------- */

const products = await mapLimit(all, 4, async (item) => {
  const file = `product__${item.path.split("/").pop()}.html`;
  let html = "";
  let httpStatus = 200;
  try {
    html = await get(`${origin}${item.path}`, file);
  } catch (error) {
    httpStatus = Number(/HTTP (\d+)/.exec(String(error.message))?.[1] ?? 0);
  }
  const article = /<article[^>]*node--type-product[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  const image = /field--name-field-product-image[\s\S]*?<a href="([^"]+)"/.exec(article)?.[1] ?? null;
  // TDS: `<optgroup label="…"><option value="tds_<url>">naziv</option>` — grupa je varijanta/jezik kada je ima.
  const documents = [...article.matchAll(/<option value="([a-z]+)_(https?:[^"]+)">([^<]*)<\/option>/g)].map(([, kind, url, label]) => ({ kind, url: decode(url), label: decode(label).trim() }));
  const sdsLink = /field--name-field-product-data-sheet[\s\S]*?<a href="([^"]+)"/.exec(article)?.[1] ?? null;
  const known = new Set(["field-product-data-sheet", "field-product-unique-id", "field-product-introduction", "field-product-image"]);
  return {
    sourceUrl: `${origin}${item.path}`,
    path: item.path,
    nodeId: item.nodeId,
    httpStatus,
    title: clean(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]) || item.title,
    code: clean(field(article, "field-product-unique-id")) || item.code,
    categories: categoriesByPath.get(item.path) ?? [],
    introduction: paragraphs(field(article, "field-product-introduction")),
    image: image ? { url: decode(image), fileName: decodeURIComponent(image.split("/").pop().split("?")[0]) } : null,
    documents,
    sdsLink,
    // Kontrola parsera: polja stranice koja parser NE čita.
    otherFields: [...new Set([...article.matchAll(/field--name-(field-[a-z0-9-]+)/g)].map((match) => match[1]))].filter((name) => !known.has(name)),
    fetchedAt: html ? statSync(path.join(PAGE_CACHE_DIR, "info", file)).mtime.toISOString() : null,
  };
});

products.sort((a, b) => a.path.localeCompare(b.path));
const codes = products.map((product) => product.code).filter(Boolean);
writeJson(PATHS.rawInfo, {
  meta: {
    source: origin,
    title: "Info R-M International",
    crawledAt: products.map((product) => product.fetchedAt).filter(Boolean).sort()[0] ?? null,
    categories,
    products: products.length,
    productsNotOk: products.filter((product) => product.httpStatus !== 200).map((product) => product.path),
    withCode: codes.length,
    distinctCodes: new Set(codes).size,
    duplicateCodes: [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))],
    withoutCode: products.filter((product) => !product.code).map((product) => product.path),
    withoutCategory: products.filter((product) => !product.categories.length).map((product) => product.path),
    withImage: products.filter((product) => product.image).length,
    withTds: products.filter((product) => product.documents.length).length,
    tdsDocuments: products.reduce((sum, product) => sum + product.documents.length, 0),
    documentHosts: [...new Set(products.flatMap((product) => product.documents.map((document) => new URL(document.url).host)))],
    unreadFields: [...new Set(products.flatMap((product) => product.otherFields))],
  },
  products,
});

console.log(`info portal: ${products.length} proizvoda · ${new Set(codes).size} oznaka · ${categories.length} kategorija · TDS ${products.reduce((sum, product) => sum + product.documents.length, 0)} → ${path.relative(process.cwd(), PATHS.rawInfo)}`);
