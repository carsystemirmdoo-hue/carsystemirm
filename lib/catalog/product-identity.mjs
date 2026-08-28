/**
 * Pravila identiteta kataloškog proizvoda.
 *
 * Čista logika, bez I/O i bez učitavanja kataloga — sve ulazi kao argument, pa
 * se svako pravilo može dokazati izvršavanjem nad kontrolisanim fixtureom, a ne
 * regexom nad izvornim kodom. `scripts/validate-product-identity.mjs` je tanak
 * CLI oko `auditProductIdentity()`.
 *
 * Modul je `.mjs` iz istog razloga kao `lib/productTaxonomy.mjs`: isti fajl
 * izvršavaju i validator i `node --test`, bez transpajlera.
 */

/**
 * Oblik naše interne šifre u finalnom katalogu: tačno šest cifara.
 *
 * Namerno bez `Number` semantike. `"005500"` je validno, `5500` nije — i to
 * nije formalnost: vodeća nula je deo šifre, a `Number("005500")` je trajno
 * gubi. Sve provere ispod prvo traže `typeof === "string"`.
 */
export const INTERNAL_CODE_PATTERN = /^\d{6}$/;

/**
 * Zašto vrednost nije prihvatljiva interna šifra.
 *
 * Vraća `null` kada jeste — pozivalac tako dobija i odluku i objašnjenje iz
 * jednog poziva, umesto da poruku greške sastavlja sam.
 *
 * @param {unknown} value
 * @returns {string | null} razlog odbijanja, ili `null` ako je vrednost validna
 */
export function internalCodeRejectionReason(value) {
  if (typeof value === "number") {
    return "interna šifra je broj — vodeće nule su izgubljene, mora biti string";
  }
  if (typeof value !== "string") {
    return `interna šifra mora biti string, dobijeno ${value === null ? "null" : typeof value}`;
  }
  if (value === "") return "interna šifra je prazan string";
  if (value !== value.trim()) return "interna šifra ima vodeći ili prateći razmak";
  if (!INTERNAL_CODE_PATTERN.test(value)) {
    return `interna šifra "${value}" nije tačno šest cifara`;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidInternalCode(value) {
  return internalCodeRejectionReason(value) === null;
}

/**
 * Da li je `manufacturerCode` u dozvoljenom obliku.
 *
 * `undefined` = još nije provereno, `null` = provereno pa nije potvrđena,
 * neprazan string = potvrđena šifra. Prazan string nije nijedno od to troje i
 * zato je greška — sakrio bi razliku između „nema je" i „nismo gledali".
 *
 * @param {unknown} value
 * @returns {string | null} razlog odbijanja, ili `null`
 */
export function manufacturerCodeRejectionReason(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return `šifra proizvođača mora biti string, null ili undefined, dobijeno ${typeof value}`;
  }
  if (value.trim() === "") {
    return "šifra proizvođača je prazan string — koristiti null za „provereno, nema je\"";
  }
  return null;
}

/**
 * Kako se danas izvodi `sku` po izvoru zapisa.
 *
 * Ovo NIJE klasifikacija proizvoda nego dijagnostika preopterećenog polja:
 * `sku` je kod R-M i Baslac-a šifra proizvođača, kod Cosmos Lac-a izvedeni ID,
 * a kod ručno pisanih zapisa izmišljen string. Validator to prijavljuje da bi
 * ostalo vidljivo zašto interna šifra ne sme da se ugura u `sku`.
 *
 * @param {{ sku?: string, externalSku?: string, brandSlug?: string }} product
 * @returns {"manufacturer-code-mirrored" | "manufacturer-code" | "derived-id" | "invented"}
 */
export function classifySkuSemantics(product) {
  const sku = product.sku ?? "";
  // R-M uvoz upisuje istu vrednost u oba polja (`lib/rm-imported-products.ts`).
  if (product.externalSku && product.externalSku === sku) return "manufacturer-code-mirrored";
  // Cosmos generator gradi `sku` iz sopstvenog `id` (`lib/cosmos-lac-data.ts`).
  if (/^CL-/i.test(sku)) return "derived-id";
  // Baslac generator upisuje article code proizvođača (`35-M214`, `20-24`).
  if (/^\d{2}-/.test(sku)) return "manufacturer-code";
  return "invented";
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string | null | undefined} keyOf
 * @returns {{ key: string, members: T[] }[]} samo grupe sa više od jednog člana
 */
function duplicateGroups(items, keyOf) {
  /** @type {Map<string, T[]>} */
  const buckets = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null || key === undefined || key === "") continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return [...buckets]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({ key, members }))
    .sort((first, second) => first.key.localeCompare(second.key));
}

/**
 * Puna revizija identiteta nad prosleđenim katalogom.
 *
 * Ne učitava ništa sama i ne zna odakle podaci dolaze — validator joj daje
 * stvarni runtime katalog, test joj daje fixture. Isti kod, oba puta.
 *
 * @param {{
 *   products: any[],
 *   families?: any[],
 *   variantKeyOf?: (product: any) => string,
 * }} input
 *   `variantKeyOf` mora biti STVARNI `productVariantKey`
 *   (`components/product/productVariantView.ts`) — sudar se meri nad ključem
 *   koji korisnik dobije u `?varijanta=`, ne nad našom rekonstrukcijom.
 */
export function auditProductIdentity({ products, families = [], variantKeyOf }) {
  const conflicts = [];
  const add = (kind, message, detail) => conflicts.push({ kind, message, detail });

  /* -- Slug ---------------------------------------------------------------- */

  for (const { key, members } of duplicateGroups(products, (product) => product.slug)) {
    add(
      "duplicate-slug",
      `Slug "${key}" nose ${members.length} zapisa — samo prvi je dostupan preko getCarsystemProductBySlug().`,
      { slug: key, skus: members.map((member) => member.sku) },
    );
  }

  /* -- Interna šifra ------------------------------------------------------- */

  const withInternalCode = products.filter((product) => product.internalCode !== undefined);
  for (const product of withInternalCode) {
    const reason = internalCodeRejectionReason(product.internalCode);
    if (reason) {
      add("invalid-internal-code", `${product.slug}: ${reason}.`, {
        slug: product.slug,
        value: product.internalCode,
        valueType: typeof product.internalCode,
      });
    }
  }

  for (const { key, members } of duplicateGroups(
    withInternalCode,
    (product) => (typeof product.internalCode === "string" ? product.internalCode : null),
  )) {
    add(
      "duplicate-internal-code",
      `Interna šifra "${key}" postoji na ${members.length} zapisa — šifra je glavni poslovni identifikator i mora biti jedinstvena.`,
      { internalCode: key, slugs: members.map((member) => member.slug) },
    );
  }

  /* -- Šifra proizvođača --------------------------------------------------- */

  for (const product of products) {
    const reason = manufacturerCodeRejectionReason(product.manufacturerCode);
    if (reason) {
      add("invalid-manufacturer-code", `${product.slug}: ${reason}.`, {
        slug: product.slug,
        value: product.manufacturerCode,
      });
    }
  }

  /* -- Sudar selekcionog ključa u variant-pdp porodicama ------------------- */

  if (variantKeyOf) {
    for (const family of families) {
      if (family.presentation !== "variant-pdp") continue;
      const collisions = duplicateGroups(family.variants ?? [], variantKeyOf);
      for (const { key, members } of collisions) {
        add(
          "variant-key-collision",
          `Porodica "${family.slug}": ključ ?varijanta=${key} pokazuje na ${members.length} varijanti — izbor varijante je dvosmislen.`,
          { family: family.slug, key, slugs: members.map((member) => member.slug) },
        );
      }
    }
  }

  /* -- Zbir ---------------------------------------------------------------- */

  /** @type {Record<string, number>} */
  const skuSemantics = {};
  for (const product of products) {
    const kind = classifySkuSemantics(product);
    skuSemantics[kind] = (skuSemantics[kind] ?? 0) + 1;
  }

  /** @type {Record<string, number>} */
  const byKind = {};
  for (const conflict of conflicts) byKind[conflict.kind] = (byKind[conflict.kind] ?? 0) + 1;

  return {
    totals: {
      products: products.length,
      withInternalCode: products.filter((product) => typeof product.internalCode === "string")
        .length,
      withManufacturerCode: products.filter(
        (product) => typeof product.manufacturerCode === "string",
      ).length,
      manufacturerCodeCheckedAndAbsent: products.filter(
        (product) => product.manufacturerCode === null,
      ).length,
      manufacturerCodeUnchecked: products.filter(
        (product) => product.manufacturerCode === undefined,
      ).length,
      withExternalSku: products.filter((product) => Boolean(product.externalSku)).length,
    },
    skuSemantics,
    conflicts,
    conflictsByKind: byKind,
    hasConflicts: conflicts.length > 0,
  };
}
