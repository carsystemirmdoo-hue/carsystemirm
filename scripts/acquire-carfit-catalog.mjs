#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT acquisition (DISCOVER → INVENTORY → ACQUIRE → PARSE).
 *
 * Source architecture, established before any parser was written:
 *
 *   carfitrepair.com — WordPress + Yoast + Elementor, manufacturer
 *   August Handel GmbH. robots.txt allows all. The REST API is open, so the
 *   catalogue is read from `wp/v2/posts` rather than scraped out of rendered
 *   markup: 128 posts, 20 categories, 302 documents, 183 images.
 *
 * This is neither the R-M/baslac document portal nor the Cosmos "rich pages,
 * no TDS" shape. It is a hybrid — rich product pages *and* a document corpus —
 * so both evidence streams are collected.
 *
 * Grammar, surveyed across all 12 product categories and confirmed by a
 * corpus-wide heading census (123 Beschreibung, 97 Weitere Produktinformation,
 * 82 Eigenschaften, 76 Zweckbestimmung, 68 Oberflächen, 62 Downloads):
 *
 *   h2 Beschreibung                → prose description
 *   h3 <component>                 → OPTIONAL component block (Klarlack, Härter…)
 *      Art.-Nr.: <code>, <pack>    → one per variant, scoped to its block
 *   h2 Zweckbestimmung             → intended use
 *   h2 Eigenschaften               → bulleted properties
 *   h2 Oberflächen                 → substrates
 *   h2 Downloads                   → TDS / SDS links
 *   h2 Weitere Produktinformation  → two-column rows: label | value
 *   h2 Technische Daten            → "Label:" then value, incl. Ja/Nein
 *
 * Two decisions that the flattened text would have got wrong:
 *
 *  1. Specifications are read from the two-column Elementor structure, not by
 *     pairing alternating lines. Pairing desynchronises on any page that mixes
 *     forms, which produced labels like "61°C" and "grau" and silently dropped
 *     the real labels (Viskosität, Zündtemperatur).
 *
 *  2. h3 blocks are component boundaries, not sizes. "Rapid Air Klarlack VOC"
 *     lists 7-325-1000/7-326-5000 under *Klarlack* and 7-336-1000/7-337-2500
 *     under *Härter*. Treating all four as variants of one thing would attach
 *     the clearcoat's density to the hardener.
 *
 * Output: data/knowledge/carfit-catalog.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const API = "https://carfitrepair.com/wp-json/wp/v2";
const OUT = "data/knowledge/carfit-catalog.generated.json";
const CACHE_DIR = ".cache/carfit";
const accessedAt = new Date().toISOString();

mkdirSync(CACHE_DIR, { recursive: true });

async function fetchJson(url, cacheKey) {
  const file = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const data = await response.json();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/* -------------------------------------------------------------------------- */
/* Text normalisation                                                         */
/* -------------------------------------------------------------------------- */

const ENTITIES = {
  "&amp;": "&", "&nbsp;": " ", "&quot;": '"', "&lt;": "<", "&gt;": ">",
  "&#8211;": "–", "&#8212;": "—", "&#8217;": "'", "&#8216;": "'",
  "&#8222;": "„", "&#8220;": "“", "&#8221;": "”", "&#039;": "'", "&#39;": "'",
};

/**
 * Cyrillic look-alikes appear in the manufacturer's own copy — "140°С" ends in
 * U+0421, "4 m х 5 m" uses U+0445. Left alone they split otherwise identical
 * values in two. They are folded to Latin, and every fold is counted so the
 * report can state that the source, not the parser, is mixed-script.
 */
const CONFUSABLES = {
  "С": "C", "х": "x", "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M",
  "Н": "H", "О": "O", "Р": "P", "Т": "T", "Х": "X", "а": "a", "е": "e",
  "о": "o", "р": "p", "с": "c",
};
let confusableHits = 0;

function decode(value) {
  let text = value;
  for (const [entity, replacement] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(replacement);
  }
  return text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function foldConfusables(text) {
  return text.replace(/[Ѐ-ӿ]/g, (char) => {
    if (CONFUSABLES[char]) {
      confusableHits += 1;
      return CONFUSABLES[char];
    }
    return char;
  });
}

const clean = (value) => foldConfusables(decode(value)).replace(/\s+/g, " ").trim();

/** Elementor ships placeholder copy that is not product content. */
const TEMPLATE_NOISE = [
  /^gib hier deine überschrift ein$/i,
  /^enter your heading here$/i,
  /^lorem ipsum/i,
];

const isNoise = (line) => !line || TEMPLATE_NOISE.some((pattern) => pattern.test(line));

/** Strip tags to newline-separated visible lines. */
function toLines(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map(clean)
    .filter((line) => !isNoise(line));
}

/* -------------------------------------------------------------------------- */
/* Structure                                                                  */
/* -------------------------------------------------------------------------- */

const SECTIONS = [
  { key: "description", re: /^(beschreibung|description)$/i },
  { key: "intendedUse", re: /^(zweckbestimmung|typische anwendung|intended use|purpose)$/i },
  { key: "properties", re: /^(eigenschaften?|vorteile|properties|features|advantages)$/i },
  { key: "substrates", re: /^(oberflächen|surfaces|substrates)$/i },
  { key: "downloads", re: /^(downloads?|dateien)$/i },
  { key: "specifications", re: /^(weitere produktinformation(en)?|further product information)$/i },
  { key: "technicalData", re: /^(technische daten|technical data)$/i },
  { key: "storage", re: /^(haltbarkeit und lagerbedingungen|lagerung|storage)$/i },
  { key: "scopeOfDelivery", re: /^(lieferumfang|scope of delivery)$/i },
];

/**
 * Split the rendered post into blocks at every h2/h3.
 *
 * h2 opens a named section; an h3 inside it names a component block whose
 * article numbers and values belong to that component alone.
 */
function splitBlocks(html) {
  const blocks = [];
  const pattern = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let lastIndex = 0;
  let currentSection = "(lead)";
  let currentComponent;
  let match;

  const push = (section, component, body) => {
    if (body.trim()) blocks.push({ section, component, html: body });
  };

  while ((match = pattern.exec(html))) {
    push(currentSection, currentComponent, html.slice(lastIndex, match.index));
    const heading = clean(match[2].replace(/<[^>]*>/g, " "));
    if (match[1] === "2") {
      const known = SECTIONS.find((entry) => entry.re.test(heading));
      currentSection = known?.key ?? `(other:${heading})`;
      currentComponent = undefined;
    } else if (!isNoise(heading)) {
      // h3 inside a section names a component, unless it repeats the section.
      currentComponent = SECTIONS.some((entry) => entry.re.test(heading)) ? undefined : heading;
    }
    lastIndex = pattern.lastIndex;
  }
  push(currentSection, currentComponent, html.slice(lastIndex));
  return blocks;
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                   */
/* -------------------------------------------------------------------------- */

const PACK_UNIT = /\b(ml|l|kg|g|mm|cm|m|Stk\.?|St\.?|μm|µm|Blatt|Rolle)\b/i;

/**
 * Article numbers, scoped to the component block they appear under.
 *
 * Both renderings occur: "Art.-Nr.: 6-200-0006 , 97 mm x 120 mm" on one line,
 * and "Art.-Nr.:" / "6-200-0006" / ", 1 l" split across three. The block text
 * is therefore rejoined before matching.
 */
function parseVariants(blockHtml, component) {
  const joined = toLines(blockHtml).join(" | ");

  // Article markers are located first and the descriptor is taken as the text
  // *between* consecutive markers. Matching the marker and its tail in one
  // expression makes the tail swallow the next marker, which silently loses
  // every article number after the first on multi-variant pages.
  const marker = /art\.?\s*-?\s*nr\.?\s*:?[\s|]*(\d[\d\-]{4,})/gi;
  const found = [];
  let match;
  while ((match = marker.exec(joined))) {
    found.push({ articleNumber: match[1], start: match.index, end: marker.lastIndex });
  }

  return found.map((entry, index) => {
    const tail = joined
      .slice(entry.end, index + 1 < found.length ? found[index + 1].start : undefined)
      .split("|")
      .map((part) => part.replace(/^[,\s]+/, "").trim())
      .filter(Boolean)
      .filter((part) => !/art\.?\s*-?\s*nr/i.test(part));

    // Only the part that actually looks like a pack size becomes packaging; the
    // manufacturer's ordering of the rest is not consistent enough to split into
    // colour/grade without risking the wrong attribution.
    const descriptor = tail.join(", ").replace(/\s*,\s*$/, "");
    // Split on separator commas only. A comma between digits is a German
    // decimal point, and splitting there turns "2,5 l" into "5 l".
    const packaging = descriptor
      .split(/,(?!\d)/)
      .map((part) => part.trim())
      .find((part) => PACK_UNIT.test(part));

    return {
      articleNumber: entry.articleNumber,
      component,
      packaging: packaging || undefined,
      descriptor: descriptor || undefined,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Specifications                                                             */
/* -------------------------------------------------------------------------- */

/** Two-column rows: `elementor-inner-section` → [label, value]. */
function parseTwoColumnRows(blockHtml) {
  const rows = [];
  for (const chunk of blockHtml.split("elementor-inner-section").slice(1)) {
    const cells = [...chunk.matchAll(/elementor-widget-container">\s*((?:<p>[\s\S]*?<\/p>\s*)+)/g)].map(
      (match) => clean(match[1].replace(/<[^>]*>/g, " ")),
    );
    if (cells.length >= 2 && cells[0] && cells[1] && !isNoise(cells[0])) {
      rows.push({ label: cells[0].replace(/:$/, "").trim(), value: cells[1] });
    }
  }
  return rows;
}

/** `Label:` on one line, value on the next — used by the polishing compounds. */
function parseColonRows(blockHtml) {
  const lines = toLines(blockHtml);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const inline = /^([A-ZÄÖÜ][^:]{1,60}):\s*(\S.*)$/.exec(lines[index]);
    if (inline) {
      rows.push({ label: inline[1].trim(), value: inline[2].trim() });
      continue;
    }
    const wrapped = /^([A-ZÄÖÜ][^:]{1,60}):\s*$/.exec(lines[index]);
    const next = lines[index + 1];
    if (wrapped && next && !/:$/.test(next)) {
      rows.push({ label: wrapped[1].trim(), value: next.trim() });
      index += 1;
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */

async function main() {
  const categories = await fetchJson(`${API}/categories?per_page=100`, "categories");
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const productCategoryIds = new Set(
    categories
      .filter((category) => {
        let node = category;
        for (let depth = 0; node && depth < 5; depth += 1) {
          if (node.slug === "produkte") return true;
          node = categoryById.get(node.parent);
        }
        return false;
      })
      .map((category) => category.id),
  );

  const posts = [];
  for (let page = 1; page <= 2; page += 1) {
    posts.push(...(await fetchJson(`${API}/posts?per_page=100&page=${page}`, `posts-${page}`)));
  }

  const products = [];
  const skipped = [];

  for (const post of posts) {
    const postCategories = post.categories.filter((id) => productCategoryIds.has(id));
    if (!postCategories.length) {
      skipped.push({ slug: post.slug, title: clean(post.title.rendered), reason: "not in a product category" });
      continue;
    }

    const blocks = splitBlocks(post.content.rendered);
    const textOf = (key) =>
      blocks.filter((block) => block.section === key).flatMap((block) => toLines(block.html));

    const variants = blocks.flatMap((block) => parseVariants(block.html, block.component));
    const specifications = blocks
      .filter((block) => block.section === "specifications")
      .flatMap((block) => parseTwoColumnRows(block.html).map((row) => ({ ...row, component: block.component })));
    const technicalData = blocks
      .filter((block) => block.section === "technicalData" || block.section === "storage")
      .flatMap((block) => parseColonRows(block.html).map((row) => ({ ...row, component: block.component })));

    const componentBlocks = [...new Set(variants.map((variant) => variant.component).filter(Boolean))];

    const documentLinks = [
      ...new Set(
        [...post.content.rendered.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((match) => decode(match[1])),
      ),
    ];

    const leafCategory = categoryById.get(
      postCategories.find((id) => categoryById.get(id)?.count > 0) ?? postCategories[0],
    );

    const officialName = clean(post.title.rendered);

    products.push({
      // The WordPress id is the identifier. The slug is not: `gold-paper-disc-2`
      // is the slug of a post titled "Purple Ceramic Film" because the post was
      // duplicated and kept the old slug.
      id: post.id,
      slug: post.slug,
      officialName,
      slugMatchesName:
        post.slug.replace(/-\d+$/, "").replace(/-/g, " ").toLowerCase() === officialName.toLowerCase(),
      sourceUrl: post.link,
      language: "de",
      category: leafCategory?.slug,
      categoryPath: postCategories.map((id) => categoryById.get(id)?.slug).filter(Boolean),
      modified: post.modified_gmt,
      officialDescription: textOf("description").join(" ").trim() || undefined,
      intendedUse: textOf("intendedUse").join(" ").trim() || undefined,
      properties: textOf("properties"),
      substrates: textOf("substrates"),
      specifications,
      technicalData,
      variants,
      articleNumbers: variants.map((variant) => variant.articleNumber),
      // More than one component means page-level values cannot be assumed to
      // describe every article number on the page.
      componentBlocks,
      hasComponentBlocks: componentBlocks.length > 1,
      isFamily: variants.length > 1,
      documentLinks,
      featuredMediaId: post.featured_media || undefined,
      // Nothing here is offered by Carsystem i R-M until a human says so.
      catalogStatus: "manufacturer-catalog-candidate",
      accessedAt,
      published: false,
    });
  }

  const byCategory = {};
  for (const product of products) {
    byCategory[product.category ?? "(none)"] = (byCategory[product.category ?? "(none)"] ?? 0) + 1;
  }

  const summary = {
    generatedAt: accessedAt,
    brand: "C.A.R.FIT",
    manufacturer: "August Handel GmbH",
    source: "https://carfitrepair.com",
    sourceArchitecture: "WordPress + Yoast + Elementor, open REST API, bilingual DE/EN",
    postsScanned: posts.length,
    products: products.length,
    skippedNonProduct: skipped.length,
    productCategories: productCategoryIds.size,
    byCategory,
    withDescription: products.filter((product) => product.officialDescription).length,
    withIntendedUse: products.filter((product) => product.intendedUse).length,
    withProperties: products.filter((product) => product.properties.length).length,
    withSubstrates: products.filter((product) => product.substrates.length).length,
    withSpecifications: products.filter((product) => product.specifications.length).length,
    withTechnicalData: products.filter((product) => product.technicalData.length).length,
    withDocumentLinks: products.filter((product) => product.documentLinks.length).length,
    families: products.filter((product) => product.isFamily).length,
    withComponentBlocks: products.filter((product) => product.hasComponentBlocks).length,
    withoutArticleNumber: products.filter((product) => !product.variants.length).length,
    articleNumbers: new Set(products.flatMap((product) => product.articleNumbers)).size,
    specificationRows: products.reduce((total, product) => total + product.specifications.length, 0),
    distinctSpecificationLabels: new Set(
      products.flatMap((product) => product.specifications.map((row) => row.label)),
    ).size,
    slugNameMismatches: products.filter((product) => !product.slugMatchesName).length,
    cyrillicConfusablesFolded: confusableHits,
  };

  mkdirSync("data/knowledge", { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ summary, products, skipped }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

await main();
