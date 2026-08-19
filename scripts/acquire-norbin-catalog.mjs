#!/usr/bin/env node
/**
 * Phase 5 — NORBIN acquisition (DISCOVER → INVENTORY → ACQUIRE → PARSE).
 *
 * Brand ownership, verified rather than assumed: NORBIN® is a registered
 * trademark of BASF Coatings GmbH, launched 2015 as BASF's value-segment
 * refinish brand alongside Glasurit, R-M and baslac. The footer of every
 * regional page states the ownership, so the prior signal is confirmed at the
 * source, not from secondary reporting.
 *
 * Source architecture — the simplest of any brand so far, and unlike its BASF
 * siblings:
 *
 *   R-M / baslac   technical portal with a per-code document endpoint
 *   NORBIN         a small static HTML site, no CMS, no REST API, no sitemap,
 *                  no robots.txt, with one `norbin-range.html` page per region
 *                  that links every document directly.
 *
 * The baslac parser is therefore not reused: there is no `techinfo` portal to
 * enumerate (`techinfo.norbin-paint.com` answers 301 to itself) and no code
 * endpoint. The range page *is* the catalogue.
 *
 * Page grammar, identical across regions:
 *
 *   <h4>Downloads</h4>  brochure, technical posters
 *   <h4>TDS</h4>        one anchor per product — "NORBIN® N15-020 Clear"
 *   <h4>MSDS</h4>       one anchor per pack size — "… N15-020 Clear 1L"
 *
 * So the anchor text carries the official name and code, and the MSDS block is
 * where the pack variants are enumerated.
 *
 * Two source conditions are recorded rather than smoothed over:
 *
 *  1. Regional offers genuinely differ ("Our offer may differ from country to
 *     country"). Turkey lists 23 codes, EMEA-EN 13, Kazakhstan 2.
 *  2. Many entries are commented out in the markup. The manufacturer chose not
 *     to publish them; they are recorded as `unlinked-in-source` and never
 *     counted as part of the live offer.
 *
 * Output: data/knowledge/norbin-catalog.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const HOST = "https://www.norbin-paint.com";
const REGIONS = ["en", "me", "de", "pl", "tr", "kz"];
const OUT = "data/knowledge/norbin-catalog.generated.json";
const CACHE_DIR = ".cache/norbin";
const accessedAt = new Date().toISOString();

mkdirSync(CACHE_DIR, { recursive: true });

async function fetchPage(url, cacheKey) {
  const file = path.join(CACHE_DIR, `${cacheKey}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const html = await response.text();
  writeFileSync(file, html);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return html;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

const ENTITIES = {
  "&amp;": "&", "&nbsp;": " ", "&quot;": '"', "&reg;": "®", "&copy;": "©",
  "&#8211;": "–", "&#8217;": "'", "&lt;": "<", "&gt;": ">",
};

function decode(value) {
  let text = value;
  for (const [entity, replacement] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(replacement);
  }
  return text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const clean = (value) => decode(String(value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** `NORBIN® N15-020 Clear 1L` → code `N15-020`. */
const CODE_RE = /\bN\d{2}-[A-Z0-9]{3}\b/;

/** Pack size as written by the manufacturer: `1L`, `2,5L`, `1.95KG`, `0.05KG`. */
const PACK_RE = /\b(\d+(?:[.,]\d+)?)\s*(L|KG|ML|G)\b/i;

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Anchors inside a named `<h4>` block. Commented-out anchors are captured
 * separately: the markup disables them with `<!-- <a href="--><!--files/…"-->`,
 * which no normal href scan would surface.
 */
function anchorsInSection(html, heading) {
  // "Downloads" is an <h3> while "TDS" and "MSDS" are <h4>; matching only <h4>
  // silently returned zero brochures.
  const start = html.search(new RegExp(`<h([34])[^>]*>\\s*${heading}\\s*</h\\1>`, "i"));
  if (start < 0) return { live: [], unlinked: [] };

  const nextHeading = html.slice(start + 1).search(/<h[1-4][^>]*>/i);
  const block = html.slice(start, nextHeading > 0 ? start + 1 + nextHeading : undefined);

  // Only documents. The MSDS block is the last <h4> on the page, so without
  // this the section runs into the footer and collects imprint, legal and
  // social-media links as if they were data sheets.
  const live = [...block.matchAll(/<a\s+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => /\.pdf$/i.test(match[1]))
    .map((match) => ({ href: match[1], label: clean(match[2]) }));

  // Disabled entries keep their path inside a comment; there is no label left.
  const unlinked = [...new Set(
    [...block.matchAll(/<!--[^>]*?(files\/[A-Za-z]+(?:\/[A-Za-z]+)?\/[^"'<>\s]+\.(?:pdf|PDF))/g)].map(
      (match) => `${HOST}/${match[1]}`,
    ),
  )].map((href) => ({ href, label: undefined }));

  return { live, unlinked };
}

/* -------------------------------------------------------------------------- */

const regionPages = {};
const regionStatus = {};

for (const region of REGIONS) {
  try {
    regionPages[region] = await fetchPage(`${HOST}/${region}/norbin-range.html`, `range-${region}`);
  } catch (error) {
    regionStatus[region] = { published: false, reason: error.message };
  }
}

/** code → product, merged across regions. */
const products = new Map();
const documents = [];
const brochures = [];

for (const [region, html] of Object.entries(regionPages)) {
  const tds = anchorsInSection(html, "TDS");
  const msds = anchorsInSection(html, "MSDS");
  const downloads = anchorsInSection(html, "Downloads");

  // A region page with no TDS and no MSDS anchors is an unpublished stub. The
  // Montenegro, Germany and Poland pages literally read "Inhalte ME/DE/PL".
  const stubMarker = /Inhalte\s+[A-Z]{2}/.exec(clean(html))?.[0];
  const published = tds.live.length > 0 || msds.live.length > 0;
  regionStatus[region] = {
    published,
    stubMarker: published ? undefined : stubMarker,
    tdsLinks: tds.live.length,
    msdsLinks: msds.live.length,
    unlinkedInSource: tds.unlinked.length + msds.unlinked.length,
  };

  const record = (entry, documentType, availability) => {
    const code = CODE_RE.exec(entry.label ?? entry.href)?.[0];
    const pack = entry.label ? PACK_RE.exec(entry.label) : undefined;

    documents.push({
      documentType,
      availability,
      region,
      sourceUrl: entry.href,
      fileName: decodeURIComponent(entry.href.split("/").pop()),
      label: entry.label,
      code,
      packSize: pack ? `${pack[1].replace(",", ".")} ${pack[2].toUpperCase()}` : undefined,
      manufacturer: "BASF Coatings GmbH",
      brand: "NORBIN",
      accessedAt,
      published: false,
    });

    if (!code) return;

    const product = products.get(code) ?? {
      code,
      officialName: undefined,
      regions: new Set(),
      regionsUnlinked: new Set(),
      variants: new Map(),
      tdsDocuments: new Set(),
      sdsDocuments: new Set(),
    };

    if (availability === "live") product.regions.add(region);
    else product.regionsUnlinked.add(region);

    // The TDS anchor label is the product name; the MSDS label repeats it with
    // a pack size appended, so the TDS label is preferred.
    if (entry.label) {
      // "NORBIN ® N15-020 Clear 1L" → "N15-020 Clear"; the ® survives entity
      // decoding as its own token, so it is stripped separately.
      const name = entry.label.replace(/^NORBIN\s*/i, "").replace(/^®\s*/, "").trim();
      const withoutPack = name.replace(PACK_RE, "").replace(/[\s,]+$/, "").trim();

      /**
       * The English page is the reference for the official name. Regions later
       * in the loop would otherwise overwrite it — Kazakhstan labels the same
       * product "Лак N15-020", which is a translation, not the official name.
       */
      const preferred = region === "en" || !product.officialNameRegion;
      if (withoutPack && preferred && (documentType === "tds" || !product.officialName)) {
        if (documentType === "tds" || !product.officialName) {
          product.officialName = withoutPack;
          product.officialNameRegion = region;
        }
      }
    }

    if (documentType === "tds") product.tdsDocuments.add(entry.href);
    if (documentType === "sds") product.sdsDocuments.add(entry.href);

    if (pack) {
      const size = `${pack[1].replace(",", ".")} ${pack[2].toUpperCase()}`;
      const variant = product.variants.get(size) ?? { packSize: size, regions: new Set(), sdsDocuments: new Set() };
      variant.regions.add(region);
      if (documentType === "sds") variant.sdsDocuments.add(entry.href);
      product.variants.set(size, variant);
    }

    products.set(code, product);
  };

  for (const entry of tds.live) record(entry, "tds", "live");
  for (const entry of tds.unlinked) record(entry, "tds", "unlinked-in-source");
  for (const entry of msds.live) record(entry, "sds", "live");
  for (const entry of msds.unlinked) record(entry, "sds", "unlinked-in-source");

  for (const entry of downloads.live) {
    brochures.push({
      documentType: /grey|shade|tech-info/i.test(entry.href) ? "technical-poster" : "brochure",
      availability: "live",
      region,
      sourceUrl: entry.href,
      fileName: decodeURIComponent(entry.href.split("/").pop()),
      label: entry.label,
      manufacturer: "BASF Coatings GmbH",
      brand: "NORBIN",
      accessedAt,
      published: false,
    });
  }
}

const catalogProducts = [...products.values()]
  .map((product) => ({
    code: product.code,
    officialName: product.officialName,
    // Nothing here is a statement that Carsystem i R-M sells it.
    catalogStatus: "manufacturer-catalog-candidate",
    soldByCarsystem: false,
    regions: [...product.regions].sort(),
    regionsUnlinkedOnly: [...product.regionsUnlinked].filter((region) => !product.regions.has(region)).sort(),
    availability: product.regions.size ? "live" : "unlinked-in-source",
    variants: [...product.variants.values()].map((variant) => ({
      packSize: variant.packSize,
      regions: [...variant.regions].sort(),
      sdsDocuments: [...variant.sdsDocuments],
    })),
    tdsDocuments: [...product.tdsDocuments],
    sdsDocuments: [...product.sdsDocuments],
    manufacturer: "BASF Coatings GmbH",
    brand: "NORBIN",
    accessedAt,
    published: false,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const byRegion = {};
for (const product of catalogProducts) {
  for (const region of product.regions) byRegion[region] = (byRegion[region] ?? 0) + 1;
}

const summary = {
  generatedAt: accessedAt,
  brand: "NORBIN",
  manufacturer: "BASF Coatings GmbH",
  brandOwnerVerifiedFrom: `${HOST}/en/norbin-range.html (footer: “NORBIN® is a registered Trademark of BASF Coatings GmbH”)`,
  source: HOST,
  sourceArchitecture:
    "static HTML, one range page per region; no CMS, no REST API, no sitemap, no robots.txt",
  regionsProbed: REGIONS.length,
  regionStatus,
  publishedRegions: Object.values(regionStatus).filter((entry) => entry.published).length,
  unpublishedRegions: Object.entries(regionStatus)
    .filter(([, entry]) => !entry.published)
    .map(([region]) => region),
  products: catalogProducts.length,
  liveProducts: catalogProducts.filter((product) => product.availability === "live").length,
  unlinkedOnlyProducts: catalogProducts.filter((product) => product.availability === "unlinked-in-source").length,
  productsByRegion: byRegion,
  withOfficialName: catalogProducts.filter((product) => product.officialName).length,
  withTds: catalogProducts.filter((product) => product.tdsDocuments.length).length,
  withSds: catalogProducts.filter((product) => product.sdsDocuments.length).length,
  variants: catalogProducts.reduce((total, product) => total + product.variants.length, 0),
  documents: documents.length,
  documentsLive: documents.filter((entry) => entry.availability === "live").length,
  documentsUnlinked: documents.filter((entry) => entry.availability === "unlinked-in-source").length,
  brochures: brochures.length,
  // No product page, no product image: the site publishes neither.
  productPages: 0,
  productImages: 0,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ summary, products: catalogProducts, documents, brochures }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
