/**
 * Usaglašavanje pravila cene sa stvarno fakturisanim uslovom — čista pravila.
 *
 * Ovaj modul ne dodeljuje `confirmed`. On odgovara na jedno pitanje: da li
 * postoji red na fakturi koji DOKAZUJE da je uslov primenjen. Zapis stanja radi
 * servis, i to samo kada ovde stigne dokaz sa konkretnom stavkom.
 *
 * Podrazumevani odgovor je „ne znam", ne „jeste". Pravilo koje ostane
 * nepotvrđeno je tačan opis stvarnosti; pravilo pogrešno proglašeno potvrđenim
 * je obećanje cene koju kupac neće dobiti, i primeti se tek na reklamaciji.
 */

/** Tolerancija na popust u procentima. Ispod ovoga je razlika zaokruživanja. */
export const DISCOUNT_TOLERANCE = 0.001;

/** Tolerancija na neto cenu po jedinici, u dinarima. */
export const PRICE_TOLERANCE = 0.01;

/**
 * Jedina valuta za koju je usaglašavanje dokazano.
 *
 * `invoices` i `invoice_lines` NEMAJU kolonu valute — svaki iznos u njima je
 * implicitno dinar. Poređenje pravila u drugoj valuti sa takvom stavkom ne bi
 * bilo pogrešno za dlaku nego potpuno: sto evra i sto dinara su isti broj.
 *
 * Dok faktura ne nosi dokazanu valutu, sve osim RSD se odbija umesto da se
 * pretpostavi.
 */
export const SUPPORTED_CURRENCY = "RSD";

export const RECONCILIATION_OUTCOMES = [
  /** Opseg pravila se ne može dokazati jednom stavkom. Ide na ručni pregled. */
  "not_applicable",
  /** Nema nijedne stavke u periodu važenja. Nije neuspeh — nije još prodato. */
  "no_evidence_yet",
  /** Postoji stavka koja se poklapa sa uslovom. */
  "confirmed",
  /** Stavke postoje, nijedna ne nosi uslov. */
  "failed",
];

/**
 * Neto cena po jedinici sa stavke fakture.
 *
 * @param {{ unitPrice: number, discountPercent: number }} line
 * @returns {number}
 */
export function netUnitPrice(line) {
  return round4(line.unitPrice * (1 - line.discountPercent / 100));
}

/**
 * Da li opseg pravila uopšte može biti dokazan jednom stavkom fakture.
 *
 * Samo par (jedan kupac, jedan artikal). Pravilo na grupi kupaca ili na brendu
 * NIJE dokazano time što je jedna njegova stavka fakturisana po tom uslovu —
 * ostatak opsega ostaje neproveren, a `confirmed` bi tvrdio i za njega.
 *
 * @param {{ customerScope: string, productScope: string }} rule
 * @returns {boolean}
 */
export function isDirectlyProvable(rule) {
  return rule.customerScope === "customer" && rule.productScope === "article";
}

/**
 * Da li stavka nosi uslov iz pravila.
 *
 * @param {object} rule
 * @param {string} rule.valueKind  `discount_percent` ili `net_price`
 * @param {number | null} [rule.discountPercent]
 * @param {number | null} [rule.netPrice]
 * @param {{ unitPrice: number, discountPercent: number }} line
 * @returns {boolean}
 */
export function lineMatchesRule(rule, line) {
  if (rule.valueKind === "discount_percent") {
    if (rule.discountPercent === null || rule.discountPercent === undefined) return false;
    return Math.abs(line.discountPercent - rule.discountPercent) <= DISCOUNT_TOLERANCE;
  }
  if (rule.valueKind === "net_price") {
    if (rule.netPrice === null || rule.netPrice === undefined) return false;
    return Math.abs(netUnitPrice(line) - rule.netPrice) <= PRICE_TOLERANCE;
  }
  /*
   * Nepoznata vrsta vrednosti se ne pokušava „razumeti".
   *
   * Nova vrsta cene mora dobiti svoje pravilo poređenja; do tada nijedna
   * stavka je ne potvrđuje.
   */
  return false;
}

/**
 * Da li stavka pada u period važenja pravila.
 *
 * Granice su uključene na oba kraja, isto kao u proceni cene — da se „poslednji
 * dan akcije" ne bi u dva modula računao različito.
 *
 * @param {{ effectiveFrom: string, effectiveTo: string | null }} rule
 * @param {string} issuedOn  ISO datum
 * @returns {boolean}
 */
export function isWithinValidity(rule, issuedOn) {
  if (issuedOn < rule.effectiveFrom) return false;
  if (rule.effectiveTo && issuedOn > rule.effectiveTo) return false;
  return true;
}

/**
 * Nalaz usaglašavanja za jedno pravilo.
 *
 * Bira NAJSTARIJU stavku koja se poklapa, ne najnoviju: dokaz je trenutak kada
 * je uslov prvi put stvarno primenjen, a ne poslednji put kada je slučajno
 * ispao isti.
 *
 * @param {object} input
 * @param {object} input.rule
 * @param {readonly {
 *   invoiceId: string, invoiceLineId: string, issuedOn: string,
 *   unitPrice: number, discountPercent: number
 * }[]} input.lines  stavke iz ledgera za par (kupac, artikal)
 * @returns {{
 *   outcome: string,
 *   evidence: {
 *     invoiceId: string, invoiceLineId: string, issuedOn: string,
 *     unitPrice: number, discountPercent: number
 *   } | null,
 *   detail: string
 * }}
 */
export function reconcileRule({ rule, lines }) {
  /*
   * Valuta se proverava PRE opsega.
   *
   * Pravilo u drugoj valuti nije „nedokazivo zbog opsega" nego neuporedivo sa
   * ovim fakturama, i poruka to mora reći tačno — inače bi neko sužavao opseg
   * pravila pokušavajući da ga potvrdi.
   */
  const currency = rule.currency ?? SUPPORTED_CURRENCY;
  if (currency !== SUPPORTED_CURRENCY) {
    return {
      outcome: "not_applicable",
      evidence: null,
      detail:
        `Pravilo je u valuti ${currency}, a fakture ne nose dokazanu valutu. ` +
        "Usaglašavanje je dokazano samo za dinarsku putanju.",
    };
  }

  if (!isDirectlyProvable(rule)) {
    return {
      outcome: "not_applicable",
      evidence: null,
      detail:
        "Opseg pravila obuhvata više kupaca ili više artikala, pa ga jedna stavka " +
        "fakture ne dokazuje. Potreban je ručni pregled.",
    };
  }

  const inWindow = lines
    .filter((line) => isWithinValidity(rule, line.issuedOn))
    .sort((a, b) => (a.issuedOn < b.issuedOn ? -1 : a.issuedOn > b.issuedOn ? 1 : 0));

  if (inWindow.length === 0) {
    return {
      outcome: "no_evidence_yet",
      evidence: null,
      detail: "U periodu važenja nema nijedne fakturisane stavke za ovaj artikal.",
    };
  }

  const hit = inWindow.find((line) => lineMatchesRule(rule, line));
  if (hit) {
    return {
      outcome: "confirmed",
      evidence: hit,
      detail: "Uslov je pronađen na fakturisanoj stavci.",
    };
  }

  return {
    outcome: "failed",
    evidence: null,
    /*
     * Poruka NE sadrži iznose.
     *
     * Ona ide u obaveštenje i u trag revizije, a fakturisana cena kupca nije
     * podatak koji sme da ispadne iz opsega. Razlika se vidi na ekranu, uz
     * proveru dozvola.
     */
    detail: `Fakturisano je ${inWindow.length} stavki u periodu važenja, ali nijedna ne nosi uslov iz pravila.`,
  };
}

const round4 = (value) => Math.round(value * 10000) / 10000;
