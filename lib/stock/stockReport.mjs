/**
 * Parser BizniSoft izveštaja o stanju zaliha (lager) — XLSX ili CSV izvoz štampe (dok. 65).
 * Podržana su dva rasporeda istog programa (oba proverena na stvarnom izvozu):
 *   A) „STANJE ZALIHA" — Šifra · Naziv robe · Stopa · Količina · Nab.Cena · Nab.Vred · VP Cena ·
 *      VP Vred. · %RuC; zbirni red nosi dve vrednosti; bez JM;
 *   B) „STANJE ZALIHA ARTIKLA" — Šifra · GR. · Naziv robe · JM · Količina · Cena · Vrednost;
 *      zaglavlje strane (firma, adresa, naslov) ponavlja se na svakoj strani; zbirni red nosi
 *      jednu vrednost; filteri u jednoj ćeliji razdvojeni sa „·".
 *
 * Ulaz je „mreža" (niz redova, red = niz ćelija po kolonama; ćelija = broj, tekst ili null),
 * kakvu daju `xlsxGrid` i `csvGrid`. Raspored se PREPOZNAJE, ne pretpostavlja:
 *   - zaglavlje izveštaja: naslov „STANJE ZALIHA", „Na dan:", „Datum štampe:",
 *     „Poslovni objekti:" → „021 VELEPRODAJA";
 *   - zaglavlje tabele (red sa „Šifra" i „Količina") ponavlja se na svakoj strani;
 *     raspon kolone = od naslova do SLEDEĆEG NASLOVA BILO KOJE KOLONE (i one koju parser
 *     ne koristi, npr. „GR."), jer spojene ćelije pomeraju vrednost (u rasporedu A naslov
 *     „Količina" je u X, a brojevi u Y);
 *   - redovi zaglavlja izveštaja koji se ponove između strana (raspored B) nisu artikli;
 *   - podnožje strane („Strana N od M", „BizniSoft Poslovni Programi") i zbirni red
 *     („Ukupno stanje zaliha na dan:") nisu artikli.
 *
 * Izlaz sadrži SAMO šifru, naziv i izvornu količinu. Cene, vrednosti i marže iz istog
 * izveštaja koriste se isključivo za kontrolu potpunosti u memoriji (zbir vrednosti =
 * „Ukupno") i ne napuštaju parser — rezultat kontrole je da/ne.
 *
 * Pravila: prazna količina nije 0; negativna količina se čuva kao nalaz; JM se ne
 * zaključuje iz naziva — kolona JM (raspored B) se samo prenosi kao provera prema potvrđenom
 * pakovanju; šifra ostaje tekst kakav je u izvoru.
 */

import { codeKey } from "./stockLink.mjs";
import { inferDecimalSeparator, parseQuantity, parseReportDate, round3 } from "./reportValues.mjs";

export const STOCK_REPORT_PARSER = "biznisoft-stanje-zaliha/2";
/** Poznati naslovi istog programa; drugačiji naslov je upozorenje, a raspored i dalje mora da prođe sve kontrole. */
const KNOWN_TITLES = ["stanje zaliha", "stanje zaliha artikla"];
export const EXPECTED_WAREHOUSE = Object.freeze({ code: "021", name: "VELEPRODAJA" });

const fold = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "dj")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const text = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isEmpty = (v) => text(v) === "";

const HEADER_FIELDS = [
  ["code", /^sifra$/],
  ["name", /^naziv( robe| artikla)?$/],
  ["group", /^gr\.?$|^grupa$/],
  ["unit", /^jm$|^jed\.? ?mere$/],
  ["vat", /^stopa$/],
  ["quantity", /^kolicina$/],
  ["purchasePrice", /^nab\.? ?cena$/],
  ["purchaseValue", /^nab\.? ?vred\.?$/],
  ["salePrice", /^vp ?cena$/],
  ["saleValue", /^vp ?vred\.?$/],
  ["margin", /^%? ?ruc$/],
  ["price", /^cena$/],
  ["value", /^vrednost$/],
];
const FOOTER = [/^strana \d+ od \d+$/, /biznisoft poslovni programi/];
const TOTAL = /^ukupno stanje zaliha/;
const CODE_RE = /^[0-9A-Za-z][0-9A-Za-z./_-]{0,31}$/;

function headerOf(row) {
  const found = {};
  row.forEach((cell, col) => {
    const f = fold(cell);
    for (const [key, re] of HEADER_FIELDS) if (re.test(f) && found[key] === undefined) found[key] = col;
  });
  return found.code !== undefined && found.quantity !== undefined ? found : null;
}

/** Granice kolona: SVAKI neprazan naslov u redu zaglavlja, i onaj koji parser ne koristi. */
function spans(header, headerRow, width) {
  const starts = headerRow.map((c, i) => (isEmpty(c) ? -1 : i)).filter((i) => i >= 0);
  const out = {};
  for (const [key, col] of Object.entries(header)) {
    const next = starts.find((s) => s > col);
    out[key] = [col, next ?? width];
  }
  return out;
}

function cellsIn(row, [from, to]) {
  const out = [];
  for (let c = from; c < to; c++) if (!isEmpty(row[c])) out.push({ col: c, value: row[c] });
  return out;
}

function labelValue(grid, labelRe, maxRows = 40) {
  for (let r = 0; r < Math.min(grid.length, maxRows); r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      // Jedna ćelija može nositi više oznaka razdvojenih sa „·“ (raspored B).
      const segment = text(row[c]).split(/\s+·\s+/).find((seg) => labelRe.test(fold(seg)));
      if (segment === undefined) continue;
      // Vrednost u istom delu („Datum štampe: 24.08.2026") ili prva sledeća ćelija desno.
      const inline = segment.split(":").slice(1).join(":").trim();
      if (inline) return { row: r, value: inline };
      for (let k = c + 1; k < row.length; k++) if (!isEmpty(row[k])) return { row: r, value: row[k] };
      return { row: r, value: null };
    }
  }
  return null;
}

/**
 * @param {Array<Array<string | number | null>>} grid
 * @returns {{
 *   ok: boolean, parser: string,
 *   errors: Array<{ code: string, row?: number, detail?: string }>,
 *   warnings: Array<{ code: string, row?: number, detail?: string, count?: number }>,
 *   meta: { title: string | null, stockDate: string | null, printedOn: string | null,
 *           warehouseCode: string | null, warehouseName: string | null, articleFilter: string | null, stockFilter: string | null },
 *   lines: Array<{ row: number, sourceCode: string, codeKey: string | null, name: string, unit: string | null, quantity: number | null, quantityStatus: "ok" | "prazno", negative: boolean }>,
 *   stats: Record<string, number>,
 *   control: { totalRowFound: boolean, totalsChecked: boolean, totalsMatch: boolean | null, pagesDeclared: number | null, pagesSeen: number, pagesComplete: boolean | null, rowValueMismatches: number | null },
 * }}
 */
export function parseStockReport(grid) {
  const errors = [];
  const warnings = [];
  let lines = [];
  let zeros = 0;
  let negative = 0;
  let decimals = 0;
  let empty = 0;
  let repeatedHeaders = 0;
  let pageHeaderRows = 0;
  let footerRows = 0;
  let emptyRows = 0;
  const unknown = [];
  let control = { totalRowFound: false, totalsChecked: false, totalsMatch: null, pagesDeclared: null, pagesSeen: 0, pagesComplete: null, rowValueMismatches: null };
  const width = Math.max(0, ...grid.map((r) => r?.length ?? 0));

  // --- zaglavlje izveštaja ---
  let title = null;
  for (let r = 0; r < Math.min(grid.length, 20) && !title; r++) {
    for (const cell of grid[r] ?? []) if (/^stanje zaliha\b/.test(fold(cell))) title = text(cell);
  }
  if (!title) errors.push({ code: "nije_stanje_zaliha" });
  else if (!KNOWN_TITLES.includes(fold(title))) warnings.push({ code: "naslov_drugaciji", detail: title });

  const naDan = labelValue(grid, /^na dan:?/);
  const stockDate = naDan ? parseReportDate(naDan.value) : null;
  if (!stockDate) errors.push({ code: "nema_datuma_stanja" });
  const stampa = labelValue(grid, /^datum stampe:?/);
  const printedOn = stampa ? parseReportDate(stampa.value) : null;
  const articleFilter = labelValue(grid, /^vrsta artikla:?/)?.value ?? null;
  const stockFilter = labelValue(grid, /^stanje artik(la|ala):?/)?.value ?? null;

  // „Poslovni objekti:" — vrednost u istom redu ili u prvim nepraznim redovima ispod.
  let warehouseCode = null;
  let warehouseName = null;
  const po = labelValue(grid, /^poslovni objekt/);
  const firstHeaderRow = grid.findIndex((row) => headerOf(row ?? []));
  if (!po) errors.push({ code: "nema_poslovnog_objekta" });
  else {
    const candidates = [];
    if (po.value) candidates.push(text(po.value));
    for (let r = po.row + 1; r < (firstHeaderRow === -1 ? grid.length : firstHeaderRow); r++) {
      const vals = (grid[r] ?? []).filter((c) => !isEmpty(c)).map(text);
      if (vals.length) candidates.push(vals.join(" "));
    }
    const objects = candidates.flatMap((c) => c.split(/[,;]/)).map((s) => s.trim()).filter((s) => /^\d{2,4}\s+\S/.test(s));
    if (objects.length !== 1) errors.push({ code: objects.length ? "vise_poslovnih_objekata" : "nema_poslovnog_objekta", detail: objects.join(" | ") });
    else {
      const m = /^(\d{2,4})\s+(.+)$/.exec(objects[0]);
      warehouseCode = m[1];
      warehouseName = m[2].trim();
      if (warehouseCode !== EXPECTED_WAREHOUSE.code || fold(warehouseName) !== fold(EXPECTED_WAREHOUSE.name)) {
        errors.push({ code: "pogresan_poslovni_objekat", detail: `${warehouseCode} ${warehouseName}` });
      }
    }
  }

  // --- tabela ---
  if (firstHeaderRow === -1) {
    errors.push({ code: "nema_zaglavlja_tabele" });
    return finish();
  }
  const header = headerOf(grid[firstHeaderRow]);
  const span = spans(header, grid[firstHeaderRow], width);
  // Redovi zaglavlja izveštaja (firma, adresa, naslov…) koji se ponavljaju na svakoj strani.
  const signature = (row) => fold((row ?? []).filter((c) => !isEmpty(c)).map(text).join(" | "));
  const reportHeaderRows = new Set(grid.slice(0, firstHeaderRow).map(signature).filter(Boolean));
  if (header.name === undefined) warnings.push({ code: "nema_kolone_naziv" });

  const raw = [];
  let totalRow = null;
  const pageNumbers = new Set();
  let pagesDeclared = null;

  for (let r = firstHeaderRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const nonEmpty = row.map((c, i) => ({ c, i })).filter((x) => !isEmpty(x.c));
    if (!nonEmpty.length) {
      emptyRows++;
      continue;
    }
    const h = headerOf(row);
    if (h) {
      repeatedHeaders++;
      if (h.code !== header.code || h.quantity !== header.quantity) errors.push({ code: "zaglavlje_promenjeno", row: r + 1 });
      continue;
    }
    if (reportHeaderRows.has(signature(row))) {
      pageHeaderRows++;
      continue;
    }
    const joined = fold(nonEmpty.map((x) => text(x.c)).join(" "));
    if (TOTAL.test(fold(nonEmpty[0].c)) || TOTAL.test(joined)) {
      totalRow = { row: r, numbers: nonEmpty.map((x) => x.c).filter((v) => typeof v === "number" || /^-?[\d.,\s]+$/.test(text(v))) };
      continue;
    }
    if (nonEmpty.length <= 2 && FOOTER.some((re) => nonEmpty.some((x) => re.test(fold(x.c))))) {
      footerRows++;
      for (const x of nonEmpty) {
        const m = /^strana (\d+) od (\d+)$/.exec(fold(x.c));
        if (m) {
          pageNumbers.add(Number(m[1]));
          pagesDeclared = Number(m[2]);
        }
      }
      continue;
    }
    const codeCells = cellsIn(row, span.code);
    const qtyCells = cellsIn(row, span.quantity);
    const codeText = codeCells.length === 1 ? (typeof codeCells[0].value === "number" ? String(codeCells[0].value) : text(codeCells[0].value)) : "";
    if (codeCells.length !== 1 || !CODE_RE.test(codeText)) {
      unknown.push(r + 1);
      continue;
    }
    if (qtyCells.length > 1) {
      errors.push({ code: "kolicina_u_vise_kolona", row: r + 1 });
      continue;
    }
    if (typeof codeCells[0].value === "number" && !Number.isInteger(codeCells[0].value)) {
      errors.push({ code: "sifra_nije_ceo_broj", row: r + 1 });
      continue;
    }
    raw.push({
      row: r + 1,
      sourceCode: codeText,
      codeIsNumberCell: typeof codeCells[0].value === "number",
      name: header.name !== undefined ? cellsIn(row, span.name).map((x) => text(x.value)).join(" ") : "",
      unit: header.unit !== undefined ? text(pick(row, span.unit)).toUpperCase() || null : null,
      qty: qtyCells[0]?.value ?? null,
      control: {
        purchasePrice: pick(row, span.purchasePrice),
        purchaseValue: pick(row, span.purchaseValue),
        salePrice: pick(row, span.salePrice),
        saleValue: pick(row, span.saleValue),
        price: pick(row, span.price),
        value: pick(row, span.value),
      },
    });
  }

  if (unknown.length) warnings.push({ code: "neprepoznati_redovi", count: unknown.length, detail: unknown.slice(0, 10).join(", ") });
  if (unknown.length > Math.max(5, raw.length * 0.02)) errors.push({ code: "previse_neprepoznatih_redova", count: unknown.length });

  // --- količine ---
  const stringQty = raw.map((x) => x.qty).filter((v) => typeof v === "string");
  const sepInfo = inferDecimalSeparator(stringQty);
  if (sepInfo.mixed) errors.push({ code: "mesoviti_decimalni_separator" });

  const seenSource = new Map();
  const seenKey = new Map();
  for (const x of raw) {
    let quantity = null;
    let quantityStatus = "ok";
    const q = parseQuantity(x.qty, sepInfo.sep);
    if (q.ok) quantity = q.value;
    else if (q.reason === "prazno") {
      quantityStatus = "prazno";
      empty++;
    } else {
      errors.push({ code: q.reason, row: x.row });
      continue;
    }
    if (quantity !== null) {
      if (quantity < 0) negative++;
      if (quantity === 0) zeros++;
      if (!Number.isInteger(quantity)) decimals++;
    }
    if (seenSource.has(x.sourceCode)) {
      errors.push({ code: "dupla_sifra", row: x.row, detail: `${x.sourceCode} (i red ${seenSource.get(x.sourceCode)})` });
      continue;
    }
    seenSource.set(x.sourceCode, x.row);
    const key = codeKey(x.sourceCode);
    if (key !== null) {
      const prev = seenKey.get(key);
      if (prev && prev.sourceCode !== x.sourceCode) {
        errors.push({ code: "sudar_sifara", row: x.row, detail: `${x.sourceCode} ~ ${prev.sourceCode}` });
        continue;
      }
      seenKey.set(key, x);
    }
    lines.push({ row: x.row, sourceCode: x.sourceCode, codeKey: key, name: x.name, unit: x.unit, quantity, quantityStatus, negative: quantity !== null && quantity < 0 });
  }
  if (!lines.length && !errors.length) errors.push({ code: "nema_artikala" });
  if (empty) warnings.push({ code: "prazne_kolicine", count: empty });
  if (negative) warnings.push({ code: "negativne_kolicine", count: negative });
  if (raw.some((x) => x.codeIsNumberCell)) warnings.push({ code: "sifre_kao_brojevi" });
  if (header.unit !== undefined) {
    const noUnit = lines.filter((l) => !l.unit).length;
    if (noUnit) warnings.push({ code: "nedostaje_jm", count: noUnit });
  }

  // --- kontrola potpunosti (cene samo ovde, u memoriji) ---
  control = {
    totalRowFound: Boolean(totalRow),
    totalsChecked: false,
    totalsMatch: null,
    pagesDeclared,
    pagesSeen: pageNumbers.size,
    pagesComplete: pagesDeclared === null ? null : pageNumbers.size === pagesDeclared && [...pageNumbers].every((p) => p >= 1 && p <= pagesDeclared),
    rowValueMismatches: null,
  };
  if (!totalRow) warnings.push({ code: "nema_zbirnog_reda" });
  if (control.pagesComplete === false) errors.push({ code: "nedostaju_strane", detail: `${pageNumbers.size}/${pagesDeclared}` });

  const num = (v) => {
    if (typeof v === "number") return v;
    const p = parseQuantity(v, sepInfo.sep);
    return p.ok ? p.value : null;
  };
  // Kolone vrednosti i parovi „cena → vrednost“ koje izveštaj ima (A: nabavna i VP; B: jedna).
  const VALUE_COLS = ["purchaseValue", "saleValue", "value"].filter((k) => header[k] !== undefined);
  const PAIRS = [["purchasePrice", "purchaseValue"], ["salePrice", "saleValue"], ["price", "value"]].filter(([p, v]) => header[p] !== undefined && header[v] !== undefined);
  const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-6);
  if (VALUE_COLS.length && totalRow) {
    const totals = totalRow.numbers.map(num).filter((v) => v !== null);
    const sums = VALUE_COLS.map((k) => raw.reduce((a, x) => a + (num(x.control[k]) ?? 0), 0));
    control.totalsChecked = totals.length >= VALUE_COLS.length;
    control.totalsMatch = control.totalsChecked ? sums.every((sum) => totals.some((t) => near(sum, t))) : null;
    if (control.totalsMatch === false) errors.push({ code: "kontrolni_zbir_ne_odgovara" });
    if (!control.totalsChecked) warnings.push({ code: "kontrolni_zbir_nije_moguc" });
  } else if (totalRow) warnings.push({ code: "kontrolni_zbir_nije_moguc" });
  if (PAIRS.length) {
    control.rowValueMismatches = raw.filter((x) => {
      const q = num(x.qty);
      return q !== null && PAIRS.some(([p, v]) => {
        const pp = num(x.control[p]);
        const vv = num(x.control[v]);
        return pp !== null && vv !== null && Math.abs(q * pp - vv) > Math.max(0.05, Math.abs(vv) * 0.001);
      });
    }).length;
    if (control.rowValueMismatches > 0) warnings.push({ code: "kolicina_puta_cena_odstupa", count: control.rowValueMismatches });
  }

  return finish();

  function finish() {
    return {
      ok: errors.length === 0,
      parser: STOCK_REPORT_PARSER,
      errors,
      warnings,
      meta: { title, stockDate, printedOn, warehouseCode, warehouseName, articleFilter: articleFilter === null ? null : text(articleFilter), stockFilter: stockFilter === null ? null : text(stockFilter) },
      lines,
      stats: { lines: lines.length, zeros, negative, decimals, emptyQuantity: empty, repeatedHeaders, pageHeaderRows, footerRows, emptyRows, unrecognizedRows: unknown.length },
      control,
    };
  }
}

function pick(row, sp) {
  if (!sp) return null;
  const c = cellsIn(row, sp);
  return c.length === 1 ? c[0].value : null;
}

export { round3 };
