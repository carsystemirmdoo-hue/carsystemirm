import type { CarsystemProduct } from "@/lib/carsystem-data";

/**
 * Kanonski ključ varijante — jedina formula u sistemu.
 *
 * Vrednost koja stoji u `?varijanta=`. Dva mesta je moraju dati identično:
 *
 *   - `productVariantKey()` (`components/product/productVariantView.ts`), koji
 *     je upisuje kada korisnik izabere varijantu na strani;
 *   - `variantRedirectTarget()` (`lib/product-families.ts`), koji je upisuje
 *     kada stari per-varijanta URL preusmeri na family PDP.
 *
 * Zašto ovde, a ne dva puta
 * -------------------------
 * Formula je ranije stajala prepisana na oba mesta, sa različitim redosledom
 * (`sku` pre `variantId` na jednom, obrnuto na drugom). Posledica nije bila
 * teorijska: 56 varijanti bez `cosmosCode` — cela `cosmos-lac-fast-acrylic`
 * porodica — dobijalo je od preusmerenja `?varijanta=<variantId>`, a od izbora
 * na strani `?varijanta=<sku>`. Ista varijanta na dve adrese. Ne pada nijedan
 * zahtev, jer `findVariantByKey` prihvata obe oznake kao alias, pa se kvar ne
 * vidi — samo se tiho udvostruči adresa i canonical se razmimoiđe sa onim što
 * korisnik ima u traci.
 *
 * Modul namerno nema nijedan runtime uvoz: `CarsystemProduct` ulazi kao tip, pa
 * ga smeju uvesti i serverski i klijentski sloj bez lanca zavisnosti.
 *
 * Redosled
 * --------
 *   1. `cosmosCode` — javna šifra artikla, ono što korisnik vidi i deli;
 *   2. `sku`        — kataloška šifra; stabilna i kada šifre artikla nema;
 *   3. `variantId`  — interni identifikator varijante;
 *   4. `slug`       — poslednja odbrana, uvek postoji.
 *
 * Promena redosleda menja SVAKU postojeću `?varijanta=` adresu u opticaju, pa
 * se ne dira bez preusmerenja za stare vrednosti.
 */
export function canonicalVariantKey(product: CarsystemProduct): string {
  return (
    product.catalogMetadata?.cosmosCode ??
    product.sku ??
    product.variantId ??
    product.slug
  );
}
