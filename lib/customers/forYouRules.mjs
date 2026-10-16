/**
 * „Za Vas“ u katalogu — čista pravila (bez baze).
 *
 * Učestalost se broji po RAZLIČITIM kupovinama (dokument/dan), ne po komadima: jedinice i pakovanja
 * nisu uporedivi. Novija kupovina vredi više (poluživot 180 dana). Predlog dopune traži bar
 * tri kupovine (dva razmaka) i opisuje samo ritam kupovine — ne tvrdi ništa o stanju kod kupca.
 */

const DAY = 86400000;
const HALF_LIFE_DAYS = 180;
export const MIN_PURCHASES_FOR_RHYTHM = 3;
/** Dovoljno istorije za podrazumevan redosled „Preporučeno za Vas“. */
export const MIN_DOCUMENTS_FOR_PERSONAL_ORDER = 3;

const dayNo = (iso) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);

/**
 * @param {{ articleId: string; date: string; purchaseId: string }[]} events
 * @param {string} today YYYY-MM-DD
 */
export function articleStats(events, today) {
  const t = dayNo(today);
  const by = new Map();
  for (const e of events) {
    if (dayNo(e.date) > t) continue;
    const s = by.get(e.articleId) ?? { articleId: e.articleId, purchases: new Set(), days: new Set() };
    s.purchases.add(e.purchaseId);
    s.days.add(e.date.slice(0, 10));
    by.set(e.articleId, s);
  }
  return [...by.values()].map((s) => {
    const days = [...s.days].sort();
    const last = days[days.length - 1];
    // Svaka kupovina (ne komad) doprinosi; starija manje.
    const score = days.reduce((acc, d) => acc + Math.pow(0.5, (t - dayNo(d)) / HALF_LIFE_DAYS), 0) * (s.purchases.size / days.length);
    return { articleId: s.articleId, purchases: s.purchases.size, days, lastDate: last, daysSinceLast: t - dayNo(last), score };
  });
}

/** Najčešće kupovani: po težini (učestalost × novina), pa po poslednjoj kupovini. */
export function frequentOrder(stats) {
  return [...stats].sort((a, b) => b.score - a.score || b.lastDate.localeCompare(a.lastDate) || a.articleId.localeCompare(b.articleId));
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Predlog dopune: uobičajen razmak između kupovina (medijana) i koliko je prošlo od poslednje.
 * Predlaže se kada je prošlo bar 80 % razmaka, a ne više od trostrukog (posle toga je kupac
 * verovatno promenio naviku — to nije „vreme za dopunu“).
 * @returns {{ articleId: string; intervalDays: number; daysSinceLast: number; ratio: number; reason: string }[]}
 */
export function refillCandidates(stats) {
  const out = [];
  for (const s of stats) {
    if (s.days.length < MIN_PURCHASES_FOR_RHYTHM) continue;
    const gaps = s.days.slice(1).map((d, i) => dayNo(d) - dayNo(s.days[i]));
    const interval = Math.round(median(gaps));
    if (interval < 7) continue;
    const ratio = s.daysSinceLast / interval;
    if (ratio < 0.8 || ratio > 3) continue;
    out.push({ articleId: s.articleId, intervalDays: interval, daysSinceLast: s.daysSinceLast, ratio, reason: refillReason(interval, s.daysSinceLast) });
  }
  return out.sort((a, b) => b.ratio - a.ratio || a.articleId.localeCompare(b.articleId));
}

const days = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "dan" : "dana"}`;

export function refillReason(interval, since) {
  return `Obično kupujete na oko ${days(interval)}; poslednja kupovina pre ${days(since)}.`;
}

/** Ima li kupac dovoljno istorije za podrazumevan lični redosled. */
export function enoughHistory(events) {
  const docs = new Set(events.map((e) => e.purchaseId));
  const articles = new Set(events.map((e) => e.articleId));
  return docs.size >= MIN_DOCUMENTS_FOR_PERSONAL_ORDER && articles.size >= 2;
}

/**
 * Lični redosled stavki kataloga: (1) kupovane, po težini; (2) srodne/kompatibilne; (3) ostatak u
 * standardnom redosledu. Svaka stavka jednom; nepoznate stavke se ignorišu.
 * @param {string[]} standard id-jevi u standardnom redosledu
 * @param {string[]} purchased id-jevi kupovanih stavki, već poređani
 * @param {string[]} related id-jevi srodnih stavki, već poređani
 * @returns {{ order: string[]; tier: Map<string, 1 | 2 | 3> }}
 */
export function personalOrder(standard, purchased, related) {
  const known = new Set(standard);
  const seen = new Set();
  const order = [];
  const tier = new Map();
  for (const [list, n] of [[purchased, 1], [related, 2], [standard, 3]]) {
    for (const id of list) {
      if (!known.has(id) || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      tier.set(id, n);
    }
  }
  return { order, tier };
}
