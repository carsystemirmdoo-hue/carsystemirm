#!/usr/bin/env node
/**
 * SATA sync, korak 1 — sitemap + kategorije + PORODICE (`CF…`).
 *
 * Kategorija nabraja pločice porodica; svaka pločica vodi na `/en/<slug>/CF<id>`. Stranica
 * porodice nosi zvanični naziv, slogan, podrazumevani broj artikla, OSE izbora i njihove
 * opcije, tabove „Technical data / Downloads / Spare parts", slike i dokumenta.
 *
 *   node scripts/sata-sync/acquire-families.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { cachedFetch, mapLimit, writeJson } from "../carsystem-sync/lib/http.mjs";
import { CATEGORY_PAGES, PAGE_CACHE_DIR, PATHS, SOURCES } from "./lib/config.mjs";
import { parseConfigurator } from "./lib/configurator.mjs";

const refresh = process.argv.includes("--refresh");
const base = `${SOURCES.website.origin}/${SOURCES.website.locale}`;

const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&reg;/g, "®").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const plain = (html) => decode(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const mainOf = (html) => /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? html;

/* -- 1. Sitemap --------------------------------------------------------------------------- */

const indexFile = path.join(PAGE_CACHE_DIR, "sitemap-index.xml");
const { body: indexBody } = await cachedFetch(`${base}/sitemap.xml`, indexFile, { refresh });
const parts = [...indexBody.toString("utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const urls = [];
for (const [index, part] of parts.entries()) {
  const file = path.join(PAGE_CACHE_DIR, `sitemap-${index}.xml.gz`);
  const { body } = await cachedFetch(part, file, { refresh });
  const xml = part.endsWith(".gz") ? gunzipSync(body).toString("utf8") : body.toString("utf8");
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1]);
}
const pathOf = (url) => url.replace(`${base}/`, "").replace(/\/$/, "");
const articleUrls = urls.filter((url) => /\/[0-9]{3,8}\/?$/.test(url));
const familyUrlsInSitemap = urls.filter((url) => /\/CF[0-9]+\/?$/.test(url));

writeJson(PATHS.rawSitemap, {
  meta: { source: `${base}/sitemap.xml`, fetchedAt: statSync(indexFile).mtime.toISOString(), urls: urls.length, articles: articleUrls.length, familiesInSitemap: familyUrlsInSitemap.length },
  articles: articleUrls.map((url) => ({ path: pathOf(url), articleNumber: /\/([0-9]{3,8})\/?$/.exec(url)[1] })).sort((a, b) => a.articleNumber.localeCompare(b.articleNumber, "en", { numeric: true })),
});

/* -- 2. Kategorije → pločice porodica ----------------------------------------------------- */

const familyRefs = new Map();
const categories = [];
for (const key of CATEGORY_PAGES) {
  const file = path.join(PAGE_CACHE_DIR, `category-${key.replace(/\//g, "__")}.html`);
  let html;
  try {
    ({ body: html } = await cachedFetch(`${base}/${key}/`, file, { refresh }));
  } catch (error) {
    categories.push({ key, error: String(error.message) });
    continue;
  }
  const main = mainOf(html.toString("utf8"));
  const tiles = [...main.matchAll(/<a[^>]+href="([^"]*\/(CF[0-9]+))\/?"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({ href: match[1], id: match[2], label: plain(match[3]) }));
  const articleTiles = [...new Set([...main.matchAll(/href="https:\/\/www\.sata\.com\/en\/[^"#?]+\/([0-9]{3,8})\/?"/g)].map((match) => match[1]))];
  for (const tile of tiles) {
    const entry = familyRefs.get(tile.id) ?? { id: tile.id, href: tile.href.startsWith("http") ? tile.href : `${SOURCES.website.origin}${tile.href}`, labels: new Set(), categories: new Set() };
    if (tile.label && tile.label.length < 90) entry.labels.add(tile.label);
    entry.categories.add(key);
    familyRefs.set(tile.id, entry);
  }
  categories.push({ key, families: new Set(tiles.map((tile) => tile.id)).size, directArticles: articleTiles.length });
}
for (const url of familyUrlsInSitemap) {
  const id = /\/(CF[0-9]+)\/?$/.exec(url)[1];
  if (!familyRefs.has(id)) familyRefs.set(id, { id, href: url, labels: new Set(), categories: new Set(["(samo sitemap)"]) });
}

/* -- 3. Stranice porodica ----------------------------------------------------------------- */

const refs = [...familyRefs.values()].sort((a, b) => a.id.localeCompare(b.id));
const families = await mapLimit(refs, 3, async (ref) => {
  const file = path.join(PAGE_CACHE_DIR, `family-${ref.id}.html`);
  try {
    const { body } = await cachedFetch(ref.href, file, { refresh });
    const html = body.toString("utf8");
    const main = mainOf(html);
    const text = main.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").split("\n").map((line) => decode(line).trim()).filter((line) => line.length > 1);

    const productNumberAt = text.findIndex((line) => /^Product number:?$/i.test(line));
    const defaultArticle = productNumberAt >= 0 ? text[productNumberAt + 1] : null;
    const defaultArticleName = productNumberAt >= 0 ? text[productNumberAt + 2] ?? null : null;

    /*
     * Ose izbora se čitaju iz samog konfiguratora (`lib/configurator.mjs`), ne iz teksta stranice:
     * `combinable: false` znači da ta vrednost uz podrazumevani izbor ne postoji kao artikal.
     * Pun prostor kombinacija daju tek stranice artikala, preko istog `parentId`.
     */
    const configurator = parseConfigurator(main);
    const axes = configurator.axes.map((axis) => ({
      name: axis.name,
      options: axis.options.map((option) => ({ value: option.value, available: option.combinable })),
    }));

    const h1 = plain(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main)?.[1] ?? "");
    const downloads = [...new Set([...main.matchAll(/href="([^"]+\.pdf(?:\.pdf)?(?:\?[^"]*)?)"/gi)].map((match) => decode(match[1])))];
    const images = [...new Set([...main.matchAll(/(https:\/\/www\.sata\.com\/media\/[^"?\s)]+\.(?:png|jpe?g|webp))/gi)].map((match) => match[1]))];
    const ogImage = /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/.exec(html)?.[1] || null;

    return {
      id: ref.id,
      url: ref.href,
      /*
       * Ime PORODICE je natpis pločice u kategoriji („jet X", „SATAjet 100 B"). `<h1>` stranice
       * je ime podrazumevanog ARTIKLA („Premium filler spray gun … nozzle 1.4 …") i zato nije
       * identitet porodice.
       */
      officialName: [...ref.labels].sort((a, b) => a.length - b.length)[0] || h1 || null,
      defaultArticleHeading: h1 || null,
      tileLabels: [...ref.labels],
      /*
       * Primarna kategorija je PRVA po redosledu `CATEGORY_PAGES`. Stranica čaša (LCS/RPS)
       * prikazuje i pištolje uz koje čaša ide — to je kompatibilnost, ne pripadnost.
       */
      primaryCategory: CATEGORY_PAGES.find((key) => ref.categories.has(key)) ?? [...ref.categories][0] ?? null,
      categories: [...ref.categories].sort(),
      tagline: text[1] && text[1] !== h1 && !/^Product number/i.test(text[1]) ? text[1] : null,
      defaultArticle,
      defaultArticleName,
      parentId: configurator.parentId,
      // Zvanični opis porodice — jedini ulaz za srpski sadržaj (uz naziv i tehničke podatke artikala).
      officialDescription: plain(/product-detail-description-text"[^>]*>([\s\S]*?)<\/div>/.exec(main)?.[1] ?? ""),
      axes,
      configurable: axes.length > 0,
      tabs: ["Description", "Technical data", "Downloads", "Spare parts"].filter((tab) => text.includes(tab)),
      downloads,
      images: { og: ogImage, count: images.length, gallery: images.filter((src) => !/banner|card-slider|icon|logo/i.test(src)).slice(0, 8), marketing: images.filter((src) => /banner|card-slider/i.test(src)).length },
      fetchedAt: statSync(file).mtime.toISOString(),
    };
  } catch (error) {
    return { id: ref.id, url: ref.href, error: String(error.message), categories: [...ref.categories] };
  }
});

writeJson(PATHS.rawFamilies, {
  meta: {
    source: base,
    categories: categories.length,
    families: families.length,
    failed: families.filter((family) => family.error).map((family) => family.id),
    configurable: families.filter((family) => family.configurable).length,
    note: "Broj artikla je konfiguracija porodice; ose izbora se čitaju sa stranice porodice. `robots.txt` zabranjuje upitne stringove, pa se `switch` endpoint ne koristi.",
  },
  categories,
  families,
});

console.log(JSON.stringify({ sitemapUrls: urls.length, articlePages: articleUrls.length, categories: categories.map((category) => `${category.key}: ${category.families ?? "greška"} porodica / ${category.directArticles ?? 0} artikala`), families: families.length, configurable: families.filter((family) => family.configurable).length, failed: families.filter((family) => family.error).length }, null, 1));
