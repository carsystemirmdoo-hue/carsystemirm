import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * P0-AUTH-01 — otvaranje naloga sa ulogom „gazda“.
 *
 * Puna provera kroz sesiju (koji stvarni HTTP odgovor dobija koji pozivalac)
 * traži pravu bazu i pravu kolačić-sesiju vezanu za `auth()` — isto ograničenje
 * koje `app/portal/importi/sinhronizacija/actions.test.mjs` već dokumentuje za
 * ovu vrstu fajla. Zato je ovaj test STRUKTURAN, nad izvorom, po istom obrascu:
 * dokazuje koji gate stoji na kojoj grani i u kom REDOSLEDU, ne prisustvo
 * teksta bilo gde u fajlu. Sposobnosti se dokazuju posebno, sa STVARNIM
 * pozivima, u `lib/authz/permissions.test.mjs`. Odsustvo sesije se dokazuje sa
 * STVARNOM bazom u `db/integration/ownerAccountCreation.integration.test.mts`.
 */

const ROOT = new URL("../../../", import.meta.url).pathname;
const izvor = await readFile(`${ROOT}app/portal/dozvole/actions.ts`, "utf8");
/** Bez komentara: reč „requireSecurityAdmin“ u objašnjenju nije poziv. */
const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function telo(ime) {
  const start = kod.indexOf(`export async function ${ime}`);
  assert.ok(start !== -1, `nema akcije ${ime}`);
  const sledeca = kod.indexOf("export async function", start + 10);
  return kod.slice(start, sledeca === -1 ? undefined : sledeca);
}

const createBody = telo("createUserAction");
const changeRoleBody = telo("changeRoleAction");

test("createUserAction traži `users:manage` kao prvu radnju", () => {
  const prva = createBody.indexOf("requireCapability(");
  assert.ok(prva !== -1, "createUserAction ne poziva requireCapability");
  assert.match(
    createBody.slice(prva, prva + 60),
    /requireCapability\(\s*"users:manage"/,
    "prva kapija nije users:manage",
  );
});

test("otvaranje naloga sa ulogom „gazda“ dodatno prolazi kroz requireSecurityAdmin", () => {
  assert.match(
    createBody,
    /if\s*\(\s*role\s*===\s*OWNER_ROLE\s*\)\s*{[\s\S]*?requireSecurityAdmin\(\s*token\s*\)/,
    "requireSecurityAdmin se ne poziva unutar provere role === OWNER_ROLE",
  );
});

test("uloga vlasnika se poredi preko `OWNER_ROLE`, ne preko sirovog literala „gazda“", () => {
  /*
   * `lib/authz/ownerGuard.test.mjs` ("nijedan mutation put ne racuna zastitu
   * sam za sebe") već brani da ovaj fajl sam tumači `role === "gazda"` — svaka
   * odluka o vlasničkoj ulozi mora ići kroz centralizovanu konstantu iz
   * `owner-guard-policy.mjs`, da se kriterijum „ko je vlasnik" ne razmiluje po
   * fajlovima. Ovaj test ponavlja ISTU proveru ovde, da regresija bude
   * uočena i sa strane P0-AUTH-01 zadatka, ne samo sa strane owner-guard
   * paketa testova.
   */
  // Uvoz nosi bar `canGrantOwnerRole` i `OWNER_ROLE` (B6 dodaje pravila eskalacije u isti uvoz).
  const uvoz = kod.match(/import \{([^}]*)\} from "@\/lib\/authz\/owner-guard-policy\.mjs";/);
  assert.ok(uvoz, "nema uvoza iz owner-guard-policy.mjs");
  assert.match(uvoz[1], /\bcanGrantOwnerRole\b/);
  assert.match(uvoz[1], /\bOWNER_ROLE\b/);
  assert.ok(!/role === "gazda"/.test(kod), "fajl i dalje sadrži sirov literal „gazda“");
});

test("KORIGOVANO: samo postojeći vlasnik sme da postavi vlasnika — canGrantOwnerRole se poziva PRE requireSecurityAdmin", () => {
  /*
   * Ovo je STRUKTURNA potvrda REDOSLEDA, ne dokaz da je `canGrantOwnerRole`
   * ispravna — to dokazuje `lib/authz/ownerGuard.test.mjs` sa STVARNIM
   * pozivima. Ono što ovde treba dokazati je da `createUserAction` tu funkciju
   * stvarno koristi, i to PRE `requireSecurityAdmin` — inače bi odbijen
   * ne-vlasnik ipak trošio TOTP proveru (i njen rate limit) uzalud, i gore,
   * mogao bi proći ako je `requireSecurityAdmin` popustljiviji u nekoj
   * budućoj izmeni.
   */
  const gazdaBlok = createBody.slice(createBody.indexOf("if (role === OWNER_ROLE)"));
  const canGrantIndex = gazdaBlok.indexOf("canGrantOwnerRole(");
  const rsaIndex = gazdaBlok.indexOf("requireSecurityAdmin(");
  assert.ok(canGrantIndex !== -1, "canGrantOwnerRole se ne poziva");
  assert.ok(rsaIndex !== -1, "requireSecurityAdmin se ne poziva");
  assert.ok(canGrantIndex < rsaIndex, "canGrantOwnerRole se poziva POSLE requireSecurityAdmin");

  // Argumenti moraju biti actor (iz sesije) i role (ciljna uloga) — ne obrnuto,
  // ne iz forme.
  assert.match(gazdaBlok, /canGrantOwnerRole\(actor, role\)/);
});

test("odbijanje canGrantOwnerRole se vraća PRE requireSecurityAdmin — TOTP se nikad ne proverava", () => {
  const gazdaBlok = createBody.slice(createBody.indexOf("if (role === OWNER_ROLE)"));
  const provera = gazdaBlok.match(
    /if\s*\(\s*!canGrantOwnerRole\(actor, role\)\s*\)\s*{\s*return ([\s\S]*?)\}/,
  );
  assert.ok(provera, "nema `if (!canGrantOwnerRole(...)) { return ... }`");
  assert.match(provera[1], /ok: null/);
  // Mesto vraćanja mora biti PRE requireSecurityAdmin poziva u istom bloku.
  assert.ok(gazdaBlok.indexOf(provera[0]) < gazdaBlok.indexOf("requireSecurityAdmin("));
});

test("gate za „gazda“ stoji PRE bilo kog upisa u bazu i pre hešovanja lozinke", () => {
  const gateIndex = createBody.indexOf("canGrantOwnerRole(");
  assert.ok(gateIndex !== -1);

  for (const posao of ["getDb(", ".insert(", "hashPassword(", "db.transaction(", "recordAudit("]) {
    const i = createBody.indexOf(posao);
    assert.ok(
      i === -1 || i > gateIndex,
      `${posao} se poziva pre canGrantOwnerRole (na ${i}, gate na ${gateIndex})`,
    );
  }
});

test("odbijen gate se vraća pre bilo kog čitanja/pisanja u bazu — nema delimičnog naloga", () => {
  /*
   * Blok gate-a mora da se završi sa `return` na neuspeh, a taj `return` mora
   * biti PRE `getDb()`. Ovo je ono što garantuje da odbijen pokušaj ne
   * ostavlja nijedan trag: kod posle gate-a se prosto nikad ne izvrši.
   */
  const gateBlockStart = createBody.indexOf("if (role === OWNER_ROLE)");
  const gateBlockEnd = createBody.indexOf("const db = getDb();", gateBlockStart);
  assert.ok(gateBlockStart !== -1 && gateBlockEnd !== -1);
  const blok = createBody.slice(gateBlockStart, gateBlockEnd);
  assert.match(blok, /return \{ error: SECURITY_GENERIC_ERROR, ok: null \};/);
  assert.match(blok, /return \{ error: error\.message, ok: null \};/);
  assert.match(blok, /throw error;/, "neočekivana greška (redirect/forbidden) se propagira, ne guta");
});

test("identitet i uloga pozivaoca dolaze isključivo iz sesije, nikad iz forme", () => {
  // `actor` se dodeljuje TAČNO jednom, iz requireCapability — nikad iz formData.
  const dodele = [...createBody.matchAll(/\bactor\s*=/g)];
  assert.equal(dodele.length, 1, "actor se dodeljuje više puta");
  assert.match(createBody, /const actor = await requireCapability\(/);

  // `role` iz forme je uloga NOVOG naloga (legitimno) — ali se nikad ne koristi
  // da odredi KO poziva akciju (nema formData.get("actorId"/"userId"/"role")
  // korišćenog kao identitet pozivaoca).
  for (const polje of ["actorId", "callerId", "callerRole"]) {
    assert.ok(
      !createBody.includes(`formData.get("${polje}")`),
      `createUserAction čita identitet pozivaoca iz forme („${polje}“)`,
    );
  }
});

test("obična uloga zadržava dosadašnje ponašanje — gate se NE poziva van grane „gazda“", () => {
  const svePoziveRSA = [...createBody.matchAll(/requireSecurityAdmin\(/g)];
  assert.equal(svePoziveRSA.length, 1, "requireSecurityAdmin se poziva na više od jednog mesta");

  // Jedini poziv mora biti unutar `if (role === OWNER_ROLE)`, ne pre njega.
  const gateIndex = createBody.indexOf("requireSecurityAdmin(");
  const ifIndex = createBody.indexOf("if (role === OWNER_ROLE)");
  assert.ok(ifIndex !== -1 && ifIndex < gateIndex);
});

test("token je obavezan SAMO za ulogu „gazda“ (šema)", () => {
  // `createSchema` je modulska konstanta PRE `createUserAction` — traži se u
  // celom fajlu, ne u telu funkcije.
  assert.match(
    kod,
    /token:\s*z\.string\(\)\.trim\(\)\.max\(8\)\.optional\(\)\.default\(""\)/,
    "token nije modelovan kao opciono polje sa praznim podrazumevanim",
  );
  assert.match(
    kod,
    /data\.role === OWNER_ROLE && data\.token\.length < 6/,
    "superRefine ne uslovljava dužinu tokena ulogom „gazda“",
  );
});

test("uspešno kreiranje ostaje auditovano kao i pre", () => {
  assert.match(createBody, /AUDIT_ACTIONS\.userCreated/);
  assert.match(createBody, /after: \{ ime: name, uloga: ROLE_LABELS\[role\] \}/);
});

test("changeRoleAction zadržava requireSecurityAdmin i withOwnerGuard — zaštita nije oslabljena", () => {
  assert.match(changeRoleBody, /requireSecurityAdmin\(/);
  assert.match(changeRoleBody, /withOwnerGuard\(/);
  assert.match(changeRoleBody, /removesActiveOwner\(/);
});
