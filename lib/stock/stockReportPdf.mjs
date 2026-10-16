/**
 * BizniSoft PDF „ZBIRNI PREGLED PO ARTIKLIMA“ → stavke lagera (dok. 65 §1b).
 *
 * Čista logika nad tekstom sa koordinatama (izvlači ga `readStockFile`). Izvedeno iz stvarnog
 * izvoza od 15. 10. 2026 (25 strana, 1.269 artikala), uporedo sa XLSX „STANJE ZALIHA ARTIKLA“ istog
 * dana: iste količine za svih 1.269 šifara; XLSX dodatno navodi 541 artikal sa stanjem 0 (bez prometa
 * u periodu — PDF ih ne navodi, pa izostavljen artikal NIJE nula).
 *
 * Šta se čita: šifra (TEKST, sa vodećim nulama kako je odštampana), naziv i kolona „Stanje“ (količina
 * na kraju perioda = stanje na dan poslednjeg datuma perioda). Ulaz i Izlaz služe samo kontroli
 * (ulaz − izlaz = stanje po redu i zbirovi iz „ZBIRNI PODACI“). Finansijske kolone (Duguje, Potražuje,
 * Saldo) se ne čuvaju i ne tumače kao količina. JM ovaj izveštaj nema.
 *
 * Odbija se: PDF bez teksta (skeniran — OCR nije podržan), drugi raspored, više ili nijedan poslovni
 * objekat, nejasna kolona broja, prethodno stanje različito od nule, strane koje nedostaju i zbir koji
 * ne odgovara.
 */

import { EXPECTED_WAREHOUSE } from "./stockReport.mjs";

export const STOCK_PDF_PARSER = "biznisoft-zbirni-pregled-pdf/1";
export const MAX_PDF_PAGES = 200;

const TITLE = "ZBIRNI PREGLED PO ARTIKLIMA";
const HEADERS = ["Šifra", "Naziv artikla", "Ulaz", "Izlaz", "Stanje", "Duguje", "Potražuje", "Saldo"];
const NUMBER = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
const CODE = /^[0-9A-Za-z][0-9A-Za-z./-]*$/;
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const num = (s) => Number(s.replace(/\./g, "").replace(",", "."));
const near = (a, b) => Math.abs(a - b) < 0.005;
const isoDate = (d) => {
  const m = String(d ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Ključ za vezu: kao `codeKey` u stockLink (numerička šifra bez vodećih nula, ostalo velikim slovima). */
function keyOf(code) {
  return /^\d+$/.test(code) ? code.replace(/^0+(?=\d)/, "") : code.toUpperCase();
}

/**
 * @param {{ numPages: number, pages: Array<Array<{ str: string, x: number, y: number, w: number }>> }} doc
 * @returns {ReturnType<typeof import("./stockReport.mjs").parseStockReport>}
 */
export function parseStockPdf(doc) {
  const errors = [];
  const warnings = [];
  const lines = [];
  const meta = { title: null, stockDate: null, printedOn: null, warehouseCode: null, warehouseName: null, articleFilter: null, stockFilter: null };
  const control = { totalRowFound: false, totalsChecked: false, totalsMatch: null, pagesDeclared: null, pagesSeen: 0, pagesComplete: null, rowValueMismatches: null };
  const stats = { lines: 0, zeros: 0, negative: 0, decimals: 0, emptyQuantity: 0, repeatedHeaders: 0, pageHeaderRows: 0, footerRows: 0, emptyRows: 0, unrecognizedRows: 0 };
  const done = () => ({ ok: errors.length === 0, parser: STOCK_PDF_PARSER, errors, warnings, meta, lines, stats: { ...stats, lines: lines.length }, control });

  const pages = (doc.pages ?? []).map((p) => p.filter((i) => typeof i.str === "string" && i.str.trim() !== "").map((i) => ({ ...i, str: i.str.trim() })));
  if (!pages.length || pages.every((p) => p.length === 0)) {
    errors.push({ code: "pdf_bez_teksta" });
    return done();
  }
  if (pages.length > MAX_PDF_PAGES) {
    errors.push({ code: "pdf_previse_strana", detail: String(pages.length) });
    return done();
  }
  const all = pages.flat();
  if (!all.some((i) => fold(i.str) === fold(TITLE))) {
    errors.push({ code: all.some((i) => /STANJE ZALIHA/i.test(i.str)) ? "pdf_raspored_bez_uzorka" : "nije_stanje_zaliha" });
    return done();
  }
  meta.title = TITLE;

  // Zaglavlje dokumenta (prva strana): period, datum štampe, filter poslovnih objekata.
  const first = pages[0];
  const after = (label) => {
    const l = first.find((i) => i.str === label);
    if (!l) return null;
    return first.filter((i) => Math.abs(i.y - l.y) < 1 && i.x > l.x).sort((a, b) => a.x - b.x)[0]?.str ?? null;
  };
  const period = after("Period:");
  const pm = String(period ?? "").match(/^(\d{2}\.\d{2}\.\d{4})-(\d{2}\.\d{2}\.\d{4})$/);
  if (!pm) errors.push({ code: "nema_datuma_stanja", detail: period ?? "" });
  else meta.stockDate = isoDate(pm[2]);
  const printed = all.map((i) => i.str.match(/^Datum štampe:\s*(\d{2}\.\d{2}\.\d{4})$/)).find(Boolean);
  meta.printedOn = printed ? isoDate(printed[1]) : null;
  const objects = after("Filteri:");
  const om = String(objects ?? "").match(/^Poslovni objekti:\s*(.+)$/);
  const list = om ? om[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (list.length !== 1) errors.push({ code: list.length ? "vise_poslovnih_objekata" : "nema_poslovnog_objekta", detail: list.join(" | ") });
  else {
    const wm = list[0].match(/^(\d+)\s+(.+)$/);
    meta.warehouseCode = wm?.[1] ?? null;
    meta.warehouseName = wm?.[2] ?? list[0];
    if (meta.warehouseCode !== EXPECTED_WAREHOUSE.code || fold(meta.warehouseName) !== fold(EXPECTED_WAREHOUSE.name)) {
      errors.push({ code: "pogresan_poslovni_objekat", detail: list[0] });
    }
  }
  const filterLine = first.find((i) => /^Vrsta cene:/.test(i.str));
  meta.articleFilter = filterLine?.str ?? null;
  meta.stockFilter = "Artikli sa prometom u periodu (bez prometa nisu navedeni)";

  // Strane: „Strana N od M“ na svakoj, redom.
  const pageNos = pages.map((p) => p.map((i) => i.str.match(/^Strana (\d+) od (\d+)$/)).find(Boolean));
  control.pagesSeen = pages.length;
  control.pagesDeclared = pageNos[0] ? Number(pageNos[0][2]) : null;
  control.pagesComplete = pageNos.every((m, i) => m && Number(m[1]) === i + 1 && Number(m[2]) === pages.length);
  if (!control.pagesComplete) errors.push({ code: "nedostaju_strane" });

  let ulazSum = 0;
  let izlazSum = 0;
  let stanjeSum = 0;
  let mismatches = 0;
  const seen = new Map();

  pages.forEach((items, pi) => {
    const header = HEADERS.map((h) => items.find((i) => i.str === h) ?? null);
    if (header.some((h) => !h) || header.some((h) => Math.abs(h.y - header[0].y) > 1)) {
      errors.push({ code: "nema_zaglavlja_tabele", detail: `strana ${pi + 1}` });
      return;
    }
    if (pi > 0) stats.repeatedHeaders++;
    const headY = header[0].y;
    const footY = Math.max(0, ...items.filter((i) => i.str === "ZBIRNI PODACI" || /^Strana \d+ od \d+$/.test(i.str)).map((i) => i.y));
    const colX = header.map((h) => h.x);
    const body = items.filter((i) => i.y < headY - 1 && i.y > footY + 1);

    // Prethodno stanje (samo na prvoj strani) mora biti nula: tada je „Stanje“ = ulaz − izlaz u periodu.
    const prev = body.find((i) => i.str === "Prethodno stanje:");
    if (prev) {
      const vals = body.filter((i) => Math.abs(i.y - prev.y) < 1 && NUMBER.test(i.str)).map((i) => num(i.str));
      if (vals.some((v) => v !== 0)) errors.push({ code: "prethodno_stanje_nije_nula" });
    }

    const codes = body.filter((i) => Math.abs(i.x - colX[0]) < 2 && CODE.test(i.str));
    const numbers = body.filter((i) => i.x > colX[2] - 30 && NUMBER.test(i.str) && (!prev || Math.abs(i.y - prev.y) >= 1));
    // Svaki broj pripada najbližem redu šifre (red brojeva je u PDF-u pomeren do ~1,5 tačke).
    const byCode = new Map(codes.map((c) => [c, []]));
    for (const n of numbers) {
      let best = null;
      for (const c of codes) if (!best || Math.abs(c.y - n.y) < Math.abs(best.y - n.y)) best = c;
      if (!best || Math.abs(best.y - n.y) > 3) {
        stats.unrecognizedRows++;
        continue;
      }
      byCode.get(best).push(n);
    }
    for (const c of codes) {
      const nums = byCode.get(c).sort((a, b) => a.x - b.x);
      const row = (pi + 1) * 1000 + codes.indexOf(c) + 1;
      if (nums.length !== 6) {
        errors.push({ code: "pdf_red_nepotpun", row, detail: `${c.str}: ${nums.length} brojeva` });
        continue;
      }
      // Kolona broja po desnoj ivici između zaglavlja susednih kolona — šifra se nikad ne spaja sa brojem.
      const inColumn = nums.every((n, k) => {
        const right = n.x + (n.w ?? 0);
        const lo = colX[k + 2];
        const hi = k + 3 < colX.length ? colX[k + 3] : Infinity;
        return right > lo && right < hi + 5;
      });
      if (!inColumn) {
        errors.push({ code: "pdf_kolona_nejasna", row, detail: c.str });
        continue;
      }
      const [ulaz, izlaz, stanje] = nums.slice(0, 3).map((n) => num(n.str));
      const name = body
        .filter((i) => Math.abs(i.y - c.y) < 1 && i.x >= colX[1] - 1 && i.x < colX[2] - 30)
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(" ");
      if (!near(ulaz - izlaz, stanje)) mismatches++;
      if (seen.has(c.str)) {
        errors.push({ code: "dupla_sifra", detail: c.str });
        continue;
      }
      seen.set(c.str, true);
      ulazSum += ulaz;
      izlazSum += izlaz;
      stanjeSum += stanje;
      if (stanje === 0) stats.zeros++;
      if (stanje < 0) stats.negative++;
      if (stanje % 1 !== 0) stats.decimals++;
      lines.push({ row, sourceCode: c.str, codeKey: keyOf(c.str), name, unit: null, quantity: stanje, quantityStatus: "ok", negative: stanje < 0 });
    }
  });

  control.rowValueMismatches = mismatches;
  if (mismatches) errors.push({ code: "pdf_ulaz_izlaz_stanje", count: mismatches });
  const keys = new Map();
  for (const l of lines) {
    const prev = keys.get(l.codeKey);
    if (prev && prev !== l.sourceCode) errors.push({ code: "sudar_sifara", detail: `${prev} / ${l.sourceCode}` });
    keys.set(l.codeKey, l.sourceCode);
  }
  if (!lines.length && !errors.length) errors.push({ code: "nema_artikala" });

  // ZBIRNI PODACI: „Ukupno ulaz (KOM)“, „Ukupno izlaz (KOM)“, „Stanje (KOM)“.
  const last = pages[pages.length - 1];
  const total = (label) => {
    const l = last.find((i) => i.str === label);
    if (!l) return null;
    const v = last.filter((i) => Math.abs(i.y - l.y) < 1 && i.x > l.x && NUMBER.test(i.str)).sort((a, b) => a.x - b.x)[0];
    return v ? num(v.str) : null;
  };
  const totals = [total("Ukupno ulaz (KOM):"), total("Ukupno izlaz (KOM):"), total("Stanje (KOM):")];
  control.totalRowFound = totals.every((t) => t !== null);
  control.totalsChecked = control.totalRowFound;
  if (!control.totalRowFound) errors.push({ code: "nema_zbirnog_reda" });
  else {
    control.totalsMatch = near(totals[0], ulazSum) && near(totals[1], izlazSum) && near(totals[2], stanjeSum);
    if (!control.totalsMatch) errors.push({ code: "kontrolni_zbir_ne_odgovara", detail: `stanje ${stanjeSum.toFixed(2)} / ${totals[2]}` });
  }
  if (stats.negative) warnings.push({ code: "negativne_kolicine", count: stats.negative });
  warnings.push({ code: "pdf_samo_artikli_sa_prometom" });
  warnings.push({ code: "nedostaje_jm" });
  if (errors.length) lines.length = 0;
  return done();
}
