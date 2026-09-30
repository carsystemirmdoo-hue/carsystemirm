/**
 * Sezonske kampanje — čista logika datuma, bez React-a i bez I/O.
 *
 * Sve odluke se donose nad KALENDARSKIM DATUMOM u zoni `Europe/Belgrade`
 * („YYYY-MM-DD"), ne nad trenutkom u UTC-u. Tako kampanja počinje u ponoć po
 * našem vremenu, bez obzira na to u kojoj zoni radi server ili browser.
 *
 * Konfiguracija kampanja živi u `seasonalCampaigns.config.mjs`; ovde je samo
 * pravilo kako se ona tumači, da bi se oba mogla testirati odvojeno.
 */

export const SEASONAL_TIME_ZONE = "Europe/Belgrade";

/** Režimi ručne kontrole. Sve ostalo je id kampanje koja se forsira. */
export const SEASONAL_MODE_AUTO = "auto";
export const SEASONAL_MODE_OFF = "off";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY_PATTERN = /^(\d{2})-(\d{2})$/;
const OFF_VALUES = new Set(["off", "0", "false", "iskljuceno", "isključeno"]);
const DAY_MS = 86_400_000;

/**
 * @typedef {{ type: "fixed", start: string, end: string }} FixedSeasonalWindow
 *   `start`/`end` su „MM-DD", oba uključena. Ako je `end` pre `start`,
 *   prozor prelazi u sledeću godinu (npr. 12-15 → 01-07).
 * @typedef {{ type: "orthodox-easter", startOffsetDays: number, endOffsetDays: number }} EasterSeasonalWindow
 *   Pomeraji su u danima u odnosu na pravoslavni Vaskrs, oba uključena.
 * @typedef {FixedSeasonalWindow | EasterSeasonalWindow} SeasonalWindow
 *
 * @typedef {object} SeasonalImageReuse
 * @property {"campaign-only" | "generic-confirmed"} status
 *   `campaign-only`: vizual pripada jednoj konkretnoj kampanji i sme da se
 *   prikaže samo unutar `campaignWindow` (npr. social vizual za 2024/25).
 *   `generic-confirmed`: dobavljač je potvrdio da je vizual generički i
 *   ponovo upotrebljiv; `evidence` mora da navede tu potvrdu.
 * @property {{ start: string, end: string }} [campaignWindow]
 *   Originalni period kampanje („YYYY-MM-DD", oba uključena); obavezan za
 *   `campaign-only`.
 * @property {string} evidence  Doslovan dokaz (tag, metapodatak, poruka).
 *
 * @typedef {object} SeasonalImageSource
 * @property {string} portal       Naziv izvora (npr. „Surventis Brand Portal").
 * @property {number} [assetId]    ID asseta na portalu.
 * @property {string} assetName    Naziv asseta na portalu.
 * @property {string} path         Kategorija ili putanja na portalu.
 * @property {string} originalFile Originalni naziv preuzetog fajla.
 * @property {string} [campaign]   Kampanja i godina iz koje vizual potiče.
 * @property {string} usageNotes   Napomene o upotrebi sa portala, doslovno.
 *
 * @typedef {object} SeasonalImage
 * @property {string} desktopSrc
 * @property {string} [mobileSrc]
 * @property {number} width
 * @property {number} height
 * @property {number} [mobileWidth]
 * @property {number} [mobileHeight]
 * @property {string} alt
 * @property {string} [validFrom]  „YYYY-MM-DD" — pre ovog dana slika se ne koristi.
 * @property {string} [validUntil] „YYYY-MM-DD" — rok sa portala; posle njega
 *   slika se ne koristi, a kampanja pada na dekorativnu verziju bez slike.
 * @property {SeasonalImageReuse} reuse
 * @property {SeasonalImageSource} source
 *
 * @typedef {object} SeasonalCopy
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} description
 * @property {{ href: string, label: string }} cta
 * @property {string} controlLabel
 *
 * @typedef {object} SeasonalCampaign
 * @property {string} id
 * @property {string} label
 * @property {boolean} enabled
 * @property {"winter" | "spring"} theme
 * @property {SeasonalWindow} window
 * @property {SeasonalImage | null} image
 * @property {SeasonalCopy} copy
 *
 * @typedef {object} ActiveSeasonalCampaign
 * @property {SeasonalCampaign} campaign
 * @property {{ start: string, end: string } | null} window
 *   Konkretan prozor za dati datum; `null` kada je kampanja ručno forsirana.
 * @property {SeasonalImage | null} image
 *   Slika samo ako postoji i ako je rok važenja pokriva dati datum.
 * @property {boolean} forced
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDateKey(value) {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Kalendarski datum trenutka `instant` u zoni Europe/Belgrade.
 *
 * @param {Date} instant
 * @returns {string} „YYYY-MM-DD"
 */
export function belgradeDateKey(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEASONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * @param {string} dateKey
 * @param {number} days
 */
export function addDays(dateKey, days) {
  if (!isDateKey(dateKey)) throw new Error(`Neispravan datum: ${dateKey}`);
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Pravoslavni Vaskrs za godinu, kao gregorijanski datum.
 *
 * Meeus-ov algoritam za julijanski kalendar, pa pomak u gregorijanski. Pomak je
 * 13 dana za 1900–2099; van tog opsega funkcija odbija da računa umesto da
 * vrati pogrešan datum.
 *
 * @param {number} year
 * @returns {string} „YYYY-MM-DD"
 */
export function orthodoxEasterDate(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    throw new RangeError(
      `Pravoslavni Vaskrs se računa samo za 1900–2099, traženo: ${year}`,
    );
  }
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;
  const julian = `${year}-${String(julianMonth).padStart(2, "0")}-${String(
    julianDay,
  ).padStart(2, "0")}`;
  return addDays(julian, 13);
}

/**
 * Konkretni prozori kampanje koji mogu da obuhvate godinu `year`.
 *
 * @param {SeasonalWindow} window
 * @param {number} year
 * @returns {{ start: string, end: string }[]}
 */
export function seasonalWindowsAround(window, year) {
  if (window.type === "fixed") {
    if (!MONTH_DAY_PATTERN.test(window.start) || !MONTH_DAY_PATTERN.test(window.end)) {
      throw new Error(`Prozor mora biti „MM-DD": ${window.start} → ${window.end}`);
    }
    const crossesYear = window.end < window.start;
    return [year - 1, year].map((startYear) => {
      const start = `${startYear}-${window.start}`;
      const end = `${crossesYear ? startYear + 1 : startYear}-${window.end}`;
      if (!isDateKey(start) || !isDateKey(end)) {
        throw new Error(`Nepostojeći datum u prozoru: ${start} → ${end}`);
      }
      return { start, end };
    });
  }

  if (window.type === "orthodox-easter") {
    if (window.startOffsetDays > window.endOffsetDays) {
      throw new Error("Vaskršnji prozor: početak mora biti pre kraja.");
    }
    const easter = orthodoxEasterDate(year);
    return [
      {
        start: addDays(easter, window.startOffsetDays),
        end: addDays(easter, window.endOffsetDays),
      },
    ];
  }

  throw new Error(`Nepoznat tip prozora: ${/** @type {any} */ (window).type}`);
}

/**
 * Slika sme da se prikaže samo ako je odluka o ponovnoj upotrebi izričita:
 * vizual jedne kampanje (`campaign-only`) nikad ne prelazi u sledeću sezonu,
 * a generički (`generic-confirmed`) mora da nosi dokaz.
 *
 * @param {SeasonalImage | null} image
 * @param {string} dateKey
 * @returns {SeasonalImage | null}
 */
export function usableSeasonalImage(image, dateKey) {
  if (!image) return null;
  // Bez eksplicitne odluke o ponovnoj upotrebi slika se nikad ne prikazuje.
  const reuse = image.reuse;
  if (!reuse || !reuse.evidence?.trim()) return null;
  if (reuse.status === "campaign-only") {
    const window = reuse.campaignWindow;
    if (!window || dateKey < window.start || dateKey > window.end) return null;
  } else if (reuse.status !== "generic-confirmed") {
    return null;
  }
  if (image.validFrom && dateKey < image.validFrom) return null;
  if (image.validUntil && dateKey > image.validUntil) return null;
  return image;
}

/**
 * Normalizuje vrednost ručnog prekidača (env ili preview parametar).
 * Nepoznata vrednost NIKAD ne uključuje kampanju — vraća `auto`.
 *
 * @param {unknown} value
 * @param {readonly SeasonalCampaign[]} campaigns
 * @returns {string} `auto`, `off` ili id postojeće kampanje
 */
export function parseSeasonalMode(value, campaigns) {
  if (typeof value !== "string") return SEASONAL_MODE_AUTO;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === SEASONAL_MODE_AUTO) return SEASONAL_MODE_AUTO;
  if (OFF_VALUES.has(normalized)) return SEASONAL_MODE_OFF;
  if (campaigns.some((campaign) => campaign.id === normalized)) return normalized;
  return SEASONAL_MODE_AUTO;
}

/**
 * Aktivna kampanja za dati datum, ili `null` (standardna verzija sajta).
 *
 * - `off`: nikad ništa.
 * - id kampanje: ta kampanja, bez obzira na datum i `enabled` (ručni test).
 * - `auto`: prva uključena kampanja čiji prozor obuhvata datum.
 *
 * @param {{ campaigns: readonly SeasonalCampaign[], dateKey: string, mode?: string }} input
 * @returns {ActiveSeasonalCampaign | null}
 */
export function resolveSeasonalCampaign({ campaigns, dateKey, mode = SEASONAL_MODE_AUTO }) {
  if (!isDateKey(dateKey)) throw new Error(`Neispravan datum: ${dateKey}`);
  if (mode === SEASONAL_MODE_OFF) return null;

  if (mode !== SEASONAL_MODE_AUTO) {
    const forced = campaigns.find((campaign) => campaign.id === mode);
    if (!forced) return null;
    return {
      campaign: forced,
      window: null,
      image: usableSeasonalImage(forced.image, dateKey),
      forced: true,
    };
  }

  const year = Number(dateKey.slice(0, 4));
  for (const campaign of campaigns) {
    if (!campaign.enabled) continue;
    const window = seasonalWindowsAround(campaign.window, year).find(
      ({ start, end }) => start <= dateKey && dateKey <= end,
    );
    if (window) {
      return {
        campaign,
        window,
        image: usableSeasonalImage(campaign.image, dateKey),
        forced: false,
      };
    }
  }
  return null;
}
