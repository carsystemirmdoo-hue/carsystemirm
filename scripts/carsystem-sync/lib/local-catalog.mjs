/**
 * Čitanje NAŠEG postojećeg Carsystem kataloga za potrebe synca.
 *
 * Ide kroz `scripts/lib/catalog-runtime.mjs` — iste module koje izvršava javni
 * sajt — pa sync vidi tačno ono što korisnik vidi, a ne regex-rekonstrukciju
 * `lib/carsystem-data.ts`.
 *
 * „Postojeći” ovde znači RUČNO vođen zapis. Proizvodi koje je sync sam uvezao
 * (slug je u identity registru sa `origin: "sync"`) nisu predmet matchinga —
 * inače bi drugo pokretanje poredilo katalog sa samim sobom.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./config.mjs";
import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";
import { PRODUCT_NAMED_COLORS } from "../../../lib/productNamedColors.mjs";

const ARTICLE = /\b\d{3}\.\d{3}\b/g;
const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";

/**
 * Izvorni tekst ručnih zapisa. Red tabele varijanti koji je DODAO sync (dopuna)
 * ne sme da se vrati kao „šifra koju zapis sam nosi” — inače bi drugi prolaz isti
 * zapis video kao EXACT_MATCH umesto onoga što je stvarno dokazano, pa plan ne bi
 * bio idempotentan. Ručno upisana šifra doslovno stoji u ovom fajlu.
 */
const handWrittenSource = readFileSync(path.join(REPO_ROOT, "lib/carsystem-data.ts"), "utf8");

const articlesIn = (value) => [...String(value ?? "").matchAll(ARTICLE)].map((match) => match[0]);

/**
 * @param {Set<string>} syncSlugs slugovi koje je uvezao sync
 */
export function loadLocalCarsystemProducts(syncSlugs) {
  const { products } = loadCatalogRuntime();
  const all = products.filter((product) => product.brandSlug === "carsystem");

  const local = all
    .filter((product) => !syncSlugs.has(product.slug))
    .map((product) => {
      const rows = product.detail?.variants?.content?.rows ?? [];
      const variantArticles = rows
        .flatMap((row) => articlesIn(`${row.id} ${row.values?.article ?? ""}`))
        .filter((articleNumber) => handWrittenSource.includes(`"${articleNumber}"`));
      const skuArticles = articlesIn(`${product.sku} ${product.manufacturerCode ?? ""} ${product.externalSku ?? ""}`);

      const imageSrc = product.productImage?.src ?? null;
      const imageFile = imageSrc && imageSrc !== PLACEHOLDER_IMAGE ? path.join(REPO_ROOT, "public", imageSrc) : null;
      const imageSha256 =
        imageFile && existsSync(imageFile) ? createHash("sha256").update(readFileSync(imageFile)).digest("hex") : null;

      // Lokalno hostovani dokumenti (TDS): bajt-identičan zvanični dokument je
      // dokaz identiteta iste težine kao bajt-identičan packshot.
      const documentSha256s = (product.documents ?? [])
        .filter((doc) => doc.status === "available" && doc.href?.startsWith("/"))
        .map((doc) => path.join(REPO_ROOT, "public", doc.href))
        .filter((file) => existsSync(file))
        .map((file) => createHash("sha256").update(readFileSync(file)).digest("hex"));

      return {
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        manufacturerCode: product.manufacturerCode ?? null,
        internalCode: product.internalCode ?? null,
        /** Šifre koje zapis SAM nosi (sku, tabela varijanti). */
        ownArticleNumbers: [...new Set([...skuArticles, ...variantArticles])],
        /** Raspon serije potvrđen u `lib/productNamedColors.mjs` (naš podatak, sa izvorom). */
        seriesArticleNumbers: articlesIn(PRODUCT_NAMED_COLORS[product.slug]?.series),
        variantRowIds: rows.map((row) => row.id).filter((id) => handWrittenSource.includes(`"${id}"`)),
        hasVariantTable: rows.length > 0,
        hasPlaceholderImage: !imageSrc || imageSrc === PLACEHOLDER_IMAGE,
        hasPlaceholderSku: !skuArticles.length,
        imageSrc,
        imageSha256,
        documentSha256s,
        packages: (product.packages ?? []).map((item) => item.label),
        specifications: product.specifications ?? [],
        hasTds: (product.documents ?? []).some((doc) => doc.status === "available" && doc.href),
        programSlug: product.programSlug,
      };
    });

  return { local, syncImported: all.filter((product) => syncSlugs.has(product.slug)), allSlugs: new Set(products.map((p) => p.slug)) };
}
