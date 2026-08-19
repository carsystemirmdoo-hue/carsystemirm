#!/usr/bin/env node
/**
 * Integrity check for every document a product page can link to.
 *
 * Two independent sources feed the PDP `documents` field:
 *   - lib/carsystem-data.ts        — hand-written products (Carsystem, baslac,
 *                                    Carfit, legacy R-M records)
 *   - data/rm-imported-products.generated.json — the 59 imported R-M products
 *
 * A broken href on a product page is worse than no document at all: the page
 * claims a technical sheet exists and then 404s. And a single PDF referenced
 * from two different products means at least one of them is showing the wrong
 * product's data. Both are checked here, across both sources.
 *
 * Placeholder stubs are exempt from uniqueness on purpose — they are shared
 * "document is confirmed on request" copy, not a claim about a specific file.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const CATALOG_SOURCE = "lib/carsystem-data.ts";
const RM_IMPORT = "data/rm-imported-products.generated.json";

/** Shared stub files; many products legitimately point at the same one. */
const SHARED_PLACEHOLDERS = new Set([
  "/documents/placeholder-tds.pdf",
  "/documents/placeholder-msds.pdf",
]);

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

/* -------------------------------------------------------------------------- */
/* Collect (product → document href) pairs                                    */
/* -------------------------------------------------------------------------- */

/**
 * href values reachable from the public model, tagged with the linking slug and
 * with whether the PDP actually renders them as an openable link.
 *
 * The distinction matters for the reported numbers: a `status: "placeholder"`
 * entry may still carry an href in the source (the shared stub files), but
 * `getDocuments()` drops it, so the visitor never sees a document. Counting
 * those as "products with documents" would overstate coverage.
 */
const links = [];

const source = readFileSync(join(projectRoot, CATALOG_SOURCE), "utf8");

const liveSlugs = (() => {
  const start = source.indexOf("const productRecords: CarsystemProduct[] = [");
  const block = source.slice(start, source.indexOf("\n];", start));
  return new Set([
    ...[...block.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
    ...[...block.matchAll(/archivedProduct\("([a-z0-9-]+)"\)/g)].map((match) => match[1]),
  ]);
})();

const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
starts.forEach((start, index) => {
  const slug = start[1];
  if (!liveSlugs.has(slug)) return;
  const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);

  // `getDocuments()` in components/product/ProductDetailPage.tsx renders the
  // reviewed `detail.documents` list INSTEAD of the legacy `documents` array
  // whenever a product has one. Mirror that precedence, otherwise a product
  // that carries the same sheet in both shapes reads as a duplicate link when
  // the page in fact renders it once.
  const detailAt = body.indexOf("\n    detail: {");
  const rendered = detailAt >= 0 ? body.slice(detailAt) : body;

  for (const match of rendered.matchAll(/"(\/documents\/[^"]+)"/g)) {
    links.push({
      slug,
      href: match[1],
      source: CATALOG_SOURCE,
      public: isPubliclyRendered(rendered, match.index),
    });
  }
});

/**
 * True when the PDP renders this href as an "Otvori PDF" link.
 *
 * Two shapes carry an href: a document object literal (`status: "available"`
 * for the legacy list, `availability: "available"` for a reviewed
 * `detail.documents` entry), and the `documentsWithTds()` / `tdsDocument()`
 * helpers, which build an available TDS from their href argument.
 */
function isPubliclyRendered(text, index) {
  const helperAt = Math.max(
    text.lastIndexOf("documentsWithTds(", index),
    text.lastIndexOf("tdsDocument(", index),
  );
  const braceAt = text.lastIndexOf("{", index);
  if (helperAt > braceAt) return true;

  const objectEnd = text.indexOf("}", index);
  const object = text.slice(braceAt, objectEnd < 0 ? undefined : objectEnd);
  return /\b(?:status|availability):\s*"available"/.test(object);
}

const rmImport = JSON.parse(readFileSync(join(projectRoot, RM_IMPORT), "utf8"));
for (const product of rmImport.products) {
  for (const href of [
    product.documents.productInformation,
    product.documents.technicalDataSheet,
  ]) {
    // `getLegacyDocuments()` emits both of these with `status: "available"`.
    if (href) links.push({ slug: product.slug, href, source: RM_IMPORT, public: true });
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Every referenced file exists and is a PDF                               */
/* -------------------------------------------------------------------------- */

for (const link of new Map(links.map((link) => [`${link.slug}|${link.href}`, link])).values()) {
  const filePath = join(projectRoot, "public", link.href);
  expect(existsSync(filePath), `Nedostaje dokument: ${link.href} (${link.slug})`);
  if (existsSync(filePath)) {
    expect(
      readFileSync(filePath).subarray(0, 4).toString("ascii") === "%PDF",
      `Dokument nije PDF: ${link.href} (${link.slug})`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 2. No product links the same file twice                                    */
/* -------------------------------------------------------------------------- */

const publicLinks = links.filter((link) => link.public);

const perProduct = new Map();
for (const link of publicLinks) {
  const seen = perProduct.get(link.slug) ?? new Map();
  seen.set(link.href, (seen.get(link.href) ?? 0) + 1);
  perProduct.set(link.slug, seen);
}
for (const [slug, seen] of perProduct) {
  for (const [href, count] of seen) {
    if (SHARED_PLACEHOLDERS.has(href)) continue;
    expect(count === 1, `Duplirani link na istom proizvodu: ${slug} → ${href} (${count}×)`);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. No file is claimed by two different products                            */
/* -------------------------------------------------------------------------- */

const perFile = new Map();
for (const link of publicLinks) {
  if (SHARED_PLACEHOLDERS.has(link.href)) continue;
  perFile.set(link.href, new Set([...(perFile.get(link.href) ?? []), link.slug]));
}
for (const [href, slugs] of perFile) {
  expect(
    slugs.size === 1,
    `Isti dokument je povezan sa više proizvoda: ${href} → ${[...slugs].join(", ")}`,
  );
}

/* -------------------------------------------------------------------------- */
/* 4. The imported R-M mapping has not regressed                              */
/* -------------------------------------------------------------------------- */

const rmLinks = publicLinks.filter((link) => link.source === RM_IMPORT);
const rmProductsWithDocuments = new Set(rmLinks.map((link) => link.slug));
const rmFiles = new Set(rmLinks.map((link) => link.href));

expect(
  rmProductsWithDocuments.size === 59,
  `Očekivano 59 R-M proizvoda sa javnim dokumentima, pronađeno ${rmProductsWithDocuments.size}.`,
);
expect(rmFiles.size === 117, `Očekivano 117 R-M fajlova, pronađeno ${rmFiles.size}.`);

/* -------------------------------------------------------------------------- */

const baslacLinks = publicLinks.filter((link) =>
  link.href.startsWith("/documents/products/baslac/"),
);
const baslacProducts = new Set(baslacLinks.map((link) => link.slug));

/** Products whose only document reference is a stub the PDP never renders. */
const placeholderOnlyProducts = [
  ...new Set(links.filter((link) => !link.public).map((link) => link.slug)),
].filter((slug) => !perProduct.has(slug));

if (failures.length) {
  console.error(`Validacija dokumenata nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      productsWithPublicDocuments: perProduct.size,
      publicDocumentFiles: perFile.size,
      productsWithPlaceholderOnlyReferences: placeholderOnlyProducts.length,
      placeholderOnlyProducts,
      rmProductsWithPublicDocuments: rmProductsWithDocuments.size,
      rmFiles: rmFiles.size,
      baslacProductsWithPerSkuDocuments: baslacProducts.size,
      baslacPerSkuFiles: new Set(baslacLinks.map((link) => link.href)).size,
    },
    null,
    2,
  ),
);
