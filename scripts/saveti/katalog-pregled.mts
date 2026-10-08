/**
 * Pregled kanonskih proizvoda i porodica za pisce rubrike „Saveti i vodiči“.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/saveti/katalog-pregled.mts
 *
 * Piše tmp/saveti/catalog-digest.json (slug, naziv, brend, program, faza,
 * kategorija, kratak opis, dokumenti) i tmp/saveti/families-digest.json.
 * U `proizvodi` članka sme samo slug iz ovog spiska (konsolidovane varijante
 * su izostavljene) ili `grupa:<slug porodice>`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getAllCarsystemProducts } from "../../lib/carsystem-data";
import { getAllProductFamilies, getConsolidatedVariantSlugs } from "../../lib/product-families";

const consolidated = getConsolidatedVariantSlugs();
const rows = getAllCarsystemProducts()
  .filter((product) => !consolidated.has(product.slug))
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    brand: product.brandSlug,
    program: product.programSlug,
    phase: product.phaseSlug,
    cat: product.taxonomyCategory,
    desc: (product.shortDescription ?? "").slice(0, 140),
    docs: (product.documents ?? []).map((document) => document.href).filter(Boolean).slice(0, 3),
  }));
const families = getAllProductFamilies().map((family) => ({ slug: family.slug, name: family.name, brand: family.brandSlug }));
mkdirSync("tmp/saveti", { recursive: true });
writeFileSync("tmp/saveti/catalog-digest.json", JSON.stringify(rows));
writeFileSync("tmp/saveti/families-digest.json", JSON.stringify(families));
console.log(`proizvoda: ${rows.length}, porodica: ${families.length}`);
