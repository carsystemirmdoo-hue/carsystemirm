import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ESCALATION_PACKAGES,
  OWNER_ROLE,
  packageChangeNeedsFreshMfa,
  packageChangeRefusal,
  roleChangeRefusal,
  securityTargetRefusal,
} from "./owner-guard-policy.mjs";
import { PACKAGE_KEYS, resolveCapabilities } from "./permissions.mjs";

/**
 * Eskalacija ka ulozi Vlasnika i preuzimanje njegovog naloga.
 *
 * Regresija (audit 2026-10-01):
 * 1. Nosilac paketa „Korisnici“ (`users:manage`) mogao je sebi da dodeli
 *    „Bezbednost naloga“, pa sebe prebaci u ulogu Vlasnika (`changeRoleAction`
 *    nije pozivao `canGrantOwnerRole` niti zabranjivao sopstvenu ulogu).
 * 2. Nosilac „Bezbednosti naloga“ mogao je da resetuje lozinku, MFA i dozvolu
 *    za vezivanje NALOGA VLASNIKA i tako ga preuzme.
 */

const owner = { id: "o1", role: OWNER_ROLE, permissions: [] };
const owner2 = { id: "o2", role: OWNER_ROLE, permissions: [] };
const office = { id: "k1", role: "kancelarija", permissions: [] };
const rep = { id: "r1", role: "komercijalista", permissions: [] };

test("lanac napada iz audita je zatvoren u svakom koraku", () => {
  // Korak 0: Vlasnik je nekome poverio „Korisnici“ (dozvoljeno).
  const delegate = { id: "d1", role: "kancelarija", permissions: ["korisnici"] };
  assert.ok(resolveCapabilities(delegate.role, delegate.permissions).has("users:manage"));

  // Korak 1: delegat sebi dodeljuje „Bezbednost naloga“.
  assert.ok(packageChangeRefusal(delegate, delegate, "bezbednost_naloga", true));
  // … ili je dodeljuje saučesniku.
  assert.ok(packageChangeRefusal(delegate, rep, "bezbednost_naloga", true));

  // Korak 2: čak i da ga ima, sebe ne prebacuje u Vlasnika.
  const withSecurity = { ...delegate, permissions: ["korisnici", "bezbednost_naloga"] };
  assert.ok(roleChangeRefusal(withSecurity, withSecurity, OWNER_ROLE));
  // … niti saučesnika.
  assert.ok(roleChangeRefusal(withSecurity, rep, OWNER_ROLE));

  // Korak 3: niti preuzima nalog postojećeg Vlasnika.
  assert.ok(securityTargetRefusal(withSecurity, owner));
});

test("sopstvena uloga se ne menja — ni Vlasniku", () => {
  assert.ok(roleChangeRefusal(owner, owner, "komercijalista"));
  assert.ok(roleChangeRefusal(office, office, OWNER_ROLE));
});

test("ulogu Vlasnika dodeljuje i oduzima samo Vlasnik", () => {
  assert.equal(roleChangeRefusal(owner, office, OWNER_ROLE), null);
  assert.equal(roleChangeRefusal(owner, owner2, "kancelarija"), null);
  assert.ok(roleChangeRefusal(office, owner, "kancelarija"), "ne-vlasnik spušta Vlasnika");
  assert.ok(roleChangeRefusal(office, rep, OWNER_ROLE));
});

test("obična promena uloge ostaje moguća delegatu", () => {
  const securityAdmin = { id: "s1", role: "kancelarija", permissions: ["bezbednost_naloga"] };
  assert.equal(roleChangeRefusal(securityAdmin, rep, "kancelarija"), null);
});

test("pakete za upravljanje nalozima menja samo Vlasnik, uz svež kod", () => {
  assert.deepEqual([...ESCALATION_PACKAGES].sort(), ["bezbednost_naloga", "korisnici"]);
  const delegate = { id: "d1", role: "kancelarija", permissions: ["korisnici"] };
  for (const pkg of ESCALATION_PACKAGES) {
    assert.ok(packageChangeNeedsFreshMfa(pkg));
    assert.equal(packageChangeRefusal(owner, office, pkg, true), null);
    assert.equal(packageChangeRefusal(owner, office, pkg, false), null);
    assert.ok(packageChangeRefusal(delegate, rep, pkg, true));
    assert.ok(packageChangeRefusal(delegate, rep, pkg, false), "ni oduzimanje");
  }
  assert.equal(packageChangeNeedsFreshMfa("analitika"), false);
});

test("niko ne dodeljuje paket sam sebi — ni Vlasnik", () => {
  for (const pkg of PACKAGE_KEYS) {
    assert.ok(packageChangeRefusal(owner, owner, pkg, true), pkg);
  }
  // Oduzimanje sebi ostaje moguće (zaštitu od zaključavanja čuva akcija).
  assert.equal(packageChangeRefusal(owner, owner, "analitika", false), null);
});

test("delegat ne daje pristup koji sam nema", () => {
  const delegate = { id: "d1", role: "kancelarija", permissions: ["korisnici"] };
  const own = resolveCapabilities(delegate.role, delegate.permissions);
  for (const pkg of PACKAGE_KEYS) {
    if (ESCALATION_PACKAGES.includes(pkg)) continue;
    const refusal = packageChangeRefusal(delegate, rep, pkg, true);
    const withPkg = resolveCapabilities(delegate.role, [...delegate.permissions, pkg]);
    const widens = [...withPkg].some((c) => !own.has(c));
    assert.equal(refusal !== null, widens, `${pkg}: odbijanje mora pratiti proširenje pristupa`);
  }
  // Vlasnik ima sve i sme da dodeli svaki paket drugome.
  for (const pkg of PACKAGE_KEYS) assert.equal(packageChangeRefusal(owner, rep, pkg, true), null, pkg);
});

test("bezbednosne radnje nad Vlasnikom izvodi samo Vlasnik", () => {
  const securityAdmin = { role: "kancelarija", permissions: ["bezbednost_naloga"] };
  assert.ok(securityTargetRefusal(securityAdmin, owner));
  assert.equal(securityTargetRefusal(owner2, owner), null);
  assert.equal(securityTargetRefusal(securityAdmin, rep), null);
});

/* ---------------------------------------------------------------------------
 * Strukturno: pravila su zaista pozvana, i to pre provere koda iz aplikacije.
 * ------------------------------------------------------------------------- */

const root = new URL("../../", import.meta.url);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const read = (rel) => strip(readFileSync(new URL(rel, root), "utf8"));
function body(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start !== -1, `nema ${name}`);
  const next = source.indexOf("export async function", start + 10);
  return source.slice(start, next === -1 ? undefined : next);
}

test("changeRoleAction: pravilo eskalacije pre TOTP provere i pre upisa", () => {
  const fn = body(read("app/portal/dozvole/actions.ts"), "changeRoleAction");
  const rule = fn.indexOf("roleChangeRefusal(sessionActor, target[0], role)");
  const totp = fn.indexOf("requireSecurityAdmin(");
  const write = fn.indexOf(".update(users)");
  assert.ok(rule > 0 && totp > rule && write > totp, "redosled: pravilo → TOTP → upis");
  assert.match(fn, /requireCapability\("users:manage_security"/);
});

test("togglePermissionAction: pravilo pre upisa, svež kod za eskalacione pakete", () => {
  const fn = body(read("app/portal/dozvole/actions.ts"), "togglePermissionAction");
  const rule = fn.indexOf("packageChangeRefusal(actor, target[0], permissionKey, grant)");
  const mfa = fn.indexOf("packageChangeNeedsFreshMfa(permissionKey)");
  const totp = fn.indexOf("requireSecurityAdmin(token)");
  const write = fn.indexOf("db.transaction(");
  assert.ok(rule > 0 && mfa > rule && totp > mfa && write > totp);
});

test("svaka bezbednosna radnja učitava cilj sa ulogom pozivaoca", () => {
  const loader = read("lib/authz/security-admin.ts");
  assert.match(loader, /actorRole: string/);
  assert.match(loader, /securityTargetRefusal\(\{ role: options\.actorRole \}, target\)/);
  const actions = read("app/portal/bezbednost/nalozi/actions.ts");
  const calls = actions.match(/loadSecurityTarget\([^)]*\)/g) ?? [];
  assert.equal(calls.length, 4);
  for (const call of calls) assert.match(call, /actorRole: actor\.role/);
});
