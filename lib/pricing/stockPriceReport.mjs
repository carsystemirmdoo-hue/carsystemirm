/**
 * BizniSoft izveštaj „STANJE ZALIHA - NABAVNA I VP CENA“ → osnovne (VP) cene.
 *
 * Čista logika: ulaz su pozicionirani tekstovi po strani (PDF se čita drugde),
 * izlaz su šifra, naziv, PDV stopa i VP cena po artiklu, uz kontrole.
 *
 * Šta se NE vraća i ne čuva: količina na stanju, nabavna cena, nabavna i VP
 * vrednost i % RuC. Moraju postojati na svom mestu (potpis formata); količina
 * i VP vrednost služe SAMO kontroli čitanja (količina × VP cena = VP vrednost
 * u svakom redu, zbir VP vrednosti = „Ukupno stanje zaliha“), pa se odbacuju.
 * Nabavna kolona se ne proverava: prosečna nabavna cena je prikazana
 * zaokruženo, pa količina × cena ume da odstupa (izmereno do 32 din po redu).
 * Nabavna cena i marža nisu podatak za portal.
 *
 * Format se prepoznaje strogo: naslov, kolone i njihove desne ivice moraju
 * biti tačno ovakve. Drugačiji PDF daje jasnu grešku, nikad delimičan upis.
 *
 * Datumi u izveštaju („Na dan“, „Datum štampe“) su datum STANJA, ne datum
 * početka važenja cena — važenje bira čovek pri potvrdi.
 */

export const REPORT_TITLE = "STANJE ZALIHA - NABAVNA I VP CENA";
export const PARSER_VERSION = "biznisoft-stanje-zaliha-vp/1";

/** Desne ivice brojčanih kolona (PDF tačke), izmerene na izvoru; tolerancija ±TOL. */
const COLUMNS = Object.freeze([
  { key: "vat", right: 387 },
  { key: "qty", right: 458 },
  { key: "costPrice", right: 529 },
  { key: "costValue", right: 608 },
  { key: "vpPrice", right: 679 },
  { key: "vpValue", right: 758.5 },
  { key: "margin", right: 821 },
]);
const TOL = 3;
const HEADER = ["Šifra", "Naziv robe", "Stopa", "Količina", "Nab. cena", "Nab. vrednost", "VP cena", "VP vrednost", "% RuC"];
const CODE_MAX_X = 55;
const NAME_MIN_X = 55;
const NAME_MAX_X = 355;
const CODE_RE = /^[0-9A-Za-z][0-9A-Za-z./_-]{0,31}$/;

export class StockReportFormatError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "StockReportFormatError";
    this.code = code;
    this.details = details;
  }
}

/** „1.234,56“ / „-0,01“ → broj u stotim delovima (ceo broj), bez gubitka tačnosti. */
export function parseAmountCents(s) {
  const t = String(s).trim();
  if (!/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(t)) return null;
  const neg = t.startsWith("-");
  const [ip, dp] = t.replace("-", "").split(",");
  return (neg ? -1 : 1) * (Number(ip.replaceAll(".", "")) * 100 + Number(dp));
}

/** Iznos u stotim delovima → tekst sa dve decimale („5200.00“), za numeric u bazi. */
export const centsToDecimal = (c) => `${c < 0 ? "-" : ""}${Math.floor(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;

function parseDateDmy(s) {
  const m = String(s).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Tekstovi jedne strane grupisani u redove (isti y ±1.5), sleva nadesno. */
function rowsOf(items) {
  const rows = [];
  for (const it of [...items].filter((i) => String(i.str).trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 1.5);
    if (row) row.cells.push(it);
    else rows.push({ y: it.y, cells: [it] });
  }
  for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
  return rows;
}

const textOf = (row) => row.cells.map((c) => String(c.str).trim()).join(" ");

/**
 * @typedef {{ title: string, company: string | null, reportDate: string, printDate: string | null, businessUnit: string | null, pages: number, parser: string }} ReportMeta
 * @typedef {{ code: string, name: string, vatPercent: number, vpPriceCents: number, page: number }} ReportRow
 * @typedef {{ kind: string, page?: number, code?: string, detail?: string, text?: string }} ReportProblem
 * @typedef {{ rows: number, totalVpMatches: boolean, rowChecksFailed: number }} ReportChecks
 */

/**
 * @param {{ items: { str: string, x: number, y: number, w: number }[] }[]} pages
 * @returns {{ meta: ReportMeta, rows: ReportRow[], problems: ReportProblem[], checks: ReportChecks }}
 */
export function parseStockPriceReport(pages) {
  if (!Array.isArray(pages) || pages.length === 0) throw new StockReportFormatError("prazan", "PDF nema nijednu stranu sa tekstom.");
  const meta = { title: null, company: null, reportDate: null, printDate: null, businessUnit: null, pages: pages.length };
  const rows = [];
  const problems = [];
  let total = null;
  let pageFooters = 0;

  pages.forEach((page, pi) => {
    const pageNo = pi + 1;
    const lines = rowsOf(page.items ?? []);
    const all = lines.map(textOf);
    if (!all.includes(REPORT_TITLE)) {
      throw new StockReportFormatError("nije_izvestaj", `Strana ${pageNo}: nema naslova „${REPORT_TITLE}“. Ovo nije BizniSoft izveštaj stanja zaliha sa VP cenom.`);
    }
    const headerIdx = lines.findIndex((l) => textOf(l).startsWith("Šifra "));
    const headerCells = headerIdx >= 0 ? lines[headerIdx].cells.map((c) => String(c.str).trim()) : [];
    if (headerCells.join("|") !== HEADER.join("|")) {
      throw new StockReportFormatError("kolone", `Strana ${pageNo}: zaglavlje kolona nije očekivano. Očekivano: ${HEADER.join(" | ")}; nađeno: ${headerCells.join(" | ") || "—"}.`);
    }
    if (pageNo === 1) {
      meta.title = REPORT_TITLE;
      const firma = all[all.findIndex((t) => t === REPORT_TITLE) - 2] ?? "";
      meta.company = firma.replace(/\s*Datum štampe:.*$/, "").trim() || null;
      const naDan = all.find((t) => t.startsWith("Na dan: "));
      meta.reportDate = naDan ? parseDateDmy(naDan.slice(8, 18)) : null;
      const stampa = all.map((t) => t.match(/Datum štampe: (\d{2}\.\d{2}\.\d{4})/)).find(Boolean);
      meta.printDate = stampa ? parseDateDmy(stampa[1]) : null;
      const objekat = all.find((t) => t.startsWith("Filteri: Poslovni objekti: "));
      meta.businessUnit = objekat ? objekat.slice("Filteri: Poslovni objekti: ".length) : null;
      if (!meta.reportDate) throw new StockReportFormatError("datum", "Strana 1: nema datuma stanja („Na dan: dd.mm.gggg“).");
    }

    for (const line of lines.slice(headerIdx + 1)) {
      const t = textOf(line);
      if (/^Strana \d+ od \d+ /.test(t)) {
        const m = t.match(/^Strana (\d+) od (\d+)/);
        if (Number(m[1]) !== pageNo || Number(m[2]) !== pages.length) {
          throw new StockReportFormatError("strane", `Strana ${pageNo}: podnožje kaže „${m[0]}“, a PDF ima ${pages.length} strana — fajl je nepotpun ili spojen.`);
        }
        pageFooters += 1;
        continue;
      }
      if (t.startsWith("Ukupno stanje zaliha na dan:")) {
        const nums = line.cells.slice(1).map((c) => ({ v: parseAmountCents(c.str), right: c.x + c.w }));
        const vpValue = nums.find((n) => Math.abs(n.right - 758.5) <= TOL)?.v ?? null;
        total = { vpValue };
        continue;
      }
      const first = line.cells[0];
      const code = String(first.str).trim();
      if (!(first.x < CODE_MAX_X) || !CODE_RE.test(code)) {
        problems.push({ kind: "red_neprepoznat", page: pageNo, text: t.slice(0, 120) });
        continue;
      }
      const nameParts = [];
      const values = {};
      let misplaced = false;
      for (const c of line.cells.slice(1)) {
        const right = c.x + c.w;
        if (c.x >= NAME_MIN_X && right <= NAME_MAX_X + TOL) {
          nameParts.push(String(c.str).trim());
          continue;
        }
        const col = COLUMNS.find((k) => Math.abs(k.right - right) <= TOL);
        if (!col || col.key in values) {
          misplaced = true;
          continue;
        }
        values[col.key] = String(c.str).trim();
      }
      const name = nameParts.join(" ").replace(/\s+/g, " ").trim();
      const vatM = String(values.vat ?? "").match(/^(\d{1,2}) %$/);
      const n = Object.fromEntries(["qty", "costPrice", "costValue", "vpPrice", "vpValue", "margin"].map((k) => [k, parseAmountCents(values[k] ?? "")]));
      const missing = ["vat", "qty", "costPrice", "costValue", "vpPrice", "vpValue", "margin"].filter((k) => k === "vat" ? !vatM : n[k] === null);
      if (misplaced || missing.length || !name) {
        problems.push({ kind: "red_neispravan", page: pageNo, code, detail: misplaced ? "tekst van kolona" : !name ? "bez naziva" : `nedostaje: ${missing.join(", ")}` });
        continue;
      }
      // Kontrola čitanja (u stotim delovima): količina × VP cena = VP vrednost, ±1 para za zaokruživanje.
      if (Math.abs(Math.round((n.qty * n.vpPrice) / 100) - n.vpValue) > 1) {
        problems.push({ kind: "kontrola_reda", page: pageNo, code, detail: "količina × VP cena ≠ VP vrednost — red nije pročitan pouzdano" });
      }
      rows.push({
        code,
        name,
        vatPercent: Number(vatM[1]),
        vpPriceCents: n.vpPrice,
        page: pageNo,
        // Samo za kontrolu zbira; ne izlazi iz funkcije (vidi dole).
        _vpValue: n.vpValue,
      });
    }
  });

  if (pageFooters !== pages.length) {
    throw new StockReportFormatError("strane", `Podnožje „Strana x od y“ nađeno na ${pageFooters} od ${pages.length} strana — fajl nije cela štampa izveštaja.`);
  }
  if (!total || total.vpValue === null) {
    throw new StockReportFormatError("zbir", "Nema reda „Ukupno stanje zaliha na dan“ sa VP zbirom — izveštaj je nepotpun.");
  }
  const sumVp = rows.reduce((s, r) => s + r._vpValue, 0);
  const checks = {
    rows: rows.length,
    totalVpMatches: sumVp === total.vpValue,
    rowChecksFailed: problems.filter((p) => p.kind === "kontrola_reda").length,
  };
  if (!checks.totalVpMatches) {
    problems.push({ kind: "zbir", detail: "zbir pročitanih redova se ne poklapa sa „Ukupno stanje zaliha“ — neki red nije pročitan ili je pročitan pogrešno" });
  }

  // Duplikati šifre u istom fajlu: nijedna od tih stavki se ne primenjuje.
  const byCode = new Map();
  for (const r of rows) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);
  for (const [code, list] of byCode) {
    if (list.length > 1) problems.push({ kind: "duplikat_sifre", code, detail: `${list.length} reda (strane ${list.map((r) => r.page).join(", ")})` });
  }
  for (const r of rows) {
    if (r.vpPriceCents <= 0) problems.push({ kind: "cena_nula", code: r.code, page: r.page, detail: "VP cena 0 ili negativna" });
  }

  return {
    meta: { ...meta, parser: PARSER_VERSION },
    rows: rows.map(({ _vpValue, ...r }) => r), // eslint-disable-line @typescript-eslint/no-unused-vars
    problems,
    checks,
  };
}
