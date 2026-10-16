/**
 * Sintetički BizniSoft PDF „ZBIRNI PREGLED PO ARTIKLIMA“ (dok. 65 §1b) — isti sadržaj kao
 * `stanje-zaliha-sinteticki.{csv,xlsx}` (05.09.2026, 021 VELEPRODAJA), raspoređen kao stvaran
 * izvoz: šifra x 21,7 (sa vodećim nulama), naziv 61,4, brojevi desno poravnati u kolonama Ulaz,
 * Izlaz, Stanje, Duguje, Potražuje, Saldo; dve strane, ponovljeno zaglavlje, ZBIRNI PODACI.
 * Tekstualni PDF bez spoljnih biblioteka (Helvetica, WinAnsi). Stvaran izvoz ostaje privatno.
 *
 *   node scripts/fixtures/build-stock-pdf-fixture.mjs
 */
import { writeFileSync } from "node:fs";

const OUT = new URL("../../fixtures/dev/biznisoft/lager/zbirni-pregled-sinteticki.pdf", import.meta.url);
// [šifra, naziv, ulaz, izlaz] → stanje = ulaz − izlaz (isto kao CSV/XLSX fixture).
const ROWS = [
  ["900001", "SINT BAZA SREBRNA 1 L", 20, 8],
  ["900002", "SINT LAK HS 5 L", 10, 2.5],
  ["900003", "SINT HERTER 2,5 L", 5, 2.5],
  ["900004", "SINT KIT 1 KG", 4, 4],
  ["900005", "SINT BRUSNI DISK P120", 300, 70],
  ["900006", "SINT TRAKA 19 MM", 60, 12],
  ["000012", "SINT STARA SIFRA SA NULAMA", 3, 0],
  ["900008", "SINT CISTAC DJAK ZUTI", 2.5, 1.25],
  ["900009", "SINT RUKAVICE NITRIL", 4, 0],
  ["900010", "SINT PISTOLJ", 1, 0],
];
const SIZE = 7;
// Helvetica širine (1/1000 em) za znakove koji se javljaju u brojevima.
const W = { "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ",": 278, ".": 278, "-": 333 };
const width = (s) => [...s].reduce((a, ch) => a + (W[ch] ?? 556), 0) * SIZE / 1000;
const fmt = (v) => {
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
};
const RIGHT = [290, 342, 396, 456, 515, 575];
const HEAD = [["Šifra", 21.7], ["Naziv artikla", 61.4], ["Ulaz", 268.5], ["Izlaz", 319.9], ["Stanje", 366.5], ["Duguje", 422.6], ["Potražuje", 471.1], ["Saldo", 549.3]];

// WinAnsi: š/Š/ž/Ž postoje; ostalo ASCII.
const enc = (s) => [...s].map((ch) => ({ "Š": "\\212", "š": "\\232", "Ž": "\\216", "ž": "\\236" })[ch] ?? (ch === "(" || ch === ")" || ch === "\\" ? `\\${ch}` : ch)).join("");
const txt = (s, x, y) => `BT /F1 ${SIZE} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${enc(s)}) Tj ET`;
const nums = (y, vals) => vals.map((v, k) => { const s = fmt(v); return txt(s, RIGHT[k] - width(s), y); });

function pageOps(n, of, rows, first, last, totals) {
  const ops = [txt("Datum štampe: 05.09.2026", 477.4, 814), txt("CAR SYSTEM SINT", 21.7, 813), txt("ZBIRNI PREGLED PO ARTIKLIMA", 21.7, 786)];
  let y = 753;
  if (first) {
    ops.push(txt("Period:", 50.5, 764), txt("01.01.2026-05.09.2026", 86.9, 764), txt("Vrsta cene: Veleprodajna", 86.9, 753), txt("Filteri:", 53.1, 741), txt("Poslovni objekti: 021 VELEPRODAJA", 86.9, 741));
    y = 717;
  }
  for (const [h, x] of HEAD) ops.push(txt(h, x, y));
  y -= 12;
  if (first) {
    ops.push(txt("Prethodno stanje:", 180, y), ...nums(y, [0, 0, 0, 0, 0, 0]));
    y -= 13;
  }
  for (const [code, name, ulaz, izlaz] of rows) {
    const fin = Math.round(ulaz * 1000) / 10;
    ops.push(txt(code, 21.7, y), txt(name, 61.4, y), ...nums(y + 1, [ulaz, izlaz, ulaz - izlaz, fin, fin / 2, fin / 2]));
    y -= 12.6;
  }
  if (last) {
    ops.push(txt("ZBIRNI PODACI", 21.7, 201), txt("Ukupno ulaz (KOM):", 60.6, 185), txt(fmt(totals[0]), 179.9, 185), txt("Ukupno izlaz (KOM):", 59.7, 172), txt(fmt(totals[1]), 179.9, 172), txt("Stanje (KOM):", 81.8, 160), txt(fmt(totals[2]), 184.9, 160));
  }
  ops.push(txt(`Strana ${n} od ${of}`, 273.2, 26));
  return ops.join("\n");
}

const totals = [ROWS.reduce((a, r) => a + r[2], 0), ROWS.reduce((a, r) => a + r[3], 0), ROWS.reduce((a, r) => a + r[2] - r[3], 0)];
const pages = [pageOps(1, 2, ROWS.slice(0, 6), true, false), pageOps(2, 2, ROWS.slice(6), false, true, totals)];

// Minimalan PDF 1.4: katalog, stabla strana, font, po jedna strana i sadržaj.
const objs = [];
const add = (s) => (objs.push(s), objs.length);
const catalog = add("");
const pagesObj = add("");
const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const kids = [];
for (const ops of pages) {
  const stream = Buffer.from(ops, "latin1");
  const content = add(`<< /Length ${stream.length} >>\nstream\n${ops}\nendstream`);
  kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
}
objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
let out = "%PDF-1.4\n";
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(Buffer.byteLength(out, "latin1"));
  out += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(out, "latin1");
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(OUT, Buffer.from(out, "latin1"));
console.log(`napisano: ${OUT.pathname} (${pages.length} strane, ${ROWS.length} artikala)`);
