import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCallback, reauthUrlFor } from "./redirects.mjs";

/*
 * Lager: istekla potvrda drugog faktora ne sme završiti ekranom „Nemate dozvolu"
 * (Production 15. 10. 2026, uvoz kancelarije). Potvrda i odbacivanje vode na
 * ponovnu potvrdu identiteta sa povratkom na isti uvoz; pravo ostaje `imports:write`.
 */
const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), "utf8");

test("adresa ponovne potvrde vraća na isti uvoz i ne propušta spoljne adrese", () => {
  const back = "/portal/zalihe/uvoz/6dde8c91-4214-4c71-a12d-866b182c612a?identitet=potvrdjen";
  const url = new URL(reauthUrlFor(back), "https://primer.test");
  assert.equal(url.pathname, "/prijava");
  assert.equal(url.searchParams.get("potvrda"), "identitet");
  assert.equal(normalizeCallback(url.searchParams.get("callbackUrl")), back);
  for (const napad of ["https://zlo.test/portal", "//zlo.test", "/kupac", "/prijava"]) {
    assert.equal(new URL(reauthUrlFor(napad), "https://primer.test").searchParams.get("callbackUrl"), "/portal");
  }
});

test("odluke o lageru traže svež drugi faktor preko ponovne potvrde, ne zabranom", async () => {
  const src = await read("app/portal/zalihe/uvoz/actions.ts");
  assert.doesNotMatch(src, /requireRecentMfa\(\)/);
  // Politika vlasnika 16. 10. 2026: rutinski tok lagera prihvata drugi faktor iz radne sesije (8 h / ponoć).
  assert.match(src, /requireSessionMfaOrReauth\(back\)/);
  assert.doesNotMatch(src, /requireRecentMfaOrReauth/);
  // Pravo se ne širi: isto `imports:write`, isti korisnik.
  assert.match(src, /requireCapability\("imports:write", back\)/);
  assert.match(src, /fresh\.id !== actor\.id \|\| !can\(fresh, "imports:write"\)\) forbidden\(\)/);
  for (const fn of ["confirmStockAction", "discardStockAction"]) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    assert.match(body.slice(0, 700), /sameActor\(await requireCapability\("imports:write", back\), await requireSessionMfaOrReauth\(back\)\)/, fn);
  }
  // Ponovljen klik posle odluke prikazuje zapisani ishod, bez nove promene.
  assert.match(src, /error\.code === "odluceno"/);
  assert.match(src, /ishod=vec-odluceno/);
});

test("kapija ponovne potvrde: bez sesije prijava, ograničena sesija zabrana, zastarela potvrda ponovna potvrda", async () => {
  const session = await read("lib/authz/session.ts");
  const block = session.slice(session.indexOf("export async function requireRecentMfaOrReauth"));
  const body = block.slice(0, block.indexOf("\n}\n"));
  assert.match(body, /if \(!session\) redirect\(loginUrlFor\(returnPath\)\)/);
  assert.match(body, /if \(!session\.fullAccess\) forbidden\(\)/);
  assert.match(body, /!isSecondFactorSatisfied\(session\.assurance\) \|\| !isMfaRecent\(session\.mfaVerifiedAt\)/);
  assert.match(body, /redirect\(reauthUrlFor\(returnPath\)\)/);
});

test("prijava u režimu potvrde prikazuje obrazac samo prijavljenom korisniku sa zastarelom potvrdom", async () => {
  const login = await read("app/prijava/page.tsx");
  assert.match(login, /session\?\.fullAccess &&\s+params\[REAUTH_PARAM\] === REAUTH_VALUE &&\s+!\(isSecondFactorSatisfied\(session\.assurance\) && isMfaRecent\(session\.mfaVerifiedAt\)\)/);
  assert.match(login, /callbackUrl=\{normalizeCallback\(callbackUrl\) \?\? ""\}/);
});

test("drugi faktor iz radne sesije: bez sesije prijava, bez drugog faktora potvrda identiteta; admin i dalje 10 minuta", async () => {
  const session = await read("lib/authz/session.ts");
  const block = session.slice(session.indexOf("export async function requireSessionMfaOrReauth"));
  const body = block.slice(0, block.indexOf("\n}\n"));
  assert.match(body, /if \(!session\) redirect\(loginUrlFor\(returnPath\)\)/);
  assert.match(body, /if \(!session\.fullAccess\) forbidden\(\)/);
  assert.match(body, /if \(!isSecondFactorSatisfied\(session\.assurance\)\) redirect\(reauthUrlFor\(returnPath\)\)/);
  assert.doesNotMatch(body, /isMfaRecent/, "rutinski tok ne traži kod na svakih 10 minuta");
  // Osetljive radnje ne dobijaju produžen prag.
  assert.match(await read("app/portal/zalihe/actions.ts"), /requireRecentMfaOrReauth\(PATH\)/);
  for (const f of ["app/portal/bezbednost/lozinka/actions.ts", "app/portal/bezbednost/nalozi/actions.ts"]) {
    assert.doesNotMatch(await read(f), /requireSessionMfaOrReauth/, f);
  }
  // Radna sesija zaposlenih: 8 h ili ponoć; kupčeva sesija nepromenjena.
  assert.match(session, /if \(!isWithinStaffWorkday\(session\.user\.loginAt\)\) return null;/);
  assert.match(await read("lib/authz/customer-session.ts"), /isWithinAbsoluteLifetime\(session\.user\.loginAt\)/);
});
