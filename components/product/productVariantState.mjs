/**
 * Čista logika izbora aktivne varijante na PDP-u.
 *
 * Bez Reacta, bez DOM-a i bez `window` — da bi se ugovor izbora mogao dokazati
 * testom, a ne klikom kroz pretraživač. `ProductVariantProvider` je jedini
 * runtime vlasnik izbora; ovde su pravila po kojima on odlučuje.
 *
 * Ključ varijante je ono što stoji u `?varijanta=`. Namerno se ne izmišlja nov
 * identifikator: koristi se isti redosled koji `variantRedirectTarget`
 * (`lib/product-families.ts`) već upisuje u stare variant URL-ove, pa
 * preusmerenje i izbor u mestu pogađaju istu varijantu.
 *
 * Za poklapanje je dovoljno da zapis ima BILO KOJU od svojih oznaka — selektor i
 * kontekst drže dva različita modela iste varijante i ne dele sva polja.
 *
 * @typedef {{
 *   key?: string,
 *   id?: string,
 *   slug?: string,
 *   sku?: string | null,
 *   name?: string
 * }} VariantIdentity
 *
 * @typedef {{
 *   key: string,
 *   id: string,
 *   slug: string,
 *   sku?: string | null,
 *   name: string,
 *   image?: string | null,
 *   volume?: string | null,
 *   brandSlug?: string,
 *   familySlug?: string | null,
 *   inventoryKey?: string | null
 * }} VariantCartIdentity
 */

export const VARIANT_QUERY_PARAM = "varijanta";

/**
 * Sve oznake pod kojima se jedna varijanta sme prepoznati iz URL-a.
 *
 * Stari linkovi u opticaju nose čas šifru (`CL-810`), čas `variantId`, čas pun
 * slug. Sve tri moraju voditi na istu varijantu — inače deep link tiho pada na
 * reprezentativnu i korisnik dobije pogrešan proizvod bez ijedne poruke.
 *
 * @param {VariantIdentity} variant
 * @returns {string[]}
 */
export function variantAliases(variant) {
  if (!variant) return [];
  return [variant.key, variant.id, variant.sku, variant.slug]
    .filter((value) => typeof value === "string" && value !== "")
    .map((value) => value.toLowerCase());
}

/**
 * Varijanta koja odgovara traženoj oznaci, ili `null`.
 *
 * @param {readonly VariantIdentity[]} variants
 * @param {string | null | undefined} requested
 * @returns {VariantIdentity | null}
 */
export function findVariantByKey(variants, requested) {
  if (!requested || typeof requested !== "string") return null;
  const needle = requested.trim().toLowerCase();
  if (needle === "") return null;

  return (
    (variants ?? []).find((variant) =>
      variantAliases(variant).includes(needle),
    ) ?? null
  );
}

/**
 * Aktivna varijanta za dati zahtev, uz bezbedan pad.
 *
 * Nevažeća oznaka NIKADA ne baca i nikada ne ostavlja prazan izbor — vraća
 * reprezentativnu varijantu. Prazna lista varijanti je jedini slučaj koji daje
 * `null`, i tada PDP prikazuje proizvod bez selektora.
 *
 * @param {readonly VariantIdentity[]} variants
 * @param {string | null | undefined} requested
 * @param {string | null | undefined} [initialKey]
 * @returns {VariantIdentity | null}
 */
export function resolveActiveVariant(variants, requested, initialKey) {
  const list = variants ?? [];
  if (list.length === 0) return null;

  return (
    findVariantByKey(list, requested) ??
    findVariantByKey(list, initialKey) ??
    list[0]
  );
}

/**
 * Vrednost koja ide u `?varijanta=`.
 *
 * @param {VariantIdentity} variant
 * @returns {string}
 */
export function variantQueryValue(variant) {
  return variant?.key ?? variant?.id ?? "";
}

/**
 * Adresa sa upisanom aktivnom varijantom.
 *
 * Radi nad `URL`-om, pa se ostali parametri i hash čuvaju — izbor varijante ne
 * sme da obriše `?utm_source` ni sidro na koje je korisnik došao.
 *
 * @param {string} href
 * @param {VariantIdentity} variant
 * @returns {string}
 */
export function withVariantQuery(href, variant) {
  const value = variantQueryValue(variant);
  // Baza je potrebna samo da relativna adresa postane parsabilna; vraća se
  // isključivo putanja sa upitom, pa baza nikada ne procuri u izlaz.
  const url = new URL(href, "https://placeholder.invalid");
  if (value) url.searchParams.set(VARIANT_QUERY_PARAM, value);
  else url.searchParams.delete(VARIANT_QUERY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Upit za konkretnu varijantu.
 *
 * Javni CTA mora nositi baš onu varijantu koju korisnik trenutno gleda — i kad
 * je stigao direktnim linkom, i kad je kliknuo drugu karticu, i kad se vratio
 * Back-om.
 *
 * @param {string} inquiryHref
 * @param {VariantIdentity} variant
 * @returns {string}
 */
export function variantInquiryHref(inquiryHref, variant) {
  return withVariantQuery(inquiryHref, variant);
}

/**
 * Stavka za portal korpu.
 *
 * Namerno bez cene i bez stanja: `lib/cart/cart-model.mjs` je izričito model
 * liste za upit, a cena kupca se rešava na serveru. Ovde se prenosi samo
 * stabilan identitet aktivne varijante.
 *
 * @param {VariantCartIdentity | null | undefined} variant
 * @returns {{
 *   productSlug: string, familySlug: string | null, variantId: string | null,
 *   sku: string, name: string, image: string | null, volume: string | null,
 *   brandSlug: string, inventoryKey: string | null
 * } | null}
 */
export function toCartPayload(variant) {
  if (!variant) return null;

  return {
    productSlug: variant.slug,
    familySlug: variant.familySlug ?? null,
    variantId: variant.id ?? null,
    // Šifra je poslovni identitet; kad je izvor nema, slug ostaje jedini
    // stabilan ključ i prenosi se umesto izmišljene šifre.
    sku: variant.sku ?? variant.slug,
    name: variant.name,
    image: variant.image ?? null,
    volume: variant.volume ?? null,
    brandSlug: variant.brandSlug ?? "",
    inventoryKey: variant.inventoryKey ?? null,
  };
}
