import { inflateRawSync } from "node:zlib";

/**
 * Čitač XLSX-a bez spoljne zavisnosti — samo ono što tabelarni izvoz koristi.
 *
 * Zašto ne biblioteka
 * -------------------
 * Potrebno je tačno jedno: redovi ćelija kao TEKST, kako su upisani u fajl.
 * Opšte biblioteke rado „pomognu" — `"0012"` postaje broj 12, `"900000119"`
 * postaje float, datum postaje JS `Date` u lokalnoj zoni. Za šifru partnera i
 * PIB je svaka od tih pomoći gubitak podatka. Ovde se vrednost ćelije nikad ne
 * pretvara u broj; pozivalac odlučuje šta je šta.
 *
 * Granice (namerne): nema ZIP64, šifrovanih fajlova ni formula — ćelija sa
 * formulom vraća poslednju sačuvanu vrednost (`<v>`), ako postoji. Datumi
 * ostaju serijski brojevi kako ih Excel čuva; tumačenje traži stil ćelije i
 * pripada profilu izvoza, ne čitaču.
 */

export class XlsxReadError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "XlsxReadError";
  }
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/**
 * Raspakuje ZIP u mapu `putanja → Buffer`.
 *
 * @param {Buffer} bytes
 * @returns {Map<string, Buffer>}
 */
export function unzipEntries(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22) {
    throw new XlsxReadError("Fajl nije ispravan Excel (.xlsx) dokument (prekratak).");
  }

  // Kraj centralnog direktorijuma: poslednjih 22 bajta + komentar do 64 KiB.
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (bytes.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxReadError("Fajl nije ispravan Excel (.xlsx) dokument (nedostaje kraj sadržaja).");

  const entryCount = bytes.readUInt16LE(eocd + 10);
  const dirOffset = bytes.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || dirOffset === 0xffffffff) {
    throw new XlsxReadError("ZIP64 arhive nisu podržane.");
  }

  /** @type {Map<string, Buffer>} */
  const entries = new Map();
  let p = dirOffset;
  for (let n = 0; n < entryCount; n += 1) {
    if (bytes.readUInt32LE(p) !== SIG_CENTRAL) {
      throw new XlsxReadError("Excel (.xlsx) fajl je oštećen.");
    }
    const flags = bytes.readUInt16LE(p + 8);
    const method = bytes.readUInt16LE(p + 10);
    const compressedSize = bytes.readUInt32LE(p + 20);
    const nameLength = bytes.readUInt16LE(p + 28);
    const extraLength = bytes.readUInt16LE(p + 30);
    const commentLength = bytes.readUInt16LE(p + 32);
    const localOffset = bytes.readUInt32LE(p + 42);
    const name = bytes.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw new XlsxReadError("Šifrovani XLSX nije podržan.");
    if (bytes.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw new XlsxReadError(`Oštećen lokalni zapis za ${name}.`);
    }
    const localName = bytes.readUInt16LE(localOffset + 26);
    const localExtra = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const raw = bytes.subarray(start, start + compressedSize);

    if (method === 0) entries.set(name, Buffer.from(raw));
    else if (method === 8) entries.set(name, inflateRawSync(raw));
    else throw new XlsxReadError(`Nepodržan način sažimanja (${method}) za ${name}.`);
  }
  return entries;
}

/**
 * Opcioni prefiks imenskog prostora. Excel piše `<row>`, a .NET OpenXML SDK
 * (koji koriste mnogi poslovni programi) `<x:row>` — isti element.
 */
const NS = "(?:[A-Za-z_][\\w.-]*:)?";

/** @param {string} source */
const re = (source, flags = "g") => new RegExp(source.replaceAll("§", NS), flags);

const T_RE = re("<§t(?:\\s[^>]*)?>([\\s\\S]*?)<\\/§t>|<§t(?:\\s[^>]*)?\\/>");
const SI_RE = re("<§si(?:\\s[^>]*)?>([\\s\\S]*?)<\\/§si>|<§si\\s*\\/>");
const RPH_RE = re("<§rPh[\\s\\S]*?<\\/§rPh>");
const ROW_RE = re("<§row\\b([^>]*?)\\/>|<§row\\b([^>]*)>([\\s\\S]*?)<\\/§row>");
const CELL_RE = re("<§c\\b([^>]*?)\\/>|<§c\\b([^>]*)>([\\s\\S]*?)<\\/§c>");
const V_RE = re("<§v(?:\\s[^>]*)?>([\\s\\S]*?)<\\/§v>", "");
const IS_RE = re("<§is>([\\s\\S]*?)<\\/§is>", "");
const SHEET_RE = re("<§sheet\\b([^>]*?)\\/?>");
const REL_RE = re("<§Relationship\\b([^>]*?)\\/?>");

/** @param {string} text */
export function decodeXmlText(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    const code = entity.startsWith("#x")
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

/**
 * Sav tekst unutar `<t>` elemenata jednog fragmenta (bogat tekst ima više).
 * @param {string} fragment
 */
function joinedText(fragment) {
  let out = "";
  for (const m of fragment.matchAll(T_RE)) {
    out += decodeXmlText(m[1] ?? "");
  }
  return out;
}

/** @param {string} xml */
function parseSharedStrings(xml) {
  /** @type {string[]} */
  const out = [];
  for (const m of xml.matchAll(SI_RE)) {
    // Fonetski dodaci (`<rPh>`) nisu deo vrednosti.
    out.push(joinedText((m[1] ?? "").replace(RPH_RE, "")));
  }
  return out;
}

/** @param {string} ref  npr. `AB12` → 27 */
export function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0];
  if (!letters) throw new XlsxReadError(`Neispravna adresa ćelije: ${ref}`);
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** @param {string} tag */
function attr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXmlText(m[1]) : null;
}

/**
 * @param {string} xml
 * @param {string[]} shared
 * @returns {(string | null)[][]}
 */
function parseSheet(xml, shared) {
  /** @type {(string | null)[][]} */
  const rows = [];
  for (const rowMatch of xml.matchAll(ROW_RE)) {
    const rowAttrs = rowMatch[1] ?? rowMatch[2] ?? "";
    const rowNumber = Number(attr(rowAttrs, "r") ?? rows.length + 1);
    /** @type {(string | null)[]} */
    const cells = [];
    let nextCol = 0;
    for (const c of (rowMatch[3] ?? "").matchAll(CELL_RE)) {
      const attrs = c[1] ?? c[2] ?? "";
      const body = c[3] ?? "";
      const ref = attr(attrs, "r");
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = attr(attrs, "t");
      const v = V_RE.exec(body)?.[1];
      /** @type {string | null} */
      let value = null;
      if (type === "s") {
        if (v !== undefined) {
          const idx = Number(v);
          if (!Number.isInteger(idx) || idx < 0 || idx >= shared.length) {
            throw new XlsxReadError(`Nepostojeći deljeni tekst ${v} u ćeliji ${ref}.`);
          }
          value = shared[idx];
        }
      } else if (type === "inlineStr") {
        value = joinedText(IS_RE.exec(body)?.[1] ?? "");
      } else if (v !== undefined) {
        value = decodeXmlText(v);
      }
      while (cells.length < col) cells.push(null);
      cells[col] = value;
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  return rows;
}

/**
 * Čita sve listove radne sveske.
 *
 * @param {Buffer} bytes
 * @returns {{ name: string, rows: (string | null)[][] }[]}
 */
export function readXlsx(bytes) {
  const entries = unzipEntries(bytes);
  const text = (/** @type {string} */ path) => entries.get(path)?.toString("utf8") ?? null;

  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new XlsxReadError("Fajl nije XLSX (nema xl/workbook.xml).");
  const rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const shared = parseSharedStrings(text("xl/sharedStrings.xml") ?? "");

  /** @type {Map<string, string>} */
  const targets = new Map();
  for (const m of rels.matchAll(REL_RE)) {
    const id = attr(m[1], "Id");
    const target = attr(m[1], "Target");
    if (id && target) targets.set(id, target);
  }

  const sheets = [];
  for (const m of workbook.matchAll(SHEET_RE)) {
    const name = attr(m[1], "name");
    const rid = attr(m[1], "r:id");
    const target = rid ? targets.get(rid) : undefined;
    if (!name || !target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = text(path);
    if (xml === null) throw new XlsxReadError(`List „${name}" ne postoji u arhivi.`);
    sheets.push({ name, rows: parseSheet(xml, shared) });
  }
  return sheets;
}
