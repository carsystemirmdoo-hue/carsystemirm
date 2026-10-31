/**
 * SATA dokumenti — identitet fajla i čitanje sadržaja (bez mreže).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { detectLanguages, documentKeyOf, fileOf, kindEvidenceOf, languageLabelOf, modelEvidenceOf, pdfLinksOf } from "./lib/documents.mjs";

test("identitet dokumenta preživljava promenu adrese (heš i ?ts=)", () => {
  const before = "https://www.sata.com/media/f8/bf/63/1790259018/BETRIEBSANLEITUNG-SATA-ADAM-2.PDF.PDF?ts=1790259018";
  const after = "https://www.sata.com/media/79/00/67/1793362241/BETRIEBSANLEITUNG-SATA-ADAM-2.PDF.PDF?ts=1793362241";
  assert.equal(documentKeyOf(fileOf(before)), "BETRIEBSANLEITUNG-SATA-ADAM-2");
  assert.equal(documentKeyOf(fileOf(before)), documentKeyOf(fileOf(after)));
});

test("adrese PDF-a sa stranice porodice: relativne postaju apsolutne, &amp; se dekodira", () => {
  const html = '<a href="/media/aa/1/X.PDF.PDF?ts=1&amp;y=2">x</a><a href="https://www.sata.com/media/b/Y.pdf">y</a><a href="/en/x">z</a>';
  assert.deepEqual(pdfLinksOf(html), ["https://www.sata.com/media/aa/1/X.PDF.PDF?ts=1&y=2", "https://www.sata.com/media/b/Y.pdf"]);
});

test("jezik iz sadržaja: naslovi na više jezika → višejezično; jedan jezik ostaje jedan", () => {
  const multi = "EU Declaration of Conformity | EU-Konformitätserklärung | Déclaration de conformité UE | Dichiarazione di conformità UE";
  assert.equal(languageLabelOf(detectLanguages(multi)), "multilingual");
  const english = "This product must be used with the operating instructions and the declaration. ".repeat(10);
  assert.equal(languageLabelOf(detectLanguages(english)), "en");
  assert.equal(languageLabelOf([]), null);
});

test("vrsta i model se potvrđuju iz teksta", () => {
  assert.ok(kindEvidenceOf("declaration", "EC Declaration of Conformity SATA filter 100 prep"));
  assert.ok(!kindEvidenceOf("declaration", "Operating instructions SATA adam 2"));
  assert.ok(kindEvidenceOf("manual", "Betriebsanleitung SATA adam 2"));
  // Porodica „SATA filter series 100“ — izjava imenuje model „SATA filter 100 prep“.
  assert.ok(modelEvidenceOf({ officialName: "SATA filter series 100", file: "EG-KONFORMITATSERKLARUNG-SATA-FILTER-100-PREP.PDF.PDF" }, "Typbezeichnung: SATA filter 100 prep"));
  assert.equal(modelEvidenceOf({ officialName: "SATA adam 2", file: "BETRIEBSANLEITUNG-SATA-ADAM-2.PDF.PDF" }, "SATAjet X 5500 Betriebsanleitung"), null);
});
