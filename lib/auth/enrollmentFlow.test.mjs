import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const actions = codeOf(await read("../../app/portal/bezbednost/mfa/actions.ts"));
const page = codeOf(await read("../../app/portal/bezbednost/mfa/page.tsx"));
const uiSource = await read("../../app/portal/bezbednost/mfa/MfaEnrollment.tsx");
// Komentari objasnjavaju zasto se `localStorage` NE koristi; tvrdnje idu nad kodom.
const uiCode = codeOf(uiSource);
const ui = uiSource;
const session = codeOf(await read("../authz/session.ts"));
const headers = codeOf(await read("../security/http-headers.mjs"));
const nextConfig = codeOf(await read("../../next.config.ts"));

const block = (source, from, to) =>
  source.slice(source.indexOf(from), to ? source.indexOf(to) : undefined);

/* =========================================================================
 * Ko sme na ekran
 * ====================================================================== */

test("enrollment ruta prima enrollment-only sesiju", () => {
  // Bez ovoga bi korisnik u rezimu `enforced` bio zakljucan napolju: nema pun
  // pristup dok ne veze faktor, a ne moze da ga veze bez punog pristupa.
  assert.match(page, /requireEnrollmentUser\(\)/);
  assert.doesNotMatch(page, /requireCapability\(/);
});

test("sve ostale portal rute i dalje odbijaju enrollment-only sesiju", () => {
  // `getPortalUser` vraca iskljucivo `fullAccess`, pa `requireCapability`
  // — koji ide preko njega — ne moze primiti enrollment sesiju.
  const getUser = block(
    session,
    "export async function getPortalUser",
    "export type AuthenticatedSession",
  );
  assert.match(getUser, /\.fullAccess \?\? null/);

  const requireFull = block(
    session,
    "export async function requireFullPortalUser",
    "export async function requireRecentMfa",
  );
  /*
   * Pun pristup je jedini izlaz koji vraca korisnika. Enrollment-only se ne
   * vraca nego preusmerava na vezivanje — odbijanje ostaje odbijanje, samo je
   * odrediste korisno umesto petlje kroz prijavu.
   */
  assert.match(requireFull, /if \(session\?\.fullAccess\) return session\.fullAccess;/);
  assert.match(requireFull, /if \(session\?\.enrollmentOnly\) redirect\(MFA_ENROLLMENT_ROUTE\)/);
  assert.match(requireFull, /redirect\(loginUrlFor\(callbackPath\)\)/);
  // Nema grane koja bi vratila bilo sta osim punog pristupa.
  assert.equal((requireFull.match(/return /g) ?? []).length, 1);
});

/* =========================================================================
 * Pokretanje vezivanja
 * ====================================================================== */

test("pokretanje trazi i lozinku i dozvolu", () => {
  const start = block(actions, "export async function startEnrollmentAction", "export async function confirmEnrollmentAction");
  assert.match(start, /verifyPassword\(password, record\.passwordHash\)/);
  assert.match(start, /consumeEnrollmentGrant\(\{ userId: user\.id, code: grant \}\)/);
  // Dozvola je vezana za PRIJAVLJENOG korisnika, ne za nesto iz obrasca.
  assert.ok(!/userId: [^u]/.test(start), "korisnik dolazi spolja");
});

test("dozvola se ne trazi kada faktor vec postoji", () => {
  const start = block(actions, "export async function startEnrollmentAction", "export async function confirmEnrollmentAction");
  assert.match(start, /if \(!status\.enabled\) \{[\s\S]{0,200}consumeEnrollmentGrant/);
});

test("pogresna lozinka i pogresna dozvola daju ISTU poruku", () => {
  const start = block(actions, "export async function startEnrollmentAction", "export async function confirmEnrollmentAction");
  // Samo grane KOJE ODBIJAJU; `error: null` je uspesan ishod.
  const rejections = [...start.matchAll(/error: (\w+)/g)]
    .map((m) => m[1])
    .filter((value) => value !== "null");
  assert.ok(rejections.length >= 2, "nema dovoljno grana odbijanja");
  assert.ok(
    rejections.every((e) => e === "GENERIC"),
    `razlicite poruke odaju sta je pogresno: ${rejections.join(", ")}`,
  );
});

test("odgovor ne nosi sifrovani materijal", () => {
  const start = block(actions, "export async function startEnrollmentAction", "export async function confirmEnrollmentAction");
  const returned = [...start.matchAll(/return \{[\s\S]*?\};/g)].map((m) => m[0]);
  for (const r of returned) {
    assert.doesNotMatch(r, /ciphertext|authTag|keyVersion|\biv\b/i, "curi sifrovani materijal");
  }
  // Vraca se tacno ono sto korisnik mora da vidi.
  assert.match(start, /base32: setup\.base32/);
  assert.match(start, /uri: setup\.uri/);
});

test("audit pri pokretanju ne nosi ni tajnu ni dozvolu", () => {
  const start = block(actions, "export async function startEnrollmentAction", "export async function confirmEnrollmentAction");
  const audits = [...start.matchAll(/recordAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(audits.length === 1);
  assert.doesNotMatch(audits[0], /grant|base32|setup|password/i);
});

/* =========================================================================
 * Potvrda i rezervni kodovi
 * ====================================================================== */

test("potvrda aktivira faktor i opoziva sesije", () => {
  const confirm = block(actions, "export async function confirmEnrollmentAction", "export async function regenerateRecoveryAction");
  assert.match(confirm, /confirmMfaEnrollment\(\{ userId: user\.id, token \}\)/);
  assert.match(confirm, /sessionVersion: sql`\$\{users\.sessionVersion\} \+ 1`/);
  assert.match(confirm, /AUDIT_ACTIONS\.mfaEnabled/);
});

test("rezervni kodovi stizu u odgovoru potvrde, i to je jedini put", () => {
  const confirm = block(actions, "export async function confirmEnrollmentAction", "export async function regenerateRecoveryAction");
  assert.match(confirm, /recoveryCodes: result\.recoveryCodes/);
  // Nijedna akcija ih ne cita iz baze.
  assert.ok(!/select[\s\S]{0,80}mfaRecoveryCodes/i.test(actions), "kodovi se citaju iz baze");
});

test("audit potvrde ne nosi kodove", () => {
  const confirm = block(actions, "export async function confirmEnrollmentAction", "export async function regenerateRecoveryAction");
  const audits = [...confirm.matchAll(/recordAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  for (const a of audits) {
    assert.doesNotMatch(a, /recoveryCodes|result\.|token/i);
  }
});

/* =========================================================================
 * Ponovno izdavanje kodova
 * ====================================================================== */

test("nov set trazi punu sesiju, lozinku i svez kod", () => {
  const regen = block(actions, "export async function regenerateRecoveryAction", "export async function readEnrollmentContext");
  assert.match(regen, /requireFullPortalUser\(\)/);
  assert.match(regen, /verifyPassword\(password, record\.passwordHash\)/);
  // Ista replay zastita kao pri prijavi.
  assert.match(regen, /verifyTotpForUser\(\{ userId: user\.id, token \}\)/);
  assert.match(regen, /AUDIT_ACTIONS\.recoveryCodesRegenerated/);
});

test("audit ponovnog izdavanja nosi samo broj, ne kodove", () => {
  const regen = block(actions, "export async function regenerateRecoveryAction", "export async function readEnrollmentContext");
  const audits = [...regen.matchAll(/recordAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.match(audits[0], /codes\.length/);
  assert.ok(!/\$\{codes\[/.test(audits[0]), "audit nosi sam kod");
});

/* =========================================================================
 * Prikaz u pretraživaču
 * ====================================================================== */

test("kodovi i kljuc zive samo u stanju komponente", () => {
  assert.ok(!/localStorage|sessionStorage/.test(uiCode), "kodovi se upisuju u skladiste");
  assert.ok(
    !/searchParams|location\.hash|history\.(push|replace)State/.test(uiCode),
    "kodovi idu u adresu",
  );
  // Preuzimanje se pravi lokalno, ne sa servera.
  assert.match(ui, /new Blob\(\[text\]/);
  assert.match(ui, /URL\.revokeObjectURL\(url\)/);
});

test("zavrsni korak trazi izricitu potvrdu da su kodovi sacuvani", () => {
  assert.match(ui, /Sačuvao sam rezervne kodove/);
  // Odjava se nudi TEK posle potvrde.
  assert.match(ui, /\{saved \? \([\s\S]{0,400}onSignOut/);
});

test("kljuc se prikazuje uz jasno upozorenje da je jednokratan", () => {
  assert.match(ui, /Ključ se prikazuje samo sada/);
  assert.match(ui, /Svaki kod važi <strong>jednom<\/strong>/);
});

test("nema QR biblioteke ni spoljnog servisa", () => {
  assert.ok(!/qrcode|qr-code|chart\.googleapis|api\.qrserver/i.test(ui));
  assert.ok(!/qrcode/i.test(actions));
});

test("polja imaju labelu, opis greske i pristupacan fokus", () => {
  assert.match(ui, /htmlFor=\{tokenId\}/);
  assert.match(ui, /htmlFor=\{passwordId\}/);
  assert.match(ui, /aria-describedby=/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /disabled=\{confirming\}/);
});

/* =========================================================================
 * Keširanje
 * ====================================================================== */

test("osetljive putanje su na spisku bez kesiranja", () => {
  assert.match(headers, /NO_STORE_PATHS = \[/);
  assert.match(headers, /"\/portal\/bezbednost\/:path\*"/);
  assert.match(headers, /"\/prijava\/reset"/);
});

test("no-store je stvarno no-store, ne no-cache", () => {
  // `no-cache` samo trazi proveru pre upotrebe — kopija bi i dalje lezala na disku.
  assert.match(headers, /"no-store, max-age=0, must-revalidate"/);
  assert.match(headers, /key: "Pragma", value: "no-cache"/);
});

test("zaglavlja su povezana u konfiguraciji", () => {
  assert.match(nextConfig, /NO_STORE_PATHS\.map/);
  assert.match(nextConfig, /headers: noStoreHeaders\(\)/);
});

test("strana se ne prerenderuje", () => {
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /export const revalidate = 0/);
  assert.match(page, /noarchive/);
});
