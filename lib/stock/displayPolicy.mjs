/**
 * Prikaz stanja iz poslednjeg potvrđenog izvoza prijavljenim kupcima (dok. 65 §4).
 *
 * Odluka vlasnika 15. 10. 2026: prikaz SVIM prijavljenim kupcima, prag svežine 24 h od
 * VREMENA STANJA. Prekidač je `system_settings['stock.customerDisplay']`
 * = { enabled: true, maxAgeHours: 24 } (vlasnik ga uključuje/isključuje u Portalu → Zalihe).
 * Promenljiva okruženja `STOCK_CUSTOMER_DISPLAY=0` je hitno isključenje za ceo deployment;
 * bez nje odlučuje podešavanje.
 *
 * Vreme stanja: izvor BizniSofta nosi samo DATUM („Na dan“), pa se računa konzervativno od
 * početka tog dana po Europe/Belgrade. Vreme otpremanja ili potvrde NIJE vreme stanja i ne
 * „podmlađuje“ snimak. Posle praga broj se skriva i kupac vidi da je potrebna provera.
 * Prag nema podrazumevanu vrednost: bez praga nema prikaza.
 */

export const STOCK_DISPLAY_SETTING = "stock.customerDisplay";
export const STOCK_TIME_ZONE = "Europe/Belgrade";
export const OFFICE_NOTE = "Raspoloživost potvrđuje kancelarija.";
export const ON_REQUEST = "Raspoloživost na upit";

/**
 * @param {unknown} raw vrednost iz system_settings
 * @returns {{ enabled: boolean, maxAgeHours: number | null, problems: string[] }}
 */
export function normalizeDisplayPolicy(raw) {
  const problems = [];
  const v = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const enabled = v.enabled === true;
  let maxAgeHours = null;
  if (v.maxAgeHours !== undefined && v.maxAgeHours !== null) {
    const h = /** @type {number} */ (v.maxAgeHours);
    if (Number.isInteger(h) && h >= 1 && h <= 24 * 14) maxAgeHours = h;
    else problems.push("prag_neispravan");
  }
  if (enabled && maxAgeHours === null) problems.push("prag_nije_zadat");
  return { enabled, maxAgeHours, problems };
}

/** Pomak vremenske zone (ms) u datom trenutku: lokalno − UTC. */
function zoneOffsetMs(at, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Početak dana `YYYY-MM-DD` u zadatoj zoni, kao trenutak (Date). Ispravno i na dane promene
 * letnjeg računanja vremena.
 * @param {string} isoDate
 * @param {string} [timeZone]
 */
export function startOfDayIn(isoDate, timeZone = STOCK_TIME_ZONE) {
  const utcMidnight = Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)));
  let guess = utcMidnight - zoneOffsetMs(new Date(utcMidnight), timeZone);
  // Druga iteracija pokriva dan kada se pomak menja oko ponoći.
  guess = utcMidnight - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/**
 * Vreme stanja snimka: tačno vreme ako ga izvor ima, inače početak datuma stanja (Beograd).
 * @param {{ stockDate: string, stockTime?: string | null }} s
 */
export function stockMoment(s) {
  if (s.stockTime) return new Date(s.stockTime);
  return startOfDayIn(s.stockDate);
}

/**
 * @param {{ env: Record<string, string | undefined>, policy: unknown, snapshot: { stockDate: string, stockTime?: string | null } | null, now: Date }} input
 * @returns {{ show: true, stockAt: Date, validUntil: Date } | { show: false, reason: string, stockAt?: Date }}
 *   `show: false` sa `reason: "zastareo_snimak"` znači: prikaz je uključen, ali broj se skriva.
 */
export function customerDisplayDecision({ env, policy, snapshot, now }) {
  if (env.STOCK_CUSTOMER_DISPLAY === "0") return { show: false, reason: "iskljuceno_okruzenje" };
  const p = normalizeDisplayPolicy(policy);
  if (!p.enabled) return { show: false, reason: "iskljuceno_podesavanje" };
  if (p.maxAgeHours === null) return { show: false, reason: "prag_nije_zadat" };
  if (!snapshot) return { show: false, reason: "nema_snimka" };
  const stockAt = stockMoment(snapshot);
  if (stockAt.getTime() > now.getTime()) return { show: false, reason: "datum_u_buducnosti", stockAt };
  const validUntil = new Date(stockAt.getTime() + p.maxAgeHours * 3600_000);
  if (now.getTime() >= validUntil.getTime()) return { show: false, reason: "zastareo_snimak", stockAt };
  return { show: true, stockAt, validUntil };
}

const fmtDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`;

/**
 * Tekst za kupca. Vreme se prikazuje samo ako ga izvor ima; vreme otpremanja se kupcu ne
 * prikazuje (nije vreme stanja).
 * @param {{ stockDate: string, stockTime?: string | null }} s
 */
export function customerStockCaption(s) {
  let when = fmtDate(s.stockDate);
  if (s.stockTime) {
    const t = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: STOCK_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(s.stockTime));
    when = `${when} u ${t}`;
  }
  return { headline: `Stanje prema izvozu na dan ${when}`, note: OFFICE_NOTE };
}

/** Tekst kada je prikaz uključen, ali je snimak stariji od praga. */
export const STALE_CAPTION = { headline: "Potrebna je provera raspoloživosti — poslednje stanje je starije od 24 sata.", note: OFFICE_NOTE };

/**
 * Šta kupac vidi za jedan artikal kada je snimak svež. Broj samo uz potvrđenu vezu, JM i
 * pakovanje (cela pakovanja, naniže); sve ostalo — uključujući izostavljenu šifru i
 * negativno ili prazno izvorno stanje — je „Raspoloživost na upit“, nikad nula ili minus.
 * @param {{ status: "ok", packs: number } | { status: "nema_broja", reason: string }} packs rezultat wholePacks
 * @param {{ label: string | null, single: boolean, unit: string | null }} pack
 * @returns {{ state: "ima" | "nema" | "upit", text: string }}
 */
export function customerStockLine(packs, pack) {
  if (packs.status !== "ok") return { state: "upit", text: ON_REQUEST };
  if (packs.packs < 1) return { state: "nema", text: pack.single ? "Prema izvozu: nema na stanju" : "Prema izvozu: nema celog pakovanja na stanju" };
  const what = pack.single ? `${packs.packs} ${unitWord(pack.unit)}` : `${packs.packs} × ${pack.label ?? "pakovanje"}`;
  return { state: "ima", text: `Na stanju prema izvozu: ${what}` };
}

function unitWord(unit) {
  const u = String(unit ?? "").toUpperCase();
  return u === "KOM" ? "kom" : u === "LIT" ? "L" : u === "KG" ? "kg" : u.toLowerCase() || "kom";
}
