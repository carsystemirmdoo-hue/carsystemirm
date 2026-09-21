/**
 * Proizvodi čiji je IZVOR Carsystem katalog — bez obzira na brend koji vidi kupac.
 *
 * Od 2026-09-21 katalog se vodi u dve grupe (vidi `third-party-manufacturers.json`):
 *   CARSYSTEM_MANUFACTURER_PRODUCTS                       Carsystem-ovi sopstveni proizvodi (`brandSlug: carsystem`)
 *   THIRD_PARTY_PRODUCTS_LISTED_IN_CARSYSTEM_CATALOGUE    proizvodi drugih proizvođača koje Carsystem samo vodi (RUPES)
 *
 * Paritet sa zvaničnim izvorom (stranice, šifre artikala) meri se nad OBE grupe, jer izvor ne pravi razliku.
 * Izveštaji o Carsystem proizvodima ih razdvajaju: tuđi proizvod se ne broji kao Carsystem-ov.
 */
export const OWN_GROUP = "CARSYSTEM_MANUFACTURER_PRODUCTS";
export const THIRD_PARTY_GROUP = "THIRD_PARTY_PRODUCTS_LISTED_IN_CARSYSTEM_CATALOGUE";

export function partitionCarsystemSourced(runtimeProducts, dataset) {
  const manufacturerBySlug = new Map(dataset.products.filter((entry) => entry.manufacturer).map((entry) => [entry.slug, entry.manufacturer]));
  const own = runtimeProducts.filter((product) => product.brandSlug === "carsystem");
  const thirdParty = runtimeProducts.filter((product) => manufacturerBySlug.has(product.slug));
  return { own, thirdParty, sourced: [...own, ...thirdParty], manufacturerBySlug };
}

/**
 * Carsystem brojevi artikala koje zapis nosi. Kod tuđeg proizvoda `manufacturerCode` je oznaka modela
 * proizvođača, pa se broj artikla kartice sa jednom varijantom čita iz `externalSku`.
 */
export function articleIdsOf(product, manufacturerBySlug) {
  const rows = product.detail?.variants?.content.rows ?? [];
  if (rows.length) return rows.map((row) => row.id);
  if (manufacturerBySlug.has(product.slug)) return product.externalSku ? [product.externalSku] : [];
  return product.manufacturerCode ? [product.manufacturerCode] : [];
}
