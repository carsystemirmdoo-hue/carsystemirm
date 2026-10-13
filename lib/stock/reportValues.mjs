/**
 * Brojevi i datumi iz BizniSoft izveštaja „Stanje zaliha" (dok. 65).
 *
 * Količina iz XLSX-a stiže kao broj. Iz CSV-a (ili XLSX ćelije sa tekstom) stiže
 * kao tekst sa decimalnim zarezom ili tačkom, ponekad i sa razdvajanjem hiljada.
 * „1.234" i „1,234" su dvosmisleni: to može biti 1234 ili 1,234. Takva vrednost se
 * tumači SAMO kada je separator za ceo fajl utvrđen iz nedvosmislenih vrednosti;
 * inače je greška — nikad se ne pogađa.
 */

const SPACES = /[\s  ']/g;

/**
 * @param {string} raw
 * @returns {{ kind: "int", value: number }
 *         | { kind: "decimal", sep: "," | ".", value: number }
 *         | { kind: "grouped", decimalSep: "," | ".", value: number }
 *         | { kind: "ambiguous", sep: "," | "." }
 *         | { kind: "invalid" }}
 */
export function classifyNumber(raw) {
  const s = String(raw ?? "").replace(SPACES, "");
  if (!s) return { kind: "invalid" };
  if (/^[+-]?\d+$/.test(s)) return { kind: "int", value: Number(s) };
  const neg = s.startsWith("-") ? -1 : 1;
  const body = s.replace(/^[+-]/, "");
  const hasComma = body.includes(",");
  const hasDot = body.includes(".");
  if (hasComma && hasDot) {
    // Poslednji separator je decimalni; drugi mora biti pravilno razdvajanje hiljada.
    const decimalSep = body.lastIndexOf(",") > body.lastIndexOf(".") ? "," : ".";
    const groupSep = decimalSep === "," ? "." : ",";
    const [intPart, frac, ...rest] = body.split(decimalSep);
    if (rest.length || !/^\d+$/.test(frac)) return { kind: "invalid" };
    const g = groupSep === "." ? "\\." : ",";
    if (!new RegExp(`^\\d{1,3}(${g}\\d{3})+$`).test(intPart)) return { kind: "invalid" };
    return { kind: "grouped", decimalSep, value: neg * Number(`${intPart.split(groupSep).join("")}.${frac}`) };
  }
  const sep = hasComma ? "," : hasDot ? "." : null;
  if (!sep) return { kind: "invalid" };
  const parts = body.split(sep);
  if (parts.some((p) => !/^\d+$/.test(p))) return { kind: "invalid" };
  if (parts.length > 2) {
    // „1.234.567" — samo razdvajanje hiljada, bez decimala.
    if (/^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => p.length === 3)) {
      return { kind: "grouped", decimalSep: sep === "," ? "." : ",", value: neg * Number(parts.join("")) };
    }
    return { kind: "invalid" };
  }
  if (parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0])) return { kind: "ambiguous", sep };
  return { kind: "decimal", sep, value: neg * Number(`${parts[0]}.${parts[1]}`) };
}

/**
 * Decimalni separator celog fajla iz nedvosmislenih vrednosti.
 * @param {string[]} raws
 * @returns {{ sep: "," | "." | null, mixed: boolean }}
 */
export function inferDecimalSeparator(raws) {
  const seen = new Set();
  for (const r of raws) {
    const c = classifyNumber(r);
    if (c.kind === "decimal") seen.add(c.sep);
    if (c.kind === "grouped") seen.add(c.decimalSep);
  }
  if (seen.size > 1) return { sep: null, mixed: true };
  return { sep: seen.size ? [...seen][0] : null, mixed: false };
}

/**
 * @param {unknown} cell broj iz XLSX-a ili tekst
 * @param {"," | "." | null} fileSep
 * @returns {{ ok: true, value: number } | { ok: false, reason: "prazno" | "dvosmislen_broj" | "neispravan_broj" }}
 */
export function parseQuantity(cell, fileSep) {
  if (cell === null || cell === undefined) return { ok: false, reason: "prazno" };
  if (typeof cell === "number") return Number.isFinite(cell) ? { ok: true, value: round3(cell) } : { ok: false, reason: "neispravan_broj" };
  const s = String(cell).trim();
  if (!s) return { ok: false, reason: "prazno" };
  const c = classifyNumber(s);
  if (c.kind === "int" || c.kind === "decimal") {
    if (c.kind === "decimal" && fileSep && c.sep !== fileSep) return { ok: false, reason: "dvosmislen_broj" };
    return { ok: true, value: round3(c.value) };
  }
  if (c.kind === "grouped") {
    if (fileSep && c.decimalSep !== fileSep) return { ok: false, reason: "dvosmislen_broj" };
    return { ok: true, value: round3(c.value) };
  }
  if (c.kind === "ambiguous") {
    if (!fileSep) return { ok: false, reason: "dvosmislen_broj" };
    const v = c.sep === fileSep ? Number(s.replace(SPACES, "").replace(c.sep, ".")) : Number(s.replace(SPACES, "").replace(c.sep, ""));
    return { ok: true, value: round3(v) };
  }
  return { ok: false, reason: "neispravan_broj" };
}

export function round3(x) {
  const r = Math.round((x + Math.sign(x) * Number.EPSILON) * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Datum iz izveštaja: „24.08.2026", „24.08.2026.", Excel serijski broj ili Date.
 * @returns {string | null} YYYY-MM-DD
 */
export function parseReportDate(cell) {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 10);
  if (typeof cell === "number" && Number.isFinite(cell) && cell > 20000 && cell < 80000) {
    // Excel 1900 sistem: dan 25569 = 1970-01-01.
    return new Date(Math.round((cell - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const m = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?/.exec(String(cell ?? ""));
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
