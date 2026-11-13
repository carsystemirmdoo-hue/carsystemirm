/**
 * Nabavka — predlog količine za porudžbinu dobavljaču (2026-11-10).
 *
 * ČISTA računica, bez baze. Predlog je samo pomoć: konačnu količinu upisuje vlasnik.
 *
 *   dnevna prodaja = neto prodato u periodu / broj dana perioda
 *   potreba        = dnevna prodaja × dana pokrivanja − lager (negativan lager = 0)
 *   predlog        = potreba zaokružena NAVIŠE na celo pakovanje (ako je pakovanje potvrđeno u
 *                    istoj JM), inače na ceo broj; potreba ≤ 0 → 0.
 *
 * Dani bez robe (0065, istorija lagera): dani kada je potvrđen lager pokazivao 0 ne ulaze u broj dana
 * perioda — artikal koji je bio rasprodat ne dobija niži predlog. Period se ne skraćuje ispod 30 dana
 * (ni ispod četvrtine perioda), da kratka istorija ne naduva prosek. Dani bez snimka se ne izuzimaju.
 */

const EPS = 1e-9;

/** Brend iz naziva u šifarniku (BiznisSoft nema kolonu brenda): prva reč naziva. */
/** @type {Array<[RegExp, string]>} */
const PREFIX = [
  [/^CS\b/, "Carsystem"],
  [/^COS\b/, "Cosmos Lac"],
  [/^RM\b/, "R-M"],
  [/^BASLAC/, "Baslac"],
  [/^(BEFAR|LEO|TURQUAZ|TURKUAZ)\b/, "Befar"],
  [/^CF\b/, "C.A.R.FIT"],
  [/^SIA\b/, "sia"],
  [/^3M\b/, "3M"],
  [/^NORBIN\b/, "Norbin"],
  [/^RUPES\b/, "RUPES"],
  [/^SATA/, "SATA"],
];

/** @param {string} name @param {string | null | undefined} [brand] */
export function brandOf(name, brand) {
  if (brand && brand.trim()) return brand.trim();
  const n = String(name ?? "").trim().toUpperCase().replace(/\./g, " ");
  for (const [re, b] of PREFIX) if (re.test(n)) return b;
  return "Ostalo";
}

/**
 * @param {{ sold: number, windowDays: number, coverDays: number, stock: number | null,
 *           unit: string | null, pack: { quantity: number, unit: string } | null, outDays?: number }} x
 * @returns {{ daily: number, need: number, suggested: number, packs: number | null, stockKnown: boolean }}
 */
export function suggestQuantity(x) {
  const sold = Math.max(0, Number(x.sold) || 0);
  const days = effectiveDays(x.windowDays, x.outDays ?? 0);
  const daily = days > 0 ? sold / days : 0;
  const stockKnown = x.stock !== null && Number.isFinite(x.stock);
  const stock = stockKnown ? Math.max(0, /** @type {number} */ (x.stock)) : 0;
  const need = daily * x.coverDays - stock;
  const samePack = Boolean(x.pack && x.pack.quantity > 0 && String(x.pack.unit).toUpperCase() === String(x.unit ?? "").toUpperCase());
  if (need <= EPS) return { daily, need, suggested: 0, packs: samePack ? 0 : null, stockKnown };
  if (samePack) {
    const pq = /** @type {{ quantity: number }} */ (x.pack).quantity;
    const packs = Math.ceil(need / pq - EPS);
    return { daily, need, suggested: round3(packs * pq), packs, stockKnown };
  }
  return { daily, need, suggested: Math.ceil(need - EPS), packs: null, stockKnown };
}

/** Kretanje prodaje: poslednjih 90 dana prema prethodnih 90. @param {number} last90 @param {number} prev90 */
export function trendOf(last90, prev90) {
  if (prev90 <= 0 && last90 <= 0) return null;
  if (prev90 <= 0) return "novo";
  const r = last90 / prev90;
  if (r >= 1.3) return "raste";
  if (r <= 0.7) return "pada";
  return null;
}

/** Količina koju je vlasnik upisao: broj ≥ 0, zarez ili tačka; prazno = ne poručuje. @param {string} raw */
export function parseOrderQuantity(raw) {
  const s = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return Number.NaN;
  return Number(s);
}

const round3 = (/** @type {number} */ n) => Math.round(n * 1000) / 1000;

/** Naziv fajla: „Porudzbina-R-M-2026-11-10“. @param {string} label @param {string} date */
export function orderFileName(label, date) {
  const slug = String(label)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .replace(/Đ/g, "Dj")
    .replace(/[^A-Za-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `Porudzbina-${slug || "dobavljac"}-${date}`;
}

/** Dani perioda posle izuzimanja dana bez robe; nikad ispod 30 dana ni ispod četvrtine perioda. @param {number} windowDays @param {number} outDays */
export function effectiveDays(windowDays, outDays) {
  if (!(windowDays > 0)) return 0;
  const floor = Math.min(windowDays, Math.max(30, Math.ceil(windowDays / 4)));
  return Math.max(floor, windowDays - Math.max(0, Math.floor(outDays) || 0));
}

/**
 * Broj dana u [od, do] (obe granice uključene) kada je istorija lagera pokazivala 0 ili manje.
 * Raspon bez kraja (`to: null`) traje do danas; dani bez podatka se ne broje.
 * @param {{ from: string, to: string | null, quantity: number | null }[]} ranges
 * @param {string} windowFrom @param {string} windowTo
 */
export function daysWithoutStock(ranges, windowFrom, windowTo) {
  const day = (/** @type {string} */ iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
  const a = day(windowFrom);
  const b = day(windowTo);
  let n = 0;
  for (const r of ranges) {
    if (r.quantity === null || r.quantity > 0) continue;
    const s = Math.max(a, day(r.from));
    const e = Math.min(b, r.to ? day(r.to) : b);
    if (e >= s) n += e - s + 1;
  }
  return n;
}
