/**
 * Ređanje bilo koje tabele portala po tekstu ćelije (2026-11-11).
 *
 * Ćelija se čita kao: datum (dd.mm.gggg. ili gggg-mm-dd), broj u srpskom zapisu
 * („1.234,56 RSD“, „40,9 %“, „-12 KOM“) ili tekst. Prazno i „—“ uvek idu na kraj,
 * u oba smera. Ćelija može da nosi `data-sort-value` kada prikazani tekst ne
 * odgovara pravoj vrednosti.
 */

const EMPTY = new Set(["", "—", "-", "–", "n/a"]);
const DMY = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const NUM = /^[-−]?\s?\d{1,3}(?:[.\s ]\d{3})*(?:,\d+)?(?![\d.])|^[-−]?\d+(?:,\d+)?(?![\d.])/;

/**
 * @param {string} raw
 * @returns {{ kind: "empty" } | { kind: "date", value: string } | { kind: "number", value: number } | { kind: "text", value: string }}
 */
export function cellValue(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (EMPTY.has(text.toLowerCase())) return { kind: "empty" };
  const dmy = DMY.exec(text);
  if (dmy) return { kind: "date", value: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` };
  const iso = ISO.exec(text);
  if (iso) return { kind: "date", value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  const num = NUM.exec(text);
  if (num) {
    const n = Number(num[0].replace(/[.\s ]/g, "").replace(",", ".").replace("−", "-"));
    if (Number.isFinite(n)) return { kind: "number", value: n };
  }
  return { kind: "text", value: text.toLocaleLowerCase("sr-Latn") };
}

/** Kolona je brojčana/datumska ako je takva većina nepraznih ćelija. */
export function columnKind(/** @type {ReturnType<typeof cellValue>[]} */ values) {
  const filled = values.filter((v) => v.kind !== "empty");
  if (!filled.length) return "text";
  for (const k of /** @type {const} */ (["date", "number"])) {
    if (filled.filter((v) => v.kind === k).length / filled.length >= 0.8) return k;
  }
  return "text";
}

/** Prvi klik: tekst rastuće (A→Ž), brojevi i datumi opadajuće (najveće/najnovije prvo). */
export const firstDir = (/** @type {string} */ kind) => (kind === "text" ? "asc" : "desc");

/**
 * Poredi dve ćelije za zadatu vrstu kolone i smer. Prazno ide na kraj u oba smera;
 * ćelija druge vrste u brojčanoj koloni ide posle brojeva.
 * @param {ReturnType<typeof cellValue>} a @param {ReturnType<typeof cellValue>} b
 * @param {"text" | "number" | "date"} kind @param {"asc" | "desc"} dir
 */
export function compareCells(a, b, kind, dir) {
  const rank = (/** @type {ReturnType<typeof cellValue>} */ v) => (v.kind === "empty" ? 2 : v.kind === kind || kind === "text" ? 0 : 1);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra !== 0) return 0;
  const sign = dir === "asc" ? 1 : -1;
  if (kind === "number") return sign * (/** @type {number} */ (/** @type {any} */ (a).value) - /** @type {number} */ (/** @type {any} */ (b).value));
  const av = String(/** @type {any} */ (a).value ?? "");
  const bv = String(/** @type {any} */ (b).value ?? "");
  return sign * av.localeCompare(bv, "sr-Latn", { numeric: true });
}
