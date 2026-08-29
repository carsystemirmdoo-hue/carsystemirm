import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileHashOf, parseBiznisoftPdf } from "@/lib/pdf/extract";

/**
 * Parser nad SINTETICKIM fixtures.
 *
 * Ne trazi bazu — stoji u `db/integration/` samo zato sto taj tsconfig stubuje
 * `server-only`, pa se produkcijski modul moze uvesti u test proces. Stvarni
 * PDF-ovi se ovde NE koriste i nikada ne ulaze u repozitorijum; oni se
 * proveravaju lokalnim acceptance prolazom.
 */

const FIXTURE = (name: string) =>
  new URL(`../../fixtures/dev/biznisoft/${name}`, import.meta.url);

async function parse(name: string) {
  return parseBiznisoftPdf(new Uint8Array(await readFile(FIXTURE(name))));
}

test("jedna stavka: procitana, zbir se slaze", async () => {
  const doc = await parse("jedna-stavka.pdf");
  assert.equal(doc.validationStatus, "valid");
  assert.equal(doc.lines.length, 1);
  assert.equal(doc.totals.ok, true);
  assert.equal(doc.documentKind, "faktura");
});

test("vise stavki: mesane poreske stope i rabati prolaze", async () => {
  const doc = await parse("vise-stavki.pdf");
  assert.equal(doc.validationStatus, "valid");
  assert.equal(doc.lines.length, 7);
  assert.ok(doc.lines.every((l) => l.status === "ok"));
  // Dokazuje da rabat i vise stopa ne obaraju proveru.
  assert.ok(new Set(doc.lines.map((l) => l.taxPercent)).size > 1);
  assert.ok(doc.lines.some((l) => (l.discountPercent ?? 0) > 0));
});

test("dve strane sa ponovljenim zaglavljem su VALIDNE", async () => {
  // Dokazani oblik: sve stavke na strani 1, strana 2 je ponovljeno zaglavlje.
  const doc = await parse("dve-strane-ponovljeno-zaglavlje.pdf");
  assert.equal(doc.pageCount, 2);
  assert.equal(doc.validationStatus, "valid");
  assert.equal(doc.lines.length, 3);
});

test("vodeca nula u sifri partnera se cuva kao TEKST", async () => {
  const doc = await parse("vodeca-nula-partner.pdf");
  assert.equal(doc.validationStatus, "valid");
  assert.equal(doc.header.partnerCode.value, "00042");
  assert.equal(typeof doc.header.partnerCode.value, "string");
});

test("neuskladjen zbir NIKAD tiho ne postaje validna faktura", async () => {
  const doc = await parse("zbir-se-ne-poklapa.pdf");
  assert.equal(doc.validationStatus, "totals_mismatch");
  assert.equal(doc.totals.ok, false);
  // Poruka ne sme nositi iznose — detalj se cita sa ekrana, ne iz loga.
  assert.ok(!/\d{3}/.test(doc.validationDetail ?? ""));
});

test("nastavak tabele ide u unsupported_requires_sample", async () => {
  /*
   * Nijedan stvaran uzorak ne dokazuje taj oblik, pa parser ne pokusava
   * spajanje. Dokument ostaje vidljiv kancelariji.
   */
  const doc = await parse("nastavak-tabele.pdf");
  assert.equal(doc.validationStatus, "unsupported_requires_sample");
  assert.match(doc.validationDetail ?? "", /nastavlja/);
});

test("dokument koji nije BizniSoft je unparsable", async () => {
  const doc = await parse("neispravan-bez-zaglavlja.pdf");
  assert.equal(doc.validationStatus, "unparsable");
  assert.equal(doc.lines.length, 0);
});

test("otisak fajla je stabilan i razlikuje razlicite fajlove", async () => {
  const a = new Uint8Array(await readFile(FIXTURE("jedna-stavka.pdf")));
  const b = new Uint8Array(await readFile(FIXTURE("vise-stavki.pdf")));
  assert.equal(fileHashOf(a), fileHashOf(a));
  assert.notEqual(fileHashOf(a), fileHashOf(b));
  assert.match(fileHashOf(a), /^[0-9a-f]{64}$/);
});

test("verzija parsera se prenosi u rezultat", async () => {
  const doc = await parse("jedna-stavka.pdf");
  assert.match(doc.parserVersion, /^biznisoft-pdf-\d+$/);
});
