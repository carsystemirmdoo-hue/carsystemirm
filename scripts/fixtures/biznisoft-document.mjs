/**
 * Sastavljanje jednog BizniSoft dokumenta — čista funkcija, bez upisa na disk.
 *
 * Izdvojeno iz generatora fixtures-a da bi i testovi mogli da naprave dokument
 * u letu. Druga kopija ove geometrije u testu bi se tiho razišla od one po
 * kojoj su fixtures napravljeni, pa bi test i fixture opisivali dva različita
 * formata a oba tvrdila da su BizniSoft.
 *
 * Svaka vrednost koju pozivalac prosledi je IZMIŠLJENA. Ovaj modul ne čita
 * nijedan stvarni dokument i ne zna za njihov sadržaj.
 */
import { writePdf } from "./pdf-writer.mjs";

/**
 * X koordinate kolona — izmerene nad realnim uzorcima, vrednosti izmišljene.
 *
 * Stvarni dokument brojeve DESNO poravnava, pa vrednost počinje levo od
 * izmerene tačke. Generator piše levo poravnato, pa se koordinate rabata i
 * PDV-a razmiču da širi tekst („10,00") ne bi ušao u susednu kolonu. Bez toga
 * fixture pada na proveri koju stvarni dokumenti prolaze — dakle greška bi bila
 * u fixture-u, ne u parseru.
 */
const X = {
  rb: 30, sifra: 50, naziv: 84, barkod: 218, jm: 272,
  kol: 305, cena: 350, rabat: 402, pdv: 445, iznos: 475, vrednost: 515,
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

/**
 * Jedan red stavke; vrednosti se RAČUNAJU, pa fixture nikad ne laže o zbiru.
 *
 * Zaokružuje se PO REDU, pa se zbir dokumenta sabira iz zaokruženih vrednosti —
 * tako radi i stvarna faktura. Sabiranje nezaokruženih vrednosti bi na
 * dokumentu sa više stavki proizvelo zbir koji se ne poklapa sa onim što je
 * odštampano, pa bi fixture lažno padao na proveri.
 */
const round2 = (n) => Math.round(n * 100) / 100;

function line(y, i, it) {
  const neto = round2(it.kol * it.cena * (1 - it.rabat / 100));
  const pdvIznos = round2(neto * (it.pdv / 100));
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

/**
 * `continuationOnPage2`:
 *   - `false`        — bez stavki na strani 2;
 *   - `"prekinuto"`  — strana 2 počinje numeraciju ispočetka (nije jedna tabela);
 *   - `"neprekidno"` — numeracija se nastavlja, a ukupan iznos obuhvata i stranu 2
 *                      (oblik izmeren nad stvarnim višestraničnim fakturama).
 */
const CONTINUATION_ITEM = {
  sifra: "900001", naziv: "NASTAVAK STAVKE", jm: "KOM",
  kol: 1, cena: 100, rabat: 0, pdv: 20,
};

export function document({ broj, partner, datum, items, pages = 1, totalOverride = null,
                    continuationOnPage2 = false }) {
  const cells = [...header(803, { broj, partner, datum }), ...tableHead(574)];
  let y = 558, neto = 0, pdvUk = 0;
  items.forEach((it, i) => {
    const r = line(y, i + 1, it);
    cells.push(...r.cells);
    neto += r.neto; pdvUk += r.pdvIznos;
    y -= 12;
  });
  const continuation = pages === 2 && continuationOnPage2
    ? line(558, continuationOnPage2 === "neprekidno" ? items.length + 1 : 1, CONTINUATION_ITEM)
    : null;
  if (continuation && continuationOnPage2 === "neprekidno") {
    neto += continuation.neto; pdvUk += continuation.pdvIznos;
  }
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
    if (continuation) {
      p2.push(...tableHead(574));
      p2.push(...continuation.cells);
    }
    p2.push({ x: 268, y: 40, text: `Strana 2 od ${pages}` },
            { x: 330, y: 40, text: "www.biznisoft.com" });
    out.push(p2);
  }
  return writePdf(out);
}

