/**
 * Starost lagera u radnim danima (pon–pet) i kratka oznaka za tabele (2026-11-10).
 *
 * Snimak od petka gledan u ponedeljak je star 1 radni dan, ne 3 dana: vikend nije kašnjenje
 * kancelarije. Datumi su `YYYY-MM-DD` (datum stanja i današnji datum u Beogradu).
 */

const dayNo = (/** @type {string} */ iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);

/** Broj radnih dana posle `stockDate` zaključno sa `today`. @param {string} stockDate @param {string} today */
export function workdaysSince(stockDate, today) {
  const a = dayNo(stockDate);
  const b = dayNo(today);
  let n = 0;
  for (let d = a + 1; d <= b; d++) {
    const wd = (d + 4) % 7; // 1970-01-01 je četvrtak → 0 = nedelja
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** „nije ažurirano 2 radna dana“ ili null ako je lager od danas / poslednjeg radnog dana. @param {number} n */
export function staleNote(n) {
  if (n < 1) return null;
  const d = n % 10;
  const dd = n % 100;
  const word = d === 1 && dd !== 11 ? "radni dan" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "radna dana" : "radnih dana";
  return `nije ažurirano ${n} ${word}`;
}

/** Kratka oznaka za kolonu „Lager“. @param {"ima" | "nema" | "upit"} state */
export const stockShort = (state) => (state === "ima" ? "Ima" : state === "nema" ? "Nema" : "Na upit");

/** Redosled pri ređanju po lageru: ima → na upit → nema. @param {"ima" | "nema" | "upit" | null | undefined} state */
export const stockRank = (state) => (state === "ima" ? 0 : state === "upit" ? 1 : state === "nema" ? 2 : 3);
