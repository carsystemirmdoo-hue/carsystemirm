#!/usr/bin/env node
/**
 * Norbin sync, korak 1 — RAW dataset aktuelnog sajta (`norbin-paint.com`).
 *
 * Stranica opsega je katalog. Gramatika je ista u svim regionima:
 *
 *   <h3>Downloads</h3>  brošura, tehnički poster
 *   <h4>TDS</h4>        jedan link po PROIZVODU — „NORBIN® N15-020 Clear"
 *   <h4>MSDS</h4>       jedan link po PAKOVANJU — „… N15-020 Clear 1L"
 *
 * Dva stanja izvora se beleže, ne zaglađuju:
 *   1. ponuda se razlikuje po regionu (proizvođač to i piše);
 *   2. deo linkova je ZAKOMENTARISAN u HTML-u — proizvođač ih je namerno sklonio,
 *      pa se vode kao `unlinked-in-source` i nikad ne ulaze u aktuelnu ponudu.
 *
 *   node scripts/norbin-sync/acquire-website.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PAGE_CACHE_DIR, PATHS, REGIONS, SOURCES } from "./lib/config.mjs";
import { codesIn, decode, plain } from "./lib/website-text.mjs";

const refresh = process.argv.includes("--refresh");

/** Pakovanje iz teksta MSDS linka: „… Clear 1L", „… 0,5L", „… 2.5 L", „… 25 KG". */
const PACK = /(\d+(?:[.,]\d+)?)\s*(L|KG|ML)\b/i;

const pages = [];
const byCode = new Map();
const documents = [];

for (const region of REGIONS) {
  const url = `${SOURCES.website.origin}/${region}/${SOURCES.website.page}`;
  const file = path.join(PAGE_CACHE_DIR, `${region}.html`);
  let html;
  try {
    ({ body: html } = await cachedFetch(url, file, { refresh }));
    html = html.toString("utf8");
  } catch (error) {
    pages.push({ region, url, published: false, error: String(error.message) });
    continue;
  }

  // Neobjavljen region: cela stranica je čuvar mesta („Inhalte ME/DE/PL").
  const body = plain(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""));
  const placeholder = /\bInhalte\s+(ME|DE|PL)\b/i.exec(body)?.[0] ?? null;

  /*
   * Zakomentarisani linkovi se čitaju odvojeno: proizvođač ih je sklonio sa stranice,
   * pa fajl postoji, ali ponuda ga ne sadrži.
   */
  const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map((match) => match[0]).join("\n");
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");

  const sections = [...stripped.matchAll(/<h([34])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[34][^>]*>|<\/body>)/gi)];
  // Deo linkova nosi upitni token (`…grey.pdf?asdb213ffe`) — bez njega se taj proizvod gubi.
  const linksIn = (fragment, linked) =>
    [...String(fragment).matchAll(/<a[^>]+href="([^"]+\.pdf(?:\?[^"]*)?)"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
      href: new URL(decode(match[1]), `${SOURCES.website.origin}/${region}/`).href,
      label: plain(match[2]),
      linked,
    }));

  const found = [];
  for (const [, , rawTitle, fragment] of sections) {
    const title = plain(rawTitle).toUpperCase();
    const kind = title.startsWith("TDS") ? "tds" : title.startsWith("MSDS") ? "sds" : title.startsWith("DOWNLOADS") ? "download" : null;
    if (!kind) continue;
    for (const link of linksIn(fragment, true)) found.push({ ...link, kind });
  }
  // Zakomentarisani blok nema sekcije — vrsta se izvodi iz putanje fajla.
  for (const link of linksIn(comments, false)) found.push({ ...link, kind: /\/TDS\//i.test(link.href) ? "tds" : /MSDS/i.test(link.href) ? "sds" : "download" });

  for (const entry of found) {
    const codes = codesIn(`${entry.label} ${decodeURIComponent(entry.href.split("/").pop())}`);
    const pack = PACK.exec(entry.label);
    const document = {
      region,
      kind: entry.kind,
      href: entry.href,
      file: decodeURIComponent(entry.href.split("/").pop().split("?")[0]),
      tokenizedUrl: entry.href.includes("?"),
      label: entry.label,
      codes,
      availability: entry.linked ? "live" : "unlinked-in-source",
      pack: pack ? `${pack[1].replace(".", ",")} ${pack[2].toUpperCase().replace("KG", "kg").replace("ML", "ml")}` : null,
    };
    documents.push(document);

    for (const code of codes) {
      const record = byCode.get(code) ?? { code, names: {}, namesFromSds: {}, regions: new Set(), liveRegions: new Set(), packs: new Set(), documents: [] };
      record.regions.add(region);
      if (entry.linked) record.liveRegions.add(region);
      /*
       * Zvanični naziv piše u TEKSTU linka. TDS link nosi naziv proizvoda, MSDS link isti
       * naziv plus pakovanje — pa se za proizvode bez tehničkog lista (učvršćivači,
       * razređivač) naziv čita iz MSDS linka, sa odsečenim pakovanjem na kraju.
       */
      if (entry.linked) {
        const label = entry.label.replace(/^NORBIN\s*®?\s*/i, "").trim();
        const name = document.kind === "sds" ? label.replace(/\s*\d+(?:[.,]\d+)?\s*(L|KG|ML)\s*$/i, "").trim() : label;
        if (document.kind === "tds") record.names[region] = name;
        else if (!record.names[region]) record.namesFromSds = { ...(record.namesFromSds ?? {}), [region]: name };
      }
      if (document.pack) record.packs.add(document.pack);
      record.documents.push({ region, kind: document.kind, href: document.href, file: document.file, availability: document.availability, pack: document.pack, tokenizedUrl: document.tokenizedUrl, label: document.label });
      byCode.set(code, record);
    }
  }

  pages.push({
    region,
    url,
    published: !placeholder,
    placeholder,
    fetchedAt: statSync(file).mtime.toISOString(),
    links: { live: found.filter((entry) => entry.linked).length, unlinked: found.filter((entry) => !entry.linked).length },
    codes: [...new Set(found.flatMap((entry) => codesIn(`${entry.label} ${entry.href}`)))].length,
  });
}

const products = [...byCode.values()]
  .map((record) => ({
    code: record.code,
    names: record.names,
    namesFromSds: record.namesFromSds ?? {},
    regions: [...record.regions].sort(),
    liveRegions: [...record.liveRegions].sort(),
    packs: [...record.packs].sort(),
    documents: record.documents,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

writeJson(PATHS.rawWebsite, {
  meta: {
    source: SOURCES.website.origin,
    architecture: "statički HTML, jedna norbin-range.html po regionu; nema CMS-a, robots.txt, sitemap.xml ni stranica proizvoda",
    crawledAt: pages.map((page) => page.fetchedAt).filter(Boolean).sort()[0] ?? null,
    regions: pages.map((page) => ({ region: page.region, published: page.published, placeholder: page.placeholder, links: page.links, codes: page.codes })),
    documents: documents.length,
    live: documents.filter((document) => document.availability === "live").length,
    unlinkedInSource: documents.filter((document) => document.availability !== "live").length,
    byKind: Object.fromEntries(["tds", "sds", "download"].map((kind) => [kind, documents.filter((document) => document.kind === kind).length])),
    codes: products.length,
    codesLiveSomewhere: products.filter((product) => product.liveRegions.length).length,
    note: "Branding na izvoru je i dalje BASF Coatings GmbH; brend se ne preimenuje u Surventis.",
  },
  pages,
  products,
  documents,
});

console.log(JSON.stringify({ ...JSON.parse(JSON.stringify(pages)).reduce((a) => a, {}), meta: undefined } && {
  regioni: pages.map((page) => `${page.region}${page.published ? "" : " (neobjavljen)"}: ${page.links?.live ?? 0} live / ${page.links?.unlinked ?? 0} skriveno`),
  dokumenata: documents.length,
  sifara: products.length,
  sifaraUzivo: products.filter((product) => product.liveRegions.length).length,
}, null, 1));
