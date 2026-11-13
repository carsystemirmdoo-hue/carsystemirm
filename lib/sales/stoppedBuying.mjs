import { dayNumber, medianOfSorted } from "../recommendations/cadence.mjs";

/**
 * „Prestao da uzima“ za karticu kupca (zahtev vlasnika 2026-11-12, period od–do).
 *
 * Artikal ulazi u listu ako ga je kupac kupio u izabranom periodu, a od
 * poslednje kupovine (bilo kad, do danas) prošlo je više od praga:
 *   - sa bar tri kupovine postoji uobičajen razmak (medijana razmaka) → prag je 2× taj razmak;
 *   - sa jednom ili dve kupovine razmaka nema → prag je 90 dana.
 * Prag nikad nije kraći od 30 dana, da artikal koji se uzima nedeljno ne iskače posle dve nedelje.
 *
 * Ovo je činjenica iz faktura, ne obračun preporuka: ne zavisi od `cadence_v1`.
 */
export const STOPPED_RULES = Object.freeze({ multipleOfUsual: 2, fallbackDays: 90, minDays: 30, minPurchasesForUsual: 3 });

/**
 * @param {{ code: string, name: string | null, dates: string[], dismissed?: boolean }[]} articles  dates: ISO dani kupovine (bilo kojim redom)
 * @param {{ today: string, from: string | null, to: string | null }} opts
 */
export function stoppedBuying(articles, { today, from, to }, rules = STOPPED_RULES) {
  const end = to && to < today ? to : today;
  const danas = dayNumber(today);
  const out = [];
  for (const a of articles) {
    const dates = [...new Set(a.dates)].filter((d) => d <= today).sort();
    if (dates.length === 0) continue;
    const inPeriod = dates.some((d) => (!from || d >= from) && d <= end);
    if (!inPeriod) continue;
    const days = dates.map(dayNumber);
    const gaps = days.slice(1).map((d, i) => d - days[i]).sort((x, y) => x - y);
    const usual = dates.length >= rules.minPurchasesForUsual ? medianOfSorted(gaps) : null;
    const threshold = Math.max(rules.minDays, usual === null ? rules.fallbackDays : Math.round(rules.multipleOfUsual * usual));
    const last = dates[dates.length - 1];
    const since = danas - dayNumber(last);
    if (since <= threshold) continue;
    out.push({
      code: a.code,
      name: a.name,
      purchases: dates.length,
      lastOn: last,
      daysSince: since,
      usualIntervalDays: usual === null ? null : Math.round(usual),
      thresholdDays: threshold,
      dismissed: Boolean(a.dismissed),
    });
  }
  // Najpre ono što je kupac uzimao najčešće, pa najduže nekupljeno.
  return out.sort((x, y) => y.purchases - x.purchases || y.daysSince - x.daysSince || x.code.localeCompare(y.code));
}
