import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ALLOWED_TOKEN_FIELDS,
  ASSURANCE_MFA,
  ASSURANCE_PASSWORD,
  ASSURANCE_RECOVERY,
  forbiddenTokenFields,
  isMfaRecent,
  isSecondFactorSatisfied,
  RECENT_MFA_WINDOW_MS,
} from "./session-assurance.mjs";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const authSource = codeOf(await read("../../auth.ts"));
const configSource = codeOf(await read("../../auth.config.ts"));
const sessionSource = codeOf(await read("../authz/session.ts"));
const grantSource = codeOf(await read("./enrollment-grant.ts"));
const formSource = await read("../../features/portal/PortalLoginForm.tsx");
const migrateSource = codeOf(await read("../../db/migrate.mjs"));
const portalActionsRaw = await read("../../app/portal/actions.ts");
const portalActions = codeOf(portalActionsRaw);

/**
 * Telo `authorize`.
 *
 * `authorize` je UNUTAR `NextAuth({...})`, dakle posle `export const { handlers`
 * — zato se seče do kraja fajla, ne do te tačke.
 */
const authorizeBody = authSource.slice(
  authSource.indexOf("async authorize(rawCredentials)"),
);

/* =========================================================================
 * Redosled provera u stvarnom toku
 * ====================================================================== */

test("blokiran bucket sprecava scrypt", () => {
  const blockedAt = authorizeBody.indexOf('isBucketBlocked({ scope: "password"');
  const decisionAt = authorizeBody.indexOf("resolveCredentialsLogin(");

  assert.ok(blockedAt > -1, "provera blokade ne postoji");
  assert.ok(
    blockedAt < decisionAt,
    "scrypt se izvrsava pre provere blokade — poklon napadacu",
  );
});

test("neuspeh lozinke uvecava brojace i za nepostojeci nalog", () => {
  const failBlock = authorizeBody.slice(
    authorizeBody.indexOf('if (outcome === "denied")'),
    authorizeBody.indexOf("if (!user) return null;", authorizeBody.indexOf('if (outcome === "denied")')),
  );
  assert.match(failBlock, /registerAttempt\(\{/);
  assert.match(failBlock, /scope: "password"/);
  // Brojanje ide PRE odluke da li korisnik postoji.
  assert.ok(
    failBlock.indexOf("registerAttempt") < failBlock.length,
    "brojac se ne uvecava za nepostojeci nalog",
  );
});

test("dummy hash se i dalje koristi kada nalog ne postoji", () => {
  assert.match(authorizeBody, /absentUserHash: ABSENT_USER_PASSWORD_RECORD/);
});

test("drugi faktor se proverava POSLE lozinke", () => {
  const passwordAt = authorizeBody.indexOf("resolveCredentialsLogin(");
  const mfaAt = authorizeBody.indexOf("readMfaStatus(user.id)");
  const recoveryAt = authorizeBody.indexOf("consumeRecoveryCode(");

  assert.ok(mfaAt > passwordAt, "MFA se cita pre provere lozinke");
  assert.ok(
    recoveryAt > passwordAt,
    "rezervni kod bi se trosio bez tacne lozinke",
  );
});

test("aktivan MFA se zahteva bez obzira na rezim", () => {
  // Grana `status.enabled` nema nijednu proveru rezima — `off` ne sme zaobici
  // vec vezan faktor.
  const enabledBranch = authorizeBody.slice(
    authorizeBody.indexOf("if (status.enabled) {"),
    authorizeBody.indexOf("} else {", authorizeBody.indexOf("if (status.enabled) {")),
  );
  assert.ok(enabledBranch.length > 0, "grana za aktivan MFA ne postoji");
  assert.ok(
    !/mode === "off"/.test(enabledBranch),
    "rezim off zaobilazi vec vezan drugi faktor",
  );
  assert.match(enabledBranch, /if \(submitted === ""\) return null;/);
});

test("prazan drugi faktor kod aktivnog MFA odbija prijavu", () => {
  assert.match(authorizeBody, /if \(submitted === ""\) return null;/);
});

test("uspeh cisti SAMO brojac po nalogu, i tek na kraju", () => {
  const clearAt = authorizeBody.indexOf('clearAccountAttempts("password"');
  const returnAt = authorizeBody.lastIndexOf("return {");
  assert.ok(clearAt > -1, "brojac se ne cisti");
  assert.ok(clearAt < returnAt, "ciscenje nije pre izdavanja sesije");

  // Nigde se ne cisti brojac po adresi.
  assert.ok(
    !/clearAccountAttempts\([^)]*"ip"/.test(authorizeBody),
    "cisti se i brojac po adresi",
  );
});

test("nivo pouzdanosti se odredjuje iz stvarne provere", () => {
  /*
   * Tvrdnja je ista kao pre: nivo pouzdanosti prati ono sto je STVARNO
   * provereno. Promenio se samo put — `authorize` vise ne sklapa vrednost sam,
   * nego prosledjuje potvrdjen faktor politici i uzima njen odgovor. Time token
   * ne moze tvrditi vise nego sto je politika priznala.
   */
  assert.match(authorizeBody, /factor = scope === "recovery" \? "recovery" : "totp"/);
  assert.match(authorizeBody, /let factor: "none" \| "totp" \| "recovery" = "none"/);
  assert.match(authorizeBody, /assurance: accessDecision\.assurance/);
  // Nema lokalne promenljive koja bi mogla da se raziđe sa odlukom.
  assert.ok(
    !/let assurance/.test(authorizeBody),
    "authorize ponovo sam sklapa nivo pouzdanosti",
  );
});

test("uneti drugi faktor ne izlazi iz servera", () => {
  // Ni u audit, ni u povratnu vrednost.
  const audits = [...authorizeBody.matchAll(/recordAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(audits.length > 0);
  for (const block of audits) {
    assert.doesNotMatch(block, /submitted|parsed\.data|token:/, "audit nosi kod");
  }
  // Traze se STVARNE vrednosti, ne imena konstanti: `ASSURANCE_PASSWORD` je
  // oznaka nivoa pouzdanosti, ne lozinka.
  const returned = [...authorizeBody.matchAll(/return \{[\s\S]*?\};/g)].map((m) => m[0]);
  for (const block of returned) {
    assert.doesNotMatch(
      block,
      /\bsubmitted\b|secondFactor|parsed\.data\.password|passwordHash/,
      "povratna vrednost nosi uneti kod ili lozinku",
    );
  }
});

test("klijentska adresa se ne cita naslepo iz zaglavlja", async () => {
  /*
   * Pravilo je izdvojeno u `lib/auth/client-ip.ts`, jer ga uz prijavu koristi i
   * obrazac za promenu lozinke kodom. Druga kopija bi pre ili kasnije otisla u
   * stranu, pa se ovde proverava JEDINO mesto na kome zivi.
   */
  const helper = await read("./client-ip.ts");
  assert.match(helper, /isTrustedProxyEnvironment\(/);
  assert.match(helper, /resolveClientIp\(/);

  // Prijava ide kroz taj modul, a ne pravo u zaglavlja.
  assert.match(authSource, /clientIpFromRequest\(\)/);
  assert.ok(
    !/from "next\/headers"/.test(authSource),
    "prijava ponovo cita zaglavlja mimo zajednickog modula",
  );
});

/* =========================================================================
 * Sadržaj tokena
 * ====================================================================== */

test("u token ulaze samo minimalna polja", () => {
  assert.deepEqual(ALLOWED_TOKEN_FIELDS.sort(), [
    "assurance",
    "mfaVerifiedAt",
    "sessionVersion",
    "sub",
  ]);
  assert.deepEqual(
    forbiddenTokenFields({ sub: "1", assurance: "mfa", sessionVersion: 0, iat: 1 }),
    [],
  );
  assert.deepEqual(
    forbiddenTokenFields({ sub: "1", capabilities: ["view:home"], secret: "x" }).sort(),
    ["capabilities", "secret"],
  );
});

test("jwt callback ne upisuje tajne ni dozvole", () => {
  const jwtBlock = configSource.slice(
    configSource.indexOf("jwt({ token, user })"),
    configSource.indexOf("session({ session, token })"),
  );
  assert.match(jwtBlock, /token\.assurance/);
  assert.match(jwtBlock, /token\.sessionVersion/);
  for (const forbidden of [
    "capabilities",
    "permissions",
    "role",
    "secret",
    "ciphertext",
    "recovery",
    "passwordHash",
  ]) {
    assert.ok(!jwtBlock.includes(forbidden), `token nosi ${forbidden}`);
  }
});

test("uloga i dozvole se i dalje citaju iz baze", () => {
  assert.match(sessionSource, /loadPortalUser\(userId\)/);
  assert.doesNotMatch(configSource, /token\.(role|permissions)/);
});

/* =========================================================================
 * Assurance kapija
 * ====================================================================== */

test("rezervni kod je ravnopravan drugi faktor", () => {
  assert.equal(isSecondFactorSatisfied(ASSURANCE_MFA), true);
  assert.equal(isSecondFactorSatisfied(ASSURANCE_RECOVERY), true);
  assert.equal(isSecondFactorSatisfied(ASSURANCE_PASSWORD), false);
  // Nepoznata vrednost iz tokena je uvek nedovoljna.
  for (const bad of [null, undefined, "", "admin", "MFA", 42]) {
    assert.equal(isSecondFactorSatisfied(bad), false, String(bad));
  }
});

test("getPortalUser ne prihvata enrollment-only sesiju", () => {
  const block = sessionSource.slice(
    sessionSource.indexOf("export async function getPortalUser"),
    sessionSource.indexOf("export type AuthenticatedSession"),
  );
  // Vraca ISKLJUCIVO `fullAccess`; enrollment-only nikada ne prolazi.
  assert.match(block, /\.fullAccess \?\? null/);
});

/*
 * Ranije su ove dve tvrdnje citale grane u `loadAuthenticatedSession`. Te grane
 * vise ne postoje — odluku donosi `resolvePortalAccess`, a ovde se samo prevodi
 * u polja. Ponasanje se zato tvrdi PRAVIM POZIVIMA politike, a ne oblikom
 * izvora; nivoi se proveravaju u `lib/auth/mfaPolicy.test.mjs`.
 */
test("vezan MFA bez potvrde ne daje ni enrollment ni pun pristup", async () => {
  const { resolvePortalAccess, ACCESS_DENIED } = await import("./mfa-policy.mjs");
  for (const mode of ["off", "enroll", "enforced"]) {
    const d = resolvePortalAccess({
      mode,
      environment: "development",
      accountActive: true,
      mfaState: "active",
      factor: "none",
      grantAvailable: true,
    });
    assert.equal(d.access, ACCESS_DENIED, mode);
  }
  // Polja se izvode iz odluke, pa `denied` ne moze da procuri kao korisnik.
  assert.match(sessionSource, /if \(decision\.access === ACCESS_DENIED\) return null;/);
});

test("bez vezanog MFA u enroll/enforced sesija sluzi samo vezivanju", async () => {
  const { resolvePortalAccess, ACCESS_ENROLLMENT_ONLY } = await import(
    "./mfa-policy.mjs"
  );
  assert.equal(
    resolvePortalAccess({
      mode: "enroll",
      environment: "development",
      accountActive: true,
      mfaState: "none",
      factor: "none",
    }).access,
    ACCESS_ENROLLMENT_ONLY,
  );
  assert.equal(
    resolvePortalAccess({
      mode: "enforced",
      environment: "development",
      accountActive: true,
      mfaState: "none",
      factor: "none",
      grantAvailable: true,
    }).access,
    ACCESS_ENROLLMENT_ONLY,
  );
  assert.match(
    sessionSource,
    /enrollmentOnly: decision\.access === ACCESS_ENROLLMENT_ONLY \? user : null/,
  );
});

test("stanje MFA se cita iz baze, ne iz tokena", () => {
  assert.match(sessionSource, /readMfaStatus\(user\.id\)/);
});

test("osetljiva radnja trazi SVEZU potvrdu", () => {
  assert.match(sessionSource, /export async function requireRecentMfa/);
  assert.match(sessionSource, /isMfaRecent\(session\.mfaVerifiedAt\)/);

  const now = new Date("2026-08-24T12:00:00Z");
  assert.equal(isMfaRecent(now.getTime() - 60_000, now), true);
  assert.equal(isMfaRecent(now.getTime() - RECENT_MFA_WINDOW_MS - 1000, now), false);
  assert.equal(isMfaRecent(null, now), false);
  // Vreme iz buducnosti se ne prihvata.
  assert.equal(isMfaRecent(now.getTime() + 60_000, now), false);
});

test("enrollment granica nije resena poredjenjem putanje", () => {
  assert.match(sessionSource, /export async function requireEnrollmentUser/);
  // Autorizacija se ne sme oslanjati na pathname.
  assert.doesNotMatch(sessionSource, /pathname/);
});

/* =========================================================================
 * Dozvola za vezivanje
 * ====================================================================== */

test("dozvola se trosi atomski i vezana je za korisnika", () => {
  const block = grantSource.slice(
    grantSource.indexOf("export async function consumeEnrollmentGrant"),
    grantSource.indexOf("export async function revokeEnrollmentGrants"),
  );
  assert.match(block, /eq\(mfaEnrollmentGrants\.userId, input\.userId\)/);
  assert.match(block, /isNull\(mfaEnrollmentGrants\.usedAt\)/);
  assert.match(block, /isNull\(mfaEnrollmentGrants\.supersededAt\)/);
  assert.match(block, /gt\(mfaEnrollmentGrants\.expiresAt, now\)/);
  assert.match(block, /consumed\.length === 1/);
});

test("nova dozvola ponistava prethodnu", () => {
  const block = grantSource.slice(
    grantSource.indexOf("export async function issueEnrollmentGrant"),
    grantSource.indexOf("export async function consumeEnrollmentGrant"),
  );
  assert.match(block, /supersededAt: now/);
  assert.match(block, /transaction\(/);
});

test("u bazi stoji samo otisak dozvole", () => {
  assert.match(grantSource, /codeFingerprint: recoveryCodeFingerprint\(/);
  const returned = [...grantSource.matchAll(/return \{[\s\S]*?\};/g)].map((m) => m[0]);
  // `issueEnrollmentGrant` sme da vrati kod — to je jedini put kada postoji.
  assert.ok(returned.some((b) => b.includes("code")));
});

test("bootstrap radi samo za aktivnog gazdu i ne ispisuje tajnu", async () => {
  const script = await read("../../scripts/issue-mfa-enrollment-grant.mjs");
  assert.match(script, /role = 'gazda'/);
  assert.match(script, /active = true/);
  // Ne sme ispisati TOTP tajnu ni napraviti trajni master kod.
  assert.ok(!/base32|totpUri|secret/i.test(script), "skripta dodiruje TOTP tajnu");
  assert.match(script, /superseded_at = now\(\)/);
  // Uloga se proverava u SQL-u, ne u JS-u posle ucitavanja.
  assert.match(grantSource, /eq\(users\.role, "gazda"\)/);
});

/* =========================================================================
 * Login forma
 * ====================================================================== */

test("polje za drugi faktor je opciono i neutralno", () => {
  assert.match(formSource, /name="secondFactor"/);
  assert.match(formSource, /autoComplete="one-time-code"/);
  // Nema `required` — inace bi korisnici bez MFA bili blokirani.
  const field = formSource.slice(
    formSource.indexOf('name="secondFactor"') - 400,
    formSource.indexOf('name="secondFactor"') + 400,
  );
  assert.ok(!/required/.test(field), "polje je obavezno");
  assert.match(field, /aria-describedby=\{secondFactorHintId\}/);
});

test("polje ne otkriva da li nalog ima MFA", () => {
  // Tekst mora biti uslovan po korisniku, ne po stanju naloga.
  assert.match(formSource, /Popunite samo ako je za Vaš nalog uključena/);
  assert.ok(!/mfaEnabled|hasMfa/.test(formSource), "forma zna stanje MFA");
});

test("kod ne zavrsava u adresi", () => {
  assert.match(codeOf(formSource), /<form action=\{formAction\}|action=\{formAction\}/);
  // Nema `method="get"` niti rucnog upisa u URL.
  assert.ok(!/method="get"/i.test(formSource));
  assert.ok(!/searchParams\.set\(["']secondFactor/.test(formSource));
});

/* =========================================================================
 * Migracije
 * ====================================================================== */

test("produkcija ne sme DDL runtime nalogom", () => {
  assert.match(migrateSource, /MIGRATION_DATABASE_URL/);
  assert.match(migrateSource, /isProduction && !migrationUrl/);
  assert.match(migrateSource, /process\.exit\(1\)/);
});

test("razvojni povratak na DATABASE_URL je izricit i ogranicen", () => {
  assert.match(migrateSource, /isProduction \? null : process\.env\.DATABASE_URL/);
});

test("provisioning SQL oduzima pravo nad auditom", async () => {
  const sql = await read("../../db/provisioning/runtime-role.sql");
  assert.match(sql, /REVOKE UPDATE, DELETE, TRUNCATE ON audit_log/);
  assert.match(sql, /GRANT SELECT, INSERT ON audit_log/);
  assert.match(sql, /REVOKE ALL ON SCHEMA public FROM PUBLIC/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES/);
  // Bez lozinki u repozitorijumu.
  assert.ok(!/PASSWORD\s+'/i.test(sql), "skripta sadrzi lozinku");
});

/* =========================================================================
 * Odjava — odrediste se ne izvodi iz post-login kapije
 *
 * [source-contract] `signOutAction` nosi `"use server"` i uvozi `@/auth`, pa se
 * ne moze izvrsno uvesti u `node --test` bez podizanja cele aplikacije i baze.
 * Ovde se cita izvor. IZVRSNI dokaz je browser korak 16 u `pg-browser-qa.mts`:
 * stvarni klik, ugasena sesija, obrisan kolacic, `/prijava` u adresi, vidljiva
 * login forma i nevidljiv portal sadrzaj.
 *
 * Kvar koji je ovo izazvao: `signOut({ redirectTo: LOGIN_ROUTE })` provlaci
 * odrediste kroz zajednicki `callbacks.redirect`, koji prima samo `/portal…`,
 * pa je fallback `?? "/portal"` odvodio odjavu na `/portal`.
 * ====================================================================== */

const signOutBody = portalActions.slice(
  portalActions.indexOf("export async function signOutAction"),
  portalActions.indexOf("export type LoginState"),
);

test("[source-contract] odjava zove Auth.js signOut sa redirect: false", () => {
  assert.match(signOutBody, /signOut\(\{\s*redirect:\s*false\s*\}\)/);
  // Odrediste NE sme ici kroz zajednicki redirect callback.
  assert.doesNotMatch(signOutBody, /redirectTo/, "odrediste se vraca u signOut opcije");
});

test("[source-contract] signOut je awaitovan pre preusmeravanja", () => {
  assert.match(signOutBody, /await signOut\(/, "signOut nije awaitovan");
  const posleSignOut = signOutBody.indexOf("await signOut(");
  const posleRedirect = signOutBody.indexOf("redirect(LOGIN_ROUTE)");
  assert.ok(posleSignOut > -1 && posleRedirect > posleSignOut, "redirect ide pre gasenja sesije");
});

test("[source-contract] odjava vodi na LOGIN_ROUTE i nema fallback na /portal", () => {
  assert.match(signOutBody, /redirect\(LOGIN_ROUTE\)/);
  assert.doesNotMatch(signOutBody, /"\/portal"/, "odjava ima fallback na portal");
  assert.doesNotMatch(signOutBody, /"\/prijava"/, "putanja je hardkodovana pored LOGIN_ROUTE");
  assert.match(portalActionsRaw, /import \{ redirect \} from "next\/navigation"/);
});

test("[source-contract] post-login politika ostaje netaknuta", () => {
  /*
   * Popravka odjave ne sme oslabiti kapiju koja stiti povratak posle PRIJAVE.
   * Ove tvrdnje bi pale da je neko „resio" problem tako sto bi u
   * `normalizeCallback` propustio `/prijava`.
   */
  /*
   * Kapija je prosirena na kupcev prostor (`normalizeAnyCallback` = portal ILI
   * `/kupac`), ali NIJE otvorena: sve sto je ranije padalo i dalje pada. Zato
   * se ovde trazi kompozicija, a ne ime jedne funkcije, i odmah ispod se
   * ponasanje proverava pozivom umesto citanjem izvora.
   */
  assert.match(configSource, /const safe = normalizeAnyCallback\(candidate\)/);
  assert.match(configSource, /safe \?\? "\/portal"/);
  // signInAction i dalje prolazi kroz normalizeCallback.
  assert.match(portalActions, /normalizeCallback\(formData\.get\(CALLBACK_PARAM\)\)/);
});

test("[source-contract] prosirena kapija ne propusta nista novo osim /kupac", async () => {
  const { normalizeAnyCallback, normalizeCustomerCallback } = await import(
    "../authz/redirects.mjs"
  );

  // Sve sto je i ranije padalo, i dalje pada.
  for (const zlonamerno of [
    "//zlonamerno.rs",
    "/\\zlonamerno.rs",
    "https://zlonamerno.rs",
    "javascript:alert(1)",
    "/prijava",
    "/prijava/reset",
    "/prijava/kupac",
    "/",
    "/katalog",
    "/kupacki",
    "/kupac\nSet-Cookie: x=1",
  ]) {
    assert.equal(
      normalizeAnyCallback(zlonamerno),
      null,
      `kapija je propustila ${JSON.stringify(zlonamerno)}`,
    );
  }

  // Prosirenje je tacno jedan prostor, i to samo za kupca.
  assert.equal(normalizeAnyCallback("/portal/kupci"), "/portal/kupci");
  assert.equal(normalizeAnyCallback("/kupac"), "/kupac");
  assert.equal(normalizeAnyCallback("/kupac/dokumenti"), "/kupac/dokumenti");

  // Kupcev povratak NIKAD ne sme voditi u interni portal.
  assert.equal(normalizeCustomerCallback("/portal"), null);
  assert.equal(normalizeCustomerCallback("/portal/kupci"), null);
});
