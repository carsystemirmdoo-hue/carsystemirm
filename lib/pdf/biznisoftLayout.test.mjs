import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COLUMNS,
  detectDocumentKind,
  foldDiacritics,
  checkLineArithmetic,
  hasTableContinuation,
  lineNumbersContiguous,
  isDescriptionContinuation,
  isLineRow,
  decimalsOf,
  isoFromSerbianDate,
  looksLikePdf,
  MAX_LINES,
  MAX_PAGES,
  MAX_QUANTITY_DECIMALS,
  parseHeader,
  parseLine,
  PARSER_VERSION,
  parseSerbianNumber,
  toRows,
  validateTotals,
} from "./biznisoftLayout.mjs";

/* -------------------------------------------------------------------------
 * Dijakritici
 * ---------------------------------------------------------------------- */

test("dijakritici se presavijaju na isti kljuc", () => {
  // Ekstrakcija ume da izgubi dijakritik; oznaka mora voditi na isti kljuc.
  assert.equal(foldDiacritics("Šifra"), foldDiacritics("Sifra"));
  assert.equal(foldDiacritics("Račun-otpremnica"), "racun-otpremnica");
  assert.equal(foldDiacritics("Količina"), "kolicina");
  assert.equal(foldDiacritics("Đorđe"), "djordje");
});

/* -------------------------------------------------------------------------
 * Brojevi
 * ---------------------------------------------------------------------- */

test("srpski zapis broja: tacka za hiljade, zarez za decimale", () => {
  assert.equal(parseSerbianNumber("1.234,56"), 1234.56);
  assert.equal(parseSerbianNumber("91,67"), 91.67);
  assert.equal(parseSerbianNumber("15,000"), 15);
  assert.equal(parseSerbianNumber("12.345.678,90"), 12345678.9);
  assert.equal(parseSerbianNumber("20%"), 20);
});

test("negativna vrednost se cita kada je dokument stvarno nosi", () => {
  assert.equal(parseSerbianNumber("-1.234,56"), -1234.56);
});

test("sve sto nije broj daje null, NIKAD nulu", () => {
  /*
   * Nula bi bila najgori mogući ishod: tiho bi postala legitimna cena ili
   * količina, i faktura bi prošla proveru sa izmišljenom vrednošću.
   */
  for (const junk of ["", "  ", "abc", "1,2,3", "12,", "1.23.4", "--5"]) {
    assert.equal(parseSerbianNumber(junk), null, JSON.stringify(junk));
  }
  assert.equal(parseSerbianNumber(1234), null, "broj kao ulaz mora pasti");
  assert.equal(parseSerbianNumber(null), null);
});

test("engleski zapis se NE prihvata tiho", () => {
  // `1,234.56` bi u srpskom zapisu značilo nešto sasvim drugo.
  assert.equal(parseSerbianNumber("1,234.56"), null);
});

/* -------------------------------------------------------------------------
 * Datumi
 * ---------------------------------------------------------------------- */

test("datum se prevodi u ISO i odbija nepostojeci dan", () => {
  assert.equal(isoFromSerbianDate("05.01.2026"), "2026-01-05");
  assert.equal(isoFromSerbianDate("29.02.2024"), "2024-02-29");
  // Bez provere bi `Date` tiho pomerio 31.02. u mart.
  assert.equal(isoFromSerbianDate("31.02.2026"), null);
  assert.equal(isoFromSerbianDate("2026-01-05"), null);
});

/* -------------------------------------------------------------------------
 * Redovi i kolone
 * ---------------------------------------------------------------------- */

const cell = (str, x, y) => ({ str, x, y });

test("elementi se grupisu u redove po Y i u celije po X", () => {
  const rows = toRows([
    cell("1.", 30, 558), cell("006133", 50, 558), cell("ARTIKAL", 84, 558),
    cell("KOM", 270, 558.4), cell("15,000", 318, 558),
    cell("2.", 30, 546), cell("006134", 50, 546),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cells.rb, "1.");
  assert.equal(rows[0].cells.articleCode, "006133");
  assert.equal(rows[0].cells.unit, "KOM");
  // Y se razlikuje za 0.4 — isti red.
  assert.equal(rows[0].cells.quantity, "15,000");
  assert.equal(rows[1].cells.rb, "2.");
});

test("redovi su poredjani od vrha strane nanize", () => {
  const rows = toRows([cell("2.", 30, 500), cell("1.", 30, 550)]);
  assert.deepEqual(rows.map((r) => r.cells.rb), ["1.", "2."]);
});

test("stavka se prepoznaje po rednom broju, ne po sadrzaju", () => {
  assert.equal(isLineRow({ cells: { rb: "7." } }), true);
  assert.equal(isLineRow({ cells: { rb: "Rb" } }), false);
  assert.equal(isLineRow({ cells: {} }), false);
});

test("kolone se ne preklapaju i pokrivaju rastuci opseg", () => {
  for (let i = 1; i < COLUMNS.length; i += 1) {
    assert.ok(
      COLUMNS[i].from >= COLUMNS[i - 1].to,
      `${COLUMNS[i].key} se preklapa sa ${COLUMNS[i - 1].key}`,
    );
  }
});

/* -------------------------------------------------------------------------
 * Aritmetika reda — pravilo izvedeno nad 53/53 stavke stvarnih uzoraka
 * ---------------------------------------------------------------------- */

const line = (over = {}) => ({
  articleCode: "900001", description: "ARTIKAL", unit: "KOM",
  quantity: "2,000", unitPrice: "100,00", discountPercent: "0,00",
  taxPercent: "20%", taxAmount: "40,00", grossAmount: "240,00", ...over,
});

test("ispravan red prolazi", () => {
  const parsed = parseLine(line());
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.netAmount, 200);
});

test("rabat ulazi u neto pre poreza", () => {
  // 2 x 100 x 0,9 = 180; PDV 20% = 36; ukupno 216.
  const parsed = parseLine(line({
    discountPercent: "10,00", taxAmount: "36,00", grossAmount: "216,00",
  }));
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.netAmount, 180);
});

test("decimalna kolicina se postuje", () => {
  const parsed = parseLine(line({
    quantity: "1,500", taxAmount: "30,00", grossAmount: "180,00",
  }));
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.netAmount, 150);
});

test("neslaganje iznosa se prijavljuje, red se ne 'popravlja'", () => {
  const parsed = parseLine(line({ grossAmount: "999,00" }));
  assert.match(parsed.status, /^arithmetic:/);
  assert.match(parsed.status, /grossAmount/);
});

test("nedostajuce polje daje missing, ne nulu", () => {
  const parsed = parseLine(line({ taxPercent: "" }));
  assert.match(parsed.status, /^missing:/);
  assert.match(parsed.status, /taxPercent/);
  assert.equal(parsed.netAmount, null);
});

test("sifra artikla ostaje TEKST sa vodecim nulama", () => {
  const parsed = parseLine(line({ articleCode: "006133" }));
  assert.equal(parsed.articleCode, "006133");
  assert.notEqual(parsed.articleCode, 6133);
});

/* -------------------------------------------------------------------------
 * Tip dokumenta — bez nagađanja
 * ---------------------------------------------------------------------- */

test("prodajna faktura se prepoznaje iz naslova", () => {
  assert.deepEqual(detectDocumentKind("Račun-otpremnica br. 01-RN1"),
    { kind: "faktura", supported: true });
});

test("storno, povrat i korekcija se NE nagadjaju", () => {
  /*
   * Nijedan stvaran uzorak ne postoji za te tipove. Svako pravilo koje bi ih
   * prepoznalo bilo bi izmišljen format, a posledica bi bila da storno tiho
   * udje u promet kao prodaja.
   */
  for (const naslov of [
    "Storno racuna br. 1", "Povrat robe", "Knjizno odobrenje", "Korekcija cene",
  ]) {
    const result = detectDocumentKind(naslov);
    assert.equal(result.supported, false, naslov);
    assert.equal(result.kind, "nepoznato", naslov);
  }
});

/* -------------------------------------------------------------------------
 * Nastavak tabele — oblik koji uzorci ne dokazuju
 * ---------------------------------------------------------------------- */

test("stavke samo na prvoj strani nisu nastavak", () => {
  assert.equal(hasTableContinuation([
    { rows: [{ cells: { rb: "1." } }] },
    { rows: [{ cells: { rb: "Rb" } }] },
  ]), false);
});

test("stavka na drugoj strani JESTE nastavak i mora se prijaviti", () => {
  assert.equal(hasTableContinuation([
    { rows: [{ cells: { rb: "1." } }] },
    { rows: [{ cells: { rb: "2." } }] },
  ]), true);
});

/* -------------------------------------------------------------------------
 * Zaglavlje
 * ---------------------------------------------------------------------- */

const HEADER_TEXT = [
  "Racun-otpremnica br. 01-RN000000123",
  "PIB: 100000001",
  "PIB: 100000002",
  "Sifra partnera: 00042",
  "Datum izdavanja racuna: 05.01.2026",
  "Ukupan iznos sa PDV:    1.234,56",
  "www.biznisoft.com",
].join("\n");

test("zaglavlje daje broj, sifru partnera, datum i zbir", () => {
  const h = parseHeader(HEADER_TEXT);
  assert.equal(h.documentNumber.value, "01-RN000000123");
  assert.equal(h.partnerCode.value, "00042");
  assert.equal(h.documentDate.value, "2026-01-05");
  assert.equal(h.printedGrossTotal.value, 1234.56);
  assert.equal(h.isBiznisoft, true);
});

test("sifra partnera ostaje TEKST — vodeca nula je deo vrednosti", () => {
  const h = parseHeader(HEADER_TEXT);
  assert.equal(typeof h.partnerCode.value, "string");
  assert.equal(h.partnerCode.value, "00042");
});

test("sifra partnera se cita i kada oznaka stoji POSLE vrednosti", () => {
  // Redosled crtanja u PDF-u ume da obrne oznaku i vrednost.
  const h = parseHeader("00042 Šifra partnera:\nwww.biznisoft.com");
  assert.equal(h.partnerCode.value, "00042");
});

test("oznaka koja sledi posle oznake šifre partnera nije šifra — vrednost stoji ispred", () => {
  // Raspored iz stvarnih faktura: vrednost, oznaka, pa odmah sledeća oznaka.
  const h = parseHeader("Kupac: PRIMER DOO  00042 Šifra partnera:  Plaćanje: VIRMANSKI Rok: 0");
  assert.equal(h.partnerCode.value, "00042");
  const bezDijakritika = parseHeader("00042 Šifra partnera:  Placanje: VIRMANSKI");
  assert.equal(bezDijakritika.partnerCode.value, "00042");
});

test("šifra posle oznake se i dalje čita kada nije praćena dvotačkom", () => {
  const h = parseHeader("Šifra partnera: 00042 Kupac");
  assert.equal(h.partnerCode.value, "00042");
});

test("PIB kupca je DRUGI PIB — prvi pripada izdavaocu", () => {
  const h = parseHeader(HEADER_TEXT);
  assert.equal(h.issuerPib.value, "100000001");
  assert.equal(h.customerPib.value, "100000002");
});

test("svako polje nosi i sirovi tekst i status", () => {
  const h = parseHeader(HEADER_TEXT);
  assert.equal(h.documentDate.raw, "05.01.2026");
  assert.equal(h.documentDate.status, "ok");
  const prazno = parseHeader("www.biznisoft.com");
  assert.equal(prazno.documentNumber.status, "missing");
  assert.equal(prazno.documentNumber.value, null);
});

/* -------------------------------------------------------------------------
 * Zbir dokumenta
 * ---------------------------------------------------------------------- */

test("zbir odstampanih redova mora dati odstampan ukupan iznos", () => {
  const lines = [{ grossAmount: 240 }, { grossAmount: 216 }];
  assert.equal(validateTotals(lines, 456).ok, true);
});

test("neslaganje zbira se prijavljuje", () => {
  const result = validateTotals([{ grossAmount: 240 }], 999);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "totals_mismatch");
});

test("bez odstampanog zbira dokument ne prolazi", () => {
  const result = validateTotals([{ grossAmount: 240 }], null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "printed_total_missing");
});

test("tolerancija raste sa brojem stavki, ali ostaje u parama", () => {
  // 13 stavki x 1 para zaokruženja mora proći; deset dinara ne sme.
  const many = Array.from({ length: 13 }, () => ({ grossAmount: 100 }));
  assert.equal(validateTotals(many, 1300.1).ok, true);
  assert.equal(validateTotals(many, 1310).ok, false);
});

/* -------------------------------------------------------------------------
 * Verzija parsera
 * ---------------------------------------------------------------------- */

test("verzija parsera je zapisana i nije prazna", async () => {
  assert.match(PARSER_VERSION, /^biznisoft-pdf-\d+$/);
  // Verzija se upisuje uz svaki dokument; bez nje se posle izmene pravila ne
  // moze odgovoriti koji su dokumenti citani starim parserom.
  // Implementacija je u `parseDocument.ts`; `extract.ts` je samo serverski
  // omotac nad njom. Tvrdnja je nepromenjena — gleda fajl u kome kod stvarno
  // stoji.
  const source = await readFile(new URL("./parseDocument.ts", import.meta.url), "utf8");
  assert.match(source, /parserVersion: PARSER_VERSION/);
});

test("serverski omotac ne nosi logiku, a cist modul ne nosi server-only", async () => {
  /*
   * Granica na koju se oslanja lokalni (Windows) ulaz.
   *
   * `parseDocument.ts` mora ostati uvozljiv van servera; cim u njega udje
   * `server-only`, lokalni adapter puca tek pri pokretanju, i to porukom koja
   * ne kaze zasto. Obrnuto, `extract.ts` mora zadrzati `server-only`, inace
   * postojeci serverski pozivaoci tiho gube granicu koju su imali.
   */
  const cist = await readFile(new URL("./parseDocument.ts", import.meta.url), "utf8");
  // Gleda se IZJAVA na pocetku reda, ne pominjanje: objasnjenje u komentaru
  // legitimno sadrzi isti niz znakova.
  assert.doesNotMatch(cist, /^import "server-only";/m);
  assert.doesNotMatch(cist, /from "next\//);
  assert.doesNotMatch(cist, /@\/db\//);
  assert.doesNotMatch(cist, /@\/auth/);

  const omotac = await readFile(new URL("./extract.ts", import.meta.url), "utf8");
  assert.match(omotac, /^import "server-only";/m);
});

test("looksLikePdf trazi %PDF- na SAMOM pocetku", () => {
  const enc = new TextEncoder();
  assert.equal(looksLikePdf(enc.encode("%PDF-1.7\n...")), true);
  assert.equal(looksLikePdf(enc.encode("obican tekst")), false);
  assert.equal(looksLikePdf(new Uint8Array(0)), false);
  assert.equal(looksLikePdf(new Uint8Array([0x25, 0x50])), false, "prekratko je proslo");

  /*
   * Polyglot: tudje zaglavlje pa PDF telo.
   *
   * Citaci ovo tolerisu, mi ne. Fajl sa ZIP zaglavljem pa PDF-om je uvek
   * neciji trik, nikad BizniSoft izvoz.
   */
  const polyglot = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc.encode("%PDF-1.7")]);
  assert.equal(looksLikePdf(polyglot), false, "polyglot je prosao kao PDF");
});

test("granice obima su iznad svega sto stvarni uzorci pokazuju", () => {
  /*
   * Najveci stvaran uzorak ima 2 strane i 13 stavki. Granica koja bi zaustavila
   * stvaran dokument bila bi vest sama po sebi, pa mora ostati daleko iznad.
   */
  assert.ok(MAX_PAGES >= 20, "granica strana je preblizu stvarnim dokumentima");
  assert.ok(MAX_LINES >= 200, "granica stavki je preblizu stvarnim dokumentima");
});

test("decimalsOf broji decimale iz SIROVOG zapisa, ne iz procitanog broja", () => {
  /*
   * `parseSerbianNumber` vraca `number`, a on vise ne pamti koliko je decimala
   * pisalo: 1,5000 i 1,5 daju isti broj. Zato se broji nad tekstom.
   */
  assert.equal(decimalsOf("1,5"), 1);
  assert.equal(decimalsOf("1,500"), 3);
  assert.equal(decimalsOf("1,5000"), 4);
  assert.equal(decimalsOf("1.234,56"), 2);
  assert.equal(decimalsOf("12"), 0);
  assert.equal(decimalsOf(null), 0);
  assert.equal(decimalsOf(undefined), 0);
});

test("parseLine prijavljuje kolicinu precizniju nego sto baza cuva", () => {
  const cells = {
    rb: "1", articleCode: "900001", description: "Test", unit: "KOM",
    quantity: "1,5000", unitPrice: "100,00", discountPercent: "0,00",
    taxPercent: "20,00", taxAmount: "30,00", grossAmount: "180,00",
  };
  const line = parseLine(cells);
  assert.equal(line.quantityDecimals, 4);
  assert.ok(line.quantityDecimals > MAX_QUANTITY_DECIMALS);

  // Tri decimale su u granici koju kolona `numeric(14,3)` cuva bez gubitka.
  assert.equal(parseLine({ ...cells, quantity: "1,500" }).quantityDecimals, 3);
});

/* -------------------------------------------------------------------------
 * Oblici izmereni nad stvarnim fakturama (2026-10) — sintetičke vrednosti
 * ---------------------------------------------------------------------- */

test("raspored bez barkoda: redni broj levo od x=25 je stavka", () => {
  const [row] = toRows([
    { str: "1.", x: 22, y: 500 }, { str: "900001", x: 45, y: 500 },
    { str: "SINTETICKI ARTIKAL", x: 80, y: 500 },
  ]);
  assert.equal(isLineRow(row), true);
});

test("raspored bez barkoda: rabat i stopa PDV-a u jednom elementu se dele", () => {
  const line = parseLine({
    rb: "1.", articleCode: "900001", description: "SINTETICKI", unit: "KOM",
    quantity: "2,00", unitPrice: "100,00", discountPercent: "10,00 20%",
    taxAmount: "36,00", grossAmount: "216,00",
  });
  assert.equal(line.discountPercent, 10);
  assert.equal(line.taxPercent, 20);
  assert.equal(line.status, "ok");
});

test("pogrešna podela rabata i PDV-a ne prolazi — presuđuje aritmetika", () => {
  // Isti element, ali iznosi odgovaraju obrnutom redosledu: mora pasti.
  const line = parseLine({
    rb: "1.", articleCode: "900001", quantity: "2,00", unitPrice: "100,00",
    discountPercent: "20,00 10%", taxAmount: "36,00", grossAmount: "216,00",
  });
  assert.notEqual(line.status, "ok");
});

test("nastavak naziva u koloni barkoda se ne gubi; cifre ostaju barkod", () => {
  const sa = parseLine({ rb: "1.", articleCode: "900001", description: "DUG NAZIV", barcode: "NASTAVAK",
    quantity: "1,00", unitPrice: "100,00", taxPercent: "20%", taxAmount: "20,00", grossAmount: "120,00" });
  assert.equal(sa.description, "DUG NAZIV NASTAVAK");
  const bez = parseLine({ rb: "1.", articleCode: "900001", description: "NAZIV", barcode: "8600000000001",
    quantity: "1,00", unitPrice: "100,00", taxPercent: "20%", taxAmount: "20,00", grossAmount: "120,00" });
  assert.equal(bez.description, "NAZIV");
});

test("ukupan iznos pod oznakom Vrednost sa PDV samo kada je jedinstvena", () => {
  assert.equal(parseHeader("Vrednost sa PDV: 1.234,56 www.biznisoft.com").printedGrossTotal.value, 1234.56);
  // Dve pojave = rekapitulacija po stopama; ne bira se nijedna.
  const dve = parseHeader("Vrednost sa PDV: 100,00 Vrednost sa PDV: 200,00");
  assert.equal(dve.printedGrossTotal.status, "missing");
  // Glavna oznaka ima prednost.
  const obe = parseHeader("Ukupan iznos sa PDV: 300,00 Vrednost sa PDV: 100,00");
  assert.equal(obe.printedGrossTotal.value, 300);
});

test("zaokruživanje kao BizniSoft: osnovica, pa rabat zasebno", () => {
  // 1,5 × 10,00 = 15,00; rabat 12,5 % = 1,875 → 1,88; neto 13,12; PDV 2,62.
  // Jedno zaokruživanje na kraju: neto 13,13, PDV 2,63, bruto 15,76.
  const ok = checkLineArithmetic({ quantity: 1.5, unitPrice: 10, discountPercent: 12.5,
    taxPercent: 20, taxAmount: 2.62, grossAmount: 15.74 });
  assert.deepEqual(ok, { netAmount: 13.12, off: [] });
  const staro = checkLineArithmetic({ quantity: 1.5, unitPrice: 10, discountPercent: 12.5,
    taxPercent: 20, taxAmount: 2.63, grossAmount: 15.76 });
  assert.deepEqual(staro.off, ["grossAmount"]);
});

test("polovina pare kao BizniSoft: binarni zapis, od nule", () => {
  // 0,25 × 7.879,00 = 1.969,75; rabat 30 % = 590,925 u decimalnom, ali
  // 590,9249… u binarnom → 590,92; neto 1.378,83, PDV 275,77, bruto 1.654,60.
  const ok = checkLineArithmetic({ quantity: 0.25, unitPrice: 7879, discountPercent: 30,
    taxPercent: 20, taxAmount: 275.77, grossAmount: 1654.6 });
  assert.deepEqual(ok, { netAmount: 1378.83, off: [] });
  // Decimalno zaokruživanje polovine dalo bi 590,93 → bruto 1.654,58: ne prolazi.
  const decimalno = checkLineArithmetic({ quantity: 0.25, unitPrice: 7879, discountPercent: 30,
    taxPercent: 20, taxAmount: 275.76, grossAmount: 1654.58 });
  assert.deepEqual(decimalno.off, ["grossAmount"]);
});

test("nastavak tabele: prihvata se samo neprekidna numeracija 1…N", () => {
  const strana = (...rb) => ({ rows: rb.map((n) => ({ cells: { rb: `${n}.` } })) });
  assert.equal(lineNumbersContiguous([strana(1, 2), strana(3)]), true);
  assert.equal(lineNumbersContiguous([strana(1, 2), strana(1)]), false);
  assert.equal(lineNumbersContiguous([strana(1, 2), strana(4)]), false);
  assert.equal(lineNumbersContiguous([strana(1, 2), strana(2)]), false);
  assert.equal(lineNumbersContiguous([strana(), strana()]), false);
});

test("raspored bez barkoda: prva reč naziva ne lepi se uz šifru", () => {
  // Naziv počinje na x≈78; sa granicom 80 davao je šifru „900001CF".
  const [row] = toRows([
    { str: "1.", x: 22, y: 500 }, { str: "900001", x: 47, y: 500 },
    { str: "CF SINTETICKI ARTIKAL", x: 78.4, y: 500 },
  ]);
  assert.equal(row.cells.articleCode, "900001");
  assert.equal(row.cells.description, "CF SINTETICKI ARTIKAL");
});

test("prelomljen naziv: red sa samo nazivom neposredno ispod stavke je nastavak", () => {
  const ispod = { y: 490, cells: { description: "NASTAVAK 2,5L" } };
  assert.equal(isDescriptionContinuation(ispod, 500), true);
  // Predaleko, iznad, ili sa drugim kolonama (zbir, nova stavka) — nije nastavak.
  assert.equal(isDescriptionContinuation({ y: 480, cells: { description: "X" } }, 500), false);
  assert.equal(isDescriptionContinuation({ y: 510, cells: { description: "X" } }, 500), false);
  assert.equal(isDescriptionContinuation({ y: 490, cells: { description: "Ukupno:", grossAmount: "1,00" } }, 500), false);
  assert.equal(isDescriptionContinuation({ y: 490, cells: { description: "  " } }, 500), false);
});


test("stavka 100+: redni broj bez tačke (tačka prelazi u sledeći red)", () => {
  assert.equal(isLineRow({ cells: { rb: "100" } }), true);
  assert.equal(isLineRow({ cells: { rb: "100." } }), true);
  // Kraći broj bez tačke nije redni broj.
  assert.equal(isLineRow({ cells: { rb: "12" } }), false);
  // Red sa samom tačkom i nastavkom naziva je nastavak, ne nova stavka.
  assert.equal(isDescriptionContinuation({ y: 490, cells: { rb: ".", description: "NASTAVAK" } }, 500), true);
  assert.equal(isLineRow({ cells: { rb: "." } }), false);
});

test("storno: veliki negativan iznos PDV-a slepljen sa stopom se deli", () => {
  const line = parseLine({
    rb: "1.", articleCode: "900001", quantity: "-2,000", unitPrice: "100,00",
    discountPercent: "0,00", taxPercent: "20%-40,00", grossAmount: "-240,00",
  });
  assert.equal(line.taxPercent, 20);
  assert.equal(line.taxAmount, -40);
  assert.equal(line.status, "ok");
  // Pozitivan broj posle stope se ne dira (taj oblik nije izmeren).
  const poz = parseLine({ rb: "1.", articleCode: "900001", quantity: "2,000", unitPrice: "100,00",
    taxPercent: "20%40,00", grossAmount: "240,00" });
  assert.notEqual(poz.status, "ok");
});
