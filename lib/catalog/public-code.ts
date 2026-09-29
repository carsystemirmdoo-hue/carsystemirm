import type { CarsystemProduct } from "@/lib/carsystem-data";

/**
 * `sku` onako kako sme da ga vidi kupac — jedino pravilo za sve javne prikaze.
 *
 * Kada izvor izričito potvrdi da zapis nema zvaničnu šifru (`skuIsInternalOnly`), `sku` je samo
 * interni ključ (danas: slug) i vraća se `null`: kartica, pretraga, PDP, SEO opis i JSON-LD ga ne
 * prikazuju kao šifru. Rute, `?varijanta=` ključ, korpa i interne veze i dalje koriste `sku`.
 *
 * Kao `variant-key.ts`, modul nema runtime uvoz, pa ga smeju koristiti i serverski i klijentski sloj.
 */
export function publicSkuOf(
  product: Pick<CarsystemProduct, "sku" | "skuIsInternalOnly">,
): string | null {
  return product.skuIsInternalOnly ? null : product.sku;
}
