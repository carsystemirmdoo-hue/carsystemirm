/**
 * Roba u dolasku (2026-11-12) — ČISTA logika, bez baze.
 *
 *   - podrazumevani rok isporuke po dobavljaču (odluka vlasnika 2026-11-12), uvek promenljiv pri unosu;
 *   - odbrojavanje „stiže za 10–14 dana“ od dana porudžbine;
 *   - čitanje potvrde porudžbine iz tabele (zaglavlje po nazivu kolone ili ručno izabrane kolone);
 *   - prijem: POVEĆANJE stanja na potvrđenom lageru posle porudžbine = stigla roba.
 */

import { codeInName, compact, dashedCodeInName, measures, norm, words } from "../catalog/nameMatch.mjs";
import { parseAmount } from "../sales-tools/receivablesParse.mjs";

/**
 * Rok isporuke u danima od dana porudžbine (vlasnik, 2026-11-12):
 * Carsystem do 14 dana; Baslac i Norbin 7–10; R-M 14; C.A.R.FIT i Befar 14; Cosmos Lac je
 * nepredvidiv (dešavalo se i do 60 dana) — upisuje se 14, uz napomenu.
 */
export const LEAD_DEFAULTS = Object.freeze({
  Carsystem: { min: 0, max: 14 },
  Baslac: { min: 7, max: 10 },
  Norbin: { min: 7, max: 10 },
  "R-M": { min: 14, max: 14 },
  "C.A.R.FIT": { min: 14, max: 14 },
  Befar: { min: 14, max: 14 },
  "Cosmos Lac": { min: 14, max: 14, note: "Rok je nepouzdan — dešavalo se i do 60 dana." },
});
export const LEAD_FALLBACK = Object.freeze({ min: 14, max: 14 });

/** Dobavljači koje vlasnik bira pri unosu (redosled = učestalost porudžbina). */
export const SUPPLIERS = Object.freeze(["R-M", "Baslac", "Carsystem", "Cosmos Lac", "Norbin", "C.A.R.FIT", "Befar", "SATA", "RUPES", "Ostalo"]);

/** @param {string} supplier */
export function leadFor(supplier) {
  return /** @type {{ min: number, max: number, note?: string }} */ (LEAD_DEFAULTS[/** @type {keyof typeof LEAD_DEFAULTS} */ (supplier)] ?? LEAD_FALLBACK);
}

/** Opis roka: „do 14 dana“, „7–10 dana“, „14 dana“. */
export function leadLabel(/** @type {number} */ min, /** @type {number} */ max) {
  if (min <= 0) return `do ${max} ${daysWord(max)}`;
  return min === max ? `${max} ${daysWord(max)}` : `${min}–${max} dana`;
}

/** „1 stavka“, „3 stavke“, „5 stavki“ (11–14 stavki). */
export function stavki(/** @type {number} */ n) {
  const d = n % 10;
  const dd = n % 100;
  return `${n} ${d === 1 && dd !== 11 ? "stavka" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "stavke" : "stavki"}`;
}

const daysWord = (/** @type {number} */ n) => (n % 10 === 1 && n % 100 !== 11 ? "dan" : "dana");

const dayNo = (/** @type {string} */ iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);

/** Datum ISO + n dana. */
export function addDays(/** @type {string} */ iso, /** @type {number} */ n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Odbrojavanje od dana porudžbine do danas.
 * @returns {{ state: "stize" | "danas" | "kasni", min: number, max: number, late: number, label: string, expectedFrom: string, expectedTo: string }}
 */
export function countdown(/** @type {string} */ orderedOn, /** @type {number} */ leadMin, /** @type {number} */ leadMax, /** @type {string} */ today) {
  const passed = dayNo(today) - dayNo(orderedOn);
  const min = Math.max(0, leadMin - passed);
  const max = leadMax - passed;
  const expectedFrom = addDays(orderedOn, leadMin);
  const expectedTo = addDays(orderedOn, leadMax);
  if (max < 0) return { state: "kasni", min: 0, max: 0, late: -max, label: `kasni ${-max} ${daysWord(-max)}`, expectedFrom, expectedTo };
  if (max === 0) return { state: "danas", min: 0, max: 0, late: 0, label: "stiže danas (poslednji dan roka)", expectedFrom, expectedTo };
  const label = min <= 0 ? `stiže za najviše ${max} ${daysWord(max)}` : min === max ? `stiže za ${max} ${daysWord(max)}` : `stiže za ${min}–${max} dana`;
  return { state: "stize", min, max, late: 0, label, expectedFrom, expectedTo };
}

/* =========================================================================
 * Potvrda porudžbine iz tabele
 * ====================================================================== */

const fold = (/** @type {unknown} */ s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.:_/\\#()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nazivi kolona (posle `fold`); srpski, engleski i nemački (dobavljači šalju sva tri). */
export const ORDER_HEADERS = {
  code: ["sifra", "sifra artikla", "sifra proizvoda", "kataloski broj", "kat broj", "kat br", "art br", "art nr", "artikel nr", "artikelnummer", "article", "article no", "article number", "item", "item no", "item number", "item code", "code", "product code", "part no", "part number", "material", "materijal", "ref", "referenca", "sku"],
  name: ["naziv", "naziv artikla", "naziv proizvoda", "opis", "artikal", "proizvod", "description", "product", "product name", "item description", "name", "bezeichnung", "artikelbezeichnung"],
  qty: ["kolicina", "kol", "kom", "komada", "qty", "quantity", "menge", "ordered", "ordered qty", "potvrdjena kolicina", "potvrdjeno"],
  unit: ["jm", "j m", "jed mere", "jedinica mere", "unit", "uom", "einheit", "me"],
};

/** @param {unknown} cell */
function headerKey(cell) {
  const h = fold(cell);
  if (!h) return null;
  for (const [key, list] of Object.entries(ORDER_HEADERS)) if (list.includes(h)) return key;
  for (const [key, list] of Object.entries(ORDER_HEADERS)) if (list.some((s) => h.startsWith(`${s} `))) return key;
  return null;
}

/**
 * Zaglavlje: prvi red (u prvih 30) sa količinom i bar šifrom ili nazivom.
 * @param {unknown[][]} rows
 * @returns {{ index: number, columns: { code?: number, name?: number, qty?: number, unit?: number } } | null}
 */
export function findOrderHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    /** @type {Record<string, number>} */
    const map = {};
    (rows[i] ?? []).forEach((cell, c) => {
      const k = headerKey(cell);
      if (k && map[k] === undefined) map[k] = c;
    });
    if (map.qty !== undefined && (map.code !== undefined || map.name !== undefined)) return { index: i, columns: map };
  }
  return null;
}

/**
 * Stavke iz tabele. `columns` bira korisnik kada zaglavlje nije prepoznato (indeksi kolona, od 0);
 * `headerRow` je red zaglavlja (redovi iznad i on sam se preskaču).
 *
 * @param {unknown[][]} rows
 * @param {{ columns: { code?: number, name?: number, qty?: number, unit?: number }, headerRow: number }} [manual]
 * @returns {{ ok: boolean, reason?: string, headerRow: number, columns: Record<string, number>, lines: { supplierCode: string | null, supplierName: string, quantity: number, unit: string | null, row: number }[], skipped: number }}
 */
export function parseOrderSheet(rows, manual) {
  const found = manual ?? (() => {
    const h = findOrderHeader(rows);
    return h ? { columns: h.columns, headerRow: h.index } : null;
  })();
  if (!found) return { ok: false, reason: "zaglavlje", headerRow: -1, columns: {}, lines: [], skipped: 0 };
  const { columns, headerRow } = found;
  if (columns.qty === undefined || (columns.code === undefined && columns.name === undefined)) {
    return { ok: false, reason: "kolone", headerRow, columns, lines: [], skipped: 0 };
  }
  const lines = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cell = (/** @type {number | undefined} */ c) => (c === undefined ? null : row[c] ?? null);
    const code = cell(columns.code) === null ? null : String(cell(columns.code)).trim() || null;
    const name = cell(columns.name) === null ? "" : String(cell(columns.name)).replace(/\s+/g, " ").trim();
    const q = parseAmount(cell(columns.qty));
    if (!code && !name) continue; // prazan red
    // Zbir na dnu („Ukupno“) ili red bez količine nije stavka.
    if (/^(ukupno|total|summe|gesamt|svega)\b/i.test(fold(name || code))) continue;
    if (q === null || q === undefined || !(q > 0)) {
      skipped++;
      continue;
    }
    const unitRaw = cell(columns.unit);
    lines.push({ supplierCode: code, supplierName: name.slice(0, 200), quantity: Math.round(q * 1000) / 1000, unit: unitRaw === null ? null : String(unitRaw).trim().slice(0, 12) || null, row: r + 1 });
  }
  if (!lines.length) return { ok: false, reason: "prazno", headerRow, columns, lines, skipped };
  return { ok: true, headerRow, columns, lines, skipped };
}

/* =========================================================================
 * Prijem
 * ====================================================================== */

/**
 * Nov potvrđen lager za stavku koja čeka. Povećanje stanja od poslednjeg viđenog = primljeno
 * (najviše do naručene količine). Pad stanja je prodaja — samo se pamti novo stanje.
 * Artikal kojeg nije bilo u izvozu lagera (nepoznato stanje) računa se kao 0.
 *
 * @param {{ quantity: number, received: number, lastSeen: number | null }} line
 * @param {number | null} current  stanje na novom snimku (null = nema u izvozu)
 * @returns {{ received: number, lastSeen: number, arrived: boolean, delta: number }}
 */
export function settleArrival(line, current) {
  const seen = line.lastSeen ?? 0;
  const now = current ?? 0;
  const remaining = Math.max(0, line.quantity - line.received);
  const delta = Math.max(0, Math.min(now - seen, remaining));
  const received = Math.round((line.received + delta) * 1000) / 1000;
  return { received, lastSeen: now, arrived: received >= line.quantity - 1e-9, delta: Math.round(delta * 1000) / 1000 };
}

/**
 * Isti artikal u više porudžbina (redom od najstarije): povećanje stanja se troši jednom, ne po
 * svakoj stavci. Polazno stanje je najmanje „poslednje viđeno“ među stavkama tog artikla.
 *
 * @param {{ id: string, quantity: number, received: number, lastSeen: number | null }[]} lines  ista šifra, redom
 * @param {number | null} current
 * @returns {{ id: string, received: number, arrived: boolean }[]}
 */
export function allocateArrivals(lines, current) {
  const now = current ?? 0;
  const seen = Math.min(...lines.map((l) => l.lastSeen ?? 0));
  let left = Math.max(0, now - seen);
  return lines.map((l) => {
    const r = settleArrival({ quantity: l.quantity, received: l.received, lastSeen: now - left }, now);
    left = Math.max(0, left - r.delta);
    return { id: l.id, received: r.received, arrived: r.arrived };
  });
}

/* =========================================================================
 * Predlog našeg artikla za stavku dobavljača
 * ====================================================================== */

const codeKey = (/** @type {unknown} */ c) => norm(String(c ?? "")).replace(/[\s.\-/]+/g, "").replace(/^0+(?=\d)/, "");

/**
 * @typedef {{ id: string, code: string, name: string, unit: string | null }} IndexArticle
 * @param {IndexArticle[]} articles  artikli tog dobavljača (brend), bez artikala van programa
 */
export function buildArticleIndex(articles) {
  const df = new Map();
  const prepared = articles.map((a) => {
    const ws = new Set(words(a.name));
    for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
    return { ...a, ws, key: codeKey(a.code), nameCompact: compact(a.name) };
  });
  const n = prepared.length || 1;
  return { prepared, byKey: new Map(prepared.map((a) => [a.key, a])), idf: (/** @type {string} */ w) => Math.log(1 + n / (df.get(w) ?? 0.5)) };
}

/**
 * Do tri kandidata: ista šifra kao naša → sigurno; šifra dobavljača u našem nazivu → jak dokaz;
 * inače sličnost reči naziva (ređa reč vredi više).
 *
 * @param {{ supplierCode: string | null, supplierName: string }} line
 * @param {ReturnType<typeof buildArticleIndex>} index
 * @returns {{ id: string, code: string, name: string, unit: string | null, score: number, how: "sifra" | "naziv" }[]}
 */
export function rankArticles(line, index) {
  const exact = line.supplierCode ? index.byKey.get(codeKey(line.supplierCode)) : undefined;
  if (exact) return [{ id: exact.id, code: exact.code, name: exact.name, unit: exact.unit, score: 2, how: "sifra" }];
  const aw = new Set(words(line.supplierName));
  const sc = line.supplierCode ? compact(line.supplierCode).replace(/\s+/g, "") : "";
  // Brojčane šifre proizvoda u nazivu dobavljača („21-10“, „40-440“) — iste se javljaju i u našem nazivu.
  const dashed = [...norm(line.supplierName).matchAll(/(?:^|[^0-9])(\d{2,3})[-.](\d{2,4})(?![0-9])/g)].map((m) => `${m[1]}${m[2]}`);
  const am = measures(line.supplierName);
  const out = [];
  for (const a of index.prepared) {
    let common = 0;
    let total = 0;
    for (const w of aw) {
      const v = index.idf(w);
      total += v;
      if (a.ws.has(w)) common += v;
    }
    let score = total ? common / total : 0;
    if (sc.length >= 3 && codeInName(sc, a.nameCompact)) score += 1;
    if (dashed.some((d) => dashedCodeInName(d, a.name))) score += 1;
    // Pakovanje: 1 L ≠ 4 L. Kada obe strane nose meru, slaganje pomaže, neslaganje odmaže.
    const tm = measures(a.name);
    if (am.size && tm.size) score += [...am].some((m) => tm.has(m)) ? 0.3 : -0.5;
    if (score > 0.25) out.push({ id: a.id, code: a.code, name: a.name, unit: a.unit, score: Math.round(score * 1000) / 1000, how: /** @type {const} */ ("naziv") });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 3);
}
