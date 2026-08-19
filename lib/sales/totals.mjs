/**
 * Bruto, povrati, korekcije i neto promet.
 *
 * Negativni dokumenti se čuvaju u izvornom obliku i ovde se samo razvrstavaju.
 * Nijedan negativan iznos se ne proglašava automatski fizičkim povratom robe —
 * razvrstavanje ide isključivo po vrsti dokumenta iz izvora.
 */

/** Vrste koje predstavljaju fizički povrat robe na lager. */
const PHYSICAL_RETURN = new Set(["povrat_robe"]);

/** Vrste koje smanjuju promet, ali roba se ne vraća. */
const VALUE_CORRECTION = new Set([
  "storno",
  "knjizno_odobrenje",
  "korekcija_cene",
  "korekcija_popusta",
]);

export const UNKNOWN_NEGATIVE_LABEL =
  "Vrsta negativnog dokumenta nije poznata iz izvora";

/**
 * @typedef {{ documentKind: string, quantity: number, lineAmount: number, [key: string]: any }} SalesRow
 */

/**
 * @param {readonly SalesRow[]} rows
 */
export function summarize(rows) {
  let gross = 0;
  let returnValue = 0;
  let returnedQuantity = 0;
  let correctionValue = 0;
  let unknownNegativeValue = 0;
  let unknownNegativeCount = 0;

  for (const row of rows) {
    const amount = Number(row.lineAmount) || 0;
    const quantity = Number(row.quantity) || 0;

    if (amount >= 0) {
      gross += amount;
      continue;
    }

    if (PHYSICAL_RETURN.has(row.documentKind)) {
      returnValue += amount;
      returnedQuantity += quantity;
    } else if (VALUE_CORRECTION.has(row.documentKind)) {
      correctionValue += amount;
    } else {
      // Nepoznata vrsta se ne svrstava ni u povrat ni u korekciju — ulazi u
      // neto promet, ali se prikazuje odvojeno da se zna da je nerazvrstana.
      unknownNegativeValue += amount;
      unknownNegativeCount += 1;
    }
  }

  return {
    gross: round(gross),
    returnValue: round(returnValue),
    returnedQuantity: round(returnedQuantity, 3),
    correctionValue: round(correctionValue),
    unknownNegativeValue: round(unknownNegativeValue),
    unknownNegativeCount,
    net: round(gross + returnValue + correctionValue + unknownNegativeValue),
  };
}

/**
 * Grupisanje prometa po ključu (kupac, komercijalista, artikal, grupa, period).
 *
 * @template {SalesRow} T
 * @param {readonly T[]} rows
 * @param {(row: T) => string} keyOf
 * @param {(row: T) => string} [labelOf]
 */
export function summarizeBy(rows, keyOf, labelOf) {
  /** @type {Map<string, { key: string, label: string, rows: T[] }>} */
  const buckets = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label: labelOf ? labelOf(row) : key, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      invoiceCount: new Set(
        bucket.rows.map((row) => row.invoiceId ?? row.invoiceNumber),
      ).size,
      ...summarize(bucket.rows),
    }))
    .sort((a, b) => b.net - a.net);
}

/**
 * Promena u odnosu na prethodni period. Vraća `null` kada osnova ne postoji —
 * deljenje nulom se ne prikazuje kao rast od 100%.
 *
 * @param {number} current
 * @param {number} previous
 * @returns {number | null}
 */
export function deltaPercent(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

/**
 * Prosečna vrednost fakture. Bez faktura vraća `null`, ne nulu.
 *
 * @param {number} net
 * @param {number} invoiceCount
 */
export function averageInvoice(net, invoiceCount) {
  if (!invoiceCount) return null;
  return round(net / invoiceCount);
}

/**
 * Udeo najvećih kupaca u ukupnom prometu.
 *
 * @param {readonly { net: number }[]} sorted opadajuće sortirano
 * @param {number} top
 */
export function concentration(sorted, top = 10) {
  const total = sorted.reduce((sum, row) => sum + row.net, 0);
  if (total <= 0) return null;
  const head = sorted.slice(0, top).reduce((sum, row) => sum + row.net, 0);
  return round((head / total) * 100, 1);
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
