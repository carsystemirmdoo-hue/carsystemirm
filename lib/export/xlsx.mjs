/**
 * Minimalan Office Open XML (.xlsx) pisač — jedan list, bez spoljnih biblioteka.
 *
 * Ranije je izvoz bio SpreadsheetML 2003 sa ekstenzijom .xls: Excel ga
 * otvara tek posle upozorenja da se format i ekstenzija ne slažu, a Numbers
 * ga ne otvara. Ovo je pravi .xlsx: ZIP (deflate iz `node:zlib`) sa
 * najmanjim skupom delova koji Excel, LibreOffice i Numbers prihvataju.
 *
 * Bezbednost ćelija: pisač NE emituje `<f>` (formulu) ni za jednu ćeliju.
 * Tekst ide kao `inlineStr`, broj kao `<v>`; tip određuje isključivo JS tip
 * vrednosti. Neutralizacija sadržaja (`guardSpreadsheetValue`) je posao
 * pozivaoca — vidi `serializers.mjs`.
 */

import { deflateRawSync } from "node:zlib";

/** @typedef {{ value: string | number, bold?: boolean }} XlsxCell */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** @param {Uint8Array} bytes */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** XML 1.0 ne dozvoljava kontrolne znakove osim taba i prelaza reda. */
function xmlText(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → A, 25 → Z, 26 → AA */
function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * @param {XlsxCell[][]} rows
 * @param {number[]} widths širina kolona u znakovima
 */
function sheetXml(rows, widths) {
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${columnName(c)}${r + 1}`;
          const style = cell.bold ? ' s="1"' : "";
          if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
            return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
          }
          const text = cell.value === null || cell.value === undefined ? "" : String(cell.value);
          if (text === "") return "";
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const STATIC_PARTS = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
};

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/**
 * ZIP arhiva (deflate), bez ekstra polja i komentara.
 *
 * @param {{ name: string, data: string }[]} entries
 * @returns {Uint8Array}
 */
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  // Fiksni datum (1. 1. 2026.) — isti ulaz daje iste bajtove.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(entry.data, "utf8");
    const packed = deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 imena
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, packed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(dosTime, 12);
    dir.writeUInt16LE(dosDate, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += local.length + name.length + packed.length;
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, ...central, end]));
}

/**
 * @param {XlsxCell[][]} rows
 * @param {{ sheetName?: string, widths?: number[] }} [options]
 * @returns {Uint8Array}
 */
export function buildXlsx(rows, options = {}) {
  const sheetName = (options.sheetName ?? "Izveštaj").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  return zip([
    { name: "[Content_Types].xml", data: STATIC_PARTS["[Content_Types].xml"] },
    { name: "_rels/.rels", data: STATIC_PARTS["_rels/.rels"] },
    { name: "xl/workbook.xml", data: workbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", data: STATIC_PARTS["xl/_rels/workbook.xml.rels"] },
    { name: "xl/styles.xml", data: STATIC_PARTS["xl/styles.xml"] },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(rows, options.widths ?? []) },
  ]);
}
