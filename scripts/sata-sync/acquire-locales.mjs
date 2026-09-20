#!/usr/bin/env node
/**
 * SATA sync, korak 3 — REGIONALNA POKRIVENOST po sitemap-ovima lokala.
 *
 * `sata.com/en` je međunarodni katalog i nadskup: sadrži i artikle koji postoje samo za jedno
 * tržište (NIOSH respiratori, američki punjač, SATAjet 1500 B SoLV…). Proizvođač to ne označava na
 * stranici artikla — jedini zvanični dokaz je u kojim se lokalima artikal uopšte objavljuje.
 *
 * Evropska referenca su `de-de`, `en-gb` i `it-it`. Artikal iz `en` koga nema ni u jednom od njih
 * je `CURRENT_REGION_SPECIFIC` i ne ulazi u customer-facing opseg.
 *
 * Čitaju se samo sitemap-ovi (dozvoljeni u `robots.txt`); čuvaju se samo brojevi artikala.
 */

import { gunzipSync } from "node:zlib";

import { writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, SOURCES, USER_AGENT } from "./lib/config.mjs";

export const EUROPE_LOCALES = ["de-de", "en-gb", "it-it"];
export const OTHER_MARKET_LOCALES = ["en-us", "en-ca"];

async function get(url, binary = false) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}

async function localeArticles(locale) {
  const index = await get(`${SOURCES.website.origin}/${locale}/sitemap.xml`);
  const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const numbers = new Set();
  for (const part of parts) {
    const raw = await get(part, true);
    const xml = part.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    for (const match of xml.matchAll(/<loc>[^<]*\/(\d{2,8})<\/loc>/g)) numbers.add(match[1]);
  }
  return numbers;
}

const locales = [SOURCES.website.locale, ...EUROPE_LOCALES, ...OTHER_MARKET_LOCALES];
const sets = {};
for (const locale of locales) sets[locale] = await localeArticles(locale);

const reference = [...sets[SOURCES.website.locale]].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const inEurope = (number) => EUROPE_LOCALES.some((locale) => sets[locale].has(number));
const regionOnly = reference.filter((number) => !inEurope(number));

writeJson(PATHS.rawLocales, {
  meta: {
    reference: SOURCES.website.locale,
    europeLocales: EUROPE_LOCALES,
    otherMarketLocales: OTHER_MARKET_LOCALES,
    counts: Object.fromEntries(locales.map((locale) => [locale, sets[locale].size])),
    referenceInEurope: reference.length - regionOnly.length,
    referenceRegionOnly: regionOnly.length,
  },
  // Samo izuzeci: artikal iz `en` koga nema ni u jednom evropskom lokalu, i gde ga ima.
  regionOnly: regionOnly.map((number) => ({
    articleNumber: number,
    publishedIn: OTHER_MARKET_LOCALES.filter((locale) => sets[locale].has(number)),
  })),
});
console.log(JSON.stringify({ counts: Object.fromEntries(locales.map((l) => [l, sets[l].size])), regionOnly: regionOnly.length }, null, 1));
