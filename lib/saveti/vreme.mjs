/**
 * Kalendarsko vreme rubrike „Saveti i vodiči“.
 *
 * Termini objave se zadaju kao lokalni datum i sat u zoni Europe/Belgrade
 * („2026-11-03 u 09:00“), a porede se kao trenuci u vremenu. Prelaz između
 * letnjeg i zimskog računanja vremena menja razliku prema UTC-u (+02:00 leti,
 * +01:00 zimi), pa se razlika računa za svaki termin posebno — nikada se ne
 * pretpostavlja jedna fiksna vrednost.
 *
 * Bez zavisnosti: koristi se samo `Intl`, koji Node i Vercel runtime imaju sa
 * punim podacima o vremenskim zonama.
 */

export const SAVETI_TIME_ZONE = "Europe/Belgrade";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** @param {string} value */
export function parseCalendarDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Neispravan datum „${value}“ (očekivano GGGG-MM-DD)`);
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`Nepostojeći datum „${value}“`);
  }
  return { year: y, month: m, day: d };
}

/** @param {string} value */
export function parseClockTime(value) {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new Error(`Neispravno vreme „${value}“ (očekivano HH:MM)`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Nepostojeće vreme „${value}“`);
  return { hour, minute };
}

/** Kalendarski datum pomeren za ceo broj dana (bez obzira na zonu). */
export function addCalendarDays(dateString, days) {
  const { year, month, day } = parseCalendarDate(dateString);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

const offsetFormatters = new Map();

function formatterFor(timeZone) {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Lokalni delovi datuma i vremena za dati trenutak u zadatoj zoni. */
export function zonedParts(instant, timeZone = SAVETI_TIME_ZONE) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Razlika lokalnog vremena prema UTC-u u minutima za dati trenutak. */
export function zoneOffsetMinutes(instant, timeZone = SAVETI_TIME_ZONE) {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60000);
}

/**
 * Lokalni datum + sat u zoni → trenutak (Date).
 *
 * Dve iteracije pokrivaju i dane prelaza: prva procena koristi razliku u
 * trenutku „kao da je UTC“, druga je ispravlja razlikom stvarnog rezultata.
 * Lokalno vreme koje ne postoji (sat koji se preskače u proleće) pomera se
 * unapred za veličinu skoka, a dvosmisleno (jesenji ponovljeni sat) uzima
 * raniji trenutak. Termin u 09:00 nikada ne pada u te sate; pravilo postoji
 * da ponašanje ne bi zavisilo od slučaja.
 */
export function zonedDateTimeToInstant(dateString, timeString, timeZone = SAVETI_TIME_ZONE) {
  const { year, month, day } = parseCalendarDate(dateString);
  const { hour, minute } = parseClockTime(timeString);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // Moguće razlike oko tog dana (pre i posle eventualnog prelaza).
  const offsets = [...new Set([-12, 0, 12].map((h) => zoneOffsetMinutes(new Date(naive + h * 3600000), timeZone)))];
  const matches = offsets
    .map((offset) => naive - offset * 60000)
    .filter((candidate) => {
      const p = zonedParts(new Date(candidate), timeZone);
      return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
    })
    .sort((a, b) => a - b);
  if (matches.length) return new Date(matches[0]);
  // Nepostojeći lokalni sat (prolećni skok): pomera se unapred za veličinu skoka.
  return new Date(naive - Math.min(...offsets) * 60000);
}

/** ISO zapis trenutka sa lokalnom razlikom, npr. 2026-11-03T09:00:00+01:00. */
export function formatZonedIso(instant, timeZone = SAVETI_TIME_ZONE) {
  const p = zonedParts(instant, timeZone);
  const offset = zoneOffsetMinutes(instant, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const pad = (value) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Lokalni kalendarski datum (GGGG-MM-DD) trenutka u zoni. */
export function zonedCalendarDate(instant, timeZone = SAVETI_TIME_ZONE) {
  return formatZonedIso(instant, timeZone).slice(0, 10);
}

/**
 * Trenutak iz zapisa koji može biti ceo ISO trenutak ili samo datum.
 * Sam datum znači početak tog dana u zoni rubrike.
 */
export function instantFrom(value, timeZone = SAVETI_TIME_ZONE) {
  if (value instanceof Date) return value;
  if (DATE_PATTERN.test(value)) return zonedDateTimeToInstant(value, "00:00", timeZone);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Neispravan trenutak „${value}“`);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`Trenutak „${value}“ mora navesti zonu (Z ili ±HH:MM)`);
  }
  return parsed;
}

const SERBIAN_MONTHS_GENITIVE = [
  "januara",
  "februara",
  "marta",
  "aprila",
  "maja",
  "juna",
  "jula",
  "avgusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

/**
 * „3. novembra 2026.“ — datum za prikaz posetiocu. Mesec je u genitivu, kako
 * se datum piše u srpskom jeziku (Intl za sr-Latn daje nominativ).
 */
export function formatSerbianDate(value) {
  const instant = instantFrom(value);
  const p = zonedParts(instant);
  return `${p.day}. ${SERBIAN_MONTHS_GENITIVE[p.month - 1]} ${p.year}.`;
}

/** Broj kalendarskih dana od `from` do `to` (GGGG-MM-DD), može biti negativan. */
export function daysBetween(from, to) {
  parseCalendarDate(from);
  parseCalendarDate(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
