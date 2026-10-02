/**
 * Provera redosleda predloga unazad — čista funkcija, bez baze i bez sata.
 *
 * Na svakom istorijskom preseku (`asOf`) koristi SAMO događaje do tog dana:
 * `cadence_v1` se računa nad tadašnjom istorijom, pravilo bira listu, a
 * pogodak je kupovina istog artikla u narednih `horizonDays` dana. Budući
 * događaji ulaze samo u ocenu pogotka, nikad u izbor.
 *
 * Pogodak NIJE dokaz da je razgovor pomogao (kupac bi možda kupio i bez
 * njega), a kupovina kod drugog dobavljača se ne vidi. Meri se samo da li je
 * redosled stavio napred artikle koje je kupac zaista ponovo uzeo.
 */

import { addDays, dayNumber, evaluatePair } from "./cadence.mjs";

/**
 * @typedef {object} PurchaseEvent
 * @property {string} article
 * @property {string} date             `YYYY-MM-DD` (datum izdavanja)
 * @property {string | null} [revokedOn]  dan od kog je kupovina poništena (storno); `null` = važi
 */

/**
 * Grupa kupca NA DAN PRESEKA, samo iz tada poznatih dana kupovine.
 * Redosled provere: novi → neaktivan → sezonski → redovan → povremen.
 *
 * @param {string[]} purchaseDays  sortirani, jedinstveni dani kupovine ≤ asOf
 * @param {string} asOf
 */
export function customerSegmentAt(purchaseDays, asOf) {
  const t = dayNumber(asOf);
  const first = dayNumber(purchaseDays[0]);
  const last = dayNumber(purchaseDays[purchaseDays.length - 1]);
  if (t - first <= 180) return "novi";
  if (t - last > 180) return "neaktivan";
  const last24 = purchaseDays.filter((d) => t - dayNumber(d) < 730);
  if (t - first >= 730 && last24.length >= 8) {
    const perMonth = new Map();
    for (const d of last24) perMonth.set(d.slice(5, 7), (perMonth.get(d.slice(5, 7)) ?? 0) + 1);
    const top4 = [...perMonth.values()].sort((a, b) => b - a).slice(0, 4).reduce((s, x) => s + x, 0);
    if (top4 / last24.length >= 0.7) return "sezonski";
  }
  const months12 = new Set(purchaseDays.filter((d) => t - dayNumber(d) < 365).map((d) => d.slice(0, 7)));
  return months12.size >= 9 ? "redovan" : "povremen";
}

/**
 * Jedan kupac, jedan presek.
 *
 * @param {PurchaseEvent[]} events
 * @param {string} asOf
 * @param {{ horizonDays: number, limit: number, rules: Record<string, (results: any[]) => any[]> }} opts
 */
export function evaluateCut(events, asOf, { horizonDays, limit, rules }) {
  const t = dayNumber(asOf);
  const end = t + horizonDays;
  /** @type {Map<string, string[]>} */
  const past = new Map();
  /** @type {Set<string>} */
  const boughtNext = new Set();
  for (const e of events) {
    const d = dayNumber(e.date);
    const revoked = e.revokedOn ? dayNumber(e.revokedOn) : null;
    // Istorija: kupovina do preseka koja tada još nije bila stornirana.
    if (d <= t && (revoked === null || revoked > t)) past.set(e.article, [...(past.get(e.article) ?? []), e.date]);
    // Pogodak: kupovina posle preseka koja nikad nije stornirana.
    if (d > t && d <= end && revoked === null) boughtNext.add(e.article);
  }
  if (past.size === 0) return null;
  const results = [...past].map(([article, dates]) =>
    evaluatePair({ customerId: "x", articleCode: article, purchaseDates: dates }, asOf),
  );
  const days = [...new Set([...past.values()].flat())].sort();
  /** @type {Record<string, { n: number, hits: number, byConfidence: Record<string, [number, number]> }>} */
  const perRule = {};
  for (const [name, rule] of Object.entries(rules)) {
    const top = rule(results).slice(0, limit);
    const byConfidence = {};
    let hits = 0;
    for (const r of top) {
      const hit = boughtNext.has(r.articleCode) ? 1 : 0;
      hits += hit;
      const k = r.confidence ?? "low";
      byConfidence[k] = [(byConfidence[k]?.[0] ?? 0) + hit, (byConfidence[k]?.[1] ?? 0) + 1];
    }
    perRule[name] = { n: top.length, hits, byConfidence };
  }
  const eligible = results.filter((r) => r.eventCount >= 2);
  return {
    segment: customerSegmentAt(days, asOf),
    boughtAnything: boughtNext.size > 0,
    base: { n: eligible.length, hits: eligible.filter((r) => boughtNext.has(r.articleCode)).length },
    perRule,
  };
}

/**
 * Mesečni preseci: prvi dan meseca od `from` dok ceo horizont staje pre `dataEnd`.
 * @param {string} from @param {string} dataEnd @param {number} horizonDays
 */
export function monthlyCuts(from, dataEnd, horizonDays) {
  const out = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const last = dayNumber(addDays(dataEnd, -horizonDays));
  for (;;) {
    const iso = `${y}-${String(m).padStart(2, "0")}-01`;
    if (dayNumber(iso) > last) break;
    out.push(iso);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const mean = (/** @type {number[]} */ xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const median = (/** @type {number[]} */ xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

/**
 * Zbir po kupcima — MAKRO: svaki kupac ima jednu težinu, pa veliki kupci ne
 * prekrivaju rezultat manjih. Upoređuju se samo PARENI preseci (oba pravila
 * imaju bar jedan predlog), da razlika u pokrivenosti ne izgleda kao tačnost.
 *
 * @param {{ customer: string, cut: ReturnType<typeof evaluateCut> }[]} records
 * @param {string} a  ime pravila (npr. dosadašnji)
 * @param {string} b  ime pravila (npr. R1)
 * @param {(r: { customer: string, cut: any }) => string} [groupOf]  grupa zapisa; podrazumevano sve zajedno
 * @param {number} [minPaired]  najmanje parenih preseka da bi kupac ušao u poređenje
 */
export function compareByCustomer(records, a, b, groupOf = () => "sve", minPaired = 3) {
  /** @type {Map<string, Map<string, { pa: number[], pb: number[], onlyA: number, onlyB: number, none: number, cuts: number }>>} */
  const acc = new Map();
  for (const r of records) {
    if (!r.cut) continue;
    const g = groupOf(r);
    const byCust = acc.get(g) ?? new Map();
    acc.set(g, byCust);
    const c = byCust.get(r.customer) ?? { pa: [], pb: [], onlyA: 0, onlyB: 0, none: 0, cuts: 0 };
    byCust.set(r.customer, c);
    c.cuts += 1;
    const ra = r.cut.perRule[a], rb = r.cut.perRule[b];
    if (ra.n && rb.n) { c.pa.push(ra.hits / ra.n); c.pb.push(rb.hits / rb.n); }
    else if (ra.n) c.onlyA += 1;
    else if (rb.n) c.onlyB += 1;
    else c.none += 1;
  }
  /** @type {Record<string, any>} */
  const out = {};
  for (const [g, byCust] of acc) {
    const rows = [...byCust.values()].filter((c) => c.pa.length >= minPaired);
    const ma = rows.map((c) => /** @type {number} */ (mean(c.pa)));
    const mb = rows.map((c) => /** @type {number} */ (mean(c.pb)));
    const diff = rows.map((_, i) => mb[i] - ma[i]);
    const all = [...byCust.values()];
    out[g] = {
      kupaca: byCust.size,
      kupacaUporedivo: rows.length,
      [a]: { prosek: mean(ma), medijana: median(ma) },
      [b]: { prosek: mean(mb), medijana: median(mb) },
      razlika: { prosek: mean(diff), medijana: median(diff) },
      bolje: diff.filter((d) => d > 0.005).length,
      isto: diff.filter((d) => Math.abs(d) <= 0.005).length,
      gore: diff.filter((d) => d < -0.005).length,
      presekaSamo: {
        [a]: all.reduce((s, c) => s + c.onlyA, 0),
        [b]: all.reduce((s, c) => s + c.onlyB, 0),
        nijedno: all.reduce((s, c) => s + c.none, 0),
      },
    };
  }
  return out;
}
