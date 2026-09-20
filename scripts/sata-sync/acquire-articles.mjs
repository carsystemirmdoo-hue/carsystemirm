#!/usr/bin/env node
/**
 * SATA sync, korak 2 — STRANICE ARTIKALA iz sitemap-a.
 *
 * Svaki broj artikla ima svoju stranicu. `og:title` nosi zvanični zapis:
 *
 *   „Nozzle set SATAjet X 5500 RP FUTURE 1.3 I | 1,3 | RP | I | 1159004"
 *     naziv                                    | vrednosti osa  | broj artikla
 *
 * pa se vrednosti osa čitaju bez `switch?options=` endpointa (koji `robots.txt` zabranjuje).
 *
 * Čuva se samo izvučeno: cele stranice bi zauzele ~500 MB. CENA se namerno NE čita ni ne čuva,
 * iako je sajt objavljuje — beleži se samo da li je artikal uopšte ponuđen za upit.
 *
 *   node scripts/sata-sync/acquire-articles.mjs [--refresh] [--limit=N]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mapLimit, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { ARTICLE_CACHE, PATHS, SOURCES, USER_AGENT } from "./lib/config.mjs";
import { parseConfigurator } from "./lib/configurator.mjs";

const refresh = process.argv.includes("--refresh");
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 0);
const sitemap = readJson(PATHS.rawSitemap);
if (!sitemap) throw new Error("Nedostaje sitemap — `node scripts/sata-sync/acquire-families.mjs`.");

const base = `${SOURCES.website.origin}/${SOURCES.website.locale}`;
const cache = !refresh && existsSync(ARTICLE_CACHE) ? JSON.parse(readFileSync(ARTICLE_CACHE, "utf8")) : {};

const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&reg;/g, "®").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const meta = (html, property) => decode(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`).exec(html)?.[1] ?? "");

async function fetchArticle(entry) {
  const response = await fetch(`${base}/${entry.path}`, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" } });
  if (!response.ok) return { articleNumber: entry.articleNumber, path: entry.path, error: `HTTP ${response.status}` };
  const html = await response.text();
  const ogTitle = meta(html, "og:title");
  const segments = ogTitle.split("|").map((segment) => segment.trim()).filter(Boolean);
  const number = segments[segments.length - 1] === entry.articleNumber ? segments.pop() : entry.articleNumber;
  const name = segments.shift() ?? null;
  const main = /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? html;
  const configurator = parseConfigurator(main);
  const gallery = [...new Set([...main.matchAll(/(https:\/\/www\.sata\.com\/media\/[^"?\s)]+\.(?:png|jpe?g|webp))/gi)].map((match) => match[1]))].filter((src) => !/banner|card-slider|icon|logo|flag/i.test(src));
  return {
    articleNumber: number,
    path: entry.path,
    name,
    options: segments,
    // Zvanična pripadnost porodici (Shopware parent) i vrednost SVAKE ose za ovaj artikal.
    parentId: configurator.parentId,
    /*
     * Zvanična kategorija artikla: `window.ga4Product` nosi `item_category…` (Home › All products ›
     * Accessories). Čitaju se ISKLJUČIVO ti ključevi — isti objekat sadrži i cenu, koja se ne dira.
     */
    officialCategory: [...html.matchAll(/"item_category(\d?)":"((?:[^"\\]|\\.)*)"/g)]
      .map((match) => [Number(match[1] || 1), JSON.parse(`"${match[2]}"`)])
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value)
      .filter((value, index, all) => all.indexOf(value) === index),
    selection: configurator.selection,
    ogImage: meta(html, "og:image") || null,
    galleryImages: gallery.length,
    firstImage: gallery[0] ?? null,
    /*
     * Dokumenti: zvanični fajlovi se zovu `…BETRIEBSANLEITUNG-….PDF.PDF?ts=…` — velika slova i
     * vremenski token. `robots.txt` takve `/media/*?ts=` adrese izričito dozvoljava.
     */
    downloads: [...new Set([...main.matchAll(/href="([^"]+\.pdf(?:\.pdf)?(?:\?[^"]*)?)"/gi)].map((match) => decode(match[1]).split("?")[0]))],
    /*
     * Veza sa porodicom: kartica „Spare parts" na stranici artikla vodi na `…?parentSku=CF…`. Sam
     * link se NE otvara (`robots.txt`: `Disallow: /*?`), ali njegov parametar je jedini zvanični
     * dokaz kojoj konfigurabilnoj porodici artikal pripada — naziv se za to ne nagađa.
     */
    parentSkus: [...new Set([...html.matchAll(/parentSku=(CF\d+)/g)].map((match) => match[1]))],
    numberOnPage: /product-detail-ordernumber"[^>]*>\s*([^<\s]+)/.exec(html)?.[1] ?? null,
    // Tehnički podaci, samo metrički prikaz; više redova sa istom etiketom je regularno.
    technicalData: [...(/id="tab-metric"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "").matchAll(/properties-label[^>]*>\s*([^<]+?)\s*<\/span>\s*<span class="(?:properties-value|unit-metric)"[^>]*>\s*([^<]+?)\s*<\/span>/g)].map((match) => ({ label: decode(match[1]), value: decode(match[2]) })),
    descriptionLength: decode((/product-detail-description-text"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().length,
    // Da li prodavnica nudi artikal (dugme za upit/korpu) — NE cena.
    offered: /inquire now|add to (shopping )?cart/i.test(main),
    unavailableNote: /no longer available|discontinued|not available/i.test(main),
  };
}

const todo = (limit ? sitemap.articles.slice(0, limit) : sitemap.articles).filter((entry) => !cache[entry.articleNumber]);
console.log(`artikala u sitemap-u: ${sitemap.articles.length} · u kešu: ${Object.keys(cache).length} · za preuzimanje: ${todo.length}`);

let done = 0;
mkdirSync(path.dirname(ARTICLE_CACHE), { recursive: true });
await mapLimit(todo, 5, async (entry) => {
  try {
    cache[entry.articleNumber] = await fetchArticle(entry);
  } catch (error) {
    cache[entry.articleNumber] = { articleNumber: entry.articleNumber, path: entry.path, error: String(error.message) };
  }
  done += 1;
  if (done % 100 === 0) {
    writeFileSync(ARTICLE_CACHE, JSON.stringify(cache));
    console.log(`  ${done}/${todo.length}`);
  }
});
writeFileSync(ARTICLE_CACHE, JSON.stringify(cache));

const articles = Object.values(cache).sort((a, b) => String(a.articleNumber).localeCompare(String(b.articleNumber), "en", { numeric: true }));
writeJson(PATHS.rawArticles, {
  meta: {
    source: `${base}/sitemap.xml`,
    articles: articles.length,
    failed: articles.filter((article) => article.error).length,
    withOptions: articles.filter((article) => article.options?.length).length,
    withParentId: articles.filter((article) => article.parentId).length,
    withOfficialCategory: articles.filter((article) => article.officialCategory?.length > 1).length,
    withImage: articles.filter((article) => article.ogImage || article.firstImage).length,
    note: "Cena se ne čita i ne čuva. Vrednosti osa dolaze iz og:title, ne iz switch endpointa.",
  },
  articles,
});
console.log(JSON.stringify(readJson(PATHS.rawArticles).meta, null, 1));
