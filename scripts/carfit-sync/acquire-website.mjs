#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 1 — RAW dataset zvaničnog sajta (carfitrepair.com, EN).
 *
 * Lista proizvoda se NE sastavlja ručno. Tri nezavisna zvanična izvora se ukrštaju:
 *   - WordPress REST (`/en/wp-json/wp/v2/posts`) — strukturisan i najstabilniji,
 *   - Yoast `post-sitemap.xml` — šta sajt sam prijavljuje pretraživačima,
 *   - živa EN stranica svakog proizvoda — HTTP status + canonical (dokaz „aktivno”).
 * Nemački REST (`/wp-json/…`) služi samo kao kontrola parsera: skup šifara
 * artikala po objavi mora biti isti u oba jezika.
 *
 * Proizvod = objava u kategoriji ispod `produkte`. Slajderi i stranice
 * („About us”, „Karriere”…) ostaju u `nonProducts` sa razlogom.
 *
 * Izlaz: data/carfit-sync/raw/website-en.generated.json (samo činjenice sa
 * sajta; ništa se ne spaja sa PDF-om niti sa našim katalogom).
 *
 *   node scripts/carfit-sync/acquire-website.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { ORIGIN, PAGE_CACHE_DIR, PATHS, REST_CACHE_DIR, WEBSITE } from "./lib/config.mjs";
import { clean, counters, decode, parseDescriptor, parseProductContent } from "./lib/html.mjs";

const refresh = process.argv.includes("--refresh");

async function restJson(base, query, cacheKey) {
  const file = path.join(REST_CACHE_DIR, `${cacheKey}.json`);
  const { body } = await cachedFetch(`${base}/${query}`, file, { refresh });
  return { data: JSON.parse(body.toString("utf8")), file };
}

/** REST paginacija: strana posle poslednje vraća HTTP 400 — to je kraj, ne greška. */
async function restAll(base, resource, cacheKey, extra = "") {
  const out = [];
  let firstFile = null;
  for (let page = 1; page <= 50; page += 1) {
    let result;
    try {
      result = await restJson(base, `${resource}?per_page=100&page=${page}&orderby=id&order=asc${extra}`, `${cacheKey}-${page}`);
    } catch (error) {
      if (page > 1 && /HTTP 400/.test(String(error.message))) break;
      throw error;
    }
    firstFile ??= result.file;
    out.push(...result.data);
    if (result.data.length < 100) break;
  }
  return { items: out, firstFile };
}

const { items: categories } = await restAll(WEBSITE.restEn, "categories", "categories-en");
const { items: postsEn, firstFile } = await restAll(WEBSITE.restEn, "posts", "posts-en");
const { items: postsDe } = await restAll(WEBSITE.restDe, "posts", "posts-de");
/** Vreme crawl-a = vreme kada je REST odgovor stvarno preuzet (stabilno dok se keš ne osveži). */
const crawledAt = statSync(firstFile).mtime.toISOString();

const categoryById = new Map(categories.map((category) => [category.id, category]));
const categoryPath = (id) => {
  const chain = [];
  for (let node = categoryById.get(id), depth = 0; node && depth < 6; node = categoryById.get(node.parent), depth += 1) {
    chain.unshift({ id: node.id, slug: node.slug, name: clean(node.name) });
  }
  return chain;
};
const isProductCategory = (id) => categoryPath(id).some((node) => node.slug === WEBSITE.productRootCategorySlug);

const { body: sitemapBody } = await cachedFetch(WEBSITE.postSitemap, path.join(REST_CACHE_DIR, "post-sitemap.xml"), { refresh });
const sitemapUrls = new Set([...sitemapBody.toString("utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()));

const deById = new Map(postsDe.map((post) => [post.id, post]));

/* -- Mediji (istaknuta slika + slike iz sadržaja) ------------------------------ */

const parsedById = new Map(postsEn.map((post) => [post.id, parseProductContent(post.content.rendered)]));
const mediaIds = [
  ...new Set(
    postsEn.flatMap((post) => [post.featured_media, ...parsedById.get(post.id).images.map((image) => image.attachmentId)]).filter(Boolean),
  ),
].sort((a, b) => a - b);
const mediaById = new Map();
for (let index = 0; index < mediaIds.length; index += 100) {
  const chunk = mediaIds.slice(index, index + 100);
  const { data } = await restJson(
    WEBSITE.restEn,
    `media?per_page=100&include=${chunk.join(",")}&_fields=id,source_url,mime_type,media_details,alt_text,date,modified`,
    `media-${index / 100 + 1}`,
  );
  for (const item of data) mediaById.set(item.id, item);
}
const mediaRecord = (id, role) => {
  const item = mediaById.get(id);
  if (!item) return null;
  return {
    role,
    attachmentId: id,
    url: item.source_url,
    mimeType: item.mime_type ?? null,
    width: item.media_details?.width ?? null,
    height: item.media_details?.height ?? null,
    alt: clean(item.alt_text ?? "") || null,
  };
};

/* -- Živa stranica: status + canonical ------------------------------------------ */

const productPosts = postsEn.filter((post) => post.categories.some(isProductCategory));
const liveById = new Map();
await mapLimit(productPosts, 4, async (post) => {
  const file = path.join(PAGE_CACHE_DIR, `${post.id}-${post.slug}.html`);
  try {
    const { body } = await cachedFetch(post.link, file, { refresh });
    const html = body.toString("utf8");
    liveById.set(post.id, {
      httpStatus: 200,
      canonicalUrl: decode(/<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? "") || null,
      ogImage: decode(/<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? "") || null,
      robots: /<meta name=['"]robots['"] content=['"]([^'"]+)['"]/.exec(html)?.[1] ?? null,
      htmlSha256: null,
    });
  } catch (error) {
    liveById.set(post.id, { httpStatus: Number(/HTTP (\d+)/.exec(String(error.message))?.[1] ?? 0), canonicalUrl: null, ogImage: null, robots: null });
  }
});

/* -- Zapisi ---------------------------------------------------------------------- */

const articleSet = (html) => new Set(parseProductContent(html).variants.map((variant) => variant.articleNumber));

const products = [];
const nonProducts = [];
for (const post of postsEn) {
  const title = clean(post.title.rendered);
  const productCategoryIds = post.categories.filter(isProductCategory);
  if (!productCategoryIds.length) {
    nonProducts.push({
      id: post.id,
      slug: post.slug,
      title,
      url: post.link,
      categories: post.categories.map((id) => categoryById.get(id)?.slug ?? String(id)),
      reason: "NON_PRODUCT: objava nije u kategoriji ispod „produkte” (slajder / stranica o firmi)",
    });
    continue;
  }

  const parsed = parsedById.get(post.id);
  const de = deById.get(post.id);
  const deArticles = de ? articleSet(de.content.rendered) : null;
  const enArticles = new Set(parsed.variants.map((variant) => variant.articleNumber));
  const languageMismatch = deArticles
    ? {
        onlyEn: [...enArticles].filter((article) => !deArticles.has(article)),
        onlyDe: [...deArticles].filter((article) => !enArticles.has(article)),
      }
    : null;

  // Najdublja kategorija je „list” (Masking → Masking Tapes).
  const paths = productCategoryIds.map(categoryPath).sort((a, b) => b.length - a.length);
  const leaf = paths[0];
  const live = liveById.get(post.id) ?? { httpStatus: 0, canonicalUrl: null, ogImage: null, robots: null };
  const deUrl = de?.link ?? null;

  const images = [
    mediaRecord(post.featured_media, "featured"),
    ...parsed.images.map((image) => mediaRecord(image.attachmentId, "content") ?? {
      role: "content", attachmentId: null, url: image.largest ?? image.src, mimeType: null, width: null, height: null, alt: image.alt,
    }),
  ].filter(Boolean);
  const uniqueImages = [...new Map(images.map((image) => [image.url.replace(/-\d+x\d+(?=\.\w+$)/, ""), image])).values()];

  const find = (pattern) => parsed.additionalInformation.find((row) => pattern.test(row.label))?.value ?? null;

  products.push({
    id: post.id,
    sourceKey: post.slug,
    url: post.link,
    canonicalUrl: live.canonicalUrl,
    germanUrl: deUrl,
    officialName: title,
    officialNameDe: de ? clean(de.title.rendered) : null,
    category: leaf?.[1] ? { slug: leaf[1].slug, name: leaf[1].name } : null,
    subcategory: leaf?.[2] ? { slug: leaf[2].slug, name: leaf[2].name } : null,
    categoryPaths: paths.map((chain) => chain.map((node) => node.slug).join("/")),
    publishedAt: post.date_gmt ?? null,
    modifiedAt: post.modified_gmt ?? null,
    description: parsed.description ? parsed.description.join("\n") : null,
    application: parsed.application,
    features: parsed.features,
    substrates: parsed.substrates,
    scopeOfDelivery: parsed.scopeOfDelivery,
    additionalInformation: parsed.additionalInformation,
    technicalData: parsed.technicalData,
    otherSections: parsed.otherSections,
    colour: find(/^colou?r$/i),
    base: find(/^(base|material)$/i),
    density: find(/^density$/i),
    voc: find(/^voc$/i),
    flashPoint: find(/^flash ?point$/i),
    dimensions: find(/^(dimensions?|size|diameter|width|length)$/i),
    grit: find(/^grit$/i),
    variants: parsed.variants.map((variant) => ({ ...variant, attributes: parseDescriptor(variant.descriptor) })),
    articleNumbers: [...enArticles],
    componentBlocks: parsed.componentBlocks,
    images: uniqueImages,
    ogImage: live.ogImage,
    documents: parsed.documents,
    availabilityNote: null,
    status: {
      restStatus: post.status,
      httpStatus: live.httpStatus,
      inSitemap: sitemapUrls.has(post.link) || (deUrl ? sitemapUrls.has(deUrl) : false),
      robots: live.robots,
      active: post.status === "publish" && live.httpStatus === 200,
    },
    parserAudit: {
      unmarkedArticleTokens: parsed.unmarkedArticleTokens,
      unknownHeadings: parsed.unknownHeadings,
      languageArticleMismatch: languageMismatch,
      contentSha256: sha256(Buffer.from(post.content.rendered)).slice(0, 16),
    },
    crawledAt,
  });
}

products.sort((a, b) => a.id - b.id);

/** Sitemap navodi i DE i /en/ adresu svake objave. */
const restLinks = new Set([...postsDe, ...postsEn].map((post) => post.link));
const allArticles = products.flatMap((product) => product.articleNumbers);
const sitemapProductUrls = [...sitemapUrls].filter((url) => products.some((product) => product.url === url));

writeJson(PATHS.rawWebsite, {
  meta: {
    source: ORIGIN,
    locale: WEBSITE.locale,
    architecture: "WordPress + Yoast + Elementor + TranslatePress; REST API otvoren",
    crawledAt,
    discovery: {
      restPostsEn: postsEn.length,
      restPostsDe: postsDe.length,
      sitemapUrls: sitemapUrls.size,
      sitemapUrlsThatAreProducts: sitemapProductUrls.length,
      productsMissingFromSitemap: products.filter((product) => !product.status.inSitemap).map((product) => product.sourceKey),
      sitemapPostsNotInRest: [...sitemapUrls].filter((url) => !restLinks.has(url)),
    },
    productPages: products.length,
    activeProductPages: products.filter((product) => product.status.active).length,
    nonProductPosts: nonProducts.length,
    articleNumbers: allArticles.length,
    distinctArticleNumbers: new Set(allArticles).size,
    productsWithoutArticleNumber: products.filter((product) => !product.articleNumbers.length).map((product) => product.sourceKey),
    productsWithComponentBlocks: products.filter((product) => product.componentBlocks.length).length,
    productsWithImages: products.filter((product) => product.images.length).length,
    productsWithTds: products.filter((product) => product.documents.some((document) => document.kind === "tds")).length,
    productsWithSds: products.filter((product) => product.documents.some((document) => document.kind === "sds")).length,
    languageArticleMismatches: products.filter(
      (product) => product.parserAudit.languageArticleMismatch && (product.parserAudit.languageArticleMismatch.onlyEn.length || product.parserAudit.languageArticleMismatch.onlyDe.length),
    ).length,
    unmarkedArticleTokens: products.filter((product) => product.parserAudit.unmarkedArticleTokens.length).length,
    cyrillicConfusablesFolded: counters.confusablesFolded,
  },
  categories: categories
    .filter((category) => isProductCategory(category.id))
    .map((category) => ({ id: category.id, slug: category.slug, name: clean(category.name), parent: categoryById.get(category.parent)?.slug ?? null, count: category.count }))
    .sort((a, b) => a.id - b.id),
  products,
  nonProducts,
});

console.log(
  `website: ${products.length} stranica proizvoda (${products.filter((product) => product.status.active).length} aktivnih), ` +
    `${new Set(allArticles).size} šifara, ${nonProducts.length} ne-proizvoda → ${path.relative(process.cwd(), PATHS.rawWebsite)}`,
);
