import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ownerGuardAllows,
  removesActiveOwner,
} from "./owner-guard-policy.mjs";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/* =========================================================================
 * Pravilo: kada izmena uklanja aktivnog vlasnika
 *
 * Ovo su stvarni pozivi funkcije, ne citanje izvora.
 * ====================================================================== */

const OWNER = { role: "gazda", active: true };

test("iskljucivanje aktivnog vlasnika ga uklanja", () => {
  assert.equal(removesActiveOwner(OWNER, { nextActive: false }), true);
});

test("prebacivanje vlasnika u drugu ulogu ga uklanja", () => {
  // Podmukliji put od iskljucivanja: nalog i dalje radi, ali niko vise ne moze
  // da upravlja korisnicima.
  assert.equal(removesActiveOwner(OWNER, { nextRole: "komercijalista" }), true);
});

test("promena uloge I iskljucivanje zajedno ga uklanjaju", () => {
  assert.equal(
    removesActiveOwner(OWNER, { nextRole: "kancelarija", nextActive: false }),
    true,
  );
});

test("vlasnik koji ostaje aktivan vlasnik nije uklonjen", () => {
  assert.equal(removesActiveOwner(OWNER, { nextRole: "gazda" }), false);
  assert.equal(removesActiveOwner(OWNER, { nextActive: true }), false);
  assert.equal(removesActiveOwner(OWNER, {}), false);
});

test("nalog koji nije aktivan vlasnik ne moze biti uklonjen iz tog skupa", () => {
  // Vec iskljucen vlasnik se ne broji, pa njegova izmena ne ugrozava nikoga.
  assert.equal(
    removesActiveOwner({ role: "gazda", active: false }, { nextRole: "magacioner" }),
    false,
  );
  assert.equal(
    removesActiveOwner({ role: "komercijalista", active: true }, { nextActive: false }),
    false,
  );
});

test("reaktivacija nikada ne uklanja vlasnika", () => {
  assert.equal(
    removesActiveOwner({ role: "gazda", active: false }, { nextActive: true }),
    false,
  );
});

/* =========================================================================
 * Pravilo: koliko vlasnika mora ostati
 * ====================================================================== */

test("nula preostalih vlasnika se odbija", () => {
  assert.equal(ownerGuardAllows(0), false);
});

test("jedan preostali vlasnik je dovoljan", () => {
  assert.equal(ownerGuardAllows(1), true);
  assert.equal(ownerGuardAllows(7), true);
});

test("neispravan rezultat upita se tumaci kao odbijanje", () => {
  // Ako upit vrati nesto neocekivano, sme se pogresiti samo na stranu opreza.
  for (const value of [undefined, null, NaN, -1, "2", 1.5]) {
    assert.equal(ownerGuardAllows(value), false, `propusteno: ${String(value)}`);
  }
});

/* =========================================================================
 * Transakciona zastita — ugovor nad izvorom
 *
 * Sto se ovde NE tvrdi: da brava stvarno serijalizuje dva istovremena zahteva.
 * To je svojstvo Postgresa i dokazuje se samo nad pravom bazom, u
 * `db/integration/ownerGuard.integration.test.mjs`.
 * ====================================================================== */

const guard = codeOf(await read("./security-admin.ts"));

test("brava se uzima pre prebrojavanja, ne posle", () => {
  const lock = guard.indexOf("pg_advisory_xact_lock");
  const count = guard.indexOf("count(*)");
  assert.ok(lock > 0, "nema advisory brave");
  assert.ok(count > lock, "prebrojavanje ide pre zakljucavanja");
});

test("brava i izmena su u istoj transakciji", () => {
  assert.match(guard, /getDb\(\)\.transaction\(async \(tx\) => \{[\s\S]*?pg_advisory_xact_lock/);
  // `mutate` prima BAS tu transakciju; zaseban upis bi izasao ispod brave.
  assert.match(guard, /return mutate\(tx\)/);
});

test("cilj se izuzima iz prebrojavanja", () => {
  // Pitanje je koliko vlasnika ostaje POSLE radnje, ne koliko ih ima sada.
  assert.match(guard, /ne\(users\.id, input\.targetId\)/);
});

test("kljuc brave je konstanta, ne izvedena vrednost", () => {
  // Kljuc izveden iz ulaza znacio bi razlicite brave za istu odluku.
  assert.match(guard, /const OWNER_GUARD_LOCK_KEY = [\d_]+;/);
});

/* =========================================================================
 * Svi putevi koji mogu ostaviti sistem bez vlasnika
 * ====================================================================== */

const roleActions = codeOf(await read("../../app/portal/dozvole/actions.ts"));
const securityActions = codeOf(
  await read("../../app/portal/bezbednost/nalozi/actions.ts"),
);

test("promena uloge ide kroz istu bravu", () => {
  const block = roleActions.slice(roleActions.indexOf("export async function changeRoleAction"));
  assert.match(block, /withOwnerGuard\(/);
  assert.match(block, /removesOwner: removesActiveOwner\(target\[0\], \{ nextRole: role \}\)/);
});

test("iskljucivanje naloga ide kroz istu bravu", () => {
  const block = securityActions.slice(
    securityActions.indexOf("export async function setAccountActiveAction"),
    securityActions.indexOf("export async function resetUserMfaAction"),
  );
  assert.match(block, /withOwnerGuard\(/);
  assert.match(block, /removesOwner: removesActiveOwner\(target, \{ nextActive \}\)/);
});

test("nijedan mutation put ne racuna zastitu sam za sebe", () => {
  // Rucno prebrojavanje van `withOwnerGuard` znaci put koji je izasao ispod brave.
  for (const [name, source] of [
    ["dozvole", roleActions],
    ["bezbednost/nalozi", securityActions],
  ]) {
    assert.ok(
      !/count\(\*\)/.test(source),
      `${name} prebrojava vlasnike mimo centralne brave`,
    );
    assert.ok(
      !/role === "gazda"/.test(source),
      `${name} sam tumaci ulogu umesto da koristi kapiju`,
    );
  }
});

/* =========================================================================
 * Transakcione granice — ugovor nad izvorom
 *
 * Prvi prolaz nad pravim PostgreSQL-om vratio je „obe deaktivacije su prosle".
 * Meta je tada bila spojnica (pooler), sto samo po sebi obara garanciju. Pre
 * ponovnog testa, granice se zakljucavaju ovde, da razlog ne moze biti u kodu.
 * ====================================================================== */

test("brava, prebrojavanje i izmena su u ISTOJ transakciji", () => {
  const telo = guard.slice(
    guard.indexOf("export async function withOwnerGuard"),
    guard.indexOf("export { removesActiveOwner }"),
  );
  // Jedna transakcija, otvorena jednom.
  assert.equal((telo.match(/getDb\(\)\.transaction\(/g) ?? []).length, 1);
  // Sve tri radnje idu kroz `tx`, ne kroz globalnu konekciju.
  assert.match(telo, /tx\.execute\(\s*sql`SELECT pg_advisory_xact_lock/);
  assert.match(telo, /await tx\s*\n?\s*\.select\(\{ remaining/);
  assert.match(telo, /return mutate\(tx\)/);
  // Unutar transakcije se ne sme pojaviti nova konekcija.
  const unutra = telo.slice(telo.indexOf("transaction(async (tx)"));
  assert.equal((unutra.match(/getDb\(\)/g) ?? []).length, 0, "unutar brave se otvara nova veza");
});

test("kljuc brave ide kao bigint, bez pogadjanja preklopljenog oblika", () => {
  // `pg_advisory_xact_lock` ima oblike `(bigint)` i `(int, int)`. Bez tipa
  // Postgres bira sam, a pogresan izbor znaci DRUGU bravu.
  assert.match(guard, /pg_advisory_xact_lock\(\$\{OWNER_GUARD_LOCK_KEY\}::bigint\)/);
});

test("guard odbija radnju kada brava nije stvarno drzana", () => {
  const telo = guard.slice(guard.indexOf("export async function withOwnerGuard"));
  // Iza spojnice `pg_advisory_xact_lock` prodje bez greske, ali brava ostane na
  // vezi koja vise ne ucestvuje. Tiho prestajanje je najgori ishod, pa se trazi
  // dokaz iz `pg_locks` za tekucu pozadinsku vezu.
  assert.match(telo, /FROM pg_locks/);
  assert.match(telo, /pid = pg_backend_pid\(\)/);
  assert.match(telo, /granted/);
  const proveraIdx = telo.indexOf("FROM pg_locks");
  const brojanjeIdx = telo.indexOf("count(*)::int");
  assert.ok(proveraIdx > 0);
  // Provera brave dolazi PRE prebrojavanja gazda.
  assert.ok(
    telo.indexOf("held.held < 1") < telo.indexOf("ownerGuardAllows"),
    "prebrojavanje ide pre provere da je brava drzana",
  );
  assert.ok(brojanjeIdx > 0);
});

test("prebrojavanje dolazi tek posle brave", () => {
  const lock = guard.indexOf("pg_advisory_xact_lock");
  const count = guard.indexOf("count(*)::int", guard.indexOf("from(users)") - 400);
  assert.ok(lock > 0 && count > lock, "prebrojavanje ide pre zakljucavanja");
});

test("oba mutation puta koriste isti guard i isti tx", async () => {
  const putevi = [
    ["dozvole", codeOf(await read("../../app/portal/dozvole/actions.ts"))],
    ["nalozi", codeOf(await read("../../app/portal/bezbednost/nalozi/actions.ts"))],
  ];
  for (const [ime, izvor] of putevi) {
    const idx = izvor.indexOf("withOwnerGuard(");
    assert.ok(idx > 0, `${ime} ne koristi guard`);
    const blok = izvor.slice(idx);
    // Callback prima `tx` i koristi ga; globalna konekcija bi izasla iz brave.
    assert.match(blok, /async \(tx\) => \{/, ime);
    assert.ok(!/getDb\(\)/.test(blok.slice(0, blok.indexOf("},\n    );") + 1)), `${ime} koristi globalnu vezu unutar brave`);
  }
});

test("greska u callbacku rusi celu transakciju", () => {
  const telo = guard.slice(guard.indexOf("export async function withOwnerGuard"));
  // Nema `try`/`catch` oko `mutate`: izuzetak mora izaci iz transakcije da bi
  // Drizzle uradio ROLLBACK. Hvatanje bi ostavilo delimicnu izmenu.
  const mutateIdx = telo.indexOf("return mutate(tx)");
  const predMutate = telo.slice(0, mutateIdx);
  assert.ok(!/try\s*\{/.test(predMutate), "izuzetak se hvata pre nego sto stigne do rollbacka");
});
