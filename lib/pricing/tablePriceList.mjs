import { parseAmountCents } from "./rebateSheet.mjs";

/**
 * Uvoz VP cenovnika iz TABELE (CSV ili XLSX), bez spoljne biblioteke.
 *
 *  - prepoznavanje artikla isključivo po ŠIFRI (naziv iz fajla je samo upozorenje — `priceListMatch`);
 *  - korisnik bira kolone (šifra, nova VP cena; opciono naziv, JM, pakovanje) i JEDINICU cene u fajlu:
 *    po JM ili po pakovanju — cena po pakovanju se deli potvrđenom količinom JM u pakovanju;
 *  - redovi koji se ne mogu pročitati ne ulaze u cenovnik, već u spisak neispravnih redova.
 * Isti kod čita fajl u pregledaču (pregled kolona) i na serveru (jedini merodavan obračun).
 */

export const TABLE_PARSER = "tabela-vp/1";
export const MAX_TABLE_ROWS = 20000;

/** CSV/TSV/„;“ sa navodnicima; razdelnik se bira po prvom redu. */
export function parseCsv(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => r.map((c) => String(c).trim()));
}

/* ---------- XLSX (ZIP + XML) ---------- */

const td = new TextDecoder("utf-8");

function zipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new TableFormatError("zip", "Fajl nije ispravan XLSX (nedostaje sadržaj arhive).");
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map();
  for (let n = 0; n < total; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new TableFormatError("zip", "Fajl nije ispravan XLSX.");
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    out.set(name, { method, data: bytes.subarray(start, start + csize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function decodeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
}

function colIndex(ref) {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Prvi list XLSX fajla kao tabela teksta.
 * @param {Uint8Array} bytes
 * @param {(data: Uint8Array) => Promise<Uint8Array> | Uint8Array} inflateRaw  raspakivanje „deflate“ zapisa
 */
export async function readXlsx(bytes, inflateRaw) {
  const entries = zipEntries(bytes);
  const read = async (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const raw = e.method === 0 ? e.data : e.method === 8 ? await inflateRaw(e.data) : null;
    if (!raw) throw new TableFormatError("zip", "Nepodržan način pakovanja u XLSX fajlu.");
    return td.decode(raw);
  };
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  let sheetPath = "xl/worksheets/sheet1.xml";
  const firstSheet = workbook?.match(/<sheet\b[^>]*r:id="([^"]+)"/);
  if (firstSheet && rels) {
    const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstSheet[1]}"[^>]*Target="([^"]+)"`)) ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstSheet[1]}"`));
    if (rel) sheetPath = rel[1].startsWith("/") ? rel[1].slice(1) : `xl/${rel[1].replace(/^\.\//, "")}`;
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new TableFormatError("xlsx", "XLSX fajl nema nijedan list.");
  const sharedXml = (await read("xl/sharedStrings.xml")) ?? "";
  const shared = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => decodeXml([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const inner = cm[2] ?? "";
      let value = "";
      if (type === "s") value = shared[Number(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1)] ?? "";
      else if (type === "inlineStr") value = decodeXml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      else value = decodeXml(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = value.trim();
    }
    if (row.some((c) => c !== "")) rows.push(row);
    if (rows.length > MAX_TABLE_ROWS + 1) break;
  }
  return rows;
}

export class TableFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TableFormatError";
    this.code = code;
  }
}

/** Broj iz ćelije: srpski zapis („1.234,56“) ili broj iz XLSX-a („1234.56“, „1234.5678“). */
export function cellAmountCents(value) {
  const t = String(value ?? "").trim();
  if (t === "") return null;
  if (/^-?\d+\.\d{3,}$/.test(t) || /^-?\d+(\.\d+)?e[+-]?\d+$/i.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
  }
  return parseAmountCents(t);
}

/** Količina JM u pakovanju („0,5“, „2,5“, „100“). */
export function parseQuantity(value) {
  const t = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Cena po JM iz cene pakovanja (polovina naviše, na paru). */
export function perUnitCents(packCents, quantity) {
  return Math.round(packCents / quantity);
}

/**
 * Tabela → redovi cenovnika za pregled.
 * @param {string[][]} table
 * @param {{ header: boolean, code: number, price: number, name?: number | null, unit?: number | null, pack?: number | null }} map
 * @param {"jm" | "pak"} priceUnit
 * @param {{ packQtyByCode: Map<string, number>, vatByCode: Map<string, number> }} known  potvrđena pakovanja i PDV postojećih artikala
 */
export function buildTableRows(table, map, priceUnit, known) {
  if (priceUnit !== "jm" && priceUnit !== "pak") throw new TableFormatError("jedinica", "Izaberite da li je cena u fajlu po JM ili po pakovanju.");
  if (!Number.isInteger(map.code) || !Number.isInteger(map.price) || map.code === map.price) throw new TableFormatError("kolone", "Izaberite različite kolone za šifru i novu VP cenu.");
  const body = map.header ? table.slice(1) : table;
  if (body.length === 0) throw new TableFormatError("prazno", "Fajl nema nijedan red sa podacima.");
  if (body.length > MAX_TABLE_ROWS) throw new TableFormatError("veliko", `Fajl ima više od ${MAX_TABLE_ROWS} redova.`);
  const rows = [];
  const problems = [];
  body.forEach((r, i) => {
    const line = i + (map.header ? 2 : 1);
    const code = String(r[map.code] ?? "").trim();
    const name = map.name === null || map.name === undefined ? "" : String(r[map.name] ?? "").trim();
    const fileUnit = map.unit === null || map.unit === undefined ? null : String(r[map.unit] ?? "").trim() || null;
    const filePack = map.pack === null || map.pack === undefined ? null : String(r[map.pack] ?? "").trim() || null;
    const raw = cellAmountCents(r[map.price]);
    if (!code) return problems.push({ line, code: null, name, reason: "nema šifre" });
    if (!/^[0-9A-Za-z./_-]{1,32}$/.test(code)) return problems.push({ line, code, name, reason: "šifra sadrži nedozvoljene znakove" });
    if (raw === null) return problems.push({ line, code, name, reason: "nema cene" });
    if (Number.isNaN(raw)) return problems.push({ line, code, name, reason: `cena nije broj („${String(r[map.price]).slice(0, 24)}“)` });
    if (raw <= 0) return problems.push({ line, code, name, reason: "cena je 0 ili negativna" });
    const vat = known.vatByCode.get(code) ?? 20;
    if (priceUnit === "jm") return rows.push({ line, code, name: name || code, vatPercent: vat, vpPriceCents: raw, rawCents: raw, fileUnit, filePack });
    const qty = known.packQtyByCode.get(code);
    if (qty) return rows.push({ line, code, name: name || code, vatPercent: vat, vpPriceCents: perUnitCents(raw, qty), rawCents: raw, fileUnit, filePack });
    if (known.vatByCode.has(code)) return problems.push({ line, code, name, reason: "cena je po pakovanju, a artikal nema potvrđenu količinu pakovanja — ne može se preračunati na JM" });
    // Nov artikal: cena po JM se računa kada se pri unosu artikla upiše količina u pakovanju.
    return rows.push({ line, code, name: name || code, vatPercent: vat, vpPriceCents: raw, rawCents: raw, fileUnit, filePack });
  });
  return { rows, problems };
}
