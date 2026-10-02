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

test("nastavak tabele sa prekinutom numeracijom ide u unsupported_requires_sample", async () => {
  /*
   * Strana 2 počinje numeraciju ispočetka — to nije jedna tabela, pa parser
   * ne spaja strane. Dokument ostaje vidljiv kancelariji.
   */
  const doc = await parse("nastavak-tabele.pdf");
  assert.equal(doc.validationStatus, "unsupported_requires_sample");
  assert.match(doc.validationDetail ?? "", /nastavlja/);
});

test("nastavak tabele sa neprekidnom numeracijom: stavke sa obe strane, zbir se slaže", async () => {
  // Oblik izmeren nad stvarnim višestraničnim fakturama (sintetičke vrednosti).
  const doc = await parse("nastavak-tabele-neprekidno.pdf");
  assert.equal(doc.validationStatus, "valid");
  assert.equal(doc.lines.length, 3);
  assert.deepEqual(doc.lines.map((l) => l.lineNumber), [1, 2, 3]);
  assert.equal(doc.totals.ok, true);
});

test("negativne stavke (povrat pod naslovom fakture) nikad ne postaju faktura", async () => {
  const doc = await parse("negativne-stavke.pdf");
  assert.equal(doc.validationStatus, "unsupported_requires_sample");
  assert.match(doc.validationDetail ?? "", /negativne/);
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

test("H-4: neispravan, skracen ili polyglot fajl je ISHOD, ne izuzetak", async () => {
  const enc = new TextEncoder();
  const dobar = new Uint8Array(await readFile(FIXTURE("jedna-stavka.pdf")));

  /*
   * Pre popravke je svaki od ovih ulaza bacao iz citaca. Kako je grupni uvoz
   * obradjivao fajlove u petlji, jedan los dokument je obarao ceo prolaz i
   * operater nije dobijao izvestaj ni o onima koji su prosli.
   */
  const slucajevi: [string, Uint8Array][] = [
    ["prazan fajl", new Uint8Array(0)],
    ["obican tekst", enc.encode("ovo nije pdf")],
    ["zaglavlje pa smece", enc.encode("%PDF-1.7\n" + "A".repeat(500))],
    ["skracen validan PDF", dobar.slice(0, Math.floor(dobar.length / 2))],
    ["polyglot ZIP+PDF", new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...dobar])],
  ];

  for (const [ime, bytes] of slucajevi) {
    const out = await parseBiznisoftPdf(bytes);
    assert.equal(out.validationStatus, "unparsable", `${ime}: pogresan status`);
    assert.equal(out.lines.length, 0, `${ime}: nastale su stavke`);

    // Poruka ne sme nositi sirov tekst dokumenta ni tehnicki trag.
    const detalj = out.validationDetail ?? "";
    assert.ok(detalj.length > 0 && detalj.length < 200, `${ime}: poruka nije kratka`);
    for (const zabranjeno of ["Error", "at ", "/Users/", "node_modules", "stack"]) {
      assert.ok(!detalj.includes(zabranjeno), `${ime}: poruka nosi tehnicki trag`);
    }
  }
});

test("H-3: dokument preko granice obima ide u unsupported_requires_sample", async () => {
  const { MAX_PAGES } = await import("@/lib/pdf/biznisoftLayout.mjs");
  const { writePdf } = await import("../../scripts/fixtures/pdf-writer.mjs");

  /*
   * PDF od nekoliko megabajta moze nositi desetine hiljada strana, a citanje
   * raste brze od linearnog. Bez granice jedan fajl zauzme server na minute.
   */
  const strane = Array.from({ length: MAX_PAGES + 1 }, () => [
    { x: 40, y: 700, text: "www.biznisoft.com" },
    { x: 40, y: 680, text: "Racun-otpremnica" },
  ]);
  const poceo = Date.now();
  const out = await parseBiznisoftPdf(writePdf(strane));

  assert.equal(out.validationStatus, "unsupported_requires_sample");
  assert.equal(out.lines.length, 0, "strane su ipak procitane");
  assert.ok(Date.now() - poceo < 3000, "granica je proverena tek posle citanja");
});
