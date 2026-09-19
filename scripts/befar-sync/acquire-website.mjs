#!/usr/bin/env node
/**
 * BEFAR sync, korak 1 — RAW dataset zvaničnog sajta (en.befar.com.tr + befar.com.tr).
 *
 * Lista stranica se ne sastavlja ručno: čita se `pages-sitemap.xml` oba jezika.
 * Sajt NEMA stranice pojedinačnih proizvoda — proizvodi su blokovi na stranicama
 * kategorija, pa je jedinica RAW dataseta BLOK (naslov + tabela šifara + slike +
 * logo linije), a ne stranica.
 *
 * Turska verzija služi kao kontrola parsera i kao drugi zvanični svedok: skup
 * šifara po stranici mora biti isti u oba jezika. Blok se između jezika uparuje
 * po skupu šifara, pa se čuva i turski naziv.
 *
 * Izlaz: data/befar-sync/raw/website.generated.json (samo činjenice sa sajta).
 *
 *   node scripts/befar-sync/acquire-website.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PAGE_CACHE_DIR, PATHS, WEBSITE } from "./lib/config.mjs";
import { CODE, clean, parseWixPage } from "./lib/wix.mjs";

const refresh = process.argv.includes("--refresh");

/** Wix putanje sadrže turska slova; URL se kodira, a ključ stranice ostaje čitljiv. */
const encodeUrl = (url) => {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname.split("/").map((part) => encodeURIComponent(decodeURIComponent(part))).join("/")}`;
};
const pageKey = (url) => decodeURIComponent(new URL(url).pathname).replace(/^\/|\/$/g, "") || "home";

async function loadLanguage(language) {
  const { sitemap } = WEBSITE[language];
  const { body } = await cachedFetch(sitemap, path.join(PAGE_CACHE_DIR, `${language}__sitemap.xml`), { refresh });
  const urls = [...body.toString("utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()).sort();
  const pages = await mapLimit(urls, 3, async (url) => {
    const key = pageKey(url);
    const file = path.join(PAGE_CACHE_DIR, `${language}__${key.replace(/\//g, "_")}.html`);
    try {
      const { body: html } = await cachedFetch(encodeUrl(url), file, { refresh });
      return { key, url, httpStatus: 200, html: html.toString("utf8"), fetchedAt: statSync(file).mtime.toISOString() };
    } catch (error) {
      return { key, url, httpStatus: Number(/HTTP (\d+)/.exec(String(error.message))?.[1] ?? 0), html: "", fetchedAt: null };
    }
  });
  return pages;
}

const [pagesEn, pagesTr] = [await loadLanguage("en"), await loadLanguage("tr")];
const crawledAt = pagesEn.map((page) => page.fetchedAt).filter(Boolean).sort()[0] ?? null;

/* -- Navigacija: zvanični naziv kategorije za svaku stranicu ------------------------------- */

const navLabels = new Map();
const home = pagesEn.find((page) => page.key === "home");
for (const match of (home?.html ?? "").matchAll(/<a\b[^>]*href="https?:\/\/en\.befar\.com\.tr\/([^"#?]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
  const key = decodeURIComponent(match[1]).replace(/\/$/, "") || "home";
  const label = clean(match[2]);
  if (label && !navLabels.has(key)) navLabels.set(key, label);
}

/* -- Linija proizvoda iz logotipa bloka --------------------------------------------------- */

/**
 * Svaki blok nosi mali logo linije (≤ 100 px visine). Befar sam tako označava
 * kojoj liniji proizvod pripada; Leo i Turkuaz su LINIJE brenda Befar, ne zasebni
 * proizvođači (isti sajt, isti katalog, iste serije šifara).
 */
const isLogo = (image) => image.source === "photo" && (image.displayHeight ?? 999) <= 100 && (image.displayWidth ?? 999) <= 280;

function lineName(logo) {
  const name = `${logo?.alt ?? ""} ${logo?.fileName ?? ""}`.toLowerCase();
  if (/leo/.test(name)) return "Leo";
  if (/plus/.test(name)) return "Befar Plus";
  if (/turkuaz|turquaz|turquoise/.test(name)) return "Turkuaz";
  if (/opencell/.test(name)) return "Opencell";
  if (/befar/.test(name)) return "Befar";
  return null;
}

/** Blok ume da nosi DVA logotipa (Befar + Befar Plus): ista porodica, boje iz obe linije. Prva je matična. */
function lineOf(images) {
  const logos = images.filter(isLogo);
  const lines = [...new Set(logos.map(lineName).filter(Boolean))];
  const unknown = logos.filter((logo) => !lineName(logo)).map((logo) => logo.alt ?? logo.fileName);
  return { line: lines[0] ?? null, lines, logos, unknownLogo: unknown[0] ?? null };
}

/** Tekst bez zaglavlja koji stoji uz SAMO jedan red višerednog bloka je oznaka bloka („SOFT”, „Hard Red”), ne atribut tog reda. */
function liftQualifiers(block) {
  const labelled = block.rows.filter((row) => row.cells.label);
  const qualifiers = [...block.notes];
  if (labelled.length === 1 && block.rows.length > 1) {
    qualifiers.push(labelled[0].cells.label);
    delete labelled[0].cells.label;
  }
  return [...new Set(qualifiers.map((text) => text.trim()).filter(Boolean))];
}

function toBlocks(page, language) {
  const parsed = parseWixPage(page.html);
  return {
    pdfLinks: parsed.pdfLinks,
    blocks: parsed.blocks
      .filter((block) => block.rows.length)
      .map((block, index) => {
        const { line, lines, logos, unknownLogo } = lineOf(block.images);
        const qualifiers = liftQualifiers(block);
        return {
          blockKey: `${page.key}#${index + 1}`,
          pageKey: page.key,
          pageUrl: page.url,
          language,
          order: index + 1,
          sectionId: block.sectionId,
          title: block.title,
          columns: block.columns,
          qualifiers,
          line,
          lines,
          unknownLogo: unknownLogo ?? null,
          rows: block.rows.map((row) => ({
            code: row.code,
            product: row.cells.product ?? null,
            colour: row.cells.colour ?? null,
            size: row.cells.size ?? null,
            holes: row.cells.holes ?? null,
            hardness: row.cells.hardness ?? null,
            quantity: row.cells.quantity ?? null,
            label: row.cells.label ?? null,
            swatch: row.swatch ?? null,
          })),
          images: block.images
            .filter((image) => !logos.includes(image))
            // `title` je naslov koji je proizvođač dao slajdu galerije; za običnu fotografiju je to samo ime fajla.
            .map((image) => ({ source: image.source, mediaId: image.mediaId, crop: image.crop ?? null, title: image.source === "gallery" && !/^dsc_|\.(jpe?g|png)$/i.test(image.alt ?? "") ? image.alt : null, fileName: image.fileName })),
        };
      }),
    // Kontrola parsera: tekst oblika šifre koji NIJE završio u redu tabele.
    strayCodes: parsed.blocks.flatMap((block) => [block.title, ...block.notes].filter((text) => text && CODE.test(text.replace(/\s+/g, "")))),
  };
}

const pdfLinks = new Set();
const blocks = [];
const pages = [];
for (const page of pagesEn) {
  const en = toBlocks(page, "en");
  const trPage = pagesTr.find((candidate) => candidate.key === page.key);
  const tr = trPage ? toBlocks(trPage, "tr") : { blocks: [], pdfLinks: [], strayCodes: [] };
  for (const link of [...en.pdfLinks, ...tr.pdfLinks]) pdfLinks.add(link);

  const codesEn = new Set(en.blocks.flatMap((block) => block.rows.map((row) => row.code)));
  const codesTr = new Set(tr.blocks.flatMap((block) => block.rows.map((row) => row.code)));
  for (const block of en.blocks) {
    const key = block.rows.map((row) => row.code).sort().join(",");
    const twin = tr.blocks.find((candidate) => candidate.rows.map((row) => row.code).sort().join(",") === key);
    const trRowByCode = new Map((twin?.rows ?? []).map((row) => [row.code, row]));
    const trTitleByMedia = new Map((twin?.images ?? []).map((image) => [image.mediaId, image.title]));
    blocks.push({
      ...block,
      category: navLabels.get(page.key) ?? null,
      titleTr: twin?.title ?? null,
      qualifiersTr: twin?.qualifiers ?? [],
      // Turski original je drugi zvanični svedok: naziv proizvoda u redu i naslov slajda nisu mašinski prevod.
      rows: block.rows.map((row) => ({ ...row, productTr: trRowByCode.get(row.code)?.product ?? null, colourTr: trRowByCode.get(row.code)?.colour ?? null })),
      images: block.images.map((image) => ({ ...image, titleTr: trTitleByMedia.get(image.mediaId) ?? null })),
    });
  }
  pages.push({
    key: page.key,
    url: page.url,
    urlTr: trPage?.url ?? null,
    httpStatus: page.httpStatus,
    httpStatusTr: trPage?.httpStatus ?? null,
    category: navLabels.get(page.key) ?? null,
    productBlocks: en.blocks.length,
    codes: codesEn.size,
    languageCodeMismatch: { onlyEn: [...codesEn].filter((code) => !codesTr.has(code)), onlyTr: [...codesTr].filter((code) => !codesEn.has(code)) },
    strayCodes: en.strayCodes,
    fetchedAt: page.fetchedAt,
  });
}

const allCodes = blocks.flatMap((block) => block.rows.map((row) => row.code));
writeJson(PATHS.rawWebsite, {
  meta: {
    source: WEBSITE.en.origin,
    controlSource: WEBSITE.tr.origin,
    architecture: "Wix; 19 stranica u pages-sitemap.xml; proizvodi su blokovi (ClassicSection) na stranicama kategorija, bez stranica pojedinačnih proizvoda",
    crawledAt,
    sitemapPages: pagesEn.length,
    pagesWithProducts: pages.filter((page) => page.productBlocks).length,
    productBlocks: blocks.length,
    codeRows: allCodes.length,
    distinctCodes: new Set(allCodes).size,
    pagesNotOk: pages.filter((page) => page.httpStatus !== 200).map((page) => page.key),
    languageCodeMismatches: pages.filter((page) => page.languageCodeMismatch.onlyEn.length || page.languageCodeMismatch.onlyTr.length).map((page) => ({ page: page.key, ...page.languageCodeMismatch })),
    strayCodes: pages.flatMap((page) => page.strayCodes),
    blocksWithoutLine: blocks.filter((block) => !block.line).map((block) => ({ block: block.blockKey, title: block.title, logo: block.unknownLogo })),
    blocksWithoutImages: blocks.filter((block) => !block.images.length).map((block) => block.blockKey),
    cataloguePdfLinks: [...pdfLinks].sort(),
  },
  pages,
  blocks,
});

console.log(
  `website: ${pages.filter((page) => page.productBlocks).length} stranica sa proizvodima · ${blocks.length} blokova · ${new Set(allCodes).size} šifara ` +
    `(redova ${allCodes.length}) · PDF linkova ${pdfLinks.size} → ${path.relative(process.cwd(), PATHS.rawWebsite)}`,
);
