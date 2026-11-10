/**
 * Tabela dugovanja kancelarije → otvorene fakture (2026-11-10).
 *
 * Kancelarija vodi neplaćene i delimično plaćene fakture u Google tabeli. Raspored kolona nije
 * fiksan: zaglavlje se prepoznaje po nazivu (kupac/PIB/šifra, faktura, datum, valuta, iznos,
 * uplaćeno, ostatak). Bez kolone ostatka, ostatak = iznos − uplaćeno.
 *
 * Pravila:
 *   - red bez kupca a sa fakturom/iznosom nasleđuje kupca iz reda iznad (grupisane tabele);
 *   - red „Ukupno…“ se preskače;
 *   - ostatak ≤ 0 znači plaćeno → red se ne uvozi (broji se u `paidRows`);
 *   - nečitljiv iznos je upozorenje, ne tiha nula.
 */

const fold = (/** @type {unknown} */ s) =>
  String(s ?? "")
    .toLocaleLowerCase("sr-Latn")
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.:_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nazivi kolona (posle `fold`). Redosled ključeva je i prioritet pri dvosmislenosti. */
export const HEADER_SYNONYMS = {
  remaining: ["ostatak", "ostatak duga", "ostalo", "preostalo", "preostalo za uplatu", "saldo", "dug", "dugovanje", "neplaceno", "za naplatu", "otvoreno"],
  paid: ["uplaceno", "placeno", "uplata", "uplate", "potrazuje", "placeni iznos", "uplaceni iznos"],
  amount: ["iznos", "iznos fakture", "ukupno", "za uplatu", "vrednost", "vrednost fakture", "duguje", "iznos sa pdv", "iznos sa pdv om"],
  invoice: ["faktura", "broj fakture", "br fakture", "dokument", "broj dokumenta", "br dokumenta", "racun", "broj racuna", "br racuna"],
  issued: ["datum", "datum fakture", "datum izdavanja", "datum dokumenta", "datum racuna"],
  due: ["valuta", "rok", "rok placanja", "datum valute", "dospece", "datum dospeca", "dospeva"],
  pib: ["pib", "pib kupca"],
  code: ["sifra", "sifra partnera", "sifra kupca", "sifra komitenta", "partner sifra"],
  customer: ["kupac", "partner", "naziv", "naziv kupca", "naziv partnera", "firma", "komitent", "klijent"],
  note: ["napomena", "komentar", "status", "opis"],
};

/** @param {unknown} cell */
function columnOf(cell) {
  const h = fold(cell);
  if (!h) return null;
  for (const [key, list] of Object.entries(HEADER_SYNONYMS)) if (list.includes(h)) return key;
  for (const [key, list] of Object.entries(HEADER_SYNONYMS)) if (list.some((s) => h.startsWith(`${s} `))) return key;
  return null;
}

/**
 * Zaglavlje: prvi red (u prvih 20) sa kolonom kupca/PIB-a/šifre i bar jednom novčanom kolonom.
 * @param {unknown[][]} rows
 */
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    /** @type {Record<string, number>} */
    const map = {};
    (rows[i] ?? []).forEach((cell, c) => {
      const k = columnOf(cell);
      if (k && map[k] === undefined) map[k] = c;
    });
    const money = map.remaining !== undefined || map.amount !== undefined;
    // Tabela kancelarije: kupac je u prvoj koloni čak i kad joj naslov nije prepoznat („t“).
    if (money && map.invoice !== undefined && map.customer === undefined && map.pib === undefined && map.code === undefined && map.invoice > 0) {
      map.customer = 0;
    }
    const who = map.customer !== undefined || map.pib !== undefined || map.code !== undefined;
    if (who && money) return { index: i, columns: map };
  }
  return null;
}

/**
 * Broj u srpskom ili engleskom zapisu: „1.234,56“, „1 234,56“, „1234.56“, „(500)“, „-500 RSD“.
 * @param {unknown} v
 * @returns {number | null | undefined} null = prazno, undefined = nečitljivo
 */
export function parseAmount(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/\s| |rsd|din\.?|дин/gi, "");
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (!s || !/^[0-9.,]+$/.test(s)) return undefined;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const th = dec === "." ? "," : ".";
    s = s.split(th).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if ((s.match(/\./g) ?? []).length > 1) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return neg ? -n : n;
}

const iso = (/** @type {number} */ y, /** @type {number} */ m, /** @type {number} */ d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/**
 * Datum: „10.11.2026.“, „10/11/2026“, „2026-11-10“, „10.11.26“ ili serijski broj tabele (Excel/Sheets).
 * @param {unknown} v
 * @returns {string | null}
 */
export function parseDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
    return dt.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\.?$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(y, Number(m[2]), Number(m[1]));
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  return null;
}

/** PIB: tačno 9 cifara (razmaci i tačke se uklanjaju), inače null. */
export function normalizePib(/** @type {unknown} */ v) {
  if (v === null || v === undefined) return null;
  const s = String(typeof v === "number" ? Math.round(v) : v).replace(/[\s.\-]/g, "");
  return /^\d{9}$/.test(s) ? s : null;
}

const text = (/** @type {unknown} */ v, n = 200) => {
  if (v === null || v === undefined) return null;
  const s = String(typeof v === "number" && Number.isInteger(v) ? v : v).trim();
  return s ? s.slice(0, n) : null;
};

const TOTAL_ROW = /^(ukupno|svega|total|zbir|sum)\b/;

/**
 * @typedef {{ row: number, customerLabel: string, pib: string | null, partnerCode: string | null,
 *   invoiceNumber: string | null, issuedOn: string | null, dueOn: string | null,
 *   amount: number | null, paid: number | null, remaining: number, note: string | null }} ReceivableLine
 */

/**
 * @param {unknown[][]} rows  ćelije lista (prvi list Google tabele ili otpremljenog fajla)
 * @returns {{ ok: boolean, error: string | null, columns: string[], lines: ReceivableLine[], customers: { row: number, label: string }[], paidRows: number, warnings: { row: number, text: string }[] }}
 */
export function parseReceivables(rows) {
  const header = findHeader(rows);
  if (!header) {
    return {
      ok: false,
      error: "U tabeli nije pronađeno zaglavlje. Potrebna je kolona sa kupcem (naziv, PIB ili šifra) i kolona sa iznosom ili ostatkom.",
      columns: [],
      lines: [],
      customers: [],
      paidRows: 0,
      warnings: [],
    };
  }
  const c = header.columns;
  const at = (/** @type {unknown[]} */ r, /** @type {string} */ k) => (c[k] === undefined ? null : r[c[k]] ?? null);
  /** @type {ReceivableLine[]} */
  const lines = [];
  /** @type {{ row: number, text: string }[]} */
  const warnings = [];
  let paidRows = 0;
  /** @type {{ row: number, label: string }[]} */
  const customers = [];
  /** @type {{ label: string | null, pib: string | null, code: string | null }} */
  let carry = { label: null, pib: null, code: null };

  for (let i = header.index + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (!r.some((x) => x !== null && x !== undefined && String(x).trim() !== "")) continue;
    const rowNo = i + 1;
    const label = text(at(r, "customer"));
    const pibRaw = at(r, "pib");
    const pib = normalizePib(pibRaw);
    const code = text(at(r, "code"), 40);
    const invoice = text(at(r, "invoice"), 80);
    if (label && TOTAL_ROW.test(fold(label))) continue;
    if (!label && !invoice && TOTAL_ROW.test(fold(r.find((x) => x !== null && String(x).trim() !== "")))) continue;

    const amountRaw = at(r, "amount");
    const paidRaw = at(r, "paid");
    const remRaw = at(r, "remaining");
    const amount = parseAmount(amountRaw);
    const paid = parseAmount(paidRaw);
    const rem = parseAmount(remRaw);
    if (amount === undefined || paid === undefined || rem === undefined) {
      warnings.push({ row: rowNo, text: "nečitljiv iznos — red nije uvezen" });
      continue;
    }

    const own = label || pib || code;
    if (own) {
      carry = { label, pib, code };
      if (label) customers.push({ row: rowNo, label });
    }
    // Red bez fakture i bez iznosa (naslov kupca, pretplata, kompenzacija…) se preskače bez upozorenja.
    if (!invoice && amount === null && rem === null) continue;
    const who = own ? { label, pib, code } : carry;
    if (!who.label && !who.pib && !who.code) {
      warnings.push({ row: rowNo, text: "red bez kupca — nije uvezen" });
      continue;
    }

    const remaining = rem !== null ? rem : amount !== null ? amount - (paid ?? 0) : null;
    if (remaining === null) {
      warnings.push({ row: rowNo, text: "nema iznosa ni ostatka — red nije uvezen" });
      continue;
    }
    if (remaining <= 0.004) {
      paidRows += 1;
      continue;
    }
    if (pibRaw !== null && pibRaw !== "" && !pib) warnings.push({ row: rowNo, text: `PIB „${String(pibRaw).slice(0, 20)}“ nije ispravan (9 cifara)` });
    lines.push({
      row: rowNo,
      customerLabel: who.label ?? who.pib ?? who.code ?? "",
      pib: who.pib,
      partnerCode: who.code,
      invoiceNumber: invoice,
      issuedOn: parseDate(at(r, "issued")),
      dueOn: parseDate(at(r, "due")),
      amount,
      paid,
      remaining: Math.round(remaining * 100) / 100,
      note: text(at(r, "note"), 200),
    });
  }

  const seen = new Map();
  for (const l of lines) {
    if (!l.invoiceNumber) continue;
    const k = `${l.pib ?? l.partnerCode ?? fold(l.customerLabel)}|${l.invoiceNumber}`;
    if (seen.has(k)) warnings.push({ row: l.row, text: `faktura ${l.invoiceNumber} se ponavlja (i u redu ${seen.get(k)})` });
    else seen.set(k, l.row);
  }
  return { ok: true, error: null, columns: Object.keys(c), lines, customers, paidRows, warnings };
}

/** Pravni oblici i skraćenice koje ne razlikuju kupce. */
const LEGAL = /\b(d ?o ?o|doo|a ?d|str|stzr|sztr|szutr|szr|sur|sptur|stur|ztr|sr|pr|preduzetnik|ortacko drustvo|od|ad)\b/g;

/**
 * Ključ naziva kupca: bez mesta posle zareza („ANTONIJEV, PANČEVO“ → „antonijev“), pravnog oblika,
 * interpunkcije i dijakritika (đ → d, dj → d, jer baza ponegde ima „NAD“ umesto „NAĐ“).
 * @param {unknown} s @param {{ keepPlace?: boolean }} [opts]
 */
export function nameKey(s, opts = {}) {
  const raw = String(s ?? "");
  const name = opts.keepPlace ? raw : raw.split(",")[0];
  return String(name)
    .toLocaleLowerCase("sr-Latn")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/dj/g, "d")
    .replace(/[.:_/\\\-",'()&]+/g, " ")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesto iz „naziv, mesto“ (ili prazno). */
export function placeOf(/** @type {unknown} */ s) {
  const parts = String(s ?? "").split(",");
  return parts.length > 1 ? nameKey(parts.slice(1).join(" "), { keepPlace: true }) : "";
}

/**
 * Dana posle dospeća (valute); bez valute nema kašnjenja.
 * @param {string | null} dueOn @param {string} today
 * @returns {number | null} broj dana posle dospeća (negativno = još nije dospelo)
 */
export function daysOverdue(dueOn, today) {
  if (!dueOn) return null;
  return Math.round((Date.parse(today) - Date.parse(dueOn)) / 864e5);
}
