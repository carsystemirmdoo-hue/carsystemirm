/*
 * Release candidate 2026-10: tehnički prevodi iz TDS-a (GAP-009), tri ispravke
 * parsiranja, preimenovana adresa `carfit-clearcoar-matt` → `carfit-clearcoat-matt`.
 *
 *   npm run test:content-copy
 *   npm run build && CONTENT_CHECK_HTML=1 npm run test:content-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import sitemapModule from "@/app/sitemap";
import { getAllCarsystemProducts, getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { getProductSearchIndex } from "@/lib/search/buildSearchIndex";
import { buildSearchIndex, searchIndex } from "@/lib/search/engine.mjs";
import nextConfigModule from "@/next.config";

// tsx/ESM interop: podrazumevani izvoz TS modula može stići umotan u `default`.
const unwrap = <T,>(module: T): T => ((module as { default?: T }).default ?? module);
const sitemap = unwrap(sitemapModule);
const nextConfig = unwrap(nextConfigModule);

type Rule = { field: string; original: string; value: string; kind: string; tds: { url: string; page: number; section?: string } };

const BRANDS = ["norbin", "baslac", "rm"] as const;
const rulesByBrand = Object.fromEntries(
  BRANDS.map((brand) => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(`data/${brand}-sync/technical-localization.json`), "utf8")) as Record<string, Rule[] | string[]>;
    const rules = Object.entries(raw)
      .filter(([code]) => !code.startsWith("_"))
      .flatMap(([code, list]) => (list as Rule[]).map((rule) => ({ code, ...rule })));
    return [brand, rules];
  }),
) as Record<(typeof BRANDS)[number], (Rule & { code: string })[]>;
const allRules = BRANDS.flatMap((brand) => rulesByBrand[brand]);

/** Polja koja ne idu na stranicu (interna beleška, provenance prevoda). */
const INTERNAL_KEYS = new Set(["internalReason", "reviewerNote", "recommendations", "evidence", "technicalLocalization"]);
function visibleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(visibleText).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !INTERNAL_KEYS.has(key))
      .map(([, v]) => visibleText(v))
      .join("\n");
  }
  return "";
}
const allVisible = getAllCarsystemProducts().map((product) => ({ slug: product.slug, text: visibleText(product) }));

const technicalFacts = (slug: string) =>
  (getCarsystemProductBySlug(slug)?.detail?.technicalFacts?.content ?? []).map((fact) => `${fact.label}: ${fact.value}`);

/* -- GAP-009: prevodi -------------------------------------------------------------------- */

test("tabela prevoda: 20 iskaza (17 odobrenih + 3 dopunska), svaka sa TDS izvorom, originalom i srpskim tekstom", () => {
  assert.equal(allRules.length, 29, "broj pravila (po šifri) se promenio — ažurirati test i izveštaj");
  const distinct = new Set(allRules.map((rule) => rule.original));
  assert.equal(distinct.size, 20, "broj različitih originalnih iskaza");
  for (const rule of allRules) {
    assert.match(rule.tds.url, /^https:\/\/(www\.norbin-paint\.com|techinfo\.baslac\.com|techinfo\.rmpaint\.com)\//, `${rule.code}: TDS URL`);
    assert.ok(rule.tds.page >= 1, `${rule.code}: strana TDS-a`);
    assert.notEqual(rule.value, rule.original);
  }
});

test("generisani katalog nosi srpsku vrednost, a original i TDS ostaju u provenance-u", () => {
  for (const brand of BRANDS) {
    const dataset = JSON.parse(fs.readFileSync(path.resolve(`data/${brand}-catalog-products.generated.json`), "utf8"));
    const records = [...dataset.products, ...Object.values(dataset.enrichments)] as { code: string; technical: Record<string, unknown>; technicalLocalization?: Rule[] }[];
    for (const rule of rulesByBrand[brand]) {
      const own = records.filter((record) => record.code === rule.code);
      assert.ok(own.length, `${brand} ${rule.code}: zapis ne postoji`);
      for (const record of own) {
        const serialized = JSON.stringify(record.technical);
        assert.ok(serialized.includes(JSON.stringify(rule.value).slice(1, -1)), `${brand} ${rule.code}: nema srpske vrednosti`);
        assert.ok(!serialized.includes(JSON.stringify(rule.original).slice(1, -1)), `${brand} ${rule.code}: original je i dalje vrednost`);
        assert.ok(
          record.technicalLocalization?.some((item) => item.original === rule.original && item.value === rule.value && item.tds.url === rule.tds.url),
          `${brand} ${rule.code}: provenance nema original i TDS`,
        );
      }
    }
  }
});

test("nijedan stari engleski iskaz nije vidljiv ni na jednom proizvodu", () => {
  const offenders = allVisible.flatMap(({ slug, text }) =>
    allRules.filter((rule) => text.includes(rule.original)).map((rule) => `${slug}: ${rule.original}`));
  assert.deepEqual([...new Set(offenders)], []);
  for (const rule of allRules) {
    assert.ok(allVisible.some(({ text }) => text.includes(rule.value)), `„${rule.value}" nije vidljivo ni na jednom proizvodu`);
  }
});

/* -- Tri ispravke parsiranja ------------------------------------------------------------- */

test("baslac 40-10: sušenje 4 h i suvo na prašinu 2 h — dve vrednosti, ne „4 h dust-free\"", () => {
  const drying = technicalFacts("baslac-40-10-2k-panel-clear").find((fact) => fact.startsWith("Sušenje"));
  assert.ok(drying?.includes("20°C: 4 h · suvo na prašinu posle 2 h"), drying);
  assert.ok(!drying?.includes("dust-free"));
});

test("R-M P 5540: oba odnosa iz TDS-a, bez dupliranog 100:25:25", () => {
  // Prvi red je kratak srpski zapis iz lokalizacije („100:25:25"), drugi je pun iskaz iz lista.
  const ratios = technicalFacts("rm-p-5540-ghd-protect-primer-filler").filter((fact) => fact.startsWith("Odnos mešanja"));
  assert.ok(ratios.includes("Odnos mešanja: 100:25:25 zapreminski, mokro na mokro · 100:20:20 zapreminski, za brušenje"), ratios.join(" | "));
  assert.ok(!ratios.some((fact) => fact.includes("100:25:25 100:25:25")));
});

test("R-M C 2A40: odnos 1:1 + 20% bez naslova sledećeg odeljka", () => {
  const ratio = technicalFacts("c-2a40-airtop").find((fact) => fact.startsWith("Odnos mešanja"));
  assert.equal(ratio, "Odnos mešanja: 1:1 + 20% zapreminski (lak : učvršćivač + razređivač)");
});

test("ispravke parsiranja su označene i ograničene na tri proizvoda", () => {
  const corrections = allRules.filter((rule) => rule.kind === "parser-correction").map((rule) => rule.code).sort();
  assert.deepEqual(corrections, ["40-10", "C 2A40", "P 5540"]);
});

/* -- carfit-clearcoar-matt → carfit-clearcoat-matt --------------------------------------- */

const OLD = "/proizvodi/carfit-clearcoar-matt";
const NEW = "/proizvodi/carfit-clearcoat-matt";

test("Car Fit Clearcoat matt živi na novoj adresi, stara ne postoji kao zapis", () => {
  assert.ok(getCarsystemProductBySlug("carfit-clearcoat-matt"));
  assert.equal(getCarsystemProductBySlug("carfit-clearcoar-matt"), undefined);
  assert.ok(!getAllCarsystemProducts().some((product) => product.slug.includes("clearcoar")));
});

test("stara adresa trajno preusmerava na novu, bez lanca i bez petlje", async () => {
  const redirects = (await nextConfig.redirects?.()) ?? [];
  const own = redirects.filter((rule) => rule.source === OLD);
  assert.equal(own.length, 1);
  assert.equal(own[0].destination, NEW);
  assert.equal(own[0].permanent, true);
  assert.ok(!redirects.some((rule) => rule.source === NEW), "nova adresa ne sme dalje da preusmerava");
  for (const rule of redirects) assert.notEqual(rule.source, rule.destination, `petlja: ${rule.source}`);
  const sources = new Set(redirects.map((rule) => rule.source));
  const chains = redirects.filter((rule) => sources.has(rule.destination.split("?")[0]));
  assert.deepEqual(chains.map((rule) => `${rule.source} → ${rule.destination}`), [], "lanac preusmerenja");
});

test("sitemap sadrži novu, a ne staru adresu", () => {
  const urls = sitemap().map((entry) => new URL(entry.url).pathname);
  assert.ok(urls.includes(NEW));
  assert.ok(!urls.some((url) => url.includes("clearcoar")));
});

test("pretraga vraća novu adresu", () => {
  const { records } = getProductSearchIndex();
  assert.ok(records.some((record) => record.href === NEW || record.href.startsWith(`${NEW}?`)));
  assert.ok(!records.some((record) => record.href.includes("clearcoar")));
  const hits = searchIndex(buildSearchIndex(records), "clearcoat matt", { limit: 5 });
  assert.ok(hits.some((hit: { record: { href: string } }) => hit.record.href.startsWith(NEW)), "„clearcoat matt\" ne nalazi proizvod");
});

/* -- Renderovan HTML (posle builda) ------------------------------------------------------ */

const appDir = path.resolve(process.cwd(), process.env.NEXT_DIST_DIR || ".next", "server/app");
const htmlSkip =
  process.env.CONTENT_CHECK_HTML !== "1"
    ? "postavite CONTENT_CHECK_HTML=1 posle builda"
    : fs.existsSync(appDir)
      ? false
      : `nema builda u ${appDir}`;

function decode(text: string) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
}
const visibleHtml = (file: string) => decode(fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " "));
function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(full) : entry.name.endsWith(".html") ? [full] : [];
  });
}

test("vidljiv HTML: nijedan stari engleski TDS iskaz, nijedna stara pogrešna vrednost", { skip: htmlSkip }, () => {
  const files = htmlFiles(path.join(appDir, "proizvodi"));
  const bad = [...new Set(allRules.map((rule) => rule.original)), "4 h dust-free", "100:25:25 100:25:25", "Clear coat Preparation", "Possibility to speed up"];
  const offenders: string[] = [];
  for (const file of files) {
    const text = visibleHtml(file);
    for (const phrase of bad) if (text.includes(phrase)) offenders.push(`${path.relative(appDir, file)}: ${phrase}`);
  }
  assert.deepEqual(offenders, []);
  const page = (slug: string) => visibleHtml(path.join(appDir, "proizvodi", `${slug}.html`));
  assert.ok(page("baslac-40-10-2k-panel-clear").includes("suvo na prašinu posle 2 h"));
  assert.ok(page("rm-p-5540-ghd-protect-primer-filler").includes("100:20:20 zapreminski, za brušenje"));
  assert.ok(page("c-2a40-airtop").includes("1:1 + 20% zapreminski"));
  assert.ok(page("norbin-n15-v20-clear-voc").includes("Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm."));
});

test("HTML: nova Clearcoat matt adresa ima sopstveni canonical, stara nema stranu, sitemap.xml je ažuran", { skip: htmlSkip }, () => {
  const html = fs.readFileSync(path.join(appDir, "proizvodi", "carfit-clearcoat-matt.html"), "utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/proizvodi\/carfit-clearcoat-matt"/);
  assert.ok(!fs.existsSync(path.join(appDir, "proizvodi", "carfit-clearcoar-matt.html")));
  const xml = fs.readFileSync(path.join(appDir, "sitemap.xml.body"), "utf8");
  assert.ok(xml.includes("/proizvodi/carfit-clearcoat-matt<"));
  assert.ok(!xml.includes("clearcoar"));
});

test("HTML: nijedan interni link ka /proizvodi ne vodi u prazno ni na staru adresu", { skip: htmlSkip }, async () => {
  const redirects = (await nextConfig.redirects?.()) ?? [];
  const matchers = redirects.map((rule) => new RegExp(`^${rule.source.replace(/:(\w+)\(([^)]+)\)/g, "($2)").replace(/:\w+\*/g, ".*").replace(/:\w+/g, "[^/]+")}$`));
  const broken = new Set<string>();
  for (const file of htmlFiles(appDir)) {
    const html = fs.readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(/href="(\/proizvodi\/[^"?#]+)/g)) {
      if (href.includes("clearcoar")) broken.add(`${path.relative(appDir, file)} → ${href}`);
      const exists = fs.existsSync(path.join(appDir, `${href}.html`));
      if (!exists && !matchers.some((matcher) => matcher.test(href))) broken.add(`${path.relative(appDir, file)} → ${href}`);
    }
  }
  assert.deepEqual([...broken].slice(0, 20), []);
});
