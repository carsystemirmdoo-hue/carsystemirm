/**
 * Promene cena i rabata koje su doneli drugi — pregled za vlasnika (2026-11-09).
 *
 * Čista logika, bez baze: grupisanje pravila u „blokove" (jedna odluka
 * komercijaliste = jedan red, i kada obuhvata 40 artikala) i dnevni zbir za
 * obaveštenje. Vlasnik treba da vidi KO je promenio, KOME, ŠTA i SA KOLIKO NA
 * KOLIKO — ne 40 redova iste odluke.
 */

import { percent } from "../ordering/panelFormat.mjs";

/** @typedef {"approved"|"rejected"|"revoked"} DecisionKind */

/**
 * @typedef {object} ChangeRow
 * @property {string} id
 * @property {string | null} sourceBatch
 * @property {string | null} customerId
 * @property {string | null} customerName
 * @property {string} productScope      article | product_group | brand | all
 * @property {string | null} brand
 * @property {string | null} productGroup
 * @property {string | null} articleCode
 * @property {string | null} articleName
 * @property {string} valueKind          discount_percent | net_price
 * @property {number | null} newValue
 * @property {number | null} oldValue    vrednost pravila koje ovo menja (null = novo pravilo)
 * @property {string | null} paymentCondition
 * @property {string} effectiveFrom
 * @property {string} status
 * @property {string} decidedAt          ISO vreme odluke
 * @property {string} decidedById
 * @property {string} decidedByName
 * @property {string | null} proposedByName
 * @property {string | null} reason
 */

/** Stanje pravila → vrsta odluke. Predlog bez odluke nije promena. */
/** @param {string} status @returns {DecisionKind | null} */
export function decisionOf(status) {
  if (status === "rejected") return "rejected";
  if (status === "revoked") return "revoked";
  if (status === "draft" || status === "pending_approval") return null;
  return "approved";
}

export const DECISION_LABELS = Object.freeze({ approved: "Odobrio", rejected: "Odbio", revoked: "Opozvao" });

/** Čitljiv obuhvat jednog pravila. */
export function scopeLabel(row) {
  switch (row.productScope) {
    case "article":
      return row.articleName ? `${row.articleName}${row.articleCode ? ` (${row.articleCode})` : ""}` : (row.articleCode ?? "artikal");
    case "brand":
      return `grupa „${row.brand ?? "—"}"`;
    case "product_group":
      return `grupa proizvoda „${row.productGroup ?? "—"}"`;
    default:
      return "svi artikli";
  }
}

/** `20 %` ili `1.234,00 RSD neto`; null → „—". */
export function valueLabel(valueKind, value) {
  if (value === null || value === undefined) return "—";
  if (valueKind === "net_price") {
    return `${new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} RSD neto`;
  }
  return percent(value);
}

/** „20 % → 25 %" ili „novo: 25 %". */
export function transitionLabel(valueKind, oldValue, newValue) {
  return oldValue === null || oldValue === undefined
    ? `novo: ${valueLabel(valueKind, newValue)}`
    : `${valueLabel(valueKind, oldValue)} → ${valueLabel(valueKind, newValue)}`;
}

/**
 * @typedef {object} ChangeBlock
 * @property {string} key
 * @property {DecisionKind} decision
 * @property {string} decidedAt
 * @property {string} decidedById
 * @property {string} decidedByName
 * @property {string | null} proposedByName
 * @property {string | null} customerId
 * @property {string | null} customerName
 * @property {string} effectiveFrom
 * @property {string | null} reason
 * @property {string} valueKind
 * @property {ChangeRow[]} items
 */

/**
 * Pravila → blokovi. Blok = ista serija (source_batch), isti kupac, ista osoba
 * i ista vrsta odluke. Pravilo bez serije je sam svoj blok.
 *
 * @param {ChangeRow[]} rows
 */
export function groupChanges(rows) {
  /** @type {Map<string, ChangeBlock>} */
  const blocks = new Map();
  for (const row of rows) {
    const decision = decisionOf(row.status);
    if (!decision) continue;
    const key = row.sourceBatch
      ? `${row.sourceBatch}|${row.customerId ?? "-"}|${row.decidedById}|${decision}`
      : `pravilo|${row.id}`;
    let block = blocks.get(key);
    if (!block) {
      block = {
        key,
        decision,
        decidedAt: row.decidedAt,
        decidedById: row.decidedById,
        decidedByName: row.decidedByName,
        proposedByName: row.proposedByName,
        customerId: row.customerId,
        customerName: row.customerName,
        effectiveFrom: row.effectiveFrom,
        reason: row.reason,
        valueKind: row.valueKind,
        items: [],
      };
      blocks.set(key, block);
    }
    if (row.decidedAt > block.decidedAt) block.decidedAt = row.decidedAt;
    if (row.effectiveFrom < block.effectiveFrom) block.effectiveFrom = row.effectiveFrom;
    block.items.push(row);
  }
  return [...blocks.values()]
    .map((b) => ({ ...b, ...summarizeItems(b.items) }))
    .sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : a.decidedAt > b.decidedAt ? -1 : 0));
}

/** Sažetak bloka: obuhvat i prelazi vrednosti (npr. „12 × 20 % → 25 %"). */
function summarizeItems(items) {
  const scope = items.length === 1 ? scopeLabel(items[0]) : `${items.length} pravila (${[...new Set(items.map(scopeLabel))].slice(0, 3).join(", ")}${items.length > 3 ? ", …" : ""})`;
  /** @type {Map<string, { label: string, n: number }>} */
  const transitions = new Map();
  for (const it of items) {
    const label = transitionLabel(it.valueKind, it.oldValue, it.newValue);
    const t = transitions.get(label) ?? { label, n: 0 };
    t.n += 1;
    transitions.set(label, t);
  }
  const list = [...transitions.values()].sort((a, b) => b.n - a.n);
  return {
    scope,
    transitions: list,
    change: list.map((t) => (items.length > 1 ? `${t.n} × ${t.label}` : t.label)).join(" · "),
  };
}

/** Osobe koje su odlučivale u skupu blokova, za filter i zbir po osobi. */
export function peopleOf(blocks) {
  /** @type {Map<string, { id: string, name: string, blocks: number }>} */
  const people = new Map();
  for (const b of blocks) {
    const p = people.get(b.decidedById) ?? { id: b.decidedById, name: b.decidedByName, blocks: 0 };
    p.blocks += 1;
    people.set(b.decidedById, p);
  }
  return [...people.values()].sort((a, b) => b.blocks - a.blocks || a.name.localeCompare(b.name, "sr"));
}

/** Najviše ovoliko poslednjih promena nosi dnevni zbir u sebi. */
export const DIGEST_RECENT = 8;

/**
 * Dnevni zbir: postojeći kontekst + jedna nova odluka → novi kontekst, naslov
 * i tekst obaveštenja. Jedno obaveštenje po danu, koje se dopunjuje.
 *
 * @param {{ ukupno?: number, poOsobi?: Record<string, number>, poslednje?: string[], upozorenja?: number } | null} previous
 * @param {{ day: string, actorName: string, line: string, warning: boolean }} change
 */
export function mergeDigest(previous, change) {
  const poOsobi = { ...(previous?.poOsobi ?? {}) };
  poOsobi[change.actorName] = (poOsobi[change.actorName] ?? 0) + 1;
  const context = {
    dan: change.day,
    ukupno: (previous?.ukupno ?? 0) + 1,
    poOsobi,
    upozorenja: (previous?.upozorenja ?? 0) + (change.warning ? 1 : 0),
    poslednje: [`${change.actorName} — ${change.line}`, ...(previous?.poslednje ?? [])].slice(0, DIGEST_RECENT),
  };
  const [y, m, d] = change.day.split("-");
  const people = Object.entries(poOsobi)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sr"))
    .map(([name, n]) => `${name} ${n}`)
    .join(", ");
  const n = context.ukupno;
  const title = `Promene cena i rabata ${d}/${m}/${y}: ${n} ${n === 1 ? "odluka" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "odluke" : "odluka"} (${people})`;
  const body =
    context.poslednje.join("\n") +
    (n > context.poslednje.length ? `\n… i još ${n - context.poslednje.length}. Sve promene su na stranici „Promene komercijalista".` : "");
  return { context, title, body, severity: context.upozorenja > 0 ? "warning" : "info" };
}
