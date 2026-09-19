#!/usr/bin/env node
/**
 * baslac sync, korak 1 — RAW dataset aktuelnog sajta (baslac.com/en-emea).
 *
 * Stranica kategorije je Drupal lista KARTICA. Jedna kartica nosi:
 *   `card-title`       — šifra(e), po potrebi skraćeno („20-24 /-34 /-94"), uz naziv,
 *   `card-subtitle`    — zvanični naziv/podnaslov,
 *   `card-description` — `<li>` stavke: ili OSOBINE, ili — kod grupnih kartica
 *                        („50- /55- /57- Hardeners") — po jedan PROIZVOD sa svojom šifrom,
 *   `card-media`       — zvanični packshot.
 *
 * Zato se čitaju kartice, ne redovi teksta: red je ranije gubio prvi znak naziva
 * („12-20 2K Universal Bodyfiller" → „K Universal…") i nije umeo da veže sliku za šifru.
 *
 * Slika se vezuje za šifru samo uz dokaz: šifra je u imenu zvaničnog fajla, ili kartica
 * ima tačno jednu šifru a ime fajla ne pominje nijednu drugu. Brojevi iz imena fajla
 * (`…_50206943.png`) su brojevi artikala i NE objavljuju se.
 *
 *   node scripts/baslac-sync/acquire-website.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, writeJson } from "../carsystem-sync/lib/http.mjs";
import { CATEGORY_PAGES, PAGE_CACHE_DIR, PATHS, SOURCES } from "./lib/config.mjs";
import { codesIn, decode, plain, stripLeadingCodes } from "./lib/website-text.mjs";

const refresh = process.argv.includes("--refresh");
const base = `${SOURCES.website.origin}/${SOURCES.website.locale}`;

const pages = [];
const products = new Map();
const imageAssignments = [];
for (const key of CATEGORY_PAGES) {
  const file = path.join(PAGE_CACHE_DIR, `${key}.html`);
  const { body } = await cachedFetch(`${base}/${key}`, file, { refresh });
  const html = body.toString("utf8");
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? html;
  const cards = [...main.matchAll(/<div class="card card-[\s\S]*?(?=<div class="card card-|<\/main>)/g)].map((match) => match[0]);

  for (const card of cards) {
    const title = plain(/class="card-title"\s*>([\s\S]*?)<\/p>/.exec(card)?.[1] ?? "");
    const subtitle = plain(/class="card-subtitle"\s*>([\s\S]*?)<\/p>/.exec(card)?.[1] ?? "");
    const bullets = [...card.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => plain(match[1])).filter(Boolean);
    const cardCodes = codesIn(title);
    // Samo GRUPNA kartica (naslov bez šifre) nabraja proizvode; u kartici proizvoda je
    // stavka sa šifrom osobina/kombinacija („Hardener 55-10 EP", „60-20/-30 Normal/Slow").
    const listed = cardCodes.length ? [] : bullets.filter((bullet) => /^\d{2}-[A-Z]?\d{2,3}\b/.test(bullet));
    const features = bullets.filter((bullet) => !listed.includes(bullet));
    const rawImage = /<img\s+src="([^"]+)"/.exec(card)?.[1];
    const image = rawImage ? decode(rawImage).replace(/\/styles\/[^/]+\/public\//, "/").replace(/\.webp(\?.*)?$|\?.*$/, "") : null;
    const imageFile = image ? decodeURIComponent(image.split("/").pop()) : "";
    const imageCodes = codesIn(imageFile.replace(/_/g, " "));

    const record = (code) => {
      const entry = products.get(code) ?? { code, page: key, name: null, subtitle: null, features: [], listedOn: [], images: [] };
      entry.listedOn = [...new Set([...entry.listedOn, key])];
      products.set(code, entry);
      return entry;
    };

    // Grupna kartica: svaka stavka liste je zaseban proizvod sa svojom zvaničnom šifrom.
    for (const bullet of listed) {
      const [code] = codesIn(bullet);
      const entry = record(code);
      entry.name ??= stripLeadingCodes(bullet) || null;
      entry.groupCard = title;
    }
    // Kartica proizvoda: naziv iz naslova bez šifre, pa podnaslov; osobine važe za sve njene šifre.
    for (const code of cardCodes) {
      const entry = record(code);
      const fromTitle = stripLeadingCodes(title);
      entry.name ??= fromTitle || subtitle || null;
      entry.subtitle ??= subtitle || null;
      for (const feature of features) if (!entry.features.includes(feature)) entry.features.push(feature);
    }

    if (!image) continue;
    const owners = imageCodes.length ? imageCodes : cardCodes.length === 1 ? cardCodes : [];
    for (const code of owners) {
      if (!products.has(code)) continue;
      const entry = products.get(code);
      if (!entry.images.includes(image)) entry.images.push(image);
      imageAssignments.push({ code, page: key, file: imageFile, evidence: imageCodes.includes(code) ? "šifra u imenu zvaničnog fajla" : "kartica sa jednom šifrom" });
    }
    if (!owners.length && (cardCodes.length || listed.length)) imageAssignments.push({ code: null, page: key, file: imageFile, evidence: "grupna kartica bez šifre u imenu fajla — slika se ne vezuje" });
  }

  pages.push({
    key,
    url: `${base}/${key}`,
    cards: cards.length,
    productCards: cards.filter((card) => codesIn(plain(/class="card-title"\s*>([\s\S]*?)<\/p>/.exec(card)?.[1] ?? "")).length).length,
    tdsLinks: [...new Set([...main.matchAll(/href="(https?:\/\/techinfo\.baslac\.com[^"]+)"/g)].map((match) => decode(match[1])))],
    fetchedAt: statSync(file).mtime.toISOString(),
  });
}

const list = [...products.values()].sort((a, b) => a.code.localeCompare(b.code));
writeJson(PATHS.rawWebsite, {
  meta: {
    source: base,
    architecture: "Drupal kartice; kartica = šifra(e) + naziv + osobine + packshot; grupna kartica nabraja proizvode u `<li>`",
    crawledAt: pages.map((page) => page.fetchedAt).sort()[0] ?? null,
    pages: pages.length,
    codes: list.length,
    withName: list.filter((entry) => entry.name).length,
    withImage: list.filter((entry) => entry.images.length).length,
    byPage: Object.fromEntries(CATEGORY_PAGES.map((key) => [key, list.filter((entry) => entry.listedOn.includes(key)).length])),
    imageRule: "slika se vezuje samo uz dokaz; brojevi artikala iz imena fajla se ne objavljuju",
  },
  pages,
  imageAssignments,
  products: list,
});
console.log(`website: ${pages.length} stranica · ${list.length} šifara (${list.filter((entry) => entry.name).length} sa nazivom, ${list.filter((entry) => entry.images.length).length} sa zvaničnom slikom)`);
