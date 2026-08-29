import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  canCustomerSignIn,
  customerIdScopeFor,
  isCustomerSubject,
  isInternalSubject,
  SUBJECT_CUSTOMER,
  SUBJECT_INTERNAL,
} from "./customer-scope.mjs";
import { seesAllCustomers } from "./permissions.mjs";
import { canAccessCustomer } from "./scope.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/* -------------------------------------------------------------------------
 * Kupac A ne može biti kupac B — struktura, ne funkcija
 * ---------------------------------------------------------------------- */

test("kupceva strana ne prima nijedan prop iz zahteva", async () => {
  /*
   * Ovo je zamenilo `resolveCustomerScope`/`assertCustomerScope`.
   *
   * Te funkcije su opisivale pravilo „tudji ID iz adrese se odbija" za rutu
   * koja ne postoji, pa su bile bezbednosne kontrole koje se nigde ne
   * izvrsavaju (postflight audit, F-9). Pravilo i dalje vazi, ali ga garantuje
   * POTPIS strane: `CustomerHomePage()` nema parametara, pa tudji ID nema kuda
   * da udje.
   */
  const source = await readFile(join(ROOT, "app/kupac/page.tsx"), "utf8");
  assert.match(
    source,
    /export default async function CustomerHomePage\(\)/,
    "kupceva strana je dobila parametre — IDOR kapija je sada obavezna",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of ["searchParams", "params"]) {
    assert.ok(!code.includes(forbidden), `strana cita ${forbidden}`);
  }
});

/* -------------------------------------------------------------------------
 * Kupčev token ne prolazi kroz internu kapiju i obrnuto
 * ---------------------------------------------------------------------- */

test("kupcem se smatra samo IZRICIT subject", () => {
  assert.equal(isCustomerSubject({ subject: SUBJECT_CUSTOMER }), true);
  assert.equal(isCustomerSubject({ subject: SUBJECT_INTERNAL }), false);
  // Odsustvo claim-a nije kupac — inace bi svaki stari token postao kupcev.
  assert.equal(isCustomerSubject({}), false);
  assert.equal(isCustomerSubject(null), false);
  assert.equal(isCustomerSubject({ subject: "" }), false);
});

test("interni token sme bez claim-a, ali kupcev nikad ne prolazi", () => {
  assert.equal(isInternalSubject({}), true, "stari tokeni moraju nastaviti da vaze");
  assert.equal(isInternalSubject({ subject: SUBJECT_INTERNAL }), true);
  assert.equal(isInternalSubject({ subject: SUBJECT_CUSTOMER }), false);
});

/* -------------------------------------------------------------------------
 * Stanje naloga
 * ---------------------------------------------------------------------- */

test("samo odobren i aktivan nalog sme da se prijavi", () => {
  assert.equal(canCustomerSignIn("approved"), true);
  assert.equal(canCustomerSignIn("active"), true);
  for (const status of ["requested", "suspended", "rejected", "", "unknown"]) {
    assert.equal(canCustomerSignIn(status), false, status);
  }
});

/* -------------------------------------------------------------------------
 * Opseg komercijaliste
 * ---------------------------------------------------------------------- */

const asUser = (role, permissions = []) => ({ role, permissions });

test("komercijalista vidi samo dodeljene kupce", () => {
  const rep = asUser("komercijalista");
  const scope = customerIdScopeFor(rep, ["k1", "k2"], seesAllCustomers);
  assert.deepEqual(scope, ["k1", "k2"]);
  assert.equal(canAccessCustomer(rep, ["k1", "k2"], "k1"), true);
  assert.equal(canAccessCustomer(rep, ["k1", "k2"], "k3"), false);
});

test("prazan opseg daje prazan rezultat, nikad sve kupce", () => {
  const rep = asUser("komercijalista");
  const scope = customerIdScopeFor(rep, [], seesAllCustomers);
  // Prazna lista, a NE `null`. `null` bi upit ostavio bez uslova.
  assert.deepEqual(scope, []);
  assert.notEqual(scope, null);
  assert.equal(canAccessCustomer(rep, [], "bilo-koji"), false);
});

test("gazda vidi sve samo kroz capability, ne kroz ulogu u upitu", () => {
  const owner = asUser("gazda");
  assert.equal(seesAllCustomers(owner), true);
  assert.equal(customerIdScopeFor(owner, [], seesAllCustomers), null);

  // Isti rezultat dobija i komercijalista kome je dodeljen paket „analitika",
  // jer taj paket nosi `customers:view_all`. Provera je nad sposobnošću.
  const analyst = asUser("komercijalista", ["analitika"]);
  assert.equal(customerIdScopeFor(analyst, [], seesAllCustomers), null);
});

test("magacioner nema opseg kupaca", () => {
  const warehouse = asUser("magacioner");
  assert.deepEqual(customerIdScopeFor(warehouse, [], seesAllCustomers), []);
  assert.equal(canAccessCustomer(warehouse, [], "k1"), false);
});

/* -------------------------------------------------------------------------
 * Struktura je garancija, ne konvencija
 * ---------------------------------------------------------------------- */

async function collectSources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectSources(full)));
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

test("kupceva putanja nigde ne cita customerId iz zahteva", async () => {
  /*
   * Ovo je jedina provera koja hvata grešku koja se ne vidi u testu ponašanja:
   * handler koji „radi ispravno" zato što ga niko nije pozvao sa tuđim ID-om.
   *
   * Traži se doslovno čitanje `customerId` iz `searchParams`, `params` ili tela
   * zahteva unutar kupčevog sloja.
   */
  const roots = [join(ROOT, "app", "kupac"), join(ROOT, "lib", "customers")];
  const forbidden = [
    /searchParams[^\n]*customerId/i,
    /params[^\n]*customerId/i,
    /formData\.get\(\s*["']customerId["']\s*\)/i,
    /req(uest)?\.(body|query)[^\n]*customerId/i,
  ];

  for (const root of roots) {
    for (const file of await collectSources(root)) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      for (const pattern of forbidden) {
        assert.ok(
          !pattern.test(code),
          `${relative(ROOT, file)} cita customerId iz zahteva (${pattern})`,
        );
      }
    }
  }
});

test("kupcev upit uvek prima customerId kao prvi argument i brani prazan", async () => {
  const source = await readFile(
    new URL("../customers/customer-queries.ts", import.meta.url),
    "utf8",
  );
  // Svaka izvezena funkcija mora prvo da odbije prazan `customerId`.
  const exported = [...source.matchAll(/export async function (\w+)\(/g)].map(
    (match) => match[1],
  );
  assert.ok(exported.length > 0, "modul nema nijednu izvezenu funkciju");

  const guards = source.match(/if \(!customerId\)/g) ?? [];
  assert.equal(
    guards.length,
    exported.length,
    "svaka kupceva funkcija mora odbiti prazan customerId",
  );
});

test("kupac nije dodat u interni enum uloga", async () => {
  const schema = await readFile(new URL("../../db/schema/users.ts", import.meta.url), "utf8");
  const enumBlock = schema.slice(
    schema.indexOf("pgEnum(\"user_role\""),
    schema.indexOf("export type UserRole"),
  );
  for (const forbidden of ["kupac", "customer", "klijent"]) {
    assert.ok(
      !enumBlock.includes(forbidden),
      `users.role sadrzi ${forbidden} — AD-2 izricito zabranjuje petu ulogu`,
    );
  }
  assert.ok(enumBlock.includes("gazda"));
  assert.ok(enumBlock.includes("magacioner"));
});

test("interni requireSessionWithPermissions lanac je nepromenjen", async () => {
  const session = await readFile(new URL("./session.ts", import.meta.url), "utf8");
  // Kupčev sloj ne sme da se uplete u internu kapiju.
  assert.ok(!session.includes("customerUsers"), "interna kapija cita customer_users");
  assert.ok(!session.includes("customer-session"), "interna kapija zavisi od kupceve");
  assert.match(session, /export async function requireCapability/);
  assert.match(session, /export async function requireCustomerAccess/);
});

test("interna kapija STVARNO poziva subject proveru, ne samo sto je testira", async () => {
  /*
   * Postflight audit (F-3): `isInternalSubject` je bio izvezen i unit-testiran
   * kao kapija, a nigde nije pozvan. Ovaj test cita produkcijski izvor.
   */
  const session = await readFile(new URL("./session.ts", import.meta.url), "utf8");
  const code = session.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.match(code, /isInternalSubject\(session\.user\)/);
  assert.match(code, /if \(!isInternalSubject\(session\.user\)\) return null;/);
});

test("uklonjeni mrtvi helperi se vise ne izvoze", async () => {
  const source = await readFile(new URL("./customer-scope.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!code.includes("export function resolveCustomerScope"));

  const gate = await readFile(new URL("./customer-session.ts", import.meta.url), "utf8");
  const gateCode = gate.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!gateCode.includes("export async function assertCustomerScope"));
  assert.ok(!gateCode.includes("export async function requireCustomerApiSession"));
});
