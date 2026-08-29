/**
 * Sintetički BizniSoft fixtures.
 *
 * Svaka vrednost je IZMIŠLJENA. Nijedan naziv, PIB, adresa, šifra, iznos ni
 * broj dokumenta ne potiče iz stvarnog dokumenta. Struktura, geometrija kolona
 * i nazivi kolona prate ono što je revizija dokaza potvrdila nad realnim
 * uzorcima (`docs/b2b/16-biznisoft-pdf-evidence-audit.md`).
 *
 *   npm run fixtures:biznisoft
 */
import { mkdir, writeFile } from "node:fs/promises";
import { writePdf } from "./pdf-writer.mjs";

const OUT = new URL("../../fixtures/dev/biznisoft/", import.meta.url);

/** X koordinate kolona — izmerene nad realnim uzorcima, vrednosti izmišljene. */
const X = {
  rb: 30, sifra: 50, naziv: 84, barkod: 218, jm: 272,
  kol: 318, cena: 379, rabat: 413, pdv: 440, iznos: 482, vrednost: 535,
};

const dec = (n, d = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

function header(y0, { broj, partner, datum }) {
  return [
    { x: 472, y: y0, text: "SINTETICKI IZDAVALAC DOO" },
    { x: 499, y: y0 - 37, text: "PIB: 100000001" },
    { x: 178, y: y0 - 60, text: `Racun-otpremnica br. ${broj}` },
    { x: 297, y: y0 - 127, text: "SINTETICKI KUPAC DOO" },
    { x: 297, y: y0 - 155, text: "11000 Grad, Ulica 1" },
    { x: 297, y: y0 - 166, text: "PIB: 100000002   Mat.br.: 20000002" },
    { x: 478, y: y0 - 116, text: "Sifra partnera:" },
    { x: 542, y: y0 - 116, text: partner },
    { x: 34, y: y0 - 127, text: `Datum izdavanja racuna: ${datum}` },
    { x: 34, y: y0 - 150, text: `Datum prometa dobara: ${datum}` },
  ];
}

function tableHead(y) {
  return [
    { x: X.rb, y, text: "Rb" }, { x: X.sifra, y, text: "Sifra" },
    { x: X.naziv, y, text: "Naziv artikla" }, { x: X.barkod, y, text: "Barkod" },
    { x: X.jm, y, text: "JM" }, { x: 309, y, text: "KOL" },
    { x: 353, y: y + 5, text: "Cena bez" }, { x: 364, y: y - 5, text: "PDV" },
    { x: 405, y: y - 5, text: "Rabat" }, { x: 413, y: y + 5, text: "%" },
    { x: 439, y, text: "PDV" },
    { x: 481, y: y + 5, text: "Iznos" }, { x: 488, y: y - 5, text: "PDV" },
    { x: 513, y: y + 5, text: "Vrednost sa" }, { x: 547, y: y - 5, text: "PDV" },
  ];
}

/** Jedan red stavke; vrednosti se RAČUNAJU, pa fixture nikad ne laže o zbiru. */
function line(y, i, it) {
  const neto = it.kol * it.cena * (1 - it.rabat / 100);
  const pdvIznos = neto * (it.pdv / 100);
  return {
    cells: [
      { x: X.rb, y, text: `${i}.` },
      { x: X.sifra, y, text: it.sifra },
      { x: X.naziv, y, text: it.naziv },
      { x: X.jm, y, text: it.jm },
      { x: X.kol, y, text: dec(it.kol, 3) },
      { x: X.cena, y, text: dec(it.cena) },
      { x: X.rabat, y, text: dec(it.rabat) },
      { x: X.pdv, y, text: `${it.pdv}%` },
      { x: X.iznos, y, text: dec(pdvIznos) },
      { x: X.vrednost, y, text: dec(neto + pdvIznos) },
    ],
    neto, pdvIznos,
  };
}

function document({ broj, partner, datum, items, pages = 1, totalOverride = null,
                    continuationOnPage2 = false }) {
  const cells = [...header(803, { broj, partner, datum }), ...tableHead(574)];
  let y = 558, neto = 0, pdvUk = 0;
  items.forEach((it, i) => {
    const r = line(y, i + 1, it);
    cells.push(...r.cells);
    neto += r.neto; pdvUk += r.pdvIznos;
    y -= 12;
  });
  const ukupno = totalOverride ?? neto + pdvUk;
  cells.push(
    { x: 413, y: y - 20, text: `Ukupan iznos sa PDV:    ${dec(ukupno)}` },
    { x: 58, y: y - 45, text: "Osnovica bez PDV:" }, { x: 169, y: y - 45, text: dec(neto) },
    { x: 88, y: y - 57, text: "Iznos PDV:" }, { x: 174, y: y - 57, text: dec(pdvUk) },
    { x: 268, y: 40, text: `Strana 1 od ${pages}` },
    { x: 330, y: 40, text: "www.biznisoft.com" },
  );

  const out = [cells];
  if (pages === 2) {
    const p2 = [...header(803, { broj, partner, datum })];
    if (continuationOnPage2) {
      p2.push(...tableHead(574));
      const r = line(558, items.length + 1, {
        sifra: "900001", naziv: "NASTAVAK STAVKE", jm: "KOM",
        kol: 1, cena: 100, rabat: 0, pdv: 20,
      });
      p2.push(...r.cells);
    }
    p2.push({ x: 268, y: 40, text: `Strana 2 od ${pages}` },
            { x: 330, y: 40, text: "www.biznisoft.com" });
    out.push(p2);
  }
  return writePdf(out);
}

const ART = (n) => ({
  sifra: String(900000 + n), naziv: `SINTETICKI ARTIKAL ${n}`, jm: n % 2 ? "KOM" : "LIT",
  kol: 1 + n * 0.5, cena: 100 + n * 10, rabat: n % 3 === 0 ? 10 : 0, pdv: n % 4 === 0 ? 10 : 20,
});

const FIXTURES = {
  // Jedna stavka — najprostiji dokazani oblik.
  "jedna-stavka.pdf": document({
    broj: "99-RN900000001", partner: "09001", datum: "01.01.2026", items: [ART(1)],
  }),
  // Više stavki, mešane stope i rabati.
  "vise-stavki.pdf": document({
    broj: "99-RN900000002", partner: "09002", datum: "02.01.2026",
    items: [1, 2, 3, 4, 5, 6, 7].map(ART),
  }),
  // Dvostrani sa PONOVLJENIM zaglavljem i bez stavki na strani 2 — dokazani oblik.
  "dve-strane-ponovljeno-zaglavlje.pdf": document({
    broj: "99-RN900000003", partner: "09003", datum: "03.01.2026",
    items: [1, 2, 3].map(ART), pages: 2,
  }),
  // Vodeća nula u šifri partnera — dokazana osobina.
  "vodeca-nula-partner.pdf": document({
    broj: "99-RN900000004", partner: "00042", datum: "04.01.2026", items: [ART(2)],
  }),
  // Odštampan zbir se NE poklapa sa izračunatim — mora biti odbijen.
  "zbir-se-ne-poklapa.pdf": document({
    broj: "99-RN900000005", partner: "09005", datum: "05.01.2026",
    items: [ART(1), ART(2)], totalOverride: 1,
  }),
  // Tabela se NASTAVLJA na strani 2 — oblik koji realni uzorci NE dokazuju.
  "nastavak-tabele.pdf": document({
    broj: "99-RN900000006", partner: "09006", datum: "06.01.2026",
    items: [ART(1), ART(2)], pages: 2, continuationOnPage2: true,
  }),
  // Bez zaglavlja dokumenta — neupotrebljiv ulaz.
  "neispravan-bez-zaglavlja.pdf": writePdf([[
    { x: 30, y: 700, text: "Ovo nije BizniSoft dokument." },
  ]]),
};

await mkdir(OUT, { recursive: true });
for (const [name, bytes] of Object.entries(FIXTURES)) {
  await writeFile(new URL(name, OUT), bytes);
  console.log(`  ${name}  ${bytes.length} B`);
}
console.log(`\n${Object.keys(FIXTURES).length} sintetickih fixtures u fixtures/dev/biznisoft/`);
