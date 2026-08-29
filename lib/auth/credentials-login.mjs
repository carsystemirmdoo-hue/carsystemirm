/**
 * Odluka o prijavi kredencijalima — čista logika, bez baze i bez Auth.js-a.
 *
 * Postoji da bi se ugovor prijave mogao dokazati testom, a ne merenjem
 * milisekundi. Konkretno, tri stvari koje se drugačije ne mogu proveriti:
 *
 *   1. provera lozinke se izvršava TAČNO JEDNOM, i za postojeći i za
 *      nepostojeći nalog;
 *   2. odluka se donosi tek POSLE te provere, nikad pre;
 *   3. spolja se sva odbijanja ne razlikuju.
 *
 * Zašto to nije kozmetika
 * -----------------------
 * Ranije je nepostojeća e-pošta vraćala odgovor odmah, a postojeća tek pošto
 * scrypt potroši svojih ~100 ms. Ta razlika se meri iz browsera i dovoljna je da
 * se prebiranjem kroz spisak firmi utvrdi ko jeste, a ko nije naš kupac.
 * Uniformna poruka to ne rešava — vreme govori umesto poruke.
 *
 * @typedef {"granted" | "denied"} LoginOutcome
 *
 * @typedef {object} LoginUserRecord  minimum koji odluka zaista čita
 * @property {string} passwordHash
 * @property {boolean} [active]
 * @property {Date | null} [lockedUntil]
 *
 * @typedef {"ok" | "no_such_user" | "inactive" | "locked" | "bad_password"} LoginReason
 *   ISKLJUČIVO za audit i interne odluke. Nikada se ne prikazuje korisniku.
 */

/**
 * Normalizacija identifikatora.
 *
 * Isti postupak mora važiti za postojeći i nepostojeći nalog — inače se razlika
 * vraća na drugom mestu.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLoginIdentifier(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Generičko po zapisu korisnika: pozivalac zadržava svoj pun tip (`UserRow`),
 * pa `authorize` i dalje vidi `name`, `email` i `role` bez kastovanja.
 *
 * @template {LoginUserRecord} TUser
 * @param {object} input
 * @param {string} input.email
 * @param {string} input.password
 * @param {(email: string) => Promise<TUser | null>} input.loadUser
 * @param {(password: string, storedHash: string) => Promise<boolean>} input.verify
 * @param {string} input.absentUserHash  zapis za nalog koji ne postoji
 * @param {(user: TUser) => boolean} [input.isActive]
 *   Kako se za dati model naloga čita „sme da se prijavi". Interni nalog ima
 *   `active boolean`; kupčev ima `status` sa pet vrednosti. Podrazumevano
 *   ponašanje je nepromenjeno, pa postojeći pozivalac ne oseća ovaj parametar.
 * @param {Date} [input.now]
 * @returns {Promise<{ outcome: LoginOutcome, user: TUser | null, reason: LoginReason }>}
 */
export async function resolveCredentialsLogin({
  email,
  password,
  loadUser,
  verify,
  absentUserHash,
  isActive = (candidate) => candidate.active,
  now = new Date(),
}) {
  const identifier = normalizeLoginIdentifier(email);
  const user = identifier ? await loadUser(identifier) : null;

  /*
   * Ključni red cele funkcije.
   *
   * Kada korisnik ne postoji, provera se ne preskače — izvršava se nad
   * zamenskim zapisom istih parametara. Posao je isti, cena je ista, pa je i
   * vreme odgovora isto.
   */
  const storedHash = user ? user.passwordHash : absentUserHash;
  const passwordMatches = await verify(password, storedHash);

  // Tek odavde se odlučuje. Nijedan `return` iznad ove linije ne postoji, i to
  // je invarijanta koju test čuva.
  if (!user) return { outcome: "denied", user: null, reason: "no_such_user" };
  if (!isActive(user)) return { outcome: "denied", user, reason: "inactive" };
  if (user.lockedUntil && user.lockedUntil > now) {
    return { outcome: "denied", user, reason: "locked" };
  }
  if (!passwordMatches) {
    return { outcome: "denied", user, reason: "bad_password" };
  }

  return { outcome: "granted", user, reason: "ok" };
}

/**
 * Da li odbijanje treba da uveća brojač neuspelih pokušaja.
 *
 * Zaključan nalog se ne kažnjava dodatno — inače bi napadač produžavao
 * zaključavanje unedogled, a vlasnik naloga ne bi mogao da uđe ni posle isteka.
 *
 * @param {LoginDecision["reason"]} reason
 * @returns {boolean}
 */
export function shouldCountFailedAttempt(reason) {
  return reason === "bad_password";
}
