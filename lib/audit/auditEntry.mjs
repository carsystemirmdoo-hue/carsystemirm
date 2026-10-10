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

  /*
   * Uredjaj je STVARAN akter, ne izmisljen korisnik.
   *
   * `kind: "device"` trazi `deviceId` i ZABRANJUJE `id` (korisnika). Bez te
   * zabrane bi se u trag upisao covek koji je uredjaj registrovao, kao da je on
   * uneo dokument — a on je odobrio kanal, ne posao. Isto ogranicenje stoji i
   * kao CHECK u bazi; ovde je da poruka bude razumljiva.
   */
  const kind = input.actor.kind ?? "user";
  if (kind === "device") {
    if (!input.actor.deviceId) {
      throw new Error("Trag revizije za uređaj zahteva deviceId.");
    }
    if (input.actor.id) {
      throw new Error("Akter uređaja ne sme nositi i korisnika.");
    }
  } else if (kind === "system") {
    if (input.actor.id || input.actor.deviceId) {
      throw new Error("Sistemski akter ne sme nositi korisnika ni uređaj.");
    }
  } else if (kind !== "user") {
    throw new Error(`Nepoznata vrsta aktera: ${kind}`);
  }

  return {
    actorKind: kind,
    actorDeviceId: input.actor.deviceId ?? null,
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
  /*
   * Nalaz usaglasavanja sa fakturom — sistemski akter, ne covek.
   *
   * Odvojeno od `priceRuleTransitioned` zato sto trag mora da razlikuje odluku
   * od nalaza: prvo je neko odlucio, drugo je nesto izmereno.
   */
  priceRuleReconciled: "Pravilo cene potvrdjeno sa fakture",
  priceRuleReconciliationFailed: "Usaglasavanje sa fakturom nije uspelo",
  /*
   * Serija pravila rabata iz istorije faktura (samo portal). Pojedinačna
   * pravila imaju svoje zapise; ovaj zbirni zapis nosi kriterijum, broj i
   * autorizaciju, sa istim `correlationId` kao pravila serije.
   */
  priceRuleBatchApplied: "Primenjena serija pravila rabata iz faktura",
  priceListUploaded: "Otpremljen cenovnik (pregled)",
  priceListApplied: "Primenjen cenovnik — osnovne cene",
  priceListDiscarded: "Odbačen otpremljen cenovnik",
  basePriceChanged: "Ručna izmena osnovne cene",
  priceRuleBatchRevoked: "Opozvana serija pravila rabata iz faktura",
  articleProgrammeChanged: "Promenjen program artikla (u ponudi / van programa)",
  rebateGroupApproved: "Odobrena grupa rabata iz istorije (kupac × porodica)",
  customerCommercialStatusChanged: "Promenjen poseban poslovni status kupca",
  paymentOptionChanged: "Opcija plaćanja kupca (predlog / odluka / opoziv)",
  articleGroupConfirmed: "Potvrđena grupa artikala (brend) za rabate",
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

  /*
   * Faza 3 — uvoz BizniSoft PDF dokumenata.
   *
   * Trag nosi INTERNI ID dokumenta i otisak fajla, nikada naziv kupca, PIB,
   * adresu ni ceo broj dokumenta: uz izdavaoca i datum, broj identifikuje
   * konkretan posao. Dokument se pronalazi po internom kljucu.
   */
  pdfIngested: "Uvezen izvorni dokument",
  pdfPosted: "Izvorni dokument proknjizen",
  pdfDuplicateSkipped: "Preskočen isti fajl (duplikat)",
  pdfRevisionResolved: "Razrešena veza revizije dokumenta",
  pdfManualReviewResolved: "Zatvoren ručni pregled dokumenta",

  /*
   * Uredjaji za automatski prijem.
   *
   * Opoziv i ponovna aktivacija ostaju u tragu zauvek; istorija se NE brise.
   * Trag nosi otisak kljuca i oznaku uredjaja, nikad javni kljuc u celini ni
   * ijedan podatak iz dostavljenog dokumenta.
   */
  deviceRegistered: "Registrovan uređaj za prijem",
  deviceActivated: "Aktiviran uređaj za prijem",
  deviceRevoked: "Opozvan uređaj za prijem",
  deviceKeyRegistered: "Dodat javni ključ uređaja",
  deviceKeyActivated: "Aktiviran javni ključ uređaja",
  deviceKeyRevoked: "Opozvan javni ključ uređaja",
  /*
   * Isti otisak fajla, drugaciji potvrdjen sadrzaj — ili zatecen zapis bez
   * dokaza za poredjenje. Ni u jednom slucaju se postojeca faktura ne menja.
   */
  pdfSourceHashMismatch: "Nesaglasje sadržaja pri istom otisku fajla",

  /*
   * Rucne komande konektoru.
   *
   * Trag cuva OBA aktera: coveka koji je zatrazio i uredjaj koji je izvrsio.
   * Spajanje bi znacilo da izvestaj kaze da je covek uneo dokumente.
   */
  syncCommandQueued: "Zatražena sinhronizacija",
  syncCommandFinished: "Komanda sinhronizacije završena",

  /*
   * Preporuke (cadence_v1).
   *
   * Trag nosi ISKLJUCIVO brojeve i identitet prolaza — nijedan naziv kupca,
   * nijednu sifru artikla i nijednu recenicu preporuke. Ko hoce detalje,
   * otvara prolaz; trag postoji da bi se znalo KO je i KADA pokrenuo obracun,
   * a ne sta je obracun rekao.
   */
  recommendationRecomputed: "Preračunate preporuke",

  /*
   * Registar partnera, potvrda osobe i dodele (0028).
   *
   * Trag uvoza nosi brojke i otisak fajla, ne spisak partnera. Trag potvrde
   * nosi način i izvor, ne belešku o dokazu — beleška ume da sadrži ime i
   * telefon, a trag preživljava sve ostale kontrole.
   */
  partnerImportRecorded: "Uvezen registar BizniSoft partnera",
  partnerPromotedToCustomer: "Partner povezan sa kupcem u portalu",
  customerContactVerified: "Potvrđena ovlašćena osoba kupca",
  customerContactVerificationRevoked: "Opozvana potvrda ovlašćene osobe",
  customerAccessRevoked: "Opozvan pristup kupčevog naloga",
  customerActivationBlocked: "Odbijena aktivacija kupčevog naloga",
  salespersonCodeLinked: "Šifra komercijaliste povezana sa korisnikom",
  customerDeactivated: "Kupac označen kao neaktivan",
  customerReactivated: "Kupac vraćen u aktivne",
  stornoApplied: "Storno primenjen — original isključen iz prometa",
  stornoWaitingOriginal: "Storno čeka original",
  stornoReview: "Storno na ručnom pregledu",
  customerAssignmentGranted: "Kupac dodeljen komercijalisti",
  customerAssignmentRemoved: "Kupac oduzet komercijalisti",
};
