/**
 * Klasifikacija R-M sync zapisa ZA BREND STRANICU (`/brendovi/rm`).
 *
 * Ovo NIJE `rmMetadata` kataloga: rezultat se ne upisuje u kataloški zapis, pa ne menja SEO,
 * breadcrumb, pravilo boje, kategorijske stranice, filtere ni indeks pretrage. Služi samo da
 * brend stranica izabere i grupiše proizvode (sistemi, serije, porodice). Globalna migracija
 * na `rmMetadata` je posebna odluka.
 *
 * Izvodi se ISKLJUČIVO iz polja koja sync već izvodi iz zvaničnih izvora, nikad iz naziva:
 *
 *   code           ← slovo zvanične R-M oznake („A 2530X” → A = aditiv); isti ključ koji
 *                    sync koristi za „CV Products” (`ROLE_BY_LETTER` u `build-source.mjs`)
 *   role           ← kategorija R-M info-portala, kada oznaka nema poznato slovo
 *   line           ← R-M sistem kome zapis pripada (info-portal / sistemska stranica sajta)
 *   series         ← zvanična serija („Advance Series”, „Pioneer Series”)
 *   technologyTags ← zvanične tehnološke oznake info-portala
 *
 * `categoryLabel`: R-M kategorija „Basecoat/Topcoat” obuhvata i direktne završne boje (UNO HD,
 * GRAPHITE HD), pa se takav zapis na stranici ne predstavlja kao „Bazna boja”.
 *
 * Nepoznata vrednost se ne pogađa: nepoznata uloga → nema klasifikacije (zapis ne ulazi ni u
 * jednu grupu brend stranice), nepoznata linija/serija/oznaka → `null`. `finish` je uvek `null`.
 */

/**
 * Slovo zvanične oznake → R-M kategorija. Ima prednost nad kategorijom info-portala:
 * portal blendere i A 2610 vodi pod „Basecoat/Topcoat”, a oznaka i već potvrđeni zapisi
 * iz arhive (A 2520, A 2530, A 2560, A 2210, A 2220) ih vode kao aditive. Za sve ostale
 * zapise slovo i portal se slažu (proverava `lib/rmBrandClassification.test.mjs`).
 */
export const RM_CATEGORY_BY_DESIGNATION = Object.freeze({
  A: "additive",
  B: "bodyfiller",
  BC: "thinner",
  C: "clearcoat",
  GV: "thinner",
  H: "hardener",
  P: "primer-filler",
  PK: "cleaner",
  PM: "primer-filler",
  R: "thinner",
  RA: "thinner",
});

/** Uloga iz sync-a → R-M kategorija proizvoda. */
export const RM_CATEGORY_BY_ROLE = Object.freeze({
  additive: "additive",
  "basecoat-topcoat": "basecoat",
  bodyfiller: "bodyfiller",
  cleaner: "cleaner",
  clearcoat: "clearcoat",
  hardener: "hardener",
  thinner: "thinner",
  undercoat: "primer-filler",
});

/** Zvanični naziv R-M sistema → `RmSystemSlug`. CRYSTAL BASE namerno nije ovde: sync ga ne sadrži. */
export const RM_SYSTEM_BY_LINE = Object.freeze({
  AGILIS: "agilis",
  "ONYX HD": "onyx-hd",
  DIAMONT: "diamont",
  "UNO HD": "uno-hd",
  "GRAPHITE HD": "graphite-hd",
});

/** Zvanična serija → `RmSeriesSlug`. „GRAPHITE HD” u polju `series` je sistem, ne serija. */
export const RM_SERIES_BY_NAME = Object.freeze({
  "Advance Series": "advance",
  "Pioneer Series": "pioneer",
});

/** Tehnološka oznaka info-portala → `RmTechnologySlug`. */
export const RM_TECHNOLOGY_BY_TAG = Object.freeze({
  "UV-A": "uv",
  "Air-Drying": "air-drying",
  DTM: "dtm",
});

/** Prevod zvanične R-M kategorije „Basecoat/Topcoat”. */
export const RM_BASECOAT_TOPCOAT_LABEL = "Bazna ili završna boja";

function lookup(map, key) {
  return key != null && Object.hasOwn(map, key) ? map[key] : null;
}

/**
 * Kategorija iz slova oznake („PK 2A15” → PK), ili `null` kada oznaka nema poznato slovo.
 * @param {string|null|undefined} code
 */
export function rmCategoryFromDesignation(code) {
  const letters = /^([A-Z]{1,2}) \S/.exec(code ?? "")?.[1];
  return lookup(RM_CATEGORY_BY_DESIGNATION, letters);
}

/**
 * @param {{code: string|null, role: string, line: string|null, series: string|null, technologyTags?: string[]}} entry
 * @returns {{system: string|null, series: string|null, category: string, technology: string|null, finish: null, categoryLabel: string|null}|undefined}
 */
export function rmBrandClassificationFromSyncEntry(entry) {
  const category = rmCategoryFromDesignation(entry.code) ?? lookup(RM_CATEGORY_BY_ROLE, entry.role);
  if (!category) return undefined;

  const technologies = [...new Set((entry.technologyTags ?? []).map((tag) => lookup(RM_TECHNOLOGY_BY_TAG, tag)).filter(Boolean))];

  return {
    system: lookup(RM_SYSTEM_BY_LINE, entry.line),
    series: lookup(RM_SERIES_BY_NAME, entry.series),
    category,
    // Jedno polje, jedna tehnologija: dve zvanične oznake bi bile izbor, a ne dokaz.
    technology: technologies.length === 1 ? technologies[0] : null,
    finish: null,
    categoryLabel: category === "basecoat" && entry.role === "basecoat-topcoat" ? RM_BASECOAT_TOPCOAT_LABEL : null,
  };
}
