/**
 * Priprema reda za trag revizije.
 *
 * Odvojeno od upisa u bazu da bi se pravila (obavezna polja, redigovanje osetljivih
 * vrednosti, oblik zapisa pre/posle) mogla testirati bez konekcije.
 */

/** Ključevi čija se vrednost nikada ne upisuje u trag revizije. */
const REDACTED_KEYS = [
  "password",
  "passwordhash",
  "password_hash",
  "lozinka",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "sessiontoken",
];

const REDACTED = "[redigovano]";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value === null || typeof value !== "object") return value;

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.includes(key.toLowerCase().replace(/[\s-]/g, ""))
      ? REDACTED
      : redactSensitive(item);
  }
  return out;
}

/**
 * @typedef {object} AuditInput
 * @property {{ id?: string | null, name: string, role: string }} actor
 * @property {string} action
 * @property {string} entityType
 * @property {string | null} [entityId]
 * @property {string | null} [entityLabel]
 * @property {unknown} [before]
 * @property {unknown} [after]
 * @property {string | null} [reason]
 * @property {string | null} [correlationId]
 */

/**
 * @param {AuditInput} input
 */
export function buildAuditEntry(input) {
  if (!input?.action) throw new Error("Trag revizije zahteva radnju (action).");
  if (!input.entityType) {
    throw new Error("Trag revizije zahteva tip entiteta (entityType).");
  }
  if (!input.actor?.name || !input.actor?.role) {
    throw new Error("Trag revizije zahteva izvršioca (actor).");
  }

  return {
    actorUserId: input.actor.id ?? null,
    // Ime i uloga se zamrzavaju u trenutku radnje: red ostaje čitljiv i kada
    // korisnik kasnije promeni ulogu ili bude deaktiviran.
    actorLabel: `${input.actor.name} (${input.actor.role})`,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    valueBefore:
      input.before === undefined ? null : redactSensitive(input.before),
    valueAfter: input.after === undefined ? null : redactSensitive(input.after),
    reason: input.reason ?? null,
    correlationId: input.correlationId ?? null,
  };
}

/** Radnje koje se obavezno beleže — spisak raste sa fazama 2–5. */
export const AUDIT_ACTIONS = {
  roleChanged: "Promena uloge korisnika",
  permissionGranted: "Dodeljen paket dozvola",
  permissionRevoked: "Oduzet paket dozvola",
  userCreated: "Kreiran korisnik",
  userDeactivated: "Deaktiviran korisnik",
  settingChanged: "Izmena sistemskog praga",
  loginFailed: "Neuspela prijava",
  loginLocked: "Nalog privremeno zaključan",
  importCompleted: "Uvoz faktura izvršen",
  importDuplicateAttempt: "Ponovljen pokušaj uvoza istog fajla",
  importManual: "Ručno pokrenut uvoz",
  exportGenerated: "Izvoz podataka",
  dataCorrection: "Ručna ispravka podataka",

  /*
   * Faza 1B — bezbednost naloga.
   *
   * Nijedan od ovih događaja ne sme nositi tajnu: ni lozinku, ni TOTP kod, ni
   * recovery/reset/enrollment kod, ni njihov otisak, ni sirovu IP adresu.
   * Beleži se ŠTA se dogodilo i KOME, nikad ČIME.
   */
  rateLimitBlocked: "Privremena blokada zbog previše pokušaja",
  mfaGrantIssued: "Izdata dozvola za vezivanje drugog faktora",
  mfaEnrollmentStarted: "Započeto vezivanje drugog faktora",
  mfaEnabled: "Drugi faktor aktiviran",
  mfaVerificationBlocked: "Blokirana provera drugog faktora",
  mfaReset: "Drugi faktor poništen",
  recoveryCodeUsed: "Upotrebljen rezervni kod za prijavu",
  recoveryCodesRegenerated: "Izdati novi rezervni kodovi",
  passwordChanged: "Promenjena lozinka",
  passwordResetIssued: "Izdat kod za promenu lozinke",
  passwordResetCompleted: "Lozinka promenjena kodom za oporavak",
  userReactivated: "Reaktiviran korisnik",
  sessionsRevoked: "Opozvane sve sesije korisnika",

  /*
   * Faza 2 — komercijalni identitet.
   *
   * Trag nosi šifru partnera i šifru artikla, jer su to poslovni identifikatori
   * bez kojih se zapis ne može pročitati. PIB, adresa i kontakt se NE upisuju:
   * oni identitet ne dokazuju, a trag bi bez potrebe postao spisak ličnih i
   * poslovnih podataka koji preživljava sve druge kontrole.
   */
  externalIdentifierRegistered: "Evidentirana šifra partnera iz izvora",
  externalIdentifierMapped: "Šifra partnera povezana sa kupcem",
  externalIdentifierConflict: "Konflikt šifre partnera",
  externalIdentifierResolved: "Ručno razrešena šifra partnera",
  productMappingProposed: "Predložena veza artikla i kataloškog proizvoda",
  productMappingConfirmed: "Potvrđena veza artikla i kataloškog proizvoda",
  productMappingRejected: "Odbijen predlog veze artikla",
  productMappingRevoked: "Poništena potvrđena veza artikla i kataloškog proizvoda",

  /* Faza 2 — kupčev nalog kao odvojen identitet (AD-2). */
  customerAccountCreated: "Otvoren nalog kupcu",
  customerAccountStatusChanged: "Promenjeno stanje kupčevog naloga",

  /*
   * Faza 2 — pravila cene.
   *
   * Prelaz stanja je JEDNA radnja u tragu, sa `before`/`after` stanjem, umesto
   * odvojene radnje po prelazu. Odvojene bi značile da se spisak dopunjuje pri
   * svakom novom stanju, i da se pretraga „šta se dogodilo ovom pravilu" piše
   * kao unija koja negde ispusti jednu vrednost.
   */
  priceRuleProposed: "Predložena promena cene",
  priceRuleTransitioned: "Promenjeno stanje pravila cene",
  notificationResolved: "Zatvoreno obaveštenje",

  /*
   * Kupčev nalog — lifecycle (postflight F-4, F-6).
   *
   * Nijedan od ovih zapisa ne sme nositi lozinku, token ni njegov otisak.
   * Beleži se ŠTA se dogodilo i KOME, nikad ČIME.
   */
  customerInvitationIssued: "Izdat poziv kupcu",
  customerAccountActivated: "Kupac aktivirao nalog",
  customerPasswordChanged: "Kupac promenio lozinku",
  customerPasswordResetIssued: "Zatražena promena lozinke kupca",
  customerPasswordResetCompleted: "Lozinka kupca promenjena tokenom",
  customerLoginFailed: "Neuspela prijava kupca",
  customerLoginLocked: "Kupčev nalog privremeno zaključan",
  customerLoginSucceeded: "Uspešna prijava kupca",
  customerContactProposed: "Predložen kontakt kupca",
  customerConsentRecorded: "Evidentirana saglasnost kupca",
};
