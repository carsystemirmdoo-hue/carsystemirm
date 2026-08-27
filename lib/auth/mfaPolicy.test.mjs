import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACCESS_DENIED,
  ACCESS_ENROLLMENT_ONLY,
  ACCESS_FULL,
  DENY_REASONS,
  describeMfaMode,
  isBlockedBySensitivity,
  MFA_SENSITIVE_CAPABILITIES,
  mfaStateFrom,
  resolveMfaMode,
  resolvePortalAccess,
  resolveRuntimeEnvironment,
  validateMfaConfiguration,
} from "./mfa-policy.mjs";

/**
 * Matrica odluke o pristupu portalu.
 *
 * Ovo su PRAVI pozivi `resolvePortalAccess`, ne citanje izvora. Ocekivane
 * vrednosti su ispisane rukom, jedna po jedna — namerno. Da se ocekivanje
 * racuna drugom funkcijom, ta funkcija bi ponovila istu gresku i test bi
 * prolazio nad pogresnim ponasanjem.
 */

const base = {
  mode: "off",
  environment: "development",
  accountActive: true,
  sessionVersionCurrent: true,
  mfaState: "none",
  factor: "none",
  grantAvailable: false,
};

const decide = (overrides) => resolvePortalAccess({ ...base, ...overrides });

/* =========================================================================
 * Neaktivan nalog — odbijen uvek, bez izuzetka
 * ====================================================================== */

test("iskljucen nalog je odbijen u svakom rezimu i svakom stanju", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    for (const environment of ["development", "test", "production"]) {
      for (const mfaState of ["none", "pending", "active"]) {
        for (const factor of ["none", "totp", "recovery"]) {
          for (const grantAvailable of [false, true]) {
            const d = decide({
              mode,
              environment,
              accountActive: false,
              mfaState,
              factor,
              grantAvailable,
            });
            assert.equal(
              d.access,
              ACCESS_DENIED,
              `propusten iskljucen nalog: ${mode}/${environment}/${mfaState}/${factor}/grant=${grantAvailable}`,
            );
            assert.equal(d.reason, DENY_REASONS.accountInactive);
          }
        }
      }
    }
  }
});

/* =========================================================================
 * Opozvana sesija
 * ====================================================================== */

test("zastarela verzija sesije je odbijena i kada je sve ostalo ispravno", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    for (const mfaState of ["none", "pending", "active"]) {
      const d = decide({
        mode,
        mfaState,
        factor: mfaState === "active" ? "totp" : "none",
        sessionVersionCurrent: false,
        grantAvailable: true,
      });
      assert.equal(d.access, ACCESS_DENIED, `${mode}/${mfaState}`);
      assert.equal(d.reason, DENY_REASONS.staleSession);
    }
  }
});

test("aktuelna verzija sesije ne smeta", () => {
  assert.equal(decide({ sessionVersionCurrent: true }).access, ACCESS_FULL);
});

/* =========================================================================
 * Korisnik SA aktivnim faktorom
 * ====================================================================== */

test("aktivan faktor bez unetog koda nikada ne daje pun pristup", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    for (const environment of ["development", "test", "production"]) {
      const d = decide({ mode, environment, mfaState: "active", factor: "none" });
      assert.equal(d.access, ACCESS_DENIED, `${mode}/${environment}`);
      assert.equal(d.reason, DENY_REASONS.secondFactorMissing);
    }
  }
});

test("aktivan faktor bez koda se NE spusta na enrollment-only", () => {
  // Spustiti ga na vezivanje znacilo bi ponuditi mu da veze nov uredjaj bez
  // ijednog dokaza da je on. To bi bio put za preuzimanje naloga.
  for (const mode of ["off", "enroll", "enforced"]) {
    const d = decide({ mode, mfaState: "active", factor: "none", grantAvailable: true });
    assert.notEqual(d.access, ACCESS_ENROLLMENT_ONLY, `${mode} degradira aktivan MFA`);
  }
});

test("validan TOTP daje pun pristup u svakom rezimu", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    for (const environment of ["development", "test", "production"]) {
      const d = decide({ mode, environment, mfaState: "active", factor: "totp" });
      assert.equal(d.access, ACCESS_FULL, `${mode}/${environment}`);
      assert.equal(d.assurance, "mfa");
    }
  }
});

test("validan rezervni kod daje pun pristup sa assurance recovery", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    const d = decide({ mode, mfaState: "active", factor: "recovery" });
    assert.equal(d.access, ACCESS_FULL, mode);
    assert.equal(d.assurance, "recovery");
  }
});

test("rezim off ne iskljucuje faktor onome ko ga je vec aktivirao", () => {
  // Inace bi se zastita ukidala promenom jedne promenljive, bez znanja vlasnika
  // naloga koji ju je ukljucio.
  const d = decide({ mode: "off", environment: "development", mfaState: "active", factor: "none" });
  assert.equal(d.access, ACCESS_DENIED);
});

/*
 * Pogresan, istekao, ponovljen TOTP i potrosen rezervni kod ne stizu do ove
 * funkcije kao poseban slucaj: `verifyTotpForUser` i `consumeRecoveryCode`
 * vracaju `false`, a pozivalac tada prosledjuje `factor: "none"`. Test ispod
 * zakljucava tu vezu, da mapiranje ne bi ostalo nepisana pretpostavka.
 */
test("neprihvacen faktor je za politiku isto sto i nedostajuci", () => {
  const odbijen = decide({ mfaState: "active", factor: "none" });
  assert.equal(odbijen.access, ACCESS_DENIED);
  assert.equal(odbijen.reason, DENY_REASONS.secondFactorMissing);
});

/* =========================================================================
 * Korisnik BEZ aktivnog faktora
 * ====================================================================== */

test("enroll nikada ne daje pun pristup bez faktora", () => {
  for (const environment of ["development", "test", "production"]) {
    for (const mfaState of ["none", "pending"]) {
      for (const grantAvailable of [false, true]) {
        const d = decide({ mode: "enroll", environment, mfaState, grantAvailable });
        assert.equal(
          d.access,
          ACCESS_ENROLLMENT_ONLY,
          `enroll/${environment}/${mfaState}/grant=${grantAvailable}`,
        );
      }
    }
  }
});

test("enforced bez faktora i bez dozvole odbija prijavu", () => {
  for (const environment of ["development", "test", "production"]) {
    const d = decide({ mode: "enforced", environment, mfaState: "none", grantAvailable: false });
    assert.equal(d.access, ACCESS_DENIED, environment);
    assert.equal(d.reason, DENY_REASONS.enrollmentGrantMissing);
  }
});

test("enforced bez faktora sa vazecom dozvolom daje SAMO vezivanje", () => {
  for (const environment of ["development", "test", "production"]) {
    const d = decide({ mode: "enforced", environment, mfaState: "none", grantAvailable: true });
    assert.equal(d.access, ACCESS_ENROLLMENT_ONLY, environment);
  }
});

test("zapoceto vezivanje drzi vrata otvorena dok traje, i ne vodi u portal", () => {
  // Dozvola je vec potrosena da bi se stiglo do `pending`; traziti novu usred
  // postupka znacilo bi da se vezivanje nikada ne moze zavrsiti.
  const d = decide({ mode: "enforced", mfaState: "pending", grantAvailable: false });
  assert.equal(d.access, ACCESS_ENROLLMENT_ONLY);
});

test("pending nije precica do punog portala ni u jednom rezimu", () => {
  for (const mode of ["off", "enroll", "enforced"]) {
    const d = decide({ mode, environment: "production", mfaState: "pending" });
    assert.notEqual(d.access, ACCESS_FULL, `${mode} pusta pending u portal`);
  }
});

test("istekla pending tajna se broji kao da je nema", () => {
  const proslost = new Date(Date.now() - 60_000);
  const buducnost = new Date(Date.now() + 60_000);
  assert.equal(mfaStateFrom({ enabled: false, pendingUntil: proslost }), "none");
  assert.equal(mfaStateFrom({ enabled: false, pendingUntil: buducnost }), "pending");
  assert.equal(mfaStateFrom({ enabled: false, pendingUntil: null }), "none");
  // Aktivan faktor nadjacava sve.
  assert.equal(mfaStateFrom({ enabled: true, pendingUntil: buducnost }), "active");
});

/* =========================================================================
 * Rezim `off` i granica produkcije
 * ====================================================================== */

test("off daje pun pristup lozinkom samo van produkcije", () => {
  for (const environment of ["development", "test"]) {
    assert.equal(decide({ mode: "off", environment }).access, ACCESS_FULL, environment);
  }
  // U produkciji sama lozinka nije dovoljna ni kada je `off` izricito podesen:
  // izmedju „vlasnik je svesno izabrao off" i „promenljiva je ispala" sistem ne
  // vidi razliku, a cena pogresne pretpostavke je ceo portal iza jedne lozinke.
  assert.equal(
    decide({ mode: "off", environment: "production" }).access,
    ACCESS_ENROLLMENT_ONLY,
  );
});

/* =========================================================================
 * Parsiranje konfiguracije — fail-closed u produkciji
 * ====================================================================== */

test("nedostajuca vrednost u produkciji ne postaje off", () => {
  const r = resolveMfaMode({ NODE_ENV: "production" });
  assert.equal(r.mode, "enforced");
  assert.equal(r.configured, false);
  assert.equal(r.environment, "production");
});

test("neispravna vrednost u produkciji ne postaje off", () => {
  for (const raw of ["ENFORCE", "yes", "true", "on", "1", "enforcedd"]) {
    const r = resolveMfaMode({ NODE_ENV: "production", PORTAL_MFA_MODE: raw });
    assert.equal(r.mode, "enforced", `propusteno: ${raw}`);
    assert.equal(r.rawWasInvalid, true);
  }
});

test("van produkcije nedostajuca vrednost je off", () => {
  for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "test" }]) {
    assert.equal(resolveMfaMode(env).mode, "off");
  }
});

test("ispravne vrednosti prolaze bez obzira na razmake i velicinu slova", () => {
  assert.equal(resolveMfaMode({ PORTAL_MFA_MODE: " Enforced " }).mode, "enforced");
  assert.equal(resolveMfaMode({ PORTAL_MFA_MODE: "ENROLL" }).mode, "enroll");
  assert.equal(resolveMfaMode({ PORTAL_MFA_MODE: "off" }).mode, "off");
});

test("zastarelo ime promenljive i dalje radi, ali se prijavljuje", () => {
  const r = resolveMfaMode({ PORTAL_MFA_ENFORCEMENT: "enroll" });
  assert.equal(r.mode, "enroll");
  assert.equal(r.usedLegacyName, true);
  assert.match(describeMfaMode(r).message, /PORTAL_MFA_MODE/);

  // Kanonsko ime ima prednost kada su oba podesena.
  const oba = resolveMfaMode({ PORTAL_MFA_MODE: "off", PORTAL_MFA_ENFORCEMENT: "enforced" });
  assert.equal(oba.mode, "off");
  assert.equal(oba.usedLegacyName, false);
});

test("poruka o rezimu ne nosi nijednu tajnu", () => {
  for (const env of [
    { NODE_ENV: "production" },
    { PORTAL_MFA_MODE: "enroll", PORTAL_MFA_MASTER_KEY_V1: "tajna-vrednost" },
  ]) {
    const message = describeMfaMode(resolveMfaMode(env)).message;
    assert.ok(!/tajna-vrednost/.test(message));
    assert.ok(!/KEY_V\d|SECRET|TOKEN/i.test(message), message);
  }
});

test("okruzenje se odredjuje po VERCEL_ENV pre NODE_ENV", () => {
  // `next start` postavlja NODE_ENV=production i na preview grani i lokalno.
  assert.equal(
    resolveRuntimeEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    "development",
  );
  assert.equal(
    resolveRuntimeEnvironment({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    "production",
  );
  assert.equal(resolveRuntimeEnvironment({ NODE_ENV: "production" }), "production");
  assert.equal(resolveRuntimeEnvironment({ NODE_ENV: "test" }), "test");
  assert.equal(resolveRuntimeEnvironment({}), "development");
});

test("enroll i enforced bez kljuca odbijaju konfiguraciju", () => {
  assert.equal(validateMfaConfiguration({ mode: "off", mfaConfigured: false }).ok, true);
  for (const mode of ["enroll", "enforced"]) {
    const bad = validateMfaConfiguration({ mode, mfaConfigured: false });
    assert.equal(bad.ok, false, mode);
    assert.match(bad.reason, /PORTAL_MFA_MASTER_KEY/);
  }
  assert.equal(validateMfaConfiguration({ mode: "enforced", mfaConfigured: true }).ok, true);
});

/* =========================================================================
 * Osetljive radnje
 * ====================================================================== */

test("enrollment-only sesija nema nijednu poslovnu sposobnost", () => {
  const d = decide({ mode: "enroll" });
  assert.equal(d.access, ACCESS_ENROLLMENT_ONLY);
  for (const capability of [
    "view:home",
    "view:kupci",
    "view:prodaja",
    "view:dozvole",
    "users:manage",
    "users:manage_security",
    "settings:manage",
    "export:data",
  ]) {
    assert.equal(
      isBlockedBySensitivity(capability, d),
      true,
      `enrollment-only propusta ${capability}`,
    );
  }
});

test("pun pristup samom lozinkom ne otvara osetljive radnje", () => {
  const d = decide({ mode: "off", environment: "development" });
  assert.equal(d.access, ACCESS_FULL);
  assert.equal(d.assurance, "password");
  for (const capability of MFA_SENSITIVE_CAPABILITIES) {
    assert.equal(isBlockedBySensitivity(capability, d), true, capability);
  }
  // Obican pregled prolazi.
  assert.equal(isBlockedBySensitivity("view:kupci", d), false);
});

test("potvrdjen faktor otvara i osetljive radnje", () => {
  const d = decide({ mfaState: "active", factor: "totp" });
  for (const capability of MFA_SENSITIVE_CAPABILITIES) {
    assert.equal(isBlockedBySensitivity(capability, d), false, capability);
  }
});

test("uza sposobnost za bezbednost naloga je na spisku osetljivih", () => {
  assert.ok(MFA_SENSITIVE_CAPABILITIES.includes("users:manage_security"));
});

/* =========================================================================
 * Jedan vlasnik odluke — ugovor nad izvorom
 *
 * Ovo NISU behavior testovi politike; oni tvrde da niko drugi ne odlucuje.
 * ====================================================================== */

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("stari modul sa suprotnom odlukom vise ne postoji", async () => {
  await assert.rejects(() => read("./mfa-enforcement.mjs"));
});

test("prijava i ucitavanje sesije zovu istu funkciju", async () => {
  const auth = codeOf(await read("../../auth.ts"));
  const session = codeOf(await read("../authz/session.ts"));
  for (const [name, source] of [["auth.ts", auth], ["session.ts", session]]) {
    assert.match(source, /resolvePortalAccess\(\{/, `${name} ne zove politiku`);
    assert.match(source, /resolveMfaMode\(process\.env\)/, `${name} sam parsira rezim`);
  }
});

test("nijedan potrosac ne racuna pristup sam", async () => {
  const auth = codeOf(await read("../../auth.ts"));
  const session = codeOf(await read("../authz/session.ts"));
  for (const [name, source] of [["auth.ts", auth], ["session.ts", session]]) {
    // Poredjenje rezima van politike je znak da je odluka procurela nazad.
    assert.ok(
      !/mode === "enroll"|mode === "off"/.test(source),
      `${name} sam tumaci rezim`,
    );
  }
  // `enforced` sme da se pomene samo tamo gde se odlucuje da li citati dozvolu.
  const grantChecks = [...auth.matchAll(/mode === "enforced"/g)];
  assert.equal(grantChecks.length, 1, "auth.ts poredi rezim vise puta");
});

test("promenljiva se cita samo kroz politiku", async () => {
  for (const path of ["../../auth.ts", "../authz/session.ts", "../../app/portal/layout.tsx"]) {
    const source = codeOf(await read(path));
    assert.ok(
      !/PORTAL_MFA_(MODE|ENFORCEMENT)/.test(source),
      `${path} cita promenljivu mimo politike`,
    );
  }
});

test("istekla i potrosena dozvola ne racunaju se kao dostupne", async () => {
  /*
   * Politika prima `grantAvailable` kao boolean. Da upit koji ga racuna ne
   * filtrira po isteku i upotrebi, potrosena dozvola bi zauvek drzala
   * `enforced` otvorenim — a to se iz same politike ne vidi.
   */
  const grant = codeOf(await read("./enrollment-grant.ts"));
  const fn = grant.slice(grant.indexOf("export async function hasOpenEnrollmentGrant"));
  assert.match(fn, /isNull\(mfaEnrollmentGrants\.usedAt\)/);
  assert.match(fn, /isNull\(mfaEnrollmentGrants\.supersededAt\)/);
  /*
   * Rok se poredi kroz tipizovan operator, ne kroz sirov `sql` sablon.
   *
   * Sablon salje `Date` do drajvera bez tipa kolone, sto nad pravim
   * PostgreSQL-om puca sa `ERR_INVALID_ARG_TYPE`. `gt` prolazi kroz maper
   * kolone i salje ispravan `timestamptz`.
   */
  assert.match(fn, /gt\(mfaEnrollmentGrants\.expiresAt, now\)/);
  assert.match(fn, /eq\(mfaEnrollmentGrants\.userId, userId\)/);
});

test("dozvola se cita samo kada od nje zavisi odluka", async () => {
  const auth = codeOf(await read("../../auth.ts"));
  const session = codeOf(await read("../authz/session.ts"));
  for (const [name, source] of [["auth.ts", auth], ["session.ts", session]]) {
    // Bezuslovno citanje bi bio dodatan upit na svaki zahtev, bez potrebe.
    assert.match(
      source,
      /mode === "enforced"[\s\S]{0,120}hasOpenEnrollmentGrant/,
      `${name} cita dozvolu bezuslovno`,
    );
  }
});
