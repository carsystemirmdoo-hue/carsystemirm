/**
 * Profil jednog kupca za komercijalistu — čista logika, bez baze i bez
 * `new Date()`.
 *
 * Ne uvodi nijedan novi prag. Ritam kupca se računa ISTOM funkcijom kao par
 * (kupac, artikal) — `evaluatePair` — samo nad danima kada je kupac kupio bilo
 * šta. Zato „kasni", „uspavan" i „nedovoljno istorije" znače isto na oba
 * mesta i zavise od ritma BAŠ tog kupca, ne od opšteg broja dana.
 *
 * Grupe artikala su samo pregled rezultata koje je već dao `cadence_v1`:
 *   - redovno uzima:   ritam potvrđen (≥ 3 kupovine), status nije „uspavan";
 *   - kasni:           prošao je njegov uobičajeni termin (`overdue`);
 *   - duže ne uzima:   `dormant` — ≥ 3 tipična razmaka I ≥ 180 dana.
 * Parovi sa 1–2 kupovine se samo BROJE; nijedan zaključak se iz njih ne izvodi.
 */

import { dayNumber, evaluatePair } from "./cadence.mjs";

/** Množina dana na srpskom. */
function dana(n) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/**
 * Ritam kupovine firme: dani sa bar jednim potvrđenim prodajnim dokumentom.
 *
 * @param {{ customerId: string, purchaseDates: string[] }} input
 * @param {string} asOfDate  `YYYY-MM-DD`
 */
export function evaluateCustomerRhythm(input, asOfDate) {
  const r = evaluatePair(
    { customerId: input.customerId, articleCode: "*", purchaseDates: input.purchaseDates },
    asOfDate,
  );
  const { articleCode: _a, articleName: _n, ...rest } = r;
  void _a;
  void _n;
  return { ...rest, explanation: explainCustomer(r) };
}

/** @param {ReturnType<typeof evaluatePair>} r */
function explainCustomer(r) {
  if (r.status === "insufficient_history") {
    return r.eventCount === 0
      ? "Nema nijednog potvrđenog prodajnog dokumenta za ovog kupca."
      : `Postoji samo jedan dan sa potvrđenom kupovinom (${r.lastPurchaseOn}). Za ritam su potrebna najmanje dva.`;
  }
  const delovi = [];
  if (r.confidenceComponents.provisional) {
    delovi.push(
      `Kupovao je u ${r.eventCount} navrata, sa jednim razmakom od ${dana(r.intervals[0])} — jedan razmak nije ritam.`,
    );
  } else {
    const od = Math.max(1, r.medianIntervalDays - r.toleranceDays);
    const do_ = r.medianIntervalDays + r.toleranceDays;
    delovi.push(
      `Kupovao je u ${r.eventCount} navrata od ${r.firstPurchaseOn}, tipično na ${od}–${do_} dana (medijana ${dana(r.medianIntervalDays)}).`,
    );
  }
  delovi.push(
    `Poslednja potvrđena kupovina: ${r.lastPurchaseOn} (pre ${dana(r.daysSinceLastPurchase)}).`,
  );
  const status = r.underlyingStatus ?? r.status;
  if (status === "dormant") {
    delovi.push(
      "To je najmanje tri njegova uobičajena razmaka i više od 180 dana. Ovo je razlog za poziv, ne dokaz da je prestao da kupuje — kupovina mimo uvezenih dokumenata se ovde ne vidi.",
    );
  } else if (status === "overdue") {
    delovi.push(`Njegov uobičajeni termin je prošao pre ${dana(r.daysUntilExpected)}.`);
  } else if (status === "due") {
    delovi.push("Sada je u svom uobičajenom terminu.");
  } else if (status === "due_soon") {
    delovi.push(`Uobičajeni termin je za ${dana(r.daysUntilExpected)}.`);
  } else if (status === "not_yet") {
    delovi.push(`Do uobičajenog termina ima još ${dana(r.daysUntilExpected)}.`);
  }
  return delovi.join(" ");
}

/**
 * @template {{ status: string, eventCount: number, daysSinceLastPurchase: number, articleCode: string }} R
 * @param {readonly R[]} rows  rezultati `cadence_v1` za JEDNOG kupca
 */
export function groupCustomerSignals(rows) {
  const byLate = (/** @type {R} */ a, /** @type {R} */ b) =>
    b.daysSinceLastPurchase - a.daysSinceLastPurchase || a.articleCode.localeCompare(b.articleCode);
  const confirmed = rows.filter((r) => r.eventCount >= 3);
  return {
    regular: confirmed
      .filter((r) => r.status !== "dormant" && r.status !== "provisional" && r.status !== "insufficient_history")
      .sort((a, b) => b.eventCount - a.eventCount || a.articleCode.localeCompare(b.articleCode)),
    overdue: rows.filter((r) => r.status === "overdue").sort(byLate),
    lapsed: rows.filter((r) => r.status === "dormant").sort(byLate),
    thinHistoryCount: rows.filter((r) => r.eventCount < 3).length,
  };
}

/**
 * Datum u Beogradu kao `YYYY-MM-DD` — jedino mesto gde profil dodiruje sat,
 * i to u serverskom sloju koji ga poziva, ne u računu.
 *
 * @param {Date} now
 */
export function belgradeDate(now) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  dayNumber(iso); // baca ako format ikada nije YYYY-MM-DD
  return iso;
}
