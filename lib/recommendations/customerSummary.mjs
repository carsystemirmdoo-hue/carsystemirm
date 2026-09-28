/**
 * Sažetak kartice kupca — čista logika, bez baze i bez `new Date()`.
 *
 * Odgovara na pet pitanja za pet sekundi: kada je kupac poslednji put kupio,
 * kakav mu je uobičajeni ritam, šta se promenilo, koje artikle vredi pomenuti
 * i šta predložiti u sledećem razgovoru.
 *
 * Ne uvodi nijedan nov prag. Statusi artikala su oni koje je već dao
 * `cadence_v1`; ovde se samo biraju i rečima opisuju. Predlog je interna
 * pomoć komercijalisti — nikad poruka kupcu, cena ni rabat.
 */

import { dayNumber } from "./cadence.mjs";

/** Redosled grupa u glavnoj listi. Svaki artikal je tačno u jednoj. */
export const ARTICLE_GROUPS = /** @type {const} */ ([
  { key: "lapsed", label: "Ranije redovno, sada ne", statuses: ["dormant"] },
  { key: "overdue", label: "Prošao uobičajeni termin", statuses: ["overdue"] },
  { key: "due", label: "Sada ili uskoro", statuses: ["due", "due_soon"] },
  { key: "steady", label: "U ritmu", statuses: ["not_yet"] },
  { key: "thin", label: "Premalo istorije (1–2 kupovine)", statuses: ["provisional", "insufficient_history"] },
]);

/** @param {string} status */
export function groupOf(status) {
  return ARTICLE_GROUPS.find((g) => /** @type {readonly string[]} */ (g.statuses).includes(status))?.key ?? "thin";
}

/** @param {number} n */
function dana(n) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/** `2026-01-31` → `31. 1. 2026.` */
export function srDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}. ${Number(m)}. ${y}.`;
}

/**
 * @typedef {object} ArticleView
 * @property {string} articleCode
 * @property {string | null} articleName
 * @property {string} status          status iz cadence_v1, ili `insufficient_history`
 * @property {number} eventCount
 * @property {string} lastPurchaseOn
 * @property {number | null} medianIntervalDays
 * @property {number | null} daysUntilExpected
 * @property {number} daysSinceLastPurchase
 */

/**
 * Ritam firme kao broj faktura po mesecu — razumljivije od „tipično na 5 dana"
 * kada firma različite artikle kupuje različitim danima.
 *
 * @param {string[]} documentDates  datumi potvrđenih dokumenata (sa ponavljanjem)
 * @param {string} asOfDate
 */
export function monthlyRhythm(documentDates, asOfDate) {
  const asOf = dayNumber(asOfDate);
  const last12 = documentDates.filter((d) => asOf - dayNumber(d) < 365 && dayNumber(d) <= asOf);
  const months = new Set(last12.map((d) => d.slice(0, 7)));
  return {
    documentsLast12Months: last12.length,
    activeMonthsLast12: months.size,
    perMonth: Math.round((last12.length / 12) * 10) / 10,
  };
}

/**
 * @param {{
 *   rhythm: { status: string, eventCount: number, lastPurchaseOn: string | null, daysSinceLastPurchase: number | null },
 *   monthly: ReturnType<typeof monthlyRhythm>,
 *   articles: ArticleView[],
 *   hasActiveRun: boolean,
 * }} input
 */
export function summarizeCustomer({ rhythm, monthly, articles, hasActiveRun }) {
  const name = (/** @type {ArticleView} */ a) => a.articleName ?? a.articleCode;
  const lapsed = articles.filter((a) => a.status === "dormant").sort((a, b) => b.eventCount - a.eventCount);
  const overdue = articles
    .filter((a) => a.status === "overdue")
    .sort((a, b) => overdueRatio(b) - overdueRatio(a));
  const due = articles
    .filter((a) => a.status === "due" || a.status === "due_soon")
    .sort((a, b) => (a.daysUntilExpected ?? 0) - (b.daysUntilExpected ?? 0));
  const steady = articles.filter((a) => a.status === "not_yet");

  /** @type {{ key: string, label: string, tone: "success" | "warning" | "danger" | "neutral" }} */
  let status;
  let change;
  let nextStep;

  if (rhythm.eventCount === 0) {
    status = { key: "none", label: "Nema potvrđenih kupovina", tone: "neutral" };
    change = "U potvrđenim prodajnim dokumentima nema nijedne kupovine ovog kupca.";
    nextStep = "Nema osnova za predlog. Ako kupac kupuje, proveriti da li su njegove fakture uvezene.";
  } else if (rhythm.eventCount < 3) {
    status = { key: "thin", label: "Premalo istorije", tone: "neutral" };
    change = `Samo ${rhythm.eventCount === 1 ? "jedan dan" : "dva dana"} sa kupovinom — ritam se još ne može proceniti.`;
    nextStep = "Nema dovoljno podataka za predlog; kartica postaje korisna posle sledećih kupovina.";
  } else if (rhythm.status === "dormant") {
    status = { key: "dormant", label: `Ne kupuje od ${srDate(rhythm.lastPurchaseOn)}`, tone: "danger" };
    const top = lapsed[0] ?? overdue[0];
    change =
      `Nema kupovine ${dana(rhythm.daysSinceLastPurchase ?? 0)}. ` +
      (top ? `Ranije je redovno uzimao ${name(top)} (${top.eventCount} kupovina).` : "");
    nextStep =
      "Pozvati i pitati da li i dalje radi sa nama i da li nabavlja drugde" +
      (top ? `; pomenuti ${name(top)}.` : ".");
  } else if (lapsed.length || overdue.length) {
    status = { key: "attention", label: "Traži pažnju", tone: "warning" };
    if (lapsed.length) {
      const a = lapsed[0];
      change =
        `${name(a)}: uzimao ${a.eventCount} puta, tipično na ${dana(a.medianIntervalDays ?? 0)}; ` +
        `poslednji put ${srDate(a.lastPurchaseOn)}, od tada ne.`;
    } else {
      const a = overdue[0];
      change =
        `${overdue.length === 1 ? "Jedan artikal je prošao" : `${overdue.length} artikla su prošla`} uobičajeni termin; ` +
        `najviše ${name(a)} (${dana(-(a.daysUntilExpected ?? 0))} posle očekivanog).`;
    }
    const parts = [];
    if (overdue.length) parts.push(`podsetiti na ${overdue.slice(0, 2).map(name).join(" i ")}`);
    else if (due.length) parts.push(`dogovoriti uobičajenu porudžbinu (${due.slice(0, 2).map(name).join(", ")})`);
    if (lapsed.length) parts.push(`pitati za ${name(lapsed[0])} — da li je prešao na drugi proizvod ili mu više ne treba`);
    nextStep = `Pozvati u narednih nekoliko dana: ${parts.join("; ")}.`;
  } else if (due.length) {
    status = { key: "due", label: "Uskoro uobičajena porudžbina", tone: "success" };
    change = `Približava se uobičajeni termin za ${due.slice(0, 3).map(name).join(", ")}.`;
    nextStep = `Podsetiti na uobičajenu porudžbinu: ${due.slice(0, 3).map(name).join(", ")}.`;
  } else {
    status = { key: "steady", label: "U ritmu", tone: "success" };
    change = "Kupuje u svom uobičajenom ritmu; nema promene.";
    const next = steady
      .filter((a) => a.daysUntilExpected !== null)
      .sort((a, b) => (a.daysUntilExpected ?? 0) - (b.daysUntilExpected ?? 0))[0];
    nextStep = next
      ? `Nije potreban poseban kontakt; sledeći uobičajeni termin (${name(next)}) za oko ${dana(next.daysUntilExpected ?? 0)}.`
      : "Nije potreban poseban kontakt.";
  }

  if (!hasActiveRun && rhythm.eventCount >= 3) {
    nextStep = "Signali po artiklu još nisu obračunati; predlog će se pojaviti posle obračuna preporuka.";
  }

  /** @type {{ articleCode: string, name: string, reason: string, tone: "danger" | "warning" | "success" }[]} */
  const mention = [];
  for (const a of lapsed) {
    mention.push({ articleCode: a.articleCode, name: name(a), reason: `ranije redovno, poslednji put ${srDate(a.lastPurchaseOn)}`, tone: "danger" });
  }
  for (const a of overdue) {
    mention.push({ articleCode: a.articleCode, name: name(a), reason: `kasni ${dana(-(a.daysUntilExpected ?? 0))}`, tone: "warning" });
  }
  for (const a of due) {
    mention.push({
      articleCode: a.articleCode,
      name: name(a),
      reason: (a.daysUntilExpected ?? 0) <= 0 ? "sada je uobičajeni termin" : `termin za ${dana(a.daysUntilExpected ?? 0)}`,
      tone: "success",
    });
  }

  return {
    status,
    lastPurchaseOn: rhythm.lastPurchaseOn,
    daysSinceLastPurchase: rhythm.daysSinceLastPurchase,
    usual:
      rhythm.eventCount === 0
        ? "—"
        : monthly.documentsLast12Months === 0
          ? "nije kupovao u poslednjih 12 meseci"
          : `${monthly.documentsLast12Months} faktura u 12 meseci · kupovao u ${monthly.activeMonthsLast12} od 12 meseci`,
    change,
    mention: mention.slice(0, 3),
    nextStep,
    regularCount: articles.filter((a) => a.eventCount >= 3 && a.status !== "dormant").length,
  };
}

/** @param {ArticleView} a */
function overdueRatio(a) {
  const m = a.medianIntervalDays ?? 0;
  return m > 0 ? -(a.daysUntilExpected ?? 0) / m : 0;
}

/**
 * Grupisanje za glavnu listu: svaki artikal TAČNO jednom, grupe po važnosti.
 * @template {ArticleView} T
 * @param {T[]} articles
 */
export function groupArticles(articles) {
  return ARTICLE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: articles
      .filter((a) => groupOf(a.status) === g.key)
      .sort((a, b) =>
        g.key === "lapsed" || g.key === "steady"
          ? b.eventCount - a.eventCount || a.articleCode.localeCompare(b.articleCode)
          : g.key === "overdue"
            ? overdueRatio(b) - overdueRatio(a)
            : a.articleCode.localeCompare(b.articleCode),
      ),
  })).filter((g) => g.items.length > 0);
}
