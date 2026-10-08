/**
 * „Poručite ponovo" — pravila bez baze i bez Reacta.
 *
 * Tri stvari se ovde odlučuju i nigde drugde:
 *   1. da li je uobičajena količina POUZDANA (inače se ne prikazuje);
 *   2. kratak, činjeničan razlog zašto je artikal na listi;
 *   3. da li artikal sme da nosi sliku i put do stranice proizvoda.
 *
 * Cena se ovde ne pojavljuje ni kao ulaz. Istorijska cena prikazana pored
 * kataloškog proizvoda čita se kao važeća, a to nije.
 */

/** Najmanje kupovina (dokumenata) za procenu količine. */
export const QUANTITY_MIN_EVENTS = 3;
/** Najveći odnos gornje i donje granice uobičajenog raspona. */
export const QUANTITY_MAX_SPREAD = 3;
/** Koliko artikala lista prikazuje. */
export const REORDER_LIMIT = 8;

const RHYTHM_STATUSES = new Set(["overdue", "due", "due_soon", "not_yet"]);

function quantile(sorted, p) {
  // Najbliži rang: vrednost koja je stvarno kupljena, ne interpolacija.
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

/**
 * Uobičajena količina po kupovini, ili `null` kada nije pouzdana.
 *
 * Količine su ZBIR po dokumentu (jedna kupovina = jedan dokument). Pouzdano
 * znači: najmanje tri kupovine, jedna ista poznata jedinica mere, sve količine
 * pozitivne i raspon (25.–75. percentil) ne širi od trostrukog. Sve ostalo je
 * nagađanje, pa se ne prikazuje.
 *
 * @param {{ quantity: number, units: (string|null)[] }[]} events
 * @returns {{ low: number, high: number, unit: string } | null}
 */
export function usualQuantity(events) {
  if (!Array.isArray(events) || events.length < QUANTITY_MIN_EVENTS) return null;
  const units = new Set(events.flatMap((e) => e.units ?? []).map((u) => (u ?? "").trim()));
  if (units.size !== 1) return null;
  const [unit] = units;
  if (!unit) return null;
  const quantities = events.map((e) => Number(e.quantity));
  if (quantities.some((q) => !Number.isFinite(q) || q <= 0)) return null;

  const sorted = [...quantities].sort((a, b) => a - b);
  const low = quantile(sorted, 0.25);
  const high = quantile(sorted, 0.75);
  if (high / low > QUANTITY_MAX_SPREAD) return null;
  return { low, high, unit };
}

export function formatQuantity(q) {
  if (!q) return null;
  const n = (v) => (Number.isInteger(v) ? String(v) : v.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 2 }));
  return q.low === q.high ? `${n(q.low)} ${q.unit}` : `${n(q.low)}–${n(q.high)} ${q.unit}`;
}

function dana(n) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

function puta(n) {
  return n % 10 === 1 && n % 100 !== 11 ? `${n} put` : `${n} puta`;
}

export function srDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
}

/**
 * Razlog u jednoj rečenici, samo iz činjenica.
 *
 * Ritam („obično na ~30 dana") se pominje samo kada je obračun aktuelan za
 * ovog kupca i status nije zastareo novom kupovinom. Kupcu se nikad ne kaže
 * „kasnite" — kaže se koliko je prošlo i koliko je uobičajeno.
 *
 * @param {{ eventCount: number, lastPurchaseOn: string, daysSinceLastPurchase: number,
 *   status?: string|null, medianIntervalDays?: number|null, rhythmCurrent?: boolean }} a
 */
export function reorderReason(a) {
  const bought = `Kupljeno ${puta(a.eventCount)}, poslednji put ${srDay(a.lastPurchaseOn)}`;
  if (a.rhythmCurrent && a.medianIntervalDays && RHYTHM_STATUSES.has(a.status ?? "")) {
    return `${bought} Obično na ~${dana(a.medianIntervalDays)}; od poslednje kupovine je prošlo ${dana(a.daysSinceLastPurchase)}.`;
  }
  return bought;
}

/**
 * Da li veza sme da nosi sliku i link na proizvod. Samo potvrđena (`mapped`)
 * veza na proizvod koji postoji u katalogu. Predlog (`suggested`) nije veza.
 */
export function linkedProduct(mapping, catalogHas) {
  return Boolean(
    mapping &&
      mapping.status === "mapped" &&
      typeof mapping.catalogProductSlug === "string" &&
      mapping.catalogProductSlug.length > 0 &&
      catalogHas(mapping.catalogProductSlug),
  );
}

/**
 * Varijanta se prikazuje samo ako oznaka iz veze postoji u selektoru tog
 * proizvoda. Nepostojeća oznaka se ne „popravlja" — prikazuje se proizvod bez
 * varijante.
 *
 * @param {string|null} variantId
 * @param {{ id?: string|null, sku?: string|null, label?: string|null }[]} options
 * @returns {{ key: string, label: string } | null}
 */
export function resolveVariant(variantId, options) {
  if (!variantId) return null;
  const wanted = variantId.trim().toLowerCase();
  const hit = (options ?? []).find(
    (o) => (o.sku && o.sku.toLowerCase() === wanted) || (o.id && o.id.toLowerCase() === wanted),
  );
  if (!hit) return null;
  return { key: hit.sku ?? hit.id, label: hit.label ?? hit.sku ?? hit.id };
}

const PRIORITY = { overdue: 0, due: 1, due_soon: 2 };

/**
 * Redosled: najpre artikli čiji uobičajeni termin je tu ili prošao (samo uz
 * aktuelan obračun), zatim po poslednjoj kupovini. Artikli koje kupac nije
 * kupio duže od godinu dana ne ulaze — nisu „ponovo", nego istorija.
 *
 * @template {{ articleCode: string, lastPurchaseOn: string, daysSinceLastPurchase: number, status?: string|null, rhythmCurrent?: boolean }} T
 * @param {T[]} items
 * @param {number} [limit]
 * @returns {T[]}
 */
export function orderReorderItems(items, limit = REORDER_LIMIT) {
  return items
    .filter((a) => a.daysSinceLastPurchase <= 365)
    .map((a) => ({ a, p: a.rhythmCurrent && a.status in PRIORITY ? PRIORITY[a.status] : 9 }))
    .sort((x, y) => x.p - y.p || y.a.lastPurchaseOn.localeCompare(x.a.lastPurchaseOn) || x.a.articleCode.localeCompare(y.a.articleCode))
    .slice(0, limit)
    .map((x) => x.a);
}
