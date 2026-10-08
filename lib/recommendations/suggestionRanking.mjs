/**
 * Predlozi za razgovor na kartici kupca: izbor i redosled.
 *
 * SLOJ PRIKAZA nad rezultatom `cadence_v1` — ne menja status, pouzdanost,
 * medijanu ni prag. Odlučuje samo šta ide u kratku listu (3–5), šta u
 * „slabije signale", a šta ostaje samo u punom spisku po grupama.
 *
 * Redosled NE zavisi samo od proteklog vremena. Tri činioca, svaki vidljiv
 * komercijalisti:
 *   1. termin    — koliko je SADA uobičajeni termin (u roku > uskoro >
 *                  prošao, sa padom što je kašnjenje veće > nedavno prestao);
 *   2. pouzdanost — visoka > srednja > niska (nivo iz `cadence_v1`);
 *   3. istorija  — koliko je puta artikal kupljen (logaritamski, do 12).
 * Proizvod ta tri broja je samo redosled — ne verovatnoća i ne prikazuje se.
 *
 * Iz faktura se ne vidi lager ni potrošnja kupca: „termin" je ritam ranijih
 * kupovina, ne datum kada mu nešto treba.
 */

/**
 * Oznaka redosleda. R1 je EKSPERIMENT: menja samo izbor i redosled prikaza,
 * nikad `cadence_v1` (status, pouzdanost, medijanu, pragove). Dosadašnji
 * redosled ostaje dostupan za poređenje (`legacySuggestions`).
 */
export const RANKING_VERSION = "r1_eksperiment";

/** Koliko predloga ide u kratku listu. */
export const MAIN_LIMIT = 5;

/** Posle ovoliko dana bez kupovine „prestao" više nije tema za kratku listu. */
export const LAPSED_RECENT_DAYS = 365;

const CONFIDENCE_WEIGHT = Object.freeze({ high: 1, medium: 0.75, low: 0.5 });

/**
 * @typedef {object} RankableArticle
 * @property {string} articleCode
 * @property {string} status
 * @property {string | null} [confidence]
 * @property {number} eventCount
 * @property {number | null} medianIntervalDays
 * @property {number | null} daysUntilExpected
 * @property {number} daysSinceLastPurchase
 * @property {boolean} [statusOutdated]
 */

/**
 * Koliko je termin aktuelan, 0–1.
 * @param {RankableArticle} a
 */
export function timingWeight(a) {
  const m = a.medianIntervalDays ?? 0;
  const st = a.status === "provisional" ? provisionalTiming(a) : a.status;
  if (st === "due") return 1;
  if (st === "due_soon") return 0.8;
  if (st === "overdue") {
    // Kašnjenje u ciklusima: do pola ciklusa je „sada", posle toga slabi.
    const late = m > 0 ? Math.max(0, -(a.daysUntilExpected ?? 0)) / m : 0;
    return 1 / (1 + Math.max(0, late - 0.5));
  }
  if (st === "dormant") return a.daysSinceLastPurchase <= LAPSED_RECENT_DAYS ? 0.6 : 0;
  return 0;
}

/** Privremena procena nema status, ali ima rok iz jednog razmaka. */
function provisionalTiming(a) {
  const d = a.daysUntilExpected;
  const m = a.medianIntervalDays ?? 0;
  if (d === null || d === undefined || m <= 0) return "not_yet";
  if (a.daysSinceLastPurchase > Math.max(3 * m, 180)) return "dormant";
  if (d < -Math.max(3, Math.round(m * 0.5))) return "overdue";
  if (d <= Math.max(3, Math.round(m * 0.5))) return "due";
  return "not_yet";
}

/** @param {number} n */
export function historyWeight(n) {
  return Math.min(1, Math.log2(1 + Math.max(0, n)) / Math.log2(13));
}

/** @param {RankableArticle} a */
export function suggestionScore(a) {
  const conf = CONFIDENCE_WEIGHT[/** @type {"high"|"medium"|"low"} */ (a.confidence ?? "low")] ?? 0.5;
  return timingWeight(a) * conf * (0.5 + 0.5 * historyWeight(a.eventCount));
}

/**
 * Kuda artikal pripada:
 *   main  — pouzdaniji signal sa aktuelnim terminom (srednja/visoka pouzdanost);
 *   weak  — isti tip signala, ali niska pouzdanost ili samo dve kupovine;
 *   none  — nije predlog (u ritmu, premalo istorije, nije obračunato,
 *           davno prestao, kupljeno posle obračuna) — ostaje u punom spisku.
 * @param {RankableArticle} a
 * @returns {"main" | "weak" | "none"}
 */
export function suggestionTier(a) {
  if (a.statusOutdated) return "none";
  if (timingWeight(a) <= 0) return "none";
  if (a.status === "provisional") return "weak";
  if (!["due", "due_soon", "overdue", "dormant"].includes(a.status)) return "none";
  return a.confidence === "medium" || a.confidence === "high" ? "main" : "weak";
}

/**
 * @template {RankableArticle} T
 * @param {T[]} articles
 * @param {{ limit?: number }} [opts]
 */
export function rankSuggestions(articles, { limit = MAIN_LIMIT } = {}) {
  const order = (/** @type {T} */ a, /** @type {T} */ b) =>
    suggestionScore(b) - suggestionScore(a) ||
    b.eventCount - a.eventCount ||
    a.articleCode.localeCompare(b.articleCode);
  const main = articles.filter((a) => suggestionTier(a) === "main").sort(order);
  const weak = articles.filter((a) => suggestionTier(a) === "weak").sort(order);
  return { top: main.slice(0, limit), main, weak };
}

/** @param {number} n */
function dana(n) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/** Razmak rečima, bez lažne preciznosti: „~3 nedelje", „~2 meseca". */
export function roughInterval(days) {
  if (days < 14) return `~${dana(days)}`;
  if (days < 60) return `~${Math.round(days / 7)} nedelje`.replace(/^~(\d+) nedelje$/, (m, n) => (Number(n) >= 5 ? `~${n} nedelja` : m));
  if (days < 365) return `~${Math.round(days / 30)} meseca`.replace(/^~(\d+) meseca$/, (m, n) => (Number(n) >= 5 ? `~${n} meseci` : m));
  const g = Math.round((days / 365) * 10) / 10;
  return `~${String(g).replace(".", ",")} god.`;
}

/**
 * Razlog predloga jednom rečenicom, rečima komercijaliste.
 * @param {RankableArticle & { lastPurchaseOn?: string }} a
 */
export function suggestionReason(a) {
  const m = a.medianIntervalDays;
  const ritam = m ? `obično na ${roughInterval(m)}` : "";
  const st = a.status === "provisional" ? provisionalTiming(a) : a.status;
  const prefix = a.status === "provisional" ? "Samo dve kupovine — " : "";
  if (st === "due") return `${prefix}uobičajeni termin je sada (${ritam}).`;
  if (st === "due_soon") return `${prefix}uobičajeni termin za ${dana(a.daysUntilExpected ?? 0)} (${ritam}).`;
  if (st === "overdue") return `${prefix}prošao uobičajeni termin pre ${dana(-(a.daysUntilExpected ?? 0))} (${ritam}).`;
  if (st === "dormant") return `${prefix}ranije redovno (${ritam}), bez kupovine ${dana(a.daysSinceLastPurchase)}.`;
  return `${prefix}nema aktuelnog termina.`;
}

/** Šta nivo pouzdanosti znači — iz pragova `cadence_v1`, ne verovatnoća. */
export const CONFIDENCE_MEANING = Object.freeze({
  high: "bar 6 kupovina, ujednačen razmak, istorija od bar 4 ciklusa",
  medium: "bar 4 kupovine, umereno ujednačen razmak",
  low: "malo kupovina ili neujednačen razmak",
});

/** Kratki ton za oznaku u sažetku. @param {RankableArticle} a */
export function suggestionTone(a) {
  const st = a.status === "provisional" ? provisionalTiming(a) : a.status;
  return st === "dormant" ? "danger" : st === "overdue" ? "warning" : "success";
}

/**
 * DOSADAŠNJI redosled (pre R1) — za poređenje, ne za odlučivanje.
 *
 * Kako je radio spisak „Vredi pomenuti": ranije redovni (po broju kupovina),
 * pa oni koji kasne (najveće kašnjenje u ciklusima prvo), pa sada/uskoro (po
 * roku). Bez obzira na pouzdanost i bez granice starosti; dve kupovine
 * (`provisional`) nisu ulazile. Slabiji signali ovde ne postoje kao grupa.
 *
 * @template {RankableArticle} T
 * @param {T[]} articles
 * @param {{ limit?: number }} [opts]
 */
export function legacySuggestions(articles, { limit = MAIN_LIMIT } = {}) {
  const ratio = (/** @type {T} */ a) =>
    a.medianIntervalDays ? -(a.daysUntilExpected ?? 0) / a.medianIntervalDays : 0;
  const lapsed = articles.filter((a) => a.status === "dormant").sort((a, b) => b.eventCount - a.eventCount);
  const overdue = articles.filter((a) => a.status === "overdue").sort((a, b) => ratio(b) - ratio(a));
  const due = articles
    .filter((a) => a.status === "due" || a.status === "due_soon")
    .sort((a, b) => (a.daysUntilExpected ?? 0) - (b.daysUntilExpected ?? 0));
  const main = [...lapsed, ...overdue, ...due];
  return { top: main.slice(0, limit), main, weak: /** @type {T[]} */ ([]) };
}
