/**
 * Pravilo „proizvod je boja" — jedan izvor istine za dva mesta u interfejsu:
 *
 *   1. grafit iza proizvoda na detaljnoj stranici (`shouldRenderProductHeroSpray`);
 *   2. razlikovanje STVARNE nijanse proizvoda od dekorativne boje kartice
 *      u katalogu (`getProductDataShade` → boja brenda kao rezerva).
 *
 * Plain JS iz istog razloga kao `lib/productTaxonomy.mjs`: isto pravilo
 * izvršavaju tipizirani kod, `node --test` i validatori — nema druge tabele.
 *
 * Boja je ono što se kupuje zbog nijanse: bazne i završne boje, mešni tonovi i
 * aerosoli za farbanje. Nije boja ono što je deo sistema ali nema nijansu —
 * bezbojni lak, prajmer, učvršćivač, razređivač, aditiv, konverter — niti bilo
 * koji aerosol koji nije farba (čistač, odmašćivač, mazivo, zaštita podvozja).
 *
 * Reč „sprej" u nazivu i pripadnost brendu se NE koriste kao dokaz. Lestvica
 * dokaza, prvi primenljivi red pobeđuje:
 *
 *   0. `PAINT_RULE_OVERRIDES`          — centralizovani izuzeci, po slugu
 *   1. `rmMetadata.category`           — kategorija proizvođača (R-M)
 *   2. `visual.productType`            — pregledani vizuelni tokeni (Cosmos Lac);
 *                                        `"color"` = aerosol za farbanje, dok
 *                                        `"spray"` (antichip, cink) NIJE farba
 *   3. Baslac sistemske baze           — `catalogMetadata` linije 30/35/45 sa
 *                                        završnicom tona (Solid/Pearl/…), ne
 *                                        konverter, aditiv ili tehnički deo
 *   4. ništa od navedenog              — nije boja (bez pogađanja)
 */

/**
 * Izuzeci po stabilnom slugu. `true` = boja, `false` = nije boja, i kada bi
 * ostatak lestvice rekao suprotno. Svaki unos nosi razlog.
 *
 * @type {Readonly<Record<string, boolean>>}
 */
export const PAINT_RULE_OVERRIDES = Object.freeze({
  // Ručno unet zapis bez metapodataka: Line 30 2K završni ton (badge „2K završna boja").
  "baslac-30-s510-s-serija": true,
  // Line 30 Mixing Clear je bezbojni deo sistema — nema ton, iako je „Transparent".
  "baslac-30-s00": false,
});

/** R-M kategorije koje su same po sebi boja. */
export const RM_PAINT_CATEGORIES = new Set(["basecoat"]);

/** Baslac linije čiji mešni tonovi jesu boja. Line 30 CV je samo konverter. */
const BASLAC_PAINT_LINE = /^Line (30|35|45)$/;

/** Završnice tona iz `baslacFinishLabels`; Converter/Aditiv/Tehnički nisu ton. */
export const BASLAC_PAINT_FINISHES = new Set([
  "Solid",
  "Transparent",
  "Metallic",
  "Pearl",
  "Xirallic",
]);

/**
 * @param {{slug: string, rmMetadata?: {category?: string}|null, visual?: {productType?: string}|null, catalogMetadata?: {technicalCategory?: string|null, finish?: string|null}|null}} product
 * @returns {boolean}
 */
export function isPaintProduct(product) {
  const override = PAINT_RULE_OVERRIDES[product.slug];
  if (typeof override === "boolean") return override;

  const rmCategory = product.rmMetadata?.category;
  if (rmCategory) return RM_PAINT_CATEGORIES.has(rmCategory);

  const visual = product.visual;
  if (visual) return visual.productType === "color";

  const metadata = product.catalogMetadata;
  if (metadata) {
    return (
      BASLAC_PAINT_LINE.test(metadata.technicalCategory ?? "") &&
      BASLAC_PAINT_FINISHES.has(metadata.finish ?? "")
    );
  }

  return false;
}

/**
 * Izvori boje koji su izmereni ili pročitani iz zvaničnog izvora, ne procenjeni.
 * `manual-estimate` je urednička procena boje ambalaže i ne računa se kao nijansa
 * proizvoda koji nije sam po sebi boja.
 */
const SHADE_SOURCES = new Set(["official-chart", "ral", "cap-sample", "name-derived"]);

/** Tipovi kod kojih izmerena boja jeste nijansa proizvoda (beli prajmer, sivi kit…). */
const SHADE_BEARING_TYPES = new Set(["spray", "primer", "filler"]);

/**
 * Stvarna nijansa proizvoda iz PODATAKA, ili `null`.
 *
 * Za proizvod koji je boja (`productType === "color"`) svaki pregledani token je
 * njegova nijansa. Za prajmere, kitove i zaštitne sprejeve nijansa postoji samo
 * kada je boja izmerena ili izvedena iz naziva nijanse. Čistači, maziva, lakovi
 * i ostali neutralni proizvodi nemaju nijansu — njihov token je boja ambalaže.
 *
 * Crna i bela su validne nijanse; providne/bezbojne varijante ostaju `null`.
 *
 * @param {{visual?: {productType?: string, backgroundColor?: string, colorSource?: string}|null}} product
 * @returns {string|null}
 */
export function getProductDataShade(product) {
  const visual = product.visual;
  if (!visual?.backgroundColor) return null;
  if (visual.productType === "color") return visual.backgroundColor;
  if (SHADE_BEARING_TYPES.has(visual.productType ?? "") && SHADE_SOURCES.has(visual.colorSource ?? "")) {
    return visual.backgroundColor;
  }
  return null;
}
