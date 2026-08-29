import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decideIdentityWrite,
  ExternalIdentityError,
  identityKey,
  isSamePartnerCode,
  matchByExactCode,
  normalizePartnerCode,
  pibIsAutoMergeEvidence,
} from "./externalIdentity.mjs";

const bs = (issuerCode, externalPartnerCode, extra = {}) => ({
  sourceSystem: "biznisoft",
  issuerCode,
  externalPartnerCode,
  ...extra,
});

/* -------------------------------------------------------------------------
 * Vodeće nule
 * ---------------------------------------------------------------------- */

test("vodeca nula se cuva kroz normalizaciju", () => {
  assert.equal(normalizePartnerCode("0012"), "0012");
  assert.equal(normalizePartnerCode("000000"), "000000");
  assert.equal(normalizePartnerCode("  0012  "), "0012");
});

test("sifra sa vodecom nulom nije ista kao bez nje", () => {
  assert.equal(isSamePartnerCode("0012", "12"), false);
  assert.equal(isSamePartnerCode("0012", "0012"), true);
  assert.notEqual(identityKey(bs("01", "0012")), identityKey(bs("01", "12")));
});

test("broj se odbija jer bi vodece nule vec bile izgubljene", () => {
  assert.throws(
    () => normalizePartnerCode(12),
    (error) =>
      error instanceof ExternalIdentityError && error.code === "not_a_string",
  );
});

test("prazna i neispravna sifra se odbijaju", () => {
  assert.throws(() => normalizePartnerCode("   "), { code: "empty" });
  assert.throws(() => normalizePartnerCode("00 12"), { code: "bad_shape" });
  assert.throws(() => normalizePartnerCode("-12"), { code: "bad_shape" });
});

test("izvorni kod nigde ne prolazi kroz numericki parser", async () => {
  const source = await readFile(new URL("./externalIdentity.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of ["Number(", "parseInt(", "parseFloat(", "replace(/^0"]) {
    assert.ok(
      !code.includes(forbidden),
      `modul koristi ${forbidden} nad sifrom partnera`,
    );
  }
});

/* -------------------------------------------------------------------------
 * Opseg izdavaoca
 * ---------------------------------------------------------------------- */

test("ista sifra kod dva izdavaoca nije isti partner", () => {
  assert.notEqual(identityKey(bs("01", "0012")), identityKey(bs("02", "0012")));
});

test("izdavalac je obavezan, izvorni sistem mora biti poznat", () => {
  assert.throws(() => identityKey(bs("", "0012")), { code: "empty_issuer" });
  assert.throws(
    () => identityKey({ sourceSystem: "excel", issuerCode: "01", externalPartnerCode: "1" }),
    { code: "unknown_source" },
  );
});

test("razdvajac ne moze da spoji dva razlicita kljuca", () => {
  // („01 02", „3") i („01", „02 3") bi se sudarili da razdvajač curi u delove.
  assert.throws(() => identityKey(bs("01 02", "3")), { code: "bad_shape" });
  assert.throws(() => identityKey(bs("01", "02 3")), { code: "bad_shape" });
});

/* -------------------------------------------------------------------------
 * Duplikat i konflikt
 * ---------------------------------------------------------------------- */

test("nov kljuc se kreira", () => {
  assert.deepEqual(
    decideIdentityWrite({ incoming: bs("01", "0012", { customerId: "c1" }), existing: null }),
    { action: "create" },
  );
});

test("ponovljeni uvoz iste veze ne menja nista", () => {
  const decision = decideIdentityWrite({
    incoming: bs("01", "0012", { customerId: "c1" }),
    existing: { id: "e1", customerId: "c1", status: "mapped" },
  });
  assert.equal(decision.action, "noop");
});

test("nevezana sifra prima kupca", () => {
  const decision = decideIdentityWrite({
    incoming: bs("01", "0012", { customerId: "c1" }),
    existing: { id: "e1", customerId: null, status: "unmapped" },
  });
  assert.equal(decision.action, "attach");
});

test("ista sifra ka drugom kupcu je konflikt, ne prepis", () => {
  const decision = decideIdentityWrite({
    incoming: bs("01", "0012", { customerId: "c2" }),
    existing: { id: "e1", customerId: "c1", status: "mapped" },
  });
  assert.equal(decision.action, "conflict");
  assert.match(decision.reason, /ne bira/);
});

test("iskljucena sifra se ne ozivljava uvozom", () => {
  const decision = decideIdentityWrite({
    incoming: bs("01", "0012", { customerId: "c1" }),
    existing: { id: "e1", customerId: "c1", status: "disabled" },
  });
  assert.equal(decision.action, "conflict");
});

/* -------------------------------------------------------------------------
 * Zabrana fuzzy povezivanja
 * ---------------------------------------------------------------------- */

test("poklapanje ide samo po tacnoj sifri", () => {
  const rows = [
    bs("01", "0012", { id: "a", sourceName: "AUTO LAK DOO" }),
    bs("01", "12", { id: "b", sourceName: "AUTO LAK D.O.O." }),
    bs("02", "0012", { id: "c", sourceName: "AUTO LAK DOO" }),
  ];
  const found = matchByExactCode(rows, bs("01", "0012"));
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "a");
});

test("PIB nije osnov automatskog spajanja", () => {
  assert.equal(pibIsAutoMergeEvidence(), false);
});

test("modul ne nudi nijednu funkciju poredjenja naziva", async () => {
  const source = await readFile(new URL("./externalIdentity.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of [
    "levenshtein",
    "similarity",
    "fuzzy",
    "localeCompare",
    "includes(name",
    "startsWith(name",
  ]) {
    assert.ok(
      !code.toLowerCase().includes(forbidden.toLowerCase()),
      `modul sadrzi trag poredjenja po nazivu: ${forbidden}`,
    );
  }
});
