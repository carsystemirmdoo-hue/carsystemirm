/**
 * Kapija za poziv kupčevom nalogu — čista pravila, bez baze.
 *
 * Poziv otvara pristup cenama, dokumentima i istoriji jedne firme. Zato se
 * izdaje tek kada su potvrđene DVE nezavisne stvari:
 *
 *   1. FIRMA — kupac u portalu je povezan sa BizniSoft partnerom (`mapped`
 *      šifra partnera). Bez toga se ne zna čije podatke nalog otvara.
 *   2. OSOBA — čovek iz kancelarije je potvrdio da osoba koja kontroliše baš
 *      ovu adresu e-pošte sme da vidi podatke baš ove firme, i zapisao kako.
 *
 * E-mail upisan na kartici partnera NIJE potvrda osobe. To je podatak iz
 * izvora: može biti knjigovođin, bivšeg zaposlenog ili deljen između dve
 * firme. Zato izvor adrese i način potvrde idu u zapis odvojeno.
 */

/** Kako je potvrđeno da osoba sme da vidi podatke firme. */
export const VERIFICATION_METHODS = /** @type {const} */ ([
  /**
   * Povratni poziv na broj firme koji je poznat OD RANIJE (kartica partnera,
   * ranija korespondencija) — nikad na broj koji je dala sama osoba.
   */
  "callback_known_number",
  /** Potpisano/overeno ovlašćenje firme, sačuvano van sistema. */
  "signed_authorization",
  /** Lični susret komercijaliste ili kancelarije uz potvrdu vlasnika firme. */
  "in_person",
]);

/** Odakle je adresa e-pošte stigla. Ne govori ništa o ovlašćenju. */
export const CONTACT_SOURCES = /** @type {const} */ ([
  "biznisoft_partner_record",
  "provided_by_company",
  "provided_by_sales_rep",
  /** Javno dostupan poslovni kontakt — traži URL izvora. */
  "public_business_listing",
]);

/**
 * Posle ovoliko dana potvrda više ne otvara NOV poziv. Već aktivan nalog ne
 * pada zbog starosti potvrde — za to postoji opoziv.
 */
export const VERIFICATION_MAX_AGE_DAYS = 90;

/** Najkraća beleška o dokazu. „ok" nije dokaz. */
export const EVIDENCE_NOTE_MIN = 15;

/** Stanja naloga kojima se sme izdati poziv. */
export const INVITABLE_STATUSES = /** @type {const} */ (["requested", "approved"]);

/**
 * Razlozi odbijanja — šifre, da bi ih UI i testovi čitali bez parsiranja teksta.
 */
export const GATE_REASONS = /** @type {const} */ ({
  account_status: "Nalog je odbijen, isključen ili već aktivan.",
  customer_inactive: "Kupac je neaktivan.",
  company_not_identified:
    "Firma nije povezana sa BizniSoft partnerom (nema potvrđene šifre partnera).",
  person_not_verified:
    "Nije potvrđeno da ova osoba sme da vidi podatke firme.",
  verification_mismatch: "Potvrda ne pripada ovom nalogu ili ovoj firmi.",
  verification_email_mismatch:
    "Potvrda je data za drugu adresu e-pošte.",
  verification_basis_invalid:
    "Šifra partnera na kojoj počiva potvrda više nije povezana sa ovom firmom.",
  verification_expired: `Potvrda je starija od ${VERIFICATION_MAX_AGE_DAYS} dana — potvrditi ponovo.`,
});

/**
 * @typedef {object} GateAccount
 * @property {string} id
 * @property {string} customerId
 * @property {string} email
 * @property {string} status
 *
 * @typedef {object} GateVerification
 * @property {string} customerUserId
 * @property {string} customerId
 * @property {string} basisIdentifierId
 * @property {string} verifiedEmail
 * @property {Date} verifiedAt
 * @property {Date | null} revokedAt
 *
 * @typedef {object} GateIdentifier
 * @property {string} id
 * @property {string | null} customerId
 * @property {string} status
 */

/**
 * Da li se nalogu sme izdati poziv. Vraća SVE razloge odbijanja, ne samo prvi —
 * kancelarija treba da vidi šta sve fali, a ne da otkriva jedno po jedno.
 *
 * @param {{
 *   account: GateAccount,
 *   customerActive: boolean,
 *   identifiers: readonly GateIdentifier[],
 *   verification: GateVerification | null,
 *   now: Date,
 * }} input
 * @returns {{ allowed: boolean, reasons: (keyof typeof GATE_REASONS)[] }}
 */
export function decideInvitation({ account, customerActive, identifiers, verification, now }) {
  /** @type {(keyof typeof GATE_REASONS)[]} */
  const reasons = [];

  if (!INVITABLE_STATUSES.includes(/** @type {any} */ (account.status))) {
    reasons.push("account_status");
  }
  if (!customerActive) reasons.push("customer_inactive");

  const mapped = identifiers.filter(
    (i) => i.status === "mapped" && i.customerId === account.customerId,
  );
  if (mapped.length === 0) reasons.push("company_not_identified");

  if (!verification || verification.revokedAt) {
    reasons.push("person_not_verified");
  } else {
    if (
      verification.customerUserId !== account.id ||
      verification.customerId !== account.customerId
    ) {
      reasons.push("verification_mismatch");
    }
    if (verification.verifiedEmail !== account.email.trim().toLowerCase()) {
      reasons.push("verification_email_mismatch");
    }
    if (!mapped.some((i) => i.id === verification.basisIdentifierId)) {
      reasons.push("verification_basis_invalid");
    }
    const ageMs = now.getTime() - verification.verifiedAt.getTime();
    if (ageMs > VERIFICATION_MAX_AGE_DAYS * 24 * 60 * 60_000) {
      reasons.push("verification_expired");
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Aktivacija pozivom: isto pravilo kao izdavanje, plus nalog mora biti baš u
 * stanju `approved` (poziv izdat, lozinka još ne postoji).
 *
 * Starost potvrde se ovde NE proverava ponovo: poziv traje 48 sati, pa bi
 * potvrda stara 89 dana pri izdavanju mogla da „istekne" dok kupac otvara
 * poruku — a to nije bezbednosni događaj. Opoziv jeste, i on se proverava.
 *
 * @param {Parameters<typeof decideInvitation>[0]} input
 */
export function decideActivation(input) {
  const gate = decideInvitation(input);
  /** @type {(keyof typeof GATE_REASONS)[]} */
  const reasons = gate.reasons.filter((r) => r !== "verification_expired" && r !== "account_status");
  if (input.account.status !== "approved") reasons.unshift("account_status");
  return { allowed: reasons.length === 0, reasons };
}

/**
 * Provera unosa potvrde, pre ijednog upita.
 *
 * @param {{
 *   method: string,
 *   contactSource: string,
 *   sourceReference?: string | null,
 *   evidenceNote: string,
 *   personRole: string,
 * }} input
 * @returns {string | null}  poruka greške ili `null`
 */
export function validateVerificationInput(input) {
  if (!VERIFICATION_METHODS.includes(/** @type {any} */ (input.method))) {
    return "Nepoznat način potvrde.";
  }
  if (!CONTACT_SOURCES.includes(/** @type {any} */ (input.contactSource))) {
    return "Nepoznat izvor kontakta.";
  }
  if ((input.evidenceNote ?? "").trim().length < EVIDENCE_NOTE_MIN) {
    return `Beleška o dokazu mora imati najmanje ${EVIDENCE_NOTE_MIN} znakova (ko je potvrdio, kojim kanalom, kada).`;
  }
  if ((input.personRole ?? "").trim().length < 2) {
    return "Upišite funkciju osobe u firmi (npr. vlasnik, nabavka).";
  }
  if (input.contactSource === "public_business_listing") {
    const ref = (input.sourceReference ?? "").trim();
    if (!/^https?:\/\/\S+$/.test(ref)) {
      return "Javno dostupan kontakt traži URL izvora.";
    }
  }
  return null;
}
