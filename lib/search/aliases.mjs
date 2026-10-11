/**
 * Kontrolisani sinonimi pretrage.
 *
 * Ovo NIJE taxonomy mapping. Grupa ovde znači samo „ako korisnik ukuca ovu reč,
 * pokušaj i sa ostalima iz grupe" — ne menja kategoriju proizvoda, ne upisuje se
 * u podatke i ne koristi se kao zamena za konačnu poslovnu klasifikaciju
 * (docs/CATALOG_TAXONOMY.md). Alias pogodak nosi najnižu težinu u rangiranju,
 * pa nikada ne može da pretekne pogodak po nazivu ili šifri.
 *
 * Podaci su eksplicitni namerno: heuristika tipa „skini nastavak pa uporedi"
 * na srpskom daje nepredvidive parove (`lak` ↔ `lakat`), a pretraga mora biti
 * objašnjiva. Svaka grupa je simetrična — bilo koji član nalazi sve ostale.
 *
 * Termini se pišu u normalizovanom obliku (vidi `normalize.mjs`): mala slova,
 * bez dijakritike, `đ → dj`.
 */

/** @type {string[][]} */
export const SEARCH_ALIAS_GROUPS = [
  ["lak", "lakovi", "clearcoat", "clear", "coat", "bezbojni"],
  ["prajmer", "primer", "temelj", "podloga", "filler", "punilac"],
  ["ucvrscivac", "hardener", "aktivator", "activator", "katalizator"],
  ["razredjivac", "thinner", "razredjivaci", "razredjivanje"],
  ["sprej", "spray", "aerosol", "sprejevi"],
  ["kit", "kitovi", "bodyfiller", "putty"],
  ["bazna", "baza", "basecoat", "base"],
  ["boja", "boje", "paint", "nijansa"],
  ["brusni", "brusna", "brusne", "smirgla", "abraziv", "abrazivi", "abrasive", "sanding"],
  /*
   * Srpski nazivi abraziva i boja ne postoje u zvaničnim (engleskim) nazivima, pa bez ovih
   * parova „brusni papir” nalazi samo jedan proizvod, a „sprej crni mat” nijedan u celini.
   */
  ["papir", "papirni", "paper"],
  ["film", "filmski"],
  ["mreza", "mrezasti", "net"],
  ["flis", "runo", "fleece"],
  ["disk", "diskovi", "disc", "discs"],
  ["traka", "trake", "strips", "rolna", "roll"],
  ["crni", "crna", "crno", "black"],
  ["beli", "bela", "belo", "white"],
  ["mat", "matt", "matte"],
  ["sjaj", "sjajni", "sjajna", "gloss", "glossy"],
  ["poliranje", "polir", "polish", "polishing", "pasta", "compound"],
  ["pistolj", "pistolji", "gun", "spraygun"],
  ["maskiranje", "masking", "traka", "tape"],
  /*
   * Antikorozivna zaštita i zaštita od udara kamenčića su DVE različite funkcije, pa su i dve
   * grupe. Dok je katalog imao samo Cosmos Lac Antichip/Antigravel, spojena grupa se nije
   * videla; sa R-M antikorozivnim prajmerima upit „antichip” je počeo da vraća i njih.
   */
  ["antikorozivni", "antikorozija", "anticorrosive", "antirust"],
  ["antichip", "antigravel", "stonechip"],
  ["ciscenje", "cistac", "cleaner", "odmascivac", "degreaser"],
];

/**
 * Termin → svi ostali termini iz njegovih grupa.
 *
 * Gradi se jednom, na nivou modula: tabela je statična i ne zavisi od podataka
 * o proizvodima, pa nema razloga da se prepravlja po upitu.
 *
 * @type {Map<string, string[]>}
 */
const ALIAS_LOOKUP = (() => {
  /** @type {Map<string, Set<string>>} */
  const lookup = new Map();

  for (const group of SEARCH_ALIAS_GROUPS) {
    for (const term of group) {
      const bucket = lookup.get(term) ?? new Set();
      for (const other of group) if (other !== term) bucket.add(other);
      lookup.set(term, bucket);
    }
  }

  return new Map(
    // Sortirano: alias-i ulaze u pretragu determinističkim redosledom, pa je i
    // rezultat isti kroz pokretanja bez oslanjanja na redosled ubacivanja.
    [...lookup].map(([term, others]) => [term, [...others].sort()]),
  );
})();

/**
 * @param {string} token normalizovan token upita
 * @returns {string[]} sinonimi, prazan niz kada ih nema
 */
export function aliasesFor(token) {
  return ALIAS_LOOKUP.get(token) ?? [];
}

/** @returns {number} broj termina koji uopšte imaju sinonim */
export function aliasTermCount() {
  return ALIAS_LOOKUP.size;
}
