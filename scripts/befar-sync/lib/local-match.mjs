/**
 * Naši postojeći (RUČNO vođeni) Befar zapisi i njihovo uparivanje sa zvaničnim proizvodima.
 *
 * LESTVICA (prvo što odluči; fuzzy naziv nikad nije dovoljan sam):
 *   1. zvanična Befar šifra koju zapis SAM nosi (doslovno u lib/carsystem-data.ts) → EXACT_MATCH
 *   2. `sku` / `manufacturerCode` = zvanična šifra                                    → EXACT_MATCH
 *   3. porodica + boja + dimenzija daju TAČNO JEDNU zvaničnu varijantu               → HIGH_CONFIDENCE_MATCH
 *   4. boja + dimenzija odgovaraju VIŠE zvaničnih varijanti (više porodica/linija)   → PROBABLE_MATCH
 *   5. ništa od navedenog                                                             → LEGACY_LOCAL_ONLY
 *
 * Placeholder SKU (`BEFAR-PAD-OR-25X150`) nije identitet proizvođača. PROBABLE ne
 * spaja ništa: ručni zapis ostaje, a zvanični proizvodi se uvoze zasebno.
 *
 * Dokaz se čita iz onoga što je zapis SAM upisao; šifre koje bi sync dodao dopunom ne
 * računaju se kao sopstvene (zamka idempotentnosti iz C.A.R.FIT synca).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";
import { BRAND, REPO_ROOT } from "./config.mjs";

const OFFICIAL_CODE = /\b\d{5,6}[A-Z]{0,4}\b/g;
const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";
const handWrittenSource = readFileSync(path.join(REPO_ROOT, "lib/carsystem-data.ts"), "utf8");

const COLOUR_FROM_SR = [
  [/narand[zž]ast/i, "orange"], [/\bcrn/i, "black"], [/\bbel/i, "white"], [/\bplav/i, "blue"], [/[zž]ut/i, "yellow"], [/krem/i, "cream"], [/bordo/i, "burgundy"],
];

/** „25 mm x 150 mm”, „150x25mm”, „150 x 25 mm” → „25x150” (manja × veća, red nije bitan). */
export function dimensionKey(value) {
  const numbers = [...String(value ?? "").matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", "."))).slice(0, 2);
  return numbers.length === 2 ? numbers.sort((a, b) => a - b).join("x") : null;
}

export const colourKey = (value) => {
  const text = String(value ?? "").toLowerCase();
  const direct = ["orange", "black", "white", "blue", "yellow", "cream", "burgundy"].find((word) => text.includes(word));
  return direct ?? COLOUR_FROM_SR.find(([pattern]) => pattern.test(text))?.[1] ?? null;
};

/** @param {Set<string>} syncSlugs slugovi koje je uvezao sync */
export function loadLocalProducts(syncSlugs) {
  const { products } = loadCatalogRuntime();
  const all = products.filter((product) => product.brandSlug === BRAND.slug);
  const local = all
    .filter((product) => !syncSlugs.has(product.slug))
    .map((product) => {
      const rows = product.detail?.variants?.content?.rows ?? [];
      const literal = (code) => handWrittenSource.includes(`"${code}"`);
      const own = [...`${product.sku ?? ""} ${product.manufacturerCode ?? ""} ${product.externalSku ?? ""} ${rows.map((row) => row.id).join(" ")}`.matchAll(OFFICIAL_CODE)].map((match) => match[0]).filter(literal);
      const imageSrc = product.productImage?.src ?? null;
      return {
        slug: product.slug,
        name: product.name,
        sku: product.sku ?? null,
        ownCodes: [...new Set(own)],
        hasPlaceholderSku: !own.length,
        hasPlaceholderImage: !imageSrc || imageSrc === PLACEHOLDER_IMAGE || /\.svg$/i.test(imageSrc),
        imageSrc,
        colour: colourKey(product.name),
        dimension: dimensionKey((product.packages ?? []).map((item) => item.label).join(" ") || product.name),
        hasDescription: Boolean(product.shortDescription),
      };
    });
  // Veličina CELOG kataloga se namerno ne vraća: to je živa metrika svih brendova, pa bi izveštaj
  // ovog synca menjala svaki kasnije dodat proizvođač (`<brand>:sync:check` mora ostati prazan).
  return { local, allSlugs: new Set(products.map((product) => product.slug)) };
}

export function matchLocalProduct(local, sourceProducts) {
  const result = (classification, candidates, evidence) => ({
    localSlug: local.slug,
    classification,
    sourceKey: classification === "EXACT_MATCH" || classification === "HIGH_CONFIDENCE_MATCH" ? candidates[0].sourceKey : null,
    candidates: candidates.map((candidate) => ({ sourceKey: candidate.sourceKey, officialName: candidate.displayNameEn, codes: candidate.codes })),
    evidence,
    autoApply: classification === "EXACT_MATCH" || classification === "HIGH_CONFIDENCE_MATCH",
  });

  if (local.ownCodes.length) {
    const owners = sourceProducts.filter((product) => product.variants.some((variant) => local.ownCodes.includes(variant.code)));
    if (owners.length === 1) return result("EXACT_MATCH", [{ ...owners[0], codes: local.ownCodes }], [`zapis nosi zvanične šifre: ${local.ownCodes.join(", ")}`]);
    if (owners.length > 1) return result("PROBABLE_MATCH", owners.map((owner) => ({ ...owner, codes: local.ownCodes })), ["šifre zapisa pripadaju različitim zvaničnim proizvodima"]);
    return result("LEGACY_LOCAL_ONLY", [], [`šifre ${local.ownCodes.join(", ")} nisu na aktuelnom sajtu`]);
  }

  if (local.colour && local.dimension) {
    const candidates = sourceProducts
      .map((product) => ({ ...product, codes: product.variants.filter((variant) => colourKey(variant.colour) === local.colour && dimensionKey(variant.size) === local.dimension).map((variant) => variant.code) }))
      .filter((product) => product.codes.length);
    const codes = candidates.flatMap((candidate) => candidate.codes);
    if (codes.length === 1) return result("HIGH_CONFIDENCE_MATCH", candidates, [`boja (${local.colour}) + dimenzija (${local.dimension} mm) daju tačno jednu zvaničnu varijantu: ${codes[0]}`]);
    if (codes.length > 1) {
      return result("PROBABLE_MATCH", candidates, [`boja (${local.colour}) + dimenzija (${local.dimension} mm) odgovaraju ${codes.length} zvaničnih šifara u ${candidates.length} porodica (${codes.join(", ")}) — bez zvanične šifre se ne može znati koja je naša`]);
    }
  }
  return result("LEGACY_LOCAL_ONLY", [], ["nema zvanične šifre; boja i dimenzija ne odgovaraju nijednoj zvaničnoj varijanti"]);
}
