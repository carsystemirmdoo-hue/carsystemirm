/**
 * Naši postojeći (RUČNO vođeni) C.A.R.FIT zapisi i njihovo uparivanje sa
 * zvaničnim proizvodima.
 *
 * Katalog se čita kroz `scripts/lib/catalog-runtime.mjs` — iste module koje
 * izvršava javni sajt. Proizvodi koje je sync sam uvezao nisu predmet matchinga.
 *
 * LESTVICA (prvo što odluči; fuzzy naziv nikad nije dovoljan sam):
 *   1. zvanična šifra koju zapis SAM nosi (doslovno u lib/carsystem-data.ts)   → EXACT_MATCH
 *   2. `sku` / `manufacturerCode` u zvaničnom formatu = zvanična šifra           → EXACT_MATCH
 *   3. naša slika bajt-identična zvaničnoj slici proizvoda
 *      + ručno pakovanje/dimenzija = zvanična varijanta tog proizvoda             → HIGH_CONFIDENCE_MATCH
 *   4. tačan normalizovan zvanični naziv + isto pakovanje                          → HIGH_CONFIDENCE_MATCH
 *   5. samo bajt-identična slika, ili samo tačan naziv                             → PROBABLE_MATCH
 *   6. zapis nosi zvaničnu šifru koje više nema na sajtu (ima je samo PDF/niko)    → LEGACY_NOT_ON_CURRENT_WEBSITE
 *   7. ništa od navedenog                                                          → LOCAL_ONLY_UNKNOWN
 *
 * Placeholder SKU (`CARFIT-FILM-4X5M`) nije identitet proizvođača: nije u
 * zvaničnom formatu `N-NNN-NNNN`, pa u koracima 1–2 ne učestvuje.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";
import { BRAND, REPO_ROOT } from "./config.mjs";

const OFFICIAL_ARTICLE = /\b\d-\d{3}-\d{3,5}[A-Za-z]?\b/g;
const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";

const handWrittenSource = readFileSync(path.join(REPO_ROOT, "lib/carsystem-data.ts"), "utf8");
const articlesIn = (value) => [...String(value ?? "").matchAll(OFFICIAL_ARTICLE)].map((match) => match[0]);
const sha256File = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** „4 x 5 m”, „4 m × 5 m”, „4m x 5m” → „4x5m”; „1 L”, „1,0 l” → „1l”. */
export function measureKey(value) {
  const text = String(value ?? "").toLowerCase().replace(/,/g, ".").replace(/×/g, "x");
  const dims = /(\d+(?:\.\d+)?)\s?(mm|cm|m)?\s?x\s?(\d+(?:\.\d+)?)\s?(mm|cm|m)/.exec(text);
  if (dims) return `${Number(dims[1])}${dims[2] ?? dims[4]}x${Number(dims[3])}${dims[4]}`;
  const single = /(\d+(?:\.\d+)?)\s?(ml|l|kg|g|mm|cm|m)\b/.exec(text);
  return single ? `${Number(single[1])}${single[2]}` : null;
}

const nameKey = (value) => String(value ?? "").toLowerCase().replace(/c\.?a\.?r\.?\s?fit|car\s?fit/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Sve verzije iste slike u `public/` (originalni .jpg i kasniji cut-out .webp
 * dele ime): dovoljno je da JEDNA bude bajt-identična zvaničnoj.
 */
function imageHashes(imageSrc) {
  if (!imageSrc || imageSrc === PLACEHOLDER_IMAGE) return [];
  const absolute = path.join(REPO_ROOT, "public", imageSrc);
  const dir = path.dirname(absolute);
  const stem = path.basename(absolute).replace(/\.\w+$/, "");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.replace(/\.\w+$/, "") === stem)
    .map((file) => sha256File(path.join(dir, file)));
}

/**
 * Naziv i pakovanja kako ih je ZAPIS SAM upisao u lib/carsystem-data.ts.
 *
 * Runtime vidi zapis POSLE dopune: uz ručnu odluku adapter mu daje zvanični naziv
 * porodice i sažetak „3 varijante”, pa „4 x 5 m” nestaje iz naziva i pakovanja.
 * Kada bi matching čitao runtime, drugi prolaz više ne bi imao dokaz „ručno
 * pakovanje = zvanična varijanta”, zapis bi pao na PROBABLE i porodica bi se
 * uvezla DRUGI PUT. Dokaz se zato čita iz ručnog izvora, koji sync ne menja.
 */
function handWrittenFields(slug) {
  const start = handWrittenSource.indexOf(`slug: "${slug}"`);
  if (start < 0) return null;
  const next = handWrittenSource.indexOf("slug: \"", start + 10);
  const block = handWrittenSource.slice(start, next < 0 ? start + 4000 : next);
  const name = /\bname:\s*"([^"]+)"/.exec(block)?.[1] ?? null;
  const packagesBlock = /\bpackages:\s*\[([\s\S]*?)\]/.exec(block)?.[1] ?? "";
  const packages = [...packagesBlock.matchAll(/label:\s*"([^"]+)"/g)].map((match) => match[1]);
  return name ? { name, packages } : null;
}

/** @param {Set<string>} syncSlugs slugovi koje je uvezao sync */
export function loadLocalProducts(syncSlugs) {
  const { products } = loadCatalogRuntime();
  const all = products.filter((product) => product.brandSlug === BRAND.slug);
  const local = all
    .filter((product) => !syncSlugs.has(product.slug))
    .map((product) => {
      const rows = product.detail?.variants?.content?.rows ?? [];
      const variantArticles = rows.flatMap((row) => articlesIn(`${row.id} ${row.values?.article ?? ""}`)).filter((article) => handWrittenSource.includes(`"${article}"`));
      // Runtime vidi zapis POSLE dopune (adapter mu uz ručnu odluku daje zvaničnu šifru
      // kao prikazani `sku`). „Šifra koju zapis SAM nosi” je samo ona koja doslovno stoji
      // u ručnom izvoru — inače bi drugi prolaz isti zapis video kao EXACT_MATCH i plan
      // ne bi bio idempotentan.
      const skuArticles = articlesIn(`${product.sku} ${product.manufacturerCode ?? ""} ${product.externalSku ?? ""}`).filter((article) =>
        handWrittenSource.includes(`"${article}"`),
      );
      const imageSrc = product.productImage?.src ?? null;
      const written = handWrittenFields(product.slug);
      return {
        slug: product.slug,
        name: written?.name ?? product.name,
        displayedName: product.name,
        sku: product.sku ?? null,
        manufacturerCode: product.manufacturerCode ?? null,
        ownArticleNumbers: [...new Set([...skuArticles, ...variantArticles])],
        hasPlaceholderSku: !skuArticles.length,
        hasPlaceholderImage: !imageSrc || imageSrc === PLACEHOLDER_IMAGE,
        imageSrc,
        imageSha256s: imageHashes(imageSrc),
        packages: written?.packages.length ? written.packages : (product.packages ?? []).map((item) => item.label),
        variantRowIds: rows.map((row) => row.id),
        programSlug: product.programSlug,
      };
    });
  // Veličina CELOG kataloga se namerno ne vraća: to je živa metrika svih brendova, pa bi izveštaj
  // ovog synca menjala svaki kasnije dodat proizvođač (`<brand>:sync:check` mora ostati prazan).
  return { local, allSlugs: new Set(products.map((product) => product.slug)) };
}

/**
 * @param {ReturnType<typeof loadLocalProducts>["local"][number]} local
 * @param {any[]} sourceProducts  `source-products.generated.json → products`
 * @param {Map<string, string>} primaryImageBySha  sha256 zvanične glavne slike → sourceKey
 * @param {Set<string>} catalogueOnlyArticles     šifre koje postoje samo u PDF-u
 */
export function matchLocalProduct(local, sourceProducts, primaryImageBySha, catalogueOnlyArticles = new Set()) {
  const ownerByArticle = new Map();
  for (const product of sourceProducts) {
    for (const variant of product.variants) if (variant.owned) ownerByArticle.set(variant.articleNumber, product.sourceKey);
  }
  const bySourceKey = new Map(sourceProducts.map((product) => [product.sourceKey, product]));
  const result = (classification, sourceKey, evidence, extra = {}) => ({
    localSlug: local.slug,
    classification,
    sourceKey: sourceKey ?? null,
    officialName: sourceKey ? bySourceKey.get(sourceKey)?.officialName ?? null : null,
    evidence,
    autoApply: classification === "EXACT_MATCH" || classification === "HIGH_CONFIDENCE_MATCH",
    ...extra,
  });

  // 1–2. sopstvene zvanične šifre
  if (local.ownArticleNumbers.length) {
    const owners = [...new Set(local.ownArticleNumbers.map((article) => ownerByArticle.get(article)).filter(Boolean))];
    if (owners.length === 1) return result("EXACT_MATCH", owners[0], [`zapis nosi zvanične šifre: ${local.ownArticleNumbers.join(", ")}`]);
    if (owners.length > 1) return result("PROBABLE_MATCH", null, [`šifre zapisa pripadaju različitim zvaničnim proizvodima: ${owners.join(", ")}`], { candidates: owners });
    const onlyCatalogue = local.ownArticleNumbers.filter((article) => catalogueOnlyArticles.has(article));
    return result("LEGACY_NOT_ON_CURRENT_WEBSITE", null, [
      onlyCatalogue.length ? `šifre ${onlyCatalogue.join(", ")} postoje samo u PDF katalogu` : `šifre ${local.ownArticleNumbers.join(", ")} nisu ni na sajtu ni u PDF-u`,
    ]);
  }

  const localMeasures = new Set([...local.packages, local.name].map(measureKey).filter(Boolean));
  const variantsMatching = (product) =>
    [...product.variants, ...product.catalogueOnlyVariants].filter((variant) => localMeasures.has(measureKey(variant.descriptor ?? variant.rowText)));

  // 3. bajt-identična zvanična slika
  const imageOwner = local.imageSha256s.map((hash) => primaryImageBySha.get(hash)).find(Boolean) ?? null;
  // 4. tačan normalizovan naziv
  const nameOwners = sourceProducts.filter((product) => nameKey(product.officialName) && nameKey(product.officialName) === nameKey(local.name));

  if (imageOwner) {
    const product = bySourceKey.get(imageOwner);
    const variants = variantsMatching(product);
    if (variants.length) {
      return result("HIGH_CONFIDENCE_MATCH", imageOwner, [
        "naša slika je bajt-identična zvaničnoj slici proizvoda",
        `ručno pakovanje (${[...localMeasures].join(", ")}) = zvanična varijanta ${variants.map((variant) => variant.articleNumber).join(", ")}`,
      ], { matchedArticleNumbers: variants.map((variant) => variant.articleNumber) });
    }
    return result("PROBABLE_MATCH", imageOwner, ["naša slika je bajt-identična zvaničnoj, ali pakovanje zapisa ne postoji među zvaničnim varijantama"]);
  }
  if (nameOwners.length === 1) {
    const variants = variantsMatching(nameOwners[0]);
    if (variants.length) return result("HIGH_CONFIDENCE_MATCH", nameOwners[0].sourceKey, ["tačan zvanični naziv + isto pakovanje"], { matchedArticleNumbers: variants.map((variant) => variant.articleNumber) });
    return result("PROBABLE_MATCH", nameOwners[0].sourceKey, ["tačan zvanični naziv, pakovanje se ne poklapa"]);
  }

  return result("LOCAL_ONLY_UNKNOWN", null, ["nema zvanične šifre, slika nije zvanična, naziv ne odgovara nijednoj zvaničnoj stranici"]);
}
