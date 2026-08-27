/**
 * Jedini vlasnik odluke o pristupu portalu.
 *
 * Zašto postoji
 * -------------
 * Pre ovog modula ista odluka je donošena na dva mesta — `resolveMfaAccess` pri
 * prijavi i grana u `loadAuthenticatedSession` pri svakom zahtevu — i ta dva
 * mesta su davala **različite odgovore** za isto stanje. U režimu `enroll`
 * korisnik bez drugog faktora je po jednom modulu smeo u ceo portal, a po
 * drugom samo na vezivanje. Kada dva modula odgovaraju na isto pitanje, pre ili
 * kasnije se razmimoiđu, a razlika se vidi tek kad neko uđe gde ne sme.
 *
 * Zato ovde postoji tačno jedna funkcija — `resolvePortalAccess` — i svaki
 * potrošač je zove. Nijedna druga grana u sistemu ne sme samostalno zaključiti
 * da korisnik ima pun pristup.
 *
 * Modul je namerno čist: bez baze, bez `server-only`, bez `process.env`. Sve
 * ulazi kao argument, pa se cela matrica može proveriti pravim pozivima u testu.
 */

/* =========================================================================
 * Režimi
 * ====================================================================== */

/**
 * @typedef {"off" | "enroll" | "enforced"} MfaMode
 * @typedef {"production" | "development" | "test"} RuntimeEnvironment
 * @typedef {"denied" | "enrollment-only" | "full"} AccessLevel
 */

export const MFA_MODES = /** @type {const} */ (["off", "enroll", "enforced"]);

/**
 * Šta važi kada je vrednost neispravna ili je nema.
 *
 * U produkciji `enforced`: pogrešno otkucana promenljiva ne sme **tiho** da
 * otvori portal bez drugog faktora. Van produkcije `off`, da razvoj ne bi
 * tražio ceo MFA aparat za svaki lokalni start.
 */
export const FAIL_CLOSED_MODE = "enforced";
export const DEVELOPMENT_FALLBACK_MODE = "off";

/** Nivoi pristupa. Enrollment-only je zaseban nivo, nikad „odsustvo punog". */
export const ACCESS_DENIED = "denied";
export const ACCESS_ENROLLMENT_ONLY = "enrollment-only";
export const ACCESS_FULL = "full";

/** Potvrde drugog faktora koje sesija može nositi. */
export const ASSURANCE_PASSWORD = "password";
export const ASSURANCE_MFA = "mfa";
export const ASSURANCE_RECOVERY = "recovery";

/**
 * Radnje koje i u režimu `enroll` traže potvrđen drugi faktor.
 *
 * Sve menjaju ovlašćenja ili tuđe naloge. Bez ovoga bi `enroll` bio prazan
 * međukorak u kome administratorske radnje stoje iza same lozinke.
 */
export const MFA_SENSITIVE_CAPABILITIES = [
  "users:manage",
  "users:manage_security",
  "settings:manage",
  "limits:approve",
  "notifications:resolve_global",
];

/* =========================================================================
 * Okruženje i konfiguracija
 * ====================================================================== */

/**
 * Klasifikuje okruženje.
 *
 * `VERCEL_ENV` ima prednost jer je jedini pouzdan pokazatelj na hostingu:
 * `next start` postavlja `NODE_ENV=production` i na preview grani i na
 * lokalnoj mašini, pa bi sam `NODE_ENV` proglasio produkcijom i ono što to nije.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {RuntimeEnvironment}
 */
export function resolveRuntimeEnvironment(env = {}) {
  if (env.NODE_ENV === "test") return "test";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    return "development";
  }
  return env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * Jedino mesto koje čita režim iz okruženja.
 *
 * Kanonsko ime je `PORTAL_MFA_MODE`. Staro ime `PORTAL_MFA_ENFORCEMENT` se i
 * dalje prihvata: preimenovanje bez rezerve bi na postojećem deploy-u tiho
 * oborilo režim na fallback, što je tačno ona greška koju ovaj modul sprečava.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   mode: MfaMode,
 *   environment: RuntimeEnvironment,
 *   configured: boolean,
 *   usedLegacyName: boolean,
 *   rawWasInvalid: boolean
 * }}
 */
export function resolveMfaMode(env = {}) {
  const environment = resolveRuntimeEnvironment(env);
  const canonical = env.PORTAL_MFA_MODE;
  const legacy = env.PORTAL_MFA_ENFORCEMENT;
  const source = canonical ?? legacy;
  const raw = String(source ?? "").trim().toLowerCase();

  if (MFA_MODES.includes(/** @type {MfaMode} */ (raw))) {
    return {
      mode: /** @type {MfaMode} */ (raw),
      environment,
      configured: true,
      usedLegacyName: canonical === undefined && legacy !== undefined,
      rawWasInvalid: false,
    };
  }

  return {
    mode: environment === "production" ? FAIL_CLOSED_MODE : DEVELOPMENT_FALLBACK_MODE,
    environment,
    configured: false,
    usedLegacyName: false,
    // Prazno je „nije podešeno"; sve ostalo je pogrešno otkucano.
    rawWasInvalid: raw !== "",
  };
}

/**
 * Poruka za dnevnik pri pokretanju.
 *
 * Sadrži isključivo naziv režima i okruženja — nikad ključ, kod ni tajnu.
 *
 * @param {ReturnType<typeof resolveMfaMode>} resolved
 * @returns {{ level: "info" | "warn", message: string }}
 */
export function describeMfaMode(resolved) {
  if (resolved.configured) {
    return {
      level: "info",
      message:
        `MFA režim: ${resolved.mode} (okruženje: ${resolved.environment})` +
        (resolved.usedLegacyName
          ? ' — pročitano iz zastarelog imena PORTAL_MFA_ENFORCEMENT; preimenujte u PORTAL_MFA_MODE.'
          : ""),
    };
  }
  return {
    level: "warn",
    message:
      `PORTAL_MFA_MODE ${resolved.rawWasInvalid ? "ima neispravnu vrednost" : "nije podešen"}; ` +
      `primenjen je ${resolved.mode} (okruženje: ${resolved.environment}).`,
  };
}

/**
 * Da li konfiguracija sme da radi.
 *
 * `enroll` i `enforced` bez ključa za šifrovanje znače da niko ne može ni da
 * veže ni da potvrdi faktor — dakle niko ne može ući. Bolje odbiti nego pustiti
 * portal koji nikoga ne pušta, ili — gore — pustiti ga da tiho preskoči MFA.
 *
 * Namerno se NE poziva pri uvozu modula: build javnih statičkih strana ne sme
 * da padne zbog promenljive koja u tom trenutku ne postoji. Provera pripada
 * granici zahteva.
 *
 * @param {{ mode: MfaMode, mfaConfigured: boolean }} input
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function validateMfaConfiguration({ mode, mfaConfigured }) {
  if (mode === "off") return { ok: true, reason: null };
  if (!mfaConfigured) {
    return {
      ok: false,
      reason:
        `PORTAL_MFA_MODE="${mode}" traži podešen PORTAL_MFA_MASTER_KEY_V<verzija>. ` +
        "Bez njega drugi faktor se ne može ni vezati ni proveriti.",
    };
  }
  return { ok: true, reason: null };
}

/**
 * Prevodi zapis iz baze u stanje koje politika razume.
 *
 * Izdvojeno da bi i prijava i učitavanje sesije računale `pending` na isti
 * način. Istekla pending tajna se broji kao da je nema — inače bi jednom
 * započeto vezivanje zauvek držalo vrata odškrinuta.
 *
 * @param {{ enabled: boolean, pendingUntil: Date | string | null }} status
 * @param {Date} [now]
 * @returns {"none" | "pending" | "active"}
 */
export function mfaStateFrom(status, now = new Date()) {
  if (status.enabled) return "active";
  if (!status.pendingUntil) return "none";
  const until = new Date(status.pendingUntil).getTime();
  return Number.isFinite(until) && until > now.getTime() ? "pending" : "none";
}

/* =========================================================================
 * Odluka o pristupu
 * ====================================================================== */

/**
 * Razlozi odbijanja. Idu u audit i dnevnik, nikada korisniku — poruka na ekranu
 * je uvek ista, da se iz nje ne bi zaključilo šta tačno nedostaje.
 */
export const DENY_REASONS = {
  accountInactive: "account-inactive",
  staleSession: "stale-session",
  secondFactorMissing: "second-factor-missing",
  secondFactorRejected: "second-factor-rejected",
  enrollmentGrantMissing: "enrollment-grant-missing",
};

/**
 * Jedina odluka o tome šta korisnik sme.
 *
 * @param {object} input
 * @param {MfaMode} input.mode
 * @param {RuntimeEnvironment} input.environment
 * @param {boolean} input.accountActive       nalog nije isključen
 * @param {boolean} [input.sessionVersionCurrent]  token nosi aktuelnu verziju
 * @param {"none" | "pending" | "active"} input.mfaState  stanje faktora u bazi
 * @param {"none" | "totp" | "recovery"} input.factor     šta je potvrđeno
 * @param {boolean} [input.grantAvailable]    postoji važeća dozvola za vezivanje
 * @returns {{ access: AccessLevel, assurance: string, reason: string | null }}
 */
export function resolvePortalAccess({
  mode,
  environment,
  accountActive,
  sessionVersionCurrent = true,
  mfaState,
  factor,
  grantAvailable = false,
}) {
  /*
   * 1. Isključen nalog otpada pre svega ostalog.
   *
   * Ni jedan režim, ni jedan faktor i ni jedna dozvola ne smeju ga vratiti u
   * igru — isključivanje je odluka vlasnika i nema izuzetak.
   */
  if (!accountActive) {
    return deny(DENY_REASONS.accountInactive);
  }

  // 2. Opozvana sesija je ista stvar kao da je nema.
  if (!sessionVersionCurrent) {
    return deny(DENY_REASONS.staleSession);
  }

  /*
   * 3. Ko IMA aktivan faktor mora ga i dati — u svakom režimu, uključujući `off`.
   *
   * `off` znači da faktor nije obavezan za one koji ga još nemaju. Ne znači da
   * se već vezan faktor sme zaobići: to bi bio način da se zaštita ukine
   * promenom jedne promenljive, bez znanja vlasnika naloga.
   *
   * Takav korisnik se NE spušta na enrollment-only. Njegov nalog nije nepotpun
   * — samo nije dokazan u ovoj sesiji. Spustiti ga na vezivanje značilo bi
   * ponuditi mu da veže nov uređaj bez ijednog dokaza da je on.
   */
  if (mfaState === "active") {
    if (factor === "totp") return grant(ACCESS_FULL, ASSURANCE_MFA);
    if (factor === "recovery") return grant(ACCESS_FULL, ASSURANCE_RECOVERY);
    return deny(DENY_REASONS.secondFactorMissing);
  }

  /*
   * 4. Nema aktivan faktor. `pending` se ovde broji kao `none`: započeto
   *    vezivanje nije vezan faktor, i ne sme biti prečica do portala.
   */
  switch (mode) {
    case "enforced":
      /*
       * Bez dozvole nema ni vezivanja. Inače bi `enforced` bio slabiji od
       * `enroll`: svako sa lozinkom mogao bi da veže svoj uređaj.
       *
       * Započeto vezivanje (`pending`) drži vrata otvorena dok traje njegov
       * kratak rok — dozvola je već potrošena da bi se stiglo dovde.
       */
      if (grantAvailable || mfaState === "pending") {
        return grant(ACCESS_ENROLLMENT_ONLY, ASSURANCE_PASSWORD);
      }
      return deny(DENY_REASONS.enrollmentGrantMissing);

    case "enroll":
      // Radi, ali nikad u portalu: sesija služi isključivo vezivanju.
      return grant(ACCESS_ENROLLMENT_ONLY, ASSURANCE_PASSWORD);

    default:
      /*
       * `off` — pun pristup samom lozinkom, ali SAMO van produkcije.
       *
       * U produkciji sama lozinka nije dovoljna ni kada je `off` izričito
       * podešen. Razlog je da između „vlasnik je svesno izabrao off" i
       * „promenljiva je ispala iz podešavanja" nema razlike koju sistem može
       * da vidi, a cena pogrešne pretpostavke je ceo portal iza jedne lozinke.
       * Produkcija zato dobija vezivanje umesto punog pristupa.
       */
      if (environment === "production") {
        return grant(ACCESS_ENROLLMENT_ONLY, ASSURANCE_PASSWORD);
      }
      return grant(ACCESS_FULL, ASSURANCE_PASSWORD);
  }
}

/** @param {string} reason */
function deny(reason) {
  return { access: ACCESS_DENIED, assurance: ASSURANCE_PASSWORD, reason };
}

/**
 * @param {AccessLevel} access
 * @param {string} assurance
 */
function grant(access, assurance) {
  return { access, assurance, reason: null };
}

/**
 * Da li je radnja zabranjena zbog nepotvrđenog drugog faktora.
 *
 * @param {string} capability
 * @param {{ access: AccessLevel, assurance: string }} decision
 * @returns {boolean}
 */
export function isBlockedBySensitivity(capability, decision) {
  if (decision.access !== ACCESS_FULL) return true;
  if (decision.assurance === ASSURANCE_PASSWORD) {
    return MFA_SENSITIVE_CAPABILITIES.includes(capability);
  }
  return false;
}
