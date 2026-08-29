/**
 * Pravila mapiranja BizniSoft artikla na kataloški proizvod — čista logika.
 *
 * Jedno pravilo nosi ceo modul: veza se pravi po TAČNOJ šifri ili se ne pravi.
 * Ne postoji funkcija koja poredi nazive, i to je namerno — kad bi postojala,
 * neko bi je pozvao „samo za predlog", a predlog koji izgleda ubedljivo se
 * potvrđuje bez provere.
 */

export const PRODUCT_MAPPING_STATUSES = [
  "unmapped",
  "suggested",
  "mapped",
  "conflict",
  "rejected",
];

/** Stanja u kojima artikal i dalje čeka odluku čoveka. */
export const OPEN_MAPPING_STATUSES = ["unmapped", "suggested", "conflict"];

const CODE_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,63}$/;

export class ProductMappingError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "ProductMappingError";
    this.code = code;
  }
}

/**
 * Priprema šifru artikla za poređenje.
 *
 * Isti razlog kao kod šifre partnera: interna šifra je string sa mogućom
 * vodećom nulom (`"005500"`), pa svaki numerički prolaz trajno menja vrednost.
 * Vidi `CarsystemProduct.internalCode` u `lib/carsystem-data.ts`.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeArticleCode(raw) {
  if (typeof raw !== "string") {
    throw new ProductMappingError(
      "Šifra artikla mora biti tekst — brojčani oblik gubi vodeće nule.",
      "not_a_string",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ProductMappingError("Šifra artikla je prazna.", "empty");
  }
  if (!CODE_SHAPE.test(trimmed)) {
    throw new ProductMappingError(
      `Šifra artikla „${trimmed}" nije u dozvoljenom obliku.`,
      "bad_shape",
    );
  }
  return trimmed;
}

/**
 * Predlog veze na osnovu jednoznačne tačne šifre.
 *
 * Ishod je uvek jedan od tri, i nijedan od njih nije „najverovatnije":
 *
 *   - `unmapped`  — nijedan kataloški proizvod ne nosi tu internu šifru;
 *   - `suggested` — tačno jedan nosi; predlog ide na potvrdu, ne u primenu;
 *   - `conflict`  — dva ili više nose istu šifru, što je greška u katalogu i
 *                   mora je videti čovek.
 *
 * @param {object} input
 * @param {string} input.articleCode  šifra iz BizniSofta
 * @param {readonly { slug: string, internalCode?: string | null }[]} input.catalogProducts
 * @returns {{ status: "unmapped" | "suggested" | "conflict",
 *             catalogProductSlug: string | null,
 *             candidates: string[],
 *             reason: string | null }}
 */
export function proposeExactMapping({ articleCode, catalogProducts }) {
  const code = normalizeArticleCode(articleCode);

  const matches = (catalogProducts ?? []).filter((product) => {
    if (typeof product?.internalCode !== "string") return false;
    // Tačno poklapanje, bez `localeCompare`, bez ignorisanja veličine slova:
    // interna šifra je identifikator, ne tekst za pretragu.
    return product.internalCode.trim() === code;
  });

  if (matches.length === 0) {
    return {
      status: "unmapped",
      catalogProductSlug: null,
      candidates: [],
      reason: null,
    };
  }

  if (matches.length === 1) {
    return {
      status: "suggested",
      catalogProductSlug: matches[0].slug,
      candidates: [matches[0].slug],
      reason: null,
    };
  }

  const candidates = matches.map((product) => product.slug).sort();
  return {
    status: "conflict",
    catalogProductSlug: null,
    candidates,
    reason: `Internu šifru „${code}" nosi više kataloških proizvoda: ${candidates.join(", ")}. Katalog mora prvo razrešiti duplikat.`,
  };
}

/**
 * Sme li se ova veza pokazati kupcu.
 *
 * Samo `mapped`. Predlog nije potvrda, a konflikt je izričita izjava da se ne
 * zna — nijedno od to dvoje ne sme kupcu izgledati kao proizvod.
 *
 * @param {{ status: string, catalogProductSlug?: string | null }} mapping
 */
export function isCustomerFacing(mapping) {
  return (
    mapping?.status === "mapped" &&
    typeof mapping.catalogProductSlug === "string" &&
    mapping.catalogProductSlug.length > 0
  );
}

/**
 * Kako se nemapiran artikal predstavlja internom korisniku.
 *
 * Poslovno postoji i vidi se; ono što nema je kataloški identitet. Zato nema ni
 * slike ni PDP linka — nasumična slika je tvrdnja o proizvodu koju niko nije
 * potvrdio, a pogrešna slika u ponudi je skuplja od prazne.
 *
 * @param {{ code: string, name: string }} article
 * @param {{ status: string, catalogProductSlug?: string | null } | null} mapping
 */
export function presentArticle(article, mapping) {
  const linked = mapping ? isCustomerFacing(mapping) : false;
  return {
    code: article.code,
    name: article.name,
    visibleInternally: true,
    catalogHref: linked ? `/katalog/${mapping.catalogProductSlug}` : null,
    imageAllowed: linked,
    status: mapping?.status ?? "unmapped",
  };
}

/**
 * Prelaz stanja mapiranja koji je dozvoljen.
 *
 * Vraća razlog odbijanja ili `null` kada je prelaz u redu. Postoji da bi se
 * pravilo „potvrda traži razlog" i „potvrda bez sluga nije potvrda" moglo
 * dokazati bez baze.
 *
 * @param {object} input
 * @param {string} input.from
 * @param {string} input.to
 * @param {string | null | undefined} input.catalogProductSlug
 * @param {string | null | undefined} input.note
 * @returns {string | null}
 */
export function rejectMappingTransition({ from, to, catalogProductSlug, note }) {
  if (!PRODUCT_MAPPING_STATUSES.includes(to)) {
    return `Nepoznato stanje mapiranja „${to}".`;
  }
  if (from === "rejected" && to !== "unmapped") {
    return 'Odbijena veza se ponovo otvara samo kroz stanje „unmapped".';
  }
  if (to === "mapped") {
    if (!catalogProductSlug) {
      return "Potvrda veze traži kataloški proizvod — potvrda bez njega ne znači ništa.";
    }
    if (!note || note.trim().length < 3) {
      return "Potvrda veze traži razlog (najmanje 3 znaka).";
    }
  }
  if (to === "rejected" && (!note || note.trim().length < 3)) {
    return "Poništavanje veze traži razlog (najmanje 3 znaka).";
  }
  return null;
}
