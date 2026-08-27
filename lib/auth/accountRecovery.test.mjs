import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RECOVERY_CODE_ENTROPY_BITS } from "./recovery-codes.mjs";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const block = (source, from, to) =>
  source.slice(
    source.indexOf(from),
    to && source.indexOf(to) > 0 ? source.indexOf(to) : undefined,
  );

const gate = codeOf(await read("../authz/security-admin.ts"));
const adminActions = codeOf(
  await read("../../app/portal/bezbednost/nalozi/actions.ts"),
);
const adminUiSource = await read(
  "../../app/portal/bezbednost/nalozi/SecurityAdmin.tsx",
);
const adminUi = codeOf(adminUiSource);
const passwordActions = codeOf(
  await read("../../app/portal/bezbednost/lozinka/actions.ts"),
);
const resetService = codeOf(await read("./password-reset.ts"));
const resetActions = codeOf(await read("../../app/prijava/reset/actions.ts"));
const resetPage = codeOf(await read("../../app/prijava/reset/page.tsx"));
const resetUi = await read("../../app/prijava/reset/ResetForm.tsx");
const revealHook = await read("../../components/portal/useEphemeralReveal.ts");
const mfaUi = await read("../../app/portal/bezbednost/mfa/MfaEnrollment.tsx");
const headers = codeOf(await read("../security/http-headers.mjs"));
const middleware = codeOf(await read("../../middleware.ts"));
const revocation = codeOf(await read("./session-revocation.ts"));
const mfaService = codeOf(await read("./mfa-service.ts"));
const adminPage = codeOf(
  await read("../../app/portal/bezbednost/nalozi/page.tsx"),
);

/* =========================================================================
 * Centralna kapija
 * ====================================================================== */

test("kapija trazi punu sesiju, sposobnost i svez kod", () => {
  const fn = block(gate, "export async function requireSecurityAdmin", "export type SecurityTarget");
  assert.match(fn, /requireFullPortalUser\(\)/);
  assert.match(fn, /requireCapability\(SECURITY_ADMIN_CAPABILITY\)/);
  assert.match(fn, /verifyTotpForUser\(\{ userId: actor\.id, token: totpToken \}\)/);
});

test("kapija nema prolaz za privilegovanu ulogu", () => {
  const fn = block(gate, "export async function requireSecurityAdmin", "export type SecurityTarget");
  // Izuzetak za „gazdu" bio bi tacno ona rupa koju modul zatvara.
  assert.ok(!/gazda/.test(fn), "kapija ima precicu za ulogu");
});

test("kod ide kroz istu replay zastitu kao pri prijavi", () => {
  // `verifyTotpForUser` podize `last_accepted_counter`; presretnut kod ne
  // prolazi drugi put. Rucna provera koda zaobisla bi to.
  assert.ok(!/validateTotp|totp\.validate/.test(gate), "kapija sama proverava kod");
});

test("svaka administratorska akcija prolazi kroz kapiju", () => {
  const actions = [...adminActions.matchAll(/export async function (\w+Action)/g)].map(
    (m) => m[1],
  );
  assert.ok(actions.length >= 4, `ocekivane bar 4 akcije, nadjeno ${actions.length}`);

  for (const name of actions) {
    const body = block(adminActions, `export async function ${name}`, undefined);
    const own = body.slice(0, body.indexOf("export async function", 10) + 1 || undefined);
    assert.match(own, /requireSecurityAdmin\(/, `${name} zaobilazi kapiju`);
  }
});

test("nijedna administratorska akcija ne radi nad sopstvenim nalogom", () => {
  // `loadSecurityTarget` podrazumevano odbija samog administratora; nijedan
  // poziv ne sme da ukljuci `allowSelf`.
  assert.ok(
    !/allowSelf/.test(adminActions),
    "neka akcija dozvoljava radnju nad sobom",
  );
  const loader = block(gate, "export async function loadSecurityTarget", "const OWNER_GUARD_LOCK_KEY");
  assert.match(loader, /if \(!options\.allowSelf && targetId === options\.actorId\)/);
});

test("cilj se cita iz baze, ne iz obrasca", () => {
  const loader = block(gate, "export async function loadSecurityTarget", "const OWNER_GUARD_LOCK_KEY");
  assert.match(loader, /\.from\(users\)[\s\S]{0,80}\.where\(eq\(users\.id, targetId\)\)/);
});

test("kapija broji promasene kodove", () => {
  // Kod ima sest cifara. Zastita od ponovne upotrebe sprecava da presretnut kod
  // prodje drugi put, ali ne sprecava POGADJANJE iz otvorene sesije.
  const fn = block(gate, "export async function requireSecurityAdmin", "export type SecurityTarget");
  const blocked = fn.indexOf("isBucketBlocked(");
  const verify = fn.indexOf("verifyTotpForUser(");
  assert.ok(blocked > 0, "kapija ne gleda blokadu");
  assert.ok(blocked < verify, "blokada se gleda tek posle skupe provere");
  assert.match(fn, /registerAttempt\(/);
  assert.match(fn, /clearAccountAttempts\("totp", actor\.email\)/);
  // Brojac se cisti tek posle prihvacenog koda.
  assert.ok(fn.indexOf("clearAccountAttempts") > verify);
});

test("blokada kapije daje istu genericnu poruku", () => {
  const fn = block(gate, "export async function requireSecurityAdmin", "export type SecurityTarget");
  const errors = [...fn.matchAll(/new SecurityActionError\((\w+)\)/g)].map((m) => m[1]);
  assert.ok(errors.length >= 2);
  assert.ok(
    errors.every((e) => e === "SECURITY_GENERIC_ERROR"),
    `razlicite poruke odaju sta je pogresno: ${errors.join(", ")}`,
  );
});

/* =========================================================================
 * d1 — promena sopstvene lozinke
 * ====================================================================== */

test("promena lozinke trazi punu sesiju, trenutnu lozinku i svez kod", () => {
  assert.match(passwordActions, /requireFullPortalUser\(\)/);
  assert.match(passwordActions, /verifyPassword\(parsed\.data\.current, record\.passwordHash\)/);
  // Poziv je sada visedelan (obe provere se izvrsavaju), pa se tvrdi sadrzaj.
  assert.match(
    passwordActions,
    /verifyTotpForUser\(\{\s*userId: user\.id,\s*token: parsed\.data\.token,?\s*\}\)/,
  );
});

test("promena lozinke broji pokusaje i ne odaje sta je promaseno", () => {
  const blocked = passwordActions.indexOf("isBucketBlocked(");
  const verify = passwordActions.indexOf("verifyPassword(");
  assert.ok(blocked > 0 && blocked < verify, "blokada se gleda posle provere");
  assert.match(passwordActions, /registerAttempt\(/);
  assert.match(passwordActions, /clearAccountAttempts\("totp", user\.email\)/);

  // Kod se proverava i kada je lozinka pogresna: rani izlaz bi razlikom u
  // vremenu odgovora rekao koja je od dve stvari promasena.
  assert.match(passwordActions, /const tokenOk = await verifyTotpForUser\(/);
  assert.match(passwordActions, /if \(!passwordOk \|\| !tokenOk\)/);
});

test("nova lozinka, opoziv sesija i oba traga su u jednoj transakciji", () => {
  const tx = block(passwordActions, "await getDb().transaction(", "return { error: null");
  assert.match(tx, /passwordHash/);
  assert.match(tx, /revokeUserSessions\(tx, user\.id, now\)/);
  const audits = [...tx.matchAll(/action: AUDIT_ACTIONS\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(audits, ["passwordChanged", "sessionsRevoked"]);
  // Svaki `recordAudit` prima BAS tu transakciju.
  assert.equal((tx.match(/\n      tx,\n/g) ?? []).length, 2);
});

test("opoziv obara i tekucu sesiju", () => {
  assert.match(revocation, /sessionVersion: sql`\$\{users\.sessionVersion\} \+ 1`/);
  // Nema izuzimanja tekuceg tokena — inace promena lozinke ne bi izbacila
  // onoga ko sedi za otvorenim laptopom.
  assert.ok(!/current|except|skipSelf/i.test(revocation));
});

test("trag promene lozinke ne nosi ni staru ni novu lozinku", () => {
  const audits = [...passwordActions.matchAll(/recordAudit\(\s*\{[\s\S]*?\},\s*tx,\s*\)/g)].map(
    (m) => m[0],
  );
  assert.ok(audits.length === 2);
  for (const entry of audits) {
    assert.doesNotMatch(entry, /passwordHash|parsed\.data|current|next/);
  }
});

test("nova lozinka ima donju granicu duzine i potvrdu", () => {
  assert.match(passwordActions, /next: z\.string\(\)\.min\(12\)/);
  assert.match(passwordActions, /value\.next === value\.confirm/);
  assert.match(passwordActions, /value\.next !== value\.current/);
});

/* =========================================================================
 * d2 — kod za promenu lozinke
 * ====================================================================== */

test("kod ima najmanje 128 bita entropije", () => {
  assert.ok(
    RECOVERY_CODE_ENTROPY_BITS >= 128,
    `entropija je ${RECOVERY_CODE_ENTROPY_BITS} bita`,
  );
  assert.match(resetService, /generateRecoveryCode\(\)/);
});

test("u bazi ostaje samo HMAC otisak, nikad sam kod", () => {
  assert.match(resetService, /codeFingerprint: recoveryCodeFingerprint\(code, env\(\), keyVersion\)/);

  // Nijedan KLJUC upisa ne sme nositi sirovu vrednost. Gleda se samo levo od
  // dvotacke: `recoveryCodeFingerprint(code, …)` sme da primi kod kao argument,
  // jer iz njega izlazi otisak.
  const inserts = [...resetService.matchAll(/\.values\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  assert.ok(inserts.length >= 1, "nema nijednog upisa");
  for (const body of inserts) {
    const keys = [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    assert.ok(keys.length > 0, "upis bez prepoznatih kolona");
    for (const key of keys) {
      assert.ok(
        !/^(code|plaintext|secret)$/.test(key),
        `sirova vrednost ulazi u bazu kroz kolonu ${key}`,
      );
    }
  }
});

test("rok vazenja je najvise 30 minuta", () => {
  assert.match(resetService, /RESET_TTL_MS = 30 \* 60_000/);
});

test("nov kod ponistava prethodni; u opticaju je najvise jedan", () => {
  const issue = block(resetService, "export async function issuePasswordResetCode", "export type ResetOutcome");
  assert.match(issue, /set\(\{ supersededAt: now \}\)/);
  assert.match(issue, /isNull\(passwordResetCodes\.usedAt\)/);
});

test("izdavanje odmah obara sesije cilja", () => {
  const issue = block(resetService, "export async function issuePasswordResetCode", "export type ResetOutcome");
  assert.match(issue, /sessionVersion: sql`\$\{users\.sessionVersion\} \+ 1`/);
});

test("trosenje koda je atomsko — svi uslovi su u WHERE", () => {
  const complete = block(resetService, "export async function completePasswordReset", "function knownKeyVersions");
  const where = block(complete, ".where(", ".returning(");
  for (const condition of [
    /eq\(passwordResetCodes\.codeFingerprint, fingerprint\)/,
    // Cilj je `targetId`: pravi nalog kada postoji, inace ID koji ne moze
    // nikoga da pogodi. Upit je isti u obe grane.
    /eq\(passwordResetCodes\.userId, targetId\)/,
    /isNull\(passwordResetCodes\.usedAt\)/,
    /isNull\(passwordResetCodes\.supersededAt\)/,
    /gt\(passwordResetCodes\.expiresAt, now\)/,
  ]) {
    assert.match(where, condition);
  }
  // Jedan red ili nista; provera pa upis bila bi trka.
  assert.match(complete, /\.returning\(\{ id: passwordResetCodes\.id \}\)/);
  assert.match(complete, /rows\.length === 1/);
});

test("nova lozinka i opoziv sesija idu u istoj transakciji kao trosenje", () => {
  const complete = block(resetService, "export async function completePasswordReset", "function knownKeyVersions");
  assert.match(complete, /getDb\(\)\.transaction\(async \(tx\) => \{/);
  assert.match(complete, /tx\s*\n?\s*\.update\(users\)/);
  assert.match(complete, /sessionVersion: sql`\$\{users\.sessionVersion\} \+ 1`/);
});

test("deaktiviran nalog se ne ozivljava promenom lozinke", () => {
  const complete = block(resetService, "export async function completePasswordReset", "function knownKeyVersions");
  // Uslov je sada imenovan i ulazi u obe odluke — i u ciljni ID i u ishod.
  assert.match(complete, /const dozvoljen = Boolean\(account && account\.active\)/);
  assert.match(complete, /if \(!consumed \|\| !dozvoljen\) return \{ ok: false \}/);
});

/* =========================================================================
 * Strana za oporavak
 * ====================================================================== */

test("ruta postoji i renderuje obrazac", () => {
  assert.match(resetPage, /export default function PasswordResetPage/);
  assert.match(resetPage, /<ResetForm \/>/);
  assert.match(resetPage, /export const dynamic = "force-dynamic"/);
});

test("strana ne trazi prijavu", () => {
  // Nalog cija je lozinka kompromitovana cesto ima i tudju otvorenu sesiju;
  // preusmeravanje prijavljenih sprecilo bi vlasnika da to popravi.
  assert.ok(!/requireUser|getPortalUser|redirect\(/.test(resetPage));
});

test("kod se unosi rukom i nikad ne dolazi iz adrese", () => {
  assert.ok(
    !/searchParams|useSearchParams|location\.(search|hash)/.test(resetUi),
    "kod se cita iz adrese",
  );
  assert.ok(!/searchParams/.test(resetPage), "strana prima kod kroz adresu");
  assert.match(resetUi, /name="code"/);
});

test("neuspeh daje istu poruku bez obzira na razlog", () => {
  const rejections = [...resetActions.matchAll(/error: (\w+)\s*[,;}\n]/g)]
    .map((m) => m[1])
    .filter((value) => value !== "null");
  assert.ok(rejections.includes("GENERIC"));
  // Ni jedna grana ne sme reci da nalog ne postoji.
  assert.ok(!/ne postoji|nepoznat nalog/i.test(resetActions));
});

test("pokusaji su ograniceni, i brojac raste pre provere koda", () => {
  const attempt = resetActions.indexOf("registerAttempt(");
  const verify = resetActions.indexOf("completePasswordReset(");
  assert.ok(attempt > 0 && verify > attempt, "brojac raste tek posle provere");
  assert.match(resetActions, /scope: "reset"/);
});

test("javni oporavak hesira lozinku i kada nalog ne postoji", () => {
  // Bez ovoga bi nepostojeci nalog odgovarao odmah, a postojeci posle ~100 ms
  // scrypt-a. Ista poruka ne pomaze ako je vreme razlicito — obrazac bi postao
  // sredstvo za proveru koje adrese postoje.
  const fn = block(
    resetService,
    "export async function completePasswordReset",
    "function knownKeyVersions",
  );
  const hash = fn.indexOf("await hashPassword(");
  const odluka = fn.indexOf("const dozvoljen");
  assert.ok(hash > 0, "lozinka se uopste ne hesira");
  assert.ok(odluka > hash, "odluka o nalogu ide pre hesiranja");
  // Jaca tvrdnja od prvobitne: posle hesa nema izlaza pre transakcije.
  const posle = fn.slice(hash);
  assert.ok(
    posle.indexOf("getDb().transaction(") > 0,
    "transakcija se ne otvara u obe grane",
  );
});

test("provera oblika koda ne zavisi od naloga", () => {
  const fn = block(
    resetService,
    "export async function completePasswordReset",
    "function knownKeyVersions",
  );
  // Sme rano, jer odgovor zavisi samo od onoga sto je posiljalac sam uneo.
  const format = fn.indexOf("looksLikeRecoveryCode(input.code)");
  const query = fn.indexOf(".from(users)");
  assert.ok(format > 0 && format < query, "oblik se proverava tek posle upita");
});

test("uspeh ostavlja oba traga", () => {
  const audits = [...resetActions.matchAll(/action: AUDIT_ACTIONS\.(\w+)/g)].map((m) => m[1]);
  assert.ok(audits.includes("passwordResetCompleted"));
  assert.ok(audits.includes("sessionsRevoked"));
  assert.ok(audits.includes("rateLimitBlocked"));
});

test("cela grana /prijava je javna, ukljucujuci oporavak", () => {
  assert.match(middleware, /pathname\.startsWith\(`\$\{LOGIN_ROUTE\}\/`\)/);
});

test("strana za oporavak je na spisku bez kesiranja", () => {
  assert.match(headers, /"\/prijava\/reset"/);
});

/* =========================================================================
 * d3 — iskljucivanje i vracanje naloga
 * ====================================================================== */

test("oba smera gase otvorene sesije", () => {
  const fn = block(
    adminActions,
    "export async function setAccountActiveAction",
    "export async function resetUserMfaAction",
  );
  assert.match(fn, /revokeUserSessions\(tx, target\.id, now\)/);
  // Poziv je van svake grane — vazi i za iskljucivanje i za vracanje.
  assert.ok(!/if \(nextActive\)[\s\S]{0,120}revokeUserSessions/.test(fn));
});

test("iskljucivanje i vracanje nose razlicite trage", () => {
  const fn = block(
    adminActions,
    "export async function setAccountActiveAction",
    "export async function resetUserMfaAction",
  );
  assert.match(fn, /AUDIT_ACTIONS\.userReactivated/);
  assert.match(fn, /AUDIT_ACTIONS\.userDeactivated/);
});

/* =========================================================================
 * d4 — ponistavanje tudjeg drugog faktora
 * ====================================================================== */

test("ponistavanje brise tajnu, kodove, dozvole i sesije", () => {
  const fn = block(
    adminActions,
    "export async function resetUserMfaAction",
    "export async function issueEnrollmentGrantAction",
  );
  assert.match(fn, /resetMfaForUser\(\{ userId: target\.id \}\)/);
  assert.match(fn, /revokeEnrollmentGrants\(target\.id\)/);
  assert.match(fn, /revokeUserSessionsStandalone\(target\.id\)/);
});

test("ponistavanje brise i pending tajnu, ne samo aktivnu", () => {
  const fn = block(mfaService, "export async function resetMfaForUser", "async function replaceRecoveryCodes");
  for (const column of [
    "secretCiphertext: null",
    "pendingCiphertext: null",
    "lastAcceptedCounter: null",
  ]) {
    assert.ok(fn.includes(column), `nije obrisano: ${column}`);
  }
  assert.match(fn, /delete\(mfaRecoveryCodes\)/);
});

test("posle ponistavanja odmah stize nova dozvola", () => {
  const fn = block(
    adminActions,
    "export async function resetUserMfaAction",
    "export async function issueEnrollmentGrantAction",
  );
  // Bez nje bi korisnik u rezimu `enforced` ostao zakljucan napolju.
  assert.match(fn, /issueEnrollmentGrant\(\{/);
  assert.match(fn, /kind: "grant"/);
});

/* =========================================================================
 * d5 — dozvola za vezivanje
 * ====================================================================== */

test("dozvola nije precica za nalog koji vec ima faktor", () => {
  const fn = block(adminActions, "export async function issueEnrollmentGrantAction", undefined);
  assert.match(fn, /if \(status\.enabled\)/);
  assert.match(fn, /koristite poništavanje faktora/);
});

test("iskljucen nalog ne dobija ni dozvolu ni kod za lozinku", () => {
  const grant = block(adminActions, "export async function issueEnrollmentGrantAction", undefined);
  const reset = block(
    adminActions,
    "export async function issueResetCodeAction",
    "const activeSchema",
  );
  assert.match(grant, /if \(!target\.active\)/);
  assert.match(reset, /if \(!target\.active\)/);
});

/* =========================================================================
 * Jednokratni prikaz i back/forward kes
 * ====================================================================== */

test("izdate tajne se ne citaju iz baze — postoje samo u odgovoru", () => {
  assert.ok(
    !/select[\s\S]{0,80}(passwordResetCodes|mfaEnrollmentGrants)[\s\S]{0,80}codeFingerprint/i.test(
      adminActions,
    ),
    "tajna se cita iz baze",
  );
  assert.match(adminActions, /code,\s*\n\s*expiresAt: expiresAt\.toISOString\(\)/);
});

test("izdata tajna nigde se ne upisuje u pretrazivacu", () => {
  assert.ok(!/localStorage|sessionStorage/.test(adminUi), "tajna ide u skladiste");
  assert.ok(
    !/history\.(push|replace)State|location\.hash/.test(adminUi),
    "tajna ide u adresu",
  );
});

test("prikaz se brise pri napustanju strane", () => {
  // `no-store` ne pokriva back/forward kes: tamo se cuva ziva strana sa React
  // stanjem, pa bi „Nazad" vratio kod na ekran.
  assert.match(revealHook, /addEventListener\("pagehide"/);
  assert.match(revealHook, /addEventListener\("pageshow"/);
  assert.match(revealHook, /if \(event\.persisted\) clear\(\)/);
});

test("hook se koristi i za izdate kodove i za rezervne kodove", () => {
  assert.match(adminUi, /useEphemeralReveal\(clear, !cleared\)/);
  assert.match(mfaUi, /useEphemeralReveal\(hide, Boolean\(freshCodes \|\| freshSetup\)\)/);
});

test("brisanje se ne vezuje za promenu taba", () => {
  // Prelazak na drugi tab ne znaci da je korisnik zavrsio; brisanje tada bi mu
  // progutalo kodove usred prepisivanja.
  assert.ok(!/visibilitychange|blur/.test(codeOf(revealHook)));
});

test("nov unos vraca prikaz — zastavica nije trajna", () => {
  assert.match(mfaUi, /onSubmit=\{reveal\}/);
});

/* =========================================================================
 * Sta administrator sme da vidi
 * ====================================================================== */

test("sopstveni nalog se ne prikazuje u administraciji", () => {
  assert.match(adminPage, /ne\(users\.id, actor\.id\)/);
});

test("strana trazi istu sposobnost kao i akcije", () => {
  assert.match(adminPage, /requireCapability\(\s*SECURITY_ADMIN_CAPABILITY/);
  assert.match(adminPage, /requireFullPortalUser\(/);
});

test("spisak naloga ne nosi nijednu tajnu u RSC payloadu", () => {
  // Spisak se renderuje na serveru, pa sve sto udje u njega putuje uz svaku
  // posetu strane. Sme da nosi samo cinjenice — ime, ulogu, DA/NE zastavice.
  const selected = block(adminPage, ".select({", ".from(users)");
  const columns = [...selected.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(columns, ["id", "name", "email", "role", "active"]);

  // Ni jedan izraz ne cita materijal iz tabela sa tajnama.
  assert.ok(
    !/codeFingerprint|passwordHash|secretCiphertext|passwordResetCodes|mfaEnrollmentGrants/.test(
      adminPage,
    ),
    "strana dodiruje tajni materijal",
  );
  // `hasOpenResetCode` vraca boolean, ne kod.
  assert.match(adminPage, /hasOpenReset: openReset/);
});

/* =========================================================================
 * Tip vremena u upitima
 *
 * Prvi prolaz nad pravim PostgreSQL-om pao je sa
 * `ERR_INVALID_ARG_TYPE: Received an instance of Date`. Uzrok: `Date` ubacen u
 * sirov `sql` sablon putuje do drajvera BEZ tipa kolone. Operatori tipa `gt`
 * prolaze kroz maper kolone i salju ispravan `timestamptz`.
 * ====================================================================== */

test("nijedan upit ne poredi vreme kroz sirov sql sablon", async () => {
  const fajlovi = [
    "./enrollment-grant.ts",
    "./password-reset.ts",
    "./rate-limit-service.ts",
    "./mfa-service.ts",
    "./session-revocation.ts",
  ];

  for (const putanja of fajlovi) {
    const izvor = codeOf(await read(putanja));
    // Trazi se `sql`...${nesto}` gde je leva strana kolona sa vremenom.
    const sumnjivi = [...izvor.matchAll(/sql`[^`]*\b(expiresAt|blockedUntil|usedAt|windowStartedAt|pendingExpiresAt|lockedUntil)\b[^`]*`/g)];
    const sa_parametrom = sumnjivi.filter((m) => /\$\{(now|olderThan|expiresAt|input\.now)\}/.test(m[0]));
    assert.deepEqual(
      sa_parametrom.map((m) => m[0]),
      [],
      `${putanja} ponovo salje Date kroz sirov sablon`,
    );
  }
});

test("poredjenja vremena koriste tipizovane operatore", async () => {
  const grant = codeOf(await read("./enrollment-grant.ts"));
  assert.match(grant, /gt\(mfaEnrollmentGrants\.expiresAt, now\)/);
  // Oba upita — i trosenje i provera otvorene dozvole.
  assert.equal((grant.match(/gt\(mfaEnrollmentGrants\.expiresAt, now\)/g) ?? []).length, 2);

  const rl = codeOf(await read("./rate-limit-service.ts"));
  assert.match(rl, /or\(isNull\(authRateLimits\.blockedUntil\), lte\(authRateLimits\.blockedUntil, now\)\)/);
});

test("obe grane javnog oporavka rade isti posao", async () => {
  const izvor = codeOf(await read("./password-reset.ts"));
  const fn = izvor.slice(
    izvor.indexOf("export async function completePasswordReset"),
    izvor.indexOf("function knownKeyVersions"),
  );

  // Nema ranog izlaza posle provere naloga: to je bio uzrok razlike od 443 ms.
  const posleHesa = fn.slice(fn.indexOf("await hashPassword("));
  assert.ok(
    !/if \(!account[^)]*\) return \{ ok: false \};/.test(posleHesa),
    "grana bez naloga ponovo izlazi pre transakcije",
  );

  // Obe grane ulaze u istu transakciju i istu petlju otisaka.
  assert.match(fn, /return getDb\(\)\.transaction\(/);
  assert.match(fn, /for \(const keyVersion of knownKeyVersions\(\)\)/);
  // Nepostojeci nalog dobija ID koji ne moze nikoga da pogodi.
  assert.match(fn, /NEPOSTOJECI_ID = "00000000-0000-0000-0000-000000000000"/);
  assert.match(fn, /eq\(passwordResetCodes\.userId, targetId\)/);
  // Zavrsni upis takodje ide u obe grane.
  assert.match(fn, /\.where\(eq\(users\.id, consumed && dozvoljen \? targetId : NEPOSTOJECI_ID\)\)/);

  // Fiksni `sleep` nije odbrana i ne sme se pojaviti.
  assert.ok(!/setTimeout|sleep\(/.test(fn), "vreme se izjednacava cekanjem");
});
