/**
 * Povezivanje stavki cenovnika sa artiklima portala i pregled promena.
 *
 * Čista logika. Šifra je poslovni identitet artikla; naziv služi samo kao
 * signal da je BizniSoft artikal preimenovan ili da šifra pokazuje na drugu
 * robu. Zato se ništa ne „pogađa“ po nazivu: stavka bez šifre u portalu je
 * nepovezana, a stavka sa šifrom ali bitno drugačijim nazivom je NEJASNA i
 * primenjuje se samo uz izričitu potvrdu gazde.
 */

/** Ispod ovoga naziv se smatra bitno drugačijim (izmereno na cenovniku 09.10.2026). */
export const NAME_SIMILARITY_MIN = 0.8;
/** Promena osnovne cene veća od ovoga (u odnosu na važeću) traži pažnju, ne blokira. */
export const LARGE_CHANGE_PERCENT = 30;

export const MATCH_STATUSES = Object.freeze(["povezano", "nejasno", "nepovezano", "duplikat", "neispravna_cena"]);

export function normalizeName(s) {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "DJ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function trigrams(s) {
  const t = normalizeName(s).replaceAll(" ", "");
  if (t.length < 3) return new Set([t]);
  const out = new Set();
  for (let i = 0; i + 3 <= t.length; i += 1) out.add(t.slice(i, i + 3));
  return out;
}

/** Sličnost naziva 0–1 (Dice nad trigramima bez razmaka i dijakritika). */
export function nameSimilarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let common = 0;
  for (const x of A) if (B.has(x)) common += 1;
  return (2 * common) / (A.size + B.size);
}

/**
 * Isti artikal napisan drugačije: ISTE cifre (mere, šifre boja — kao skup
 * znakova, jer BizniSoft ume da spoji „20-24 … 1L“ u „20-241L“) i SVAKA reč
 * kraćeg naziva postoji u dužem (dozvoljeno skraćenje: „NARAN“ / „NARANDZASTA“).
 * Različita boja („BELI“ / „SIVI“) ili prevedeni naziv ne prolaze.
 */
export function sameArticleWording(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  const digits = (s) => [...s.replace(/[^0-9]/g, "")].sort().join("");
  if (digits(na) !== digits(nb)) return false;
  const words = (s) => [...new Set(s.split(/[^A-Z]+/).filter(Boolean))];
  const [shorter, longer] = [words(na), words(nb)].sort((x, y) => x.length - y.length);
  if (shorter.length === 0) return false;
  const matches = (w, v) => w === v || (Math.min(w.length, v.length) >= 2 && (v.startsWith(w) || w.startsWith(v)));
  return shorter.every((w) => longer.some((v) => matches(w, v)));
}

/**
 * @typedef {{ code: string, name: string, vatPercent: number, vpPriceCents: number, page?: number }} PriceRow
 * @typedef {PriceRow & { status: string, note: string | null, articleId: string | null, articleName: string | null, unit: string | null, similarity: number | null, currentCents: number | null, change: "nova" | "ista" | "promena" | null, flags: string[] }} ClassifiedRow
 */

/**
 * @param {PriceRow[]} rows  iz `parseStockPriceReport`
 * @param {Map<string, { id: string, code: string, name: string, unit: string | null }>} articlesByCode
 * @param {Map<string, number>} currentPriceCents  važeća osnovna cena po article_id (na izabrani dan), ako postoji
 * @returns {ClassifiedRow[]}
 */
export function classifyPriceRows(rows, articlesByCode, currentPriceCents = new Map()) {
  const counts = new Map();
  for (const r of rows) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  return rows.map((r) => {
    const base = { ...r, articleId: null, articleName: null, unit: null, similarity: null, currentCents: null, change: null, flags: [] };
    if (counts.get(r.code) > 1) return { ...base, status: "duplikat", note: "ista šifra se u fajlu pojavljuje više puta — nijedna stavka se ne primenjuje" };
    if (!Number.isInteger(r.vpPriceCents) || r.vpPriceCents <= 0) return { ...base, status: "neispravna_cena", note: "VP cena je 0 ili negativna" };
    const a = articlesByCode.get(r.code);
    if (!a) return { ...base, status: "nepovezano", note: "šifra ne postoji u portalu (artikal još nije fakturisan)" };
    const similarity = Math.round(nameSimilarity(r.name, a.name) * 100) / 100;
    const currentCents = currentPriceCents.get(a.id) ?? null;
    const change = currentCents === null ? "nova" : currentCents === r.vpPriceCents ? "ista" : "promena";
    const flags = [];
    if (!a.unit) flags.push("bez_jedinice_mere");
    if (change === "promena" && Math.abs((r.vpPriceCents / currentCents - 1) * 100) > LARGE_CHANGE_PERCENT) flags.push("velika_promena");
    const linked = { ...base, articleId: a.id, articleName: a.name, unit: a.unit, similarity, currentCents, change, flags };
    if (similarity < NAME_SIMILARITY_MIN && !sameArticleWording(r.name, a.name)) {
      return { ...linked, status: "nejasno", note: "ista šifra, bitno drugačiji naziv — primenjuje se samo uz potvrdu da je isti artikal" };
    }
    // Bez jedinice mere u portalu: cena važi za artikal kakav jeste; samo informacija.
    return { ...linked, status: "povezano", note: null };
  });
}

/**
 * Zbirni pregled za ekran i izveštaj.
 * @param {ClassifiedRow[]} classified
 */
export function summarizeClassification(classified) {
  const by = (pred) => classified.filter(pred).length;
  return {
    total: classified.length,
    povezano: by((r) => r.status === "povezano"),
    nejasno: by((r) => r.status === "nejasno"),
    nepovezano: by((r) => r.status === "nepovezano"),
    duplikat: by((r) => r.status === "duplikat"),
    neispravnaCena: by((r) => r.status === "neispravna_cena"),
    nova: by((r) => r.status === "povezano" && r.change === "nova"),
    ista: by((r) => r.status === "povezano" && r.change === "ista"),
    promena: by((r) => r.status === "povezano" && r.change === "promena"),
    velikaPromena: by((r) => r.flags.includes("velika_promena")),
  };
}

/**
 * Koje stavke ulaze u primenu: povezane sa promenom ili novom cenom, plus
 * NEJASNE samo ako ih je gazda izričito označio (`confirmedUnclearCodes`).
 * Ista cena se ne upisuje ponovo. Nepovezane, duplikati i neispravne nikad.
 * @param {ClassifiedRow[]} classified
 * @param {Set<string>} [confirmedUnclearCodes]
 * @returns {ClassifiedRow[]}
 */
export function rowsToApply(classified, confirmedUnclearCodes = new Set()) {
  return classified.filter((r) => {
    if (r.status === "povezano") return r.change !== "ista";
    if (r.status === "nejasno") return confirmedUnclearCodes.has(r.code) && r.change !== "ista";
    return false;
  });
}
