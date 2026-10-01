import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readXlsx } from "../import/xlsx/readXlsx.mjs";
import {
  analyzePartners,
  contactWorklist,
  CONTACT_WORKLIST_HEADERS,
  diffPartnerSnapshots,
  matchAuxiliary,
  parsePartnerWorkbook,
  PartnerWorkbookError,
  phoneKey,
  splitEmails,
  summarizePartners,
  toCsv,
} from "./partnerRegistry.mjs";
import { classifyPib, pibCheckDigit } from "./pib.mjs";

const FIXTURE = new URL("../../fixtures/dev/partners/partner-prep-synthetic.xlsx", import.meta.url);
const load = () => parsePartnerWorkbook(readXlsx(readFileSync(FIXTURE)));

test("PIB: kontrolna cifra, strani broj, prazno", () => {
  // Sintetički PIB-ovi sa vodećim nulama: ispravna kontrolna cifra, a broj ispod 100000001 se ne dodeljuje kao PIB.
  assert.equal(pibCheckDigit("00000011"), 8);
  assert.deepEqual(classifyPib(" 000000118 "), { value: "000000118", status: "valid" });
  assert.equal(classifyPib("000000215").status, "invalid_checksum");
  assert.equal(classifyPib("DE000000000").status, "nonstandard");
  assert.equal(classifyPib("09000001").status, "nonstandard");
  assert.deepEqual(classifyPib(null), { value: null, status: "missing" });
  assert.deepEqual(classifyPib("  "), { value: null, status: "missing" });
});

test("klasifikacija se izvodi iz šifre komercijaliste, ne iz imena lista", () => {
  const { partners, sheetMismatches } = load();
  assert.equal(sheetMismatches.length, 0);
  const byCode = new Map(partners.map((p) => [p.partnerCode, p]));
  assert.equal(byCode.get("0012").classification, "rep_assigned_candidate");
  assert.equal(byCode.get("51").classification, "needs_review");
  // "0012" i "12" su dva partnera.
  assert.notEqual(byCode.get("0012").name, byCode.get("12").name);
});

test("ime lista koje se ne slaže sa podacima postaje nalaz", () => {
  const sheets = readXlsx(readFileSync(FIXTURE));
  const review = sheets.find((s) => s.name === "Za dodatnu proveru");
  review.rows[1][7] = "2"; // partner 50 sada ima komercijalistu
  const { sheetMismatches } = parsePartnerWorkbook(sheets);
  assert.deepEqual(sheetMismatches, [
    { partnerCode: "50", sheet: "Za dodatnu proveru", expected: "needs_review", derived: "rep_assigned_candidate" },
  ]);
});

test("promenjena struktura izvoza zaustavlja uvoz", () => {
  const sheets = readXlsx(readFileSync(FIXTURE));
  sheets[0].rows[0][2] = "Poreski broj";
  assert.throws(() => parsePartnerWorkbook(sheets), PartnerWorkbookError);
  const without = readXlsx(readFileSync(FIXTURE)).filter((s) => s.name !== "Kupci bez emaila");
  assert.throws(() => parsePartnerWorkbook(without), /Nedostaje list/);
});

test("sažetak broji iz podataka", () => {
  const { partners, aux } = load();
  const s = summarizePartners(partners, aux);
  assert.equal(s.partners, 10);
  assert.equal(s.repAssignedCandidates, 8);
  assert.equal(s.candidatesWithEmail, 5);
  assert.equal(s.candidatesWithoutEmail, 3);
  assert.equal(s.needsReview, 2);
  assert.equal(s.needsReviewWithEmail, 1);
  assert.deepEqual(s.candidatesByRepCode, { 1: 4, 2: 2, 3: 2 });
  assert.equal(s.auxiliary, 3);
});

test("nalazi: poslovnice, deljena e-pošta, PIB problemi", () => {
  const { partners } = load();
  const findings = analyzePartners(partners);
  const kinds = (k) => findings.filter((f) => f.kind === k).map((f) => f.partnerCodes);

  assert.deepEqual(kinds("pib_shared_by_codes"), [["30", "31"]]);
  assert.deepEqual(kinds("email_shared_across_legal_entities"), [["20", "21"]]);
  assert.deepEqual(kinds("pib_missing"), [["40"]]);
  assert.deepEqual(kinds("pib_invalid_checksum"), [["41"]]);
  assert.deepEqual(kinds("pib_nonstandard"), [["50"]]);
  assert.equal(findings.some((f) => f.severity === "blocking"), false);
});

test("dupla šifra je blokirajući nalaz", () => {
  const { partners } = load();
  const findings = analyzePartners([...partners, { ...partners[0], sourceSheet: "drugi" }]);
  assert.ok(findings.some((f) => f.kind === "duplicate_partner_code" && f.severity === "blocking"));
});

test("pomoćna lista: telefon je jak predlog, naziv samo napomena", () => {
  const { partners, aux } = load();
  const links = matchAuxiliary(aux, partners);
  assert.deepEqual(
    links.map((l) => [l.auxId, l.partnerCode, l.basis, l.strength]),
    [
      ["900001", "30", "phone", "strong"],
      ["900002", "12", "name", "hint_only"],
    ],
  );
  // Nijedan zapis pomoćne liste bez jakog identifikatora nije povezan.
  assert.equal(links.some((l) => l.auxId === "900003"), false);
});

test("e-pošta i telefon: normalizacija bez nagađanja", () => {
  assert.deepEqual(splitEmails("A@primer-a.invalid; b@primer-b.invalid , nije-adresa"), {
    emails: ["a@primer-a.invalid", "b@primer-b.invalid"],
    invalid: ["nije-adresa"],
  });
  assert.equal(phoneKey("+381 60 555 0916"), "0605550916");
  assert.equal(phoneKey("00381 11 000 0101"), "0110000101");
  assert.equal(phoneKey("555"), null);
});

test("radna lista kontakata nikad ne sadrži predloženu adresu", () => {
  const { partners } = load();
  const rows = contactWorklist(partners, analyzePartners(partners));
  assert.equal(rows.length, partners.length);
  const idx = CONTACT_WORKLIST_HEADERS.indexOf("Predložen kontakt (e-mail)");
  for (const r of rows) {
    assert.equal(r.length, CONTACT_WORKLIST_HEADERS.length);
    for (let i = idx; i < r.length; i += 1) assert.equal(r[i], "");
  }
  const shared = rows.find((r) => r[0] === "20");
  assert.match(shared[7], /deljen sa drugom firmom/);
  const missing = rows.find((r) => r[0] === "31");
  assert.match(missing[7], /nema/);
});

test("CSV neutralizuje formule i navodnike", () => {
  const csv = toCsv(["a", "b"], [["=HYPERLINK(1)", 'x"y;z']]);
  assert.ok(csv.startsWith("﻿a;b\r\n"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes('"x""y;z"'));
});

test("razlika snimaka: promena PIB-a je kritična", () => {
  const before = [
    { partnerCode: "1", name: "A", pib: "000000319", repCode: "1", emails: [] },
    { partnerCode: "2", name: "B", pib: null, repCode: null, emails: [] },
  ];
  const after = [
    { partnerCode: "1", name: "A NOVO IME", pib: "000000417", repCode: "2", emails: ["a@primer-a.invalid"] },
    { partnerCode: "3", name: "C", pib: null, repCode: null, emails: [] },
  ];
  const d = diffPartnerSnapshots(before, after);
  const bySev = (s) => d.filter((c) => c.severity === s).map((c) => `${c.partnerCode}:${c.change}`);
  assert.deepEqual(bySev("critical"), ["1:pib_changed"]);
  assert.deepEqual(bySev("info").sort(), ["1:name_changed", "3:added"]);
  assert.deepEqual(bySev("review").sort(), ["1:email_changed", "1:rep_changed", "2:removed"]);
});
