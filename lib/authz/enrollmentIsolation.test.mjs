import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * Izolacija sesije koja sme samo na vezivanje drugog faktora.
 *
 * Sto se ovde tvrdi: nijedna portal ruta i nijedna server akcija ne prihvata
 * enrollment-only sesiju, osim jedne izricito imenovane.
 *
 * Sto se NE tvrdi: da server stvarno vraca 307 na svakoj od tih ruta. To trazi
 * bazu i pravu sesiju — vidi blocker u docs/b2b/11.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (rel) => readFile(path.join(ROOT, rel), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Jedina ruta koja sme da primi ogranicenu sesiju. */
const ENROLLMENT_ROUTE = "app/portal/bezbednost/mfa/page.tsx";

/**
 * Da li strana samo preusmerava, bez ijednog podatka.
 *
 * Takvoj ruti kapija ne treba: ne cita bazu, ne renderuje sadrzaj i zavrsava na
 * ruti koja svoju kapiju ima. Provera je strukturna, ne spisak izuzetaka —
 * spisak bi zastareo cim neko doda logiku u takvu stranu, i to niko ne bi
 * primetio.
 */
function isPureRedirect(source) {
  if (!/\bredirect\(/.test(source)) return false;
  // Bilo kakav dodir sa podacima ili klijentom znaci da strana nije samo skretnica.
  return !/getDb|fetch\(|"use client"|loadPortalUser|db\.|drizzle/.test(source);
}

/** Kapije koje garantuju PUN pristup (enrollment-only kroz njih ne prolazi). */
const FULL_ACCESS_GATES = [
  "requireUser",
  "requireFullPortalUser",
  "requireCapability",
  "requireRecentMfa",
  "requireSecurityAdmin",
  "requireApiCapability",
  "requireCustomerAccess",
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(rel)));
    else out.push(rel);
  }
  return out;
}

const portalFiles = await walk("app/portal");
const pages = portalFiles.filter((f) => f.endsWith("page.tsx"));

/* =========================================================================
 * Rute
 * ====================================================================== */

test("svaka portal strana prolazi kroz kapiju za pun pristup", async () => {
  const bez = [];
  for (const rel of pages) {
    if (rel === ENROLLMENT_ROUTE) continue;
    const source = codeOf(await read(rel));
    const ima = FULL_ACCESS_GATES.some((gate) =>
      new RegExp(`\\b${gate}\\(`).test(source),
    );
    if (!ima && !isPureRedirect(source)) bez.push(rel);
  }
  assert.deepEqual(bez, [], `strane bez kapije: ${bez.join(", ")}`);
});

test("samo jedna strana prima enrollment-only sesiju", async () => {
  const primaju = [];
  for (const rel of pages) {
    const source = codeOf(await read(rel));
    if (/requireEnrollmentUser\(/.test(source)) primaju.push(rel);
  }
  assert.deepEqual(primaju, [ENROLLMENT_ROUTE]);
});

test("izricito imenovane rute traze pun pristup", async () => {
  /*
   * Ocekivane kapije po strani.
   *
   * `app/portal/korpa/page.tsx` je namerno OPCIONA: korpa dolazi iz zasebnog
   * toka i ne postoji u svakoj grani. Njena politika se proverava zasebno,
   * ispod, i to iz kanonskog izvora — ne iz postojanja fajla. Tvrdnja se time
   * ne slabi: dok strana postoji, proverava se isto kao i ostale.
   */
  const ocekivano = {
    "app/portal/page.tsx": /requireUser\(/,
    "app/portal/dozvole/page.tsx": /requireCapability\(/,
    "app/portal/bezbednost/lozinka/page.tsx": /requireFullPortalUser\(/,
    "app/portal/bezbednost/nalozi/page.tsx": /requireCapability\(/,
  };
  const opcione = {
    "app/portal/korpa/page.tsx": /requireUser\(/,
  };

  for (const [rel, pattern] of Object.entries(ocekivano)) {
    const source = codeOf(await read(rel));
    assert.match(source, pattern, rel);
    assert.ok(
      !/requireEnrollmentUser\(/.test(source),
      `${rel} prima ogranicenu sesiju`,
    );
  }

  for (const [rel, pattern] of Object.entries(opcione)) {
    let source;
    try {
      source = codeOf(await read(rel));
    } catch {
      continue; // strana ne postoji u ovoj grani
    }
    assert.match(source, pattern, rel);
    assert.ok(!/requireEnrollmentUser\(/.test(source), `${rel} prima ogranicenu sesiju`);
  }
});

test("kanonska politika: samo ruta za vezivanje prima ogranicenu sesiju", async () => {
  /*
   * Ovo je tvrdnja koja NE zavisi od toga koje strane postoje.
   *
   * Garancija za bilo koju portal rutu — ukljucujuci `/portal/korpa`, koja u
   * ovoj grani jos ne postoji — pociva na tri stvari:
   *
   *   1. `MFA_ENROLLMENT_ROUTE` je jedina ruta koja sme primiti ogranicenu
   *      sesiju, i tacno jedna strana zove `requireEnrollmentUser`;
   *   2. `requireUser` je isti put kao `requireFullPortalUser`, pa svaka strana
   *      koja ga zove odbija ogranicenu sesiju;
   *   3. layout za takvu sesiju uopste ne montira poslovni sloj.
   *
   * Dok to vazi, nova strana pod `/portal` ne moze slucajno postati dostupna
   * ogranicenoj sesiji — bez obzira na to kada bude dodata.
   */
  const zasticene = [
    "/portal",
    "/portal/korpa",
    "/portal/dozvole",
    "/portal/bezbednost/lozinka",
    "/portal/bezbednost/nalozi",
  ];
  const enrollmentRuta = "/" + ENROLLMENT_ROUTE.replace(/^app\/|\/page\.tsx$/g, "");
  for (const ruta of zasticene) {
    assert.notEqual(ruta, enrollmentRuta, `${ruta} je proglasena rutom za vezivanje`);
  }

  const session = codeOf(await read("lib/authz/session.ts"));
  assert.match(session, /export const MFA_ENROLLMENT_ROUTE = "\/portal\/bezbednost\/mfa"/);
  assert.match(session, /return requireFullPortalUser\(callbackPath\)/);

  const layout = codeOf(await read("app/portal/layout.tsx"));
  assert.match(layout, /if \(session\.enrollmentOnly\)/);
});

test("requireUser i requireFullPortalUser su isti put", async () => {
  const session = codeOf(await read("lib/authz/session.ts"));
  const requireUser = session.slice(
    session.indexOf("export async function requireUser"),
    session.indexOf("export async function requireCapability"),
  );
  // Bez ovoga bi dve kapije mogle da se raziđu, a `requireUser` je ona koju
  // koristi vecina strana.
  assert.match(requireUser, /return requireFullPortalUser\(callbackPath\)/);
});

test("enrollment-only ide na vezivanje, ne u petlju kroz prijavu", async () => {
  const session = codeOf(await read("lib/authz/session.ts"));
  const block = session.slice(
    session.indexOf("export async function requireFullPortalUser"),
    session.indexOf("export async function requireRecentMfa"),
  );
  assert.match(block, /if \(session\?\.enrollmentOnly\) redirect\(MFA_ENROLLMENT_ROUTE\)/);
  // Prijava takodje mora da ga posalje dalje, inace se vrti u krug.
  const login = codeOf(await read("app/prijava/page.tsx"));
  assert.match(login, /session\?\.enrollmentOnly.*redirect\(MFA_ENROLLMENT_ROUTE\)/s);
});

/* =========================================================================
 * Layout
 * ====================================================================== */

test("portal layout prima ogranicenu sesiju, ali bez poslovnih komponenti", async () => {
  const layout = codeOf(await read("app/portal/layout.tsx"));
  // Ekran za vezivanje zivi pod /portal; layout koji trazi pun pristup bi
  // korisnika zakljucao napolju.
  assert.match(layout, /if \(session\.enrollmentOnly\)/);

  const frame = layout.slice(
    layout.indexOf("if (session.enrollmentOnly)"),
    layout.indexOf("const user = session.fullAccess"),
  );
  for (const zabranjeno of ["PortalShell", "CartProvider", "CartDrawer", "navGroupsFor"]) {
    assert.ok(!frame.includes(zabranjeno), `okvir montira ${zabranjeno}`);
  }
});

/* =========================================================================
 * Server akcije
 * ====================================================================== */

const actionFiles = portalFiles.filter(
  (f) => f.endsWith("actions.ts") && !f.endsWith("types.ts"),
);

test("svaka server akcija ima kapiju u svom telu", async () => {
  const bez = [];
  for (const rel of actionFiles) {
    const source = codeOf(await read(rel));
    if (!source.includes('"use server"')) continue;

    const names = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    for (const name of names) {
      const start = source.indexOf(`export async function ${name}`);
      const next = source.indexOf("export async function", start + 10);
      const body = source.slice(start, next === -1 ? undefined : next);

      const ima =
        FULL_ACCESS_GATES.some((gate) => new RegExp(`\\b${gate}\\(`).test(body)) ||
        /requireEnrollmentUser\(/.test(body);
      if (!ima) bez.push(`${rel}:${name}`);
    }
  }
  // `signOutAction` i `readEnrollmentContext` nisu mutacije nad tudjim stanjem.
  const dozvoljeno = new Set([
    "app/portal/actions.ts:signOutAction",
    "app/portal/actions.ts:signInAction",
    "app/portal/bezbednost/mfa/actions.ts:readEnrollmentContext",
  ]);
  const stvarno = bez.filter((entry) => !dozvoljeno.has(entry));
  assert.deepEqual(stvarno, [], `akcije bez kapije: ${stvarno.join(", ")}`);
});

test("samo enrollment akcije primaju ogranicenu sesiju", async () => {
  const primaju = [];
  for (const rel of actionFiles) {
    const source = codeOf(await read(rel));
    if (/requireEnrollmentUser\(/.test(source)) primaju.push(rel);
  }
  assert.deepEqual(primaju, ["app/portal/bezbednost/mfa/actions.ts"]);
});

test("nove bezbednosne akcije traze punu sesiju i svez kod", async () => {
  const nalozi = codeOf(await read("app/portal/bezbednost/nalozi/actions.ts"));
  const names = [...nalozi.matchAll(/export async function (\w+Action)/g)].map((m) => m[1]);
  assert.ok(names.length >= 4);
  for (const name of names) {
    const start = nalozi.indexOf(`export async function ${name}`);
    const next = nalozi.indexOf("export async function", start + 10);
    const body = nalozi.slice(start, next === -1 ? undefined : next);
    assert.match(body, /requireSecurityAdmin\(/, name);
  }

  const lozinka = codeOf(await read("app/portal/bezbednost/lozinka/actions.ts"));
  assert.match(lozinka, /requireFullPortalUser\(\)/);
  assert.match(lozinka, /verifyTotpForUser\(/);
});

test("promena uloge ide kroz istu kapiju kao reset lozinke", async () => {
  const source = codeOf(await read("app/portal/dozvole/actions.ts"));
  const start = source.indexOf("export async function changeRoleAction");
  const body = source.slice(start);
  assert.match(body, /requireSecurityAdmin\(parsed\.data\.token\)/);
  assert.match(body, /withOwnerGuard\(/);
  // Kapija se uzima PRE ijedne izmene.
  assert.ok(
    body.indexOf("requireSecurityAdmin") < body.indexOf("withOwnerGuard"),
    "izmena pocinje pre provere",
  );
});

/* =========================================================================
 * Sposobnost za bezbednost naloga
 * ====================================================================== */

test("bezbednosna kapija koristi uzu sposobnost od obicne administracije", async () => {
  const gate = codeOf(await read("lib/authz/security-admin.ts"));
  assert.match(gate, /SECURITY_ADMIN_CAPABILITY = "users:manage_security"/);
  const page = codeOf(await read("app/portal/bezbednost/nalozi/page.tsx"));
  assert.match(page, /SECURITY_ADMIN_CAPABILITY/);
});

test("paket korisnici vise ne nosi preuzimanje tudjeg pristupa", async () => {
  const { resolveCapabilities } = await import("./permissions.mjs");
  const sa = resolveCapabilities("magacioner", ["korisnici"]);
  assert.equal(sa.has("users:manage"), true, "paket je izgubio osnovnu svrhu");
  assert.equal(
    sa.has("users:manage_security"),
    false,
    "paket i dalje daje preuzimanje tudjeg pristupa",
  );

  const security = resolveCapabilities("magacioner", ["bezbednost_naloga"]);
  assert.equal(security.has("users:manage_security"), true);
});

test("nov paket postoji i u bazi, inace se ne moze dodeliti", async () => {
  // `user_permissions.permission_key` ima strani kljuc ka `permission_packages`.
  const migration = await read("db/migrations/0006_account_security_package.sql");
  assert.match(migration, /INSERT INTO "permission_packages"/);
  assert.match(migration, /'bezbednost_naloga'/);
  const journal = JSON.parse(await read("db/migrations/meta/_journal.json"));
  assert.ok(
    journal.entries.some((e) => e.tag === "0006_account_security_package"),
    "migracija nije upisana u journal, pa se nikad nece primeniti",
  );
});

test("strane bez kapije su iskljucivo skretnice bez podataka", async () => {
  const skretnice = [];
  for (const rel of pages) {
    if (rel === ENROLLMENT_ROUTE) continue;
    const source = codeOf(await read(rel));
    const ima = FULL_ACCESS_GATES.some((gate) =>
      new RegExp(`\\b${gate}\\(`).test(source),
    );
    if (ima) continue;

    skretnice.push(rel);
    /*
     * Nijedan JSX, nijedan upit — samo preusmeravanje.
     *
     * Trazi se zatvarajuci ili samozatvarajuci tag, ne `<Velicina`: generik
     * tipa `Promise<Record<...>>` nije JSX, a naivna provera bi ga tako
     * protumacila i prijavila lazan nalaz.
     */
    const imaJsx = /<\/[A-Za-z]/.test(source) || /<[A-Z][\w]*\s*\/>/.test(source);
    assert.ok(!imaJsx, `${rel} renderuje komponentu bez kapije`);
    assert.ok(!/getDb|drizzle|fetch\(/.test(source), `${rel} cita podatke bez kapije`);
    assert.match(source, /redirect\(/, rel);
  }
  // Ako spisak poraste, neko je dodao nezasticenu stranu.
  assert.ok(skretnice.length <= 11, `previse strana bez kapije: ${skretnice.join(", ")}`);
});
