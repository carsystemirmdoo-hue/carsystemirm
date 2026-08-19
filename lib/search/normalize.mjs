/**
 * Normalizacija upita i indeksiranog teksta — jedini izvor istine za pretragu.
 *
 * Postojeća katalog pretraga je radila `toLowerCase().normalize("NFD")` +
 * skidanje kombinujućih znakova. To rešava `č/ć → c`, `š → s`, `ž → z`, ali NE i
 * `đ`: to je jedan codepoint (U+0111) bez dekompozicije, pa je upit
 * „razredjivac" vraćao 0 rezultata dok je „razređivač" vraćao 7. Zato se `đ`
 * eksplicitno mapira na `dj` sa OBE strane (i u indeksu i u upitu), čime oba
 * oblika daju isti ključ.
 *
 * Modul je namerno `.mjs` bez ijedne zavisnosti: isti fajl koristi Next server
 * build (generisanje indeksa), Web Worker (pretraga) i `node --test` (testovi).
 * Da je TypeScript, worker bi morao kroz bundler, a testovi kroz transpajler.
 */

/** Verzija ugovora normalizacije; menja se kad se promeni ključ tokena. */
export const NORMALIZE_VERSION = 1;

/**
 * Sufiksi jedinica koji se smeju odvojiti od broja.
 *
 * Namerno whitelist, a ne „slova posle cifara": `2E50` je oznaka modela
 * (`C 2E50 Clear coat`) i sme da ostane jedan token, dok `600ml` mora da se
 * razloži na `600` + `ml` da bi se poklopio sa `600 ml`.
 */
const UNIT_SUFFIXES = new Set([
  "l",
  "ml",
  /*
   * `cl` (centilitar) namerno NIJE jedinica: u ovom katalogu nijedan proizvod
   * se ne meri u centilitrima (izmereno: ml, l, kg, mm), a `CL` jeste oznaka
   * Cosmos Lac linije („CL 811", „CL-AUTOMOTIVE-…"). Kao jedinica bi ta oznaka
   * bila proglašena merom i ispala iz tokena porodice.
   */
  "dl",
  "g",
  "gr",
  "kg",
  "mm",
  "cm",
  "m",
  "mikron",
  "my",
]);

const NUMBER_UNIT = /^(\d+(?:\.\d+)?)([a-z]{1,6})$/;
const UNIT_NUMBER = /^([a-z]{1,6})(\d+(?:\.\d+)?)$/;

/**
 * Osnovna normalizacija stringa: mala slova, `đ → dj`, skinuta dijakritika,
 * decimalni zarez → tačka, sve ostalo što nije slovo/cifra/tačka → razmak.
 *
 * Tačka preživi samo između cifara (`3.5`), inače je separator — `R-M`,
 * `cl-automotive-250`, `1/1` i `Pasta 190.` se svi razlažu isto.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  if (!value) return "";

  return (
    value
      .toLowerCase()
      .replace(/đ/g, "dj")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Decimalni zarez je srpski zapis: „3,5 l" i „3.5 l" moraju dati isti token.
      .replace(/(\d),(\d)/g, "$1.$2")
      /*
       * Decimalna tačka se štiti sentinelom umesto lookbehind-om: `(?<!\d)` je
       * sintaksna greška u starijim Safari runtime-ovima, a modul se učitava i u
       * Web Workeru gde bi takav izuzetak oborio celu pretragu, ne samo jedan
       * upit. Sve ostale tačke su separatori.
       */
      .replace(/(\d)\.(\d)/g, "$1\u0001$2")
      .replace(/[^a-z0-9\u0001]+/g, " ")
      .replace(/\u0001/g, ".")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Kompaktni oblik: normalizovan tekst bez ijednog separatora.
 *
 * Ovo je ono što čini da SKU nađe sam sebe bez obzira na razmake — `C 2E50`,
 * `c2e50` i `c-2e50` svi daju `c2e50`.
 *
 * @param {string} value
 * @returns {string}
 */
export function compactText(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

/**
 * Tokeni jednog stringa, sa razlaganjem broj+jedinica u oba smera.
 *
 * `600ml` → `600ml`, `600`, `ml`
 * `600 ml` → `600`, `ml`, `600ml`
 * `3,5 l` → `3.5`, `l`, `3.5l`
 * `2e50`  → `2e50` (nije jedinica, ostaje celo)
 *
 * @param {string} value
 * @returns {string[]} jedinstveni tokeni, u redosledu prvog pojavljivanja
 */
export function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const raw = normalized.split(" ").filter(Boolean);
  const tokens = [];
  const seen = new Set();

  const push = (token) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    push(token);

    const numberUnit = NUMBER_UNIT.exec(token);
    if (numberUnit && UNIT_SUFFIXES.has(numberUnit[2])) {
      push(numberUnit[1]);
      push(numberUnit[2]);
      continue;
    }

    const unitNumber = UNIT_NUMBER.exec(token);
    if (unitNumber && UNIT_SUFFIXES.has(unitNumber[1])) {
      push(unitNumber[1]);
      push(unitNumber[2]);
      continue;
    }

    // Spojeni oblik za „600 ml" → „600ml", da razmak ne bi menjao rezultat.
    const next = raw[index + 1];
    if (next && /^\d+(?:\.\d+)?$/.test(token) && UNIT_SUFFIXES.has(next)) {
      push(`${token}${next}`);
    }
  }

  return tokens;
}

/**
 * Alternativni oblici JEDNE otkucane reči, za stranu upita.
 *
 * Mera se traži ISKLJUČIVO kao spojen token (`600ml`), nikad kao „`600` I `ml`
 * bilo gde u zapisu". Razlog je konkretan promašaj: `Cosmos Lac Flame Blue FB
 * 600` je pakovanje od 400 ml, ali ima šifru 600 — pa je razložena mera
 * poklapala `600` u polju šifre i `ml` u tehničkoj liniji i proglašavala ga
 * rezultatom za upit „600 ml".
 *
 * Spojen oblik je dovoljan jer ga indeksna strana uvek emituje: `tokenize()`
 * spaja susedni par broj+jedinica UNUTAR jednog polja, pa `600ml` postoji tačno
 * onda kada zapis stvarno ima pakovanje od 600 ml — bez obzira da li je u
 * podacima zapisano `600 ml`, `600ml` ili `600 ML`.
 *
 * @param {string} word jedna normalizovana reč upita
 * @returns {string[][]} lista konjunkcija; danas uvek tačno jedna
 */
export function tokenAlternatives(word) {
  if (!word) return [];
  return [[word]];
}

/** @param {string} token */
export function isUnitToken(token) {
  return UNIT_SUFFIXES.has(token);
}

/** @param {string} token */
export function isNumberToken(token) {
  return /^\d+(?:\.\d+)?$/.test(token);
}

/**
 * Da li je token mera: broj, jedinica ili spojen par (`600`, `ml`, `600ml`).
 *
 * Koristi ga generator indeksa da pakovanje ne postane osobina PORODICE —
 * porodica se upravo i deli na varijante po volumenu, pa „600 ml" opisuje
 * varijantu, ne grupu.
 *
 * @param {string} token
 */
export function isMeasureToken(token) {
  if (isNumberToken(token) || isUnitToken(token)) return true;
  const numberUnit = NUMBER_UNIT.exec(token);
  if (numberUnit && UNIT_SUFFIXES.has(numberUnit[2])) return true;
  const unitNumber = UNIT_NUMBER.exec(token);
  return Boolean(unitNumber && UNIT_SUFFIXES.has(unitNumber[1]));
}

/**
 * Reči upita, sa spajanjem mere napisane kao dve reči.
 *
 * „600 ml" i „600ml" su ista mera, pa moraju dati IDENTIČAN skup grupa — inače
 * bi razmak menjao rezultat: kod razdvojenog zapisa bi „ml" bio samostalna reč
 * koja se prefiksom širi na sve što počinje na „ml", a kod spojenog ne bi.
 *
 * @param {string} normalized normalizovan ceo upit
 * @returns {string[]} reči, sa spojenim merama
 */
export function queryWords(normalized) {
  const raw = normalized.split(" ").filter(Boolean);
  const words = [];

  for (let index = 0; index < raw.length; index += 1) {
    const word = raw[index];
    const next = raw[index + 1];
    if (next && isNumberToken(word) && isUnitToken(next)) {
      words.push(`${word}${next}`);
      index += 1;
      continue;
    }
    words.push(word);
  }

  return [...new Set(words)];
}

/**
 * Rastojanje po Damerau–Levenshtein (optimal string alignment) sa ranim
 * prekidom kada pređe `max`.
 *
 * OSA varijanta je izabrana jer transpoziciju („antchiip") broji kao JEDNU
 * grešku; obična Levenshtein distanca bi je brojala kao dve i takav upit bi
 * ispao iz praga tolerancije za tipičnu dužinu reči.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} max
 * @returns {number} rastojanje, ili `max + 1` kada ga sigurno prelazi
 */
export function boundedEditDistance(a, b, max) {
  if (a === b) return 0;
  const lengthA = a.length;
  const lengthB = b.length;
  if (Math.abs(lengthA - lengthB) > max) return max + 1;
  if (lengthA === 0) return lengthB;
  if (lengthB === 0) return lengthA;

  let previousPrevious = new Array(lengthB + 1);
  let previous = new Array(lengthB + 1);
  let current = new Array(lengthB + 1);

  for (let j = 0; j <= lengthB; j += 1) previous[j] = j;

  for (let i = 1; i <= lengthA; i += 1) {
    current[0] = i;
    const from = Math.max(1, i - max);
    const to = Math.min(lengthB, i + max);
    if (from > 1) current[from - 1] = max + 1;

    let rowBest = max + 1;
    for (let j = from; j <= to; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        value = Math.min(value, previousPrevious[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowBest) rowBest = value;
    }
    if (to < lengthB) current[to + 1] = max + 1;
    if (rowBest > max) return max + 1;

    const spent = previousPrevious;
    previousPrevious = previous;
    previous = current;
    current = spent;
  }

  const distance = previous[lengthB];
  return distance > max ? max + 1 : distance;
}

/**
 * Dozvoljena tolerancija greške za token date dužine.
 *
 * Kratki tokeni nemaju toleranciju namerno: na 3.500 zapisa bi „ral" sa
 * distancom 1 povukao „ram", „rap", „bal"… i pretraga bi prestala da bude
 * objašnjiva. Prag 4 znaka je i granica ispod koje tipične SKU oznake žive.
 *
 * @param {string} token
 * @returns {number}
 */
export function fuzzyToleranceFor(token) {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}
