/**
 * Komponente na stranici proizvoda (h3 blokovi: „Clearcoat”, „Hardener”, „Discs”…).
 *
 * PRAVILO (determinističko, dokumentovano u docs/CARFIT_CATALOG_SYNC.md):
 *
 *   1. Šifra pod h3 blokom pripada stranici na kojoj je navedena i NIKAD se ne
 *      gubi: postaje red tabele šifara tog proizvoda, sa kolonom „Komponenta”.
 *   2. Prateća komponenta (učvršćivač, aktivator, razređivač) postaje ZASEBAN
 *      proizvod samo kada je proizvođač sam tako predstavlja: ima sopstvenu
 *      stranicu, ili je ista šifra navedena na više stranica (deljeni
 *      učvršćivač). Tada je vlasnik šifre ta zasebna stranica / stranica na kojoj
 *      je šifra glavna komponenta, a ostale stranice je navode kao „koristi se uz”.
 *   3. Učvršćivač naveden samo na stranici svog laka/filera ostaje red tog
 *      proizvoda: C.A.R.FIT ga prodaje kao deo tog sistema, zasebna kartica bi
 *      bila proizvod bez opisa, slike i namene — dakle izmišljen sadržaj.
 *   4. Atributi stranice (gustina, VOC, tačka paljenja) važe za GLAVNU komponentu;
 *      na red prateće komponente se ne prenose.
 *
 * Blokovi koji nisu komponente nego OBLICI iste porodice („Discs”, „Stripes”,
 * „Lids”) su obične varijante; naziv bloka ulazi u oznaku varijante.
 */

const COMPANION = [
  { role: "hardener", re: /\b(hardener|härter|haerter|durcisseur)\b/i },
  { role: "activator", re: /\b(activator|aktivator|activateur)\b/i },
  { role: "thinner", re: /\b(thinner|verdünn\w*|diluant)\b/i },
];

const FORMAT = /\b(discs?|stripes?|strips?|sheets?|rolls?|lids?|cups?|scheiben|streifen|deckel|becher)\b/i;

/** @returns {"main"|"format"|"hardener"|"activator"|"thinner"} */
export function componentRole(component) {
  if (!component) return "main";
  const companion = COMPANION.find((entry) => entry.re.test(component));
  if (companion) return companion.role;
  return FORMAT.test(component) ? "format" : "main";
}

export const isCompanionRole = (role) => role === "hardener" || role === "activator" || role === "thinner";

export const COMPONENT_LABEL_SR = {
  main: "Osnovna komponenta",
  format: "Oblik",
  hardener: "Učvršćivač",
  activator: "Aktivator",
  thinner: "Razređivač",
};
