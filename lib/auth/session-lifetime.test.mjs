import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isValidSessionId,
  isWithinAbsoluteLifetime,
  revocationExpiresAt,
  SESSION_ABSOLUTE_SECONDS,
} from "./session-lifetime.mjs";

const NOW = 1_800_000_000;

test("apsolutni rok: unutar osam sati važi, posle ne — bez obzira na osvežavanje tokena", () => {
  assert.equal(isWithinAbsoluteLifetime(NOW - 60, NOW), true);
  assert.equal(isWithinAbsoluteLifetime(NOW - SESSION_ABSOLUTE_SECONDS, NOW), true);
  assert.equal(isWithinAbsoluteLifetime(NOW - SESSION_ABSOLUTE_SECONDS - 1, NOW), false);
});

test("token bez vremena prijave ili sa vremenom iz budućnosti se odbija", () => {
  for (const v of [undefined, null, "1800000000", Number.NaN, {}]) assert.equal(isWithinAbsoluteLifetime(v, NOW), false);
  assert.equal(isWithinAbsoluteLifetime(NOW + 30, NOW), true, "mala razlika satova");
  assert.equal(isWithinAbsoluteLifetime(NOW + 3600, NOW), false);
});

test("sid mora biti UUID", () => {
  assert.equal(isValidSessionId("6d03cd52-4e01-4661-afd4-93ac5459882f"), true);
  for (const v of [undefined, "", "abc", "6d03cd52-4e01-4661-afd4-93ac5459882f' OR 1=1"]) assert.equal(isValidSessionId(v), false);
});

test("zapis opoziva traje bar do apsolutnog isteka tokena", () => {
  assert.ok(revocationExpiresAt(NOW).getTime() / 1000 > NOW + SESSION_ABSOLUTE_SECONDS);
});

test("auth.config.ts: sid i loginAt se postavljaju samo pri prijavi; maxAge = apsolutni rok", async () => {
  const kod = await readFile(new URL("../../auth.config.ts", import.meta.url), "utf8");
  assert.match(kod, /maxAge: 60 \* 60 \* 24 \* 30,/);
  const blok = kod.slice(kod.indexOf("jwt({"), kod.indexOf("session({"));
  assert.match(blok, /if \(user\?\.id\) \{[\s\S]*token\.sid = crypto\.randomUUID\(\);[\s\S]*token\.loginAt = /);
});

test("kapije zaposlenih i kupca proveravaju rok i opoziv; obe odjave opozivaju", async () => {
  const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), "utf8");
  for (const [p, gate] of [["lib/authz/session.ts", /isWithinStaffSession\(session\.user\.loginAt\)/], ["lib/authz/customer-session.ts", /isWithinAbsoluteLifetime\(session\.user\.loginAt\)/]]) {
    const kod = await read(p);
    // Zaposleni: 30 dana od prijave; kupac: apsolutni rok (8 h).
    assert.match(kod, gate, p);
    assert.match(kod, /await isSessionRevoked\(session\.user\.sid\)/, p);
  }
  assert.match(await read("app/portal/actions.ts"), /await revokeCurrentSession\(\);\s*await signOut/);
  assert.match(await read("app/prijava/kupac/actions.ts"), /await revokeCurrentSession\(\);\s*await signOut/);
});

test("sesija zaposlenog: 30 dana od prijave, i preko ponoći; aktivnost ne produžava (odluka 10. 11. 2026)", async () => {
  const { isWithinStaffSession, STAFF_SESSION_SECONDS, isWithinAbsoluteLifetime: absolute } = await import("./session-lifetime.mjs");
  const at = (iso) => Math.floor(Date.parse(iso) / 1000);
  const login = at("2026-11-10T07:00:00Z");
  assert.equal(STAFF_SESSION_SECONDS, 30 * 24 * 3600);
  assert.equal(isWithinStaffSession(login, at("2026-11-10T23:30:00Z")), true, "preko ponoći");
  assert.equal(isWithinStaffSession(login, login + STAFF_SESSION_SECONDS), true, "tačno 30 dana");
  assert.equal(isWithinStaffSession(login, login + STAFF_SESSION_SECONDS + 1), false, "posle 30 dana");
  assert.equal(isWithinStaffSession(login + 3600, login), false, "prijava iz budućnosti");
  for (const v of [undefined, null, "1800000000", Number.NaN]) assert.equal(isWithinStaffSession(v, login), false);
  // Kupčeva sesija se ne menja: 8 h.
  assert.equal(absolute(login, login + 8 * 3600 + 1), false);
});

test("opoziv odjavom traje koliko i najduža sesija", async () => {
  const { revocationExpiresAt, STAFF_SESSION_SECONDS } = await import("./session-lifetime.mjs");
  assert.ok(revocationExpiresAt(NOW).getTime() / 1000 > NOW + STAFF_SESSION_SECONDS);
});
