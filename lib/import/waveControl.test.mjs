import assert from "node:assert/strict";
import test from "node:test";
import { postImportChecks, preImportChecks } from "./waveControl.mjs";

// Sintetički manifest od dva dokumenta.
const MANIFEST = {
  kontrola: { dokumenata: 2, stavki: 3, neto: 300, bruto: 360 },
  dokumenti: [
    { sha256: "a", stavki: 1, parser: "biznisoft-pdf-2", sifra_partnera: "00001" },
    { sha256: "b", stavki: 2, parser: "biznisoft-pdf-2", sifra_partnera: "00002" },
  ],
};
const okPre = {
  manifest: MANIFEST,
  files: [{ sha256: "a", present: true, actualSha: "a" }, { sha256: "b", present: true, actualSha: "b" }],
  repoParserVersion: "biznisoft-pdf-2",
  db: { demoMarker: false, sizeBytes: 11 * 1048576, alreadyImported: 0, unmappedPartnerCodes: [], pendingReview: 0 },
};
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);

test("pre: sve u redu → nijedna provera ne pada", () => {
  assert.deepEqual(failed(preImportChecks(okPre)), []);
});

test("pre: promenjen fajl, druga verzija parsera, demo baza, nepovezan partner — sve pada", () => {
  const f = structuredClone(okPre);
  f.files[0].actualSha = "x";
  f.repoParserVersion = "biznisoft-pdf-3";
  f.db.demoMarker = true;
  f.db.unmappedPartnerCodes = ["00002"];
  f.db.alreadyImported = 1;
  assert.equal(failed(preImportChecks(f)).length, 5);
});

test("pre: procena iznad 80 % od 0,5 GB pada", () => {
  const f = structuredClone(okPre);
  f.db.sizeBytes = 420 * 1048576;
  assert.deepEqual(failed(preImportChecks(f)), ["procena posle talasa ispod radne granice 0,5 GB (rezerva 20 %)"]);
});

const okPost = {
  manifest: MANIFEST,
  db: {
    documents: [
      { sha256: "a", valid: true, invoiceId: "i1", manualReview: "not_required", revisionStatus: "original" },
      { sha256: "b", valid: true, invoiceId: "i2", manualReview: "not_required", revisionStatus: "original" },
    ],
    invoices: { count: 2, lines: 3, net: 300, gross: 360 },
    invoicesInPeriodForIssuer: 2, sizeBytesBefore: 11 * 1048576, sizeBytesAfter: 12 * 1048576,
  },
  bizniSoft: { broj: 2, neto: 300, pdv: 60, bruto: 360 },
};

test("posle: sve se slaže sa manifestom i BizniSoft-om", () => {
  assert.deepEqual(failed(postImportChecks(okPost)), []);
});

test("posle: bez BizniSoft zbira talas se ne prihvata", () => {
  assert.deepEqual(failed(postImportChecks({ ...okPost, bizniSoft: null })), ["BizniSoft kontrolni zbir"]);
});

test("posle: razlika od jedne pare, višak faktura u periodu i dokument na pregledu padaju", () => {
  const f = structuredClone(okPost);
  f.db.invoices.net = 300.01;
  f.db.invoicesInPeriodForIssuer = 3;
  f.db.documents[1].manualReview = "pending";
  assert.deepEqual(failed(postImportChecks(f)).sort(), [
    "BizniSoft neto = baza (na paru)",
    "neto = manifest (na paru)",
    "nijedan na ručnom pregledu ni u sukobu revizije",
    "u periodu za izdavaoca nema faktura van talasa",
  ].sort());
});
