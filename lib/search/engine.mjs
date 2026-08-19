/**
 * Product search engine — jedan algoritam za Header, Homepage i Katalog.
 *
 * Zašto ne linearni fuzzy scan: postojeća katalog pretraga je po pritisku
 * tastera prolazila kroz ceo skup i radila `includes()` nad unapred spojenim
 * haystack stringom. Na 873 zapisa to je ~0,25 ms i prolazi, ali na ciljanih
 * 3.500+ zapisa sa fuzzy poređenjem po zapisu to postaje desetine milisekundi
 * po znaku — na main threadu, dok Header animacija i kursor rade. Zato je
 * obrada obrnuta: prvo se JEFTINO suzi skup kandidata (exact mapa → postings po
 * tokenu → prefiks opseg nad sortiranim rečnikom), pa se skupo fuzzy poređenje
 * radi nad rečnikom tokena (nekoliko hiljada kratkih stringova), a ne nad
 * zapisima.
 *
 * Zašto bez biblioteke: Fuse.js radi Bitap scan po zapisu i nema inverzni
 * indeks, pa raste linearno sa brojem zapisa — baš ono što ovde treba izbeći.
 * MiniSearch ima inverzni indeks, ali donosi ~9 KB gzip i sopstvenu
 * tokenizaciju i ranking semantiku koju bi ionako trebalo zameniti: srpska
 * dijakritika i `đ`, jedinice (`600ml` ≡ `600 ml`), SKU bez razmaka, alias
 * tabela i pravilo da SKU nikada ne sme da izgubi od slabog fuzzy pogotka po
 * nazivu. Ovaj modul je bez zavisnosti, deterministički i testiran baš na tim
 * pravilima; njegov doprinos bundle-u je manji od biblioteke koju bi zamenio.
 *
 * Modul je `.mjs` iz istog razloga kao `normalize.mjs`: isti fajl radi u Web
 * Workeru, u Next bundle-u i u `node --test`, bez transpajlera.
 */

import { aliasesFor } from "./aliases.mjs";
import {
  boundedEditDistance,
  compactText,
  fuzzyToleranceFor,
  normalizeText,
  queryWords,
  tokenAlternatives,
  tokenize,
} from "./normalize.mjs";

/** Verzija ugovora rangiranja; menja se kad se promene težine ili tie-breakeri. */
export const ENGINE_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* Polja                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Bit-maska polja u kojima se token pojavljuje.
 *
 * Maska (a ne lista pojava) jer je jedino pitanje pri bodovanju „u kom polju je
 * ovaj token", pa je jedan broj po paru token/zapis dovoljan i bodovanje ostaje
 * O(1) po pogotku umesto O(broj pojava).
 */
export const FIELD = {
  NAME: 1,
  CODE: 2,
  VARIANT: 4,
  FAMILY: 8,
  BRAND: 16,
  LINE: 32,
  CATEGORY: 64,
  TERM: 128,
  QUANTITY: 256,
};

/**
 * Težina tokena po polju — redosled prati traženu ranking listu:
 * šifra > naziv > naziv varijante > porodica > brend > tehnička linija >
 * kategorija > alias/termin > pakovanje.
 */
const FIELD_WEIGHT = [
  ["CODE", FIELD.CODE, 120],
  ["NAME", FIELD.NAME, 100],
  ["VARIANT", FIELD.VARIANT, 92],
  ["FAMILY", FIELD.FAMILY, 70],
  ["BRAND", FIELD.BRAND, 52],
  ["LINE", FIELD.LINE, 44],
  ["CATEGORY", FIELD.CATEGORY, 36],
  ["TERM", FIELD.TERM, 28],
  ["QUANTITY", FIELD.QUANTITY, 22],
];

/** Ceo upit se poklopio sa celim poljem — bodovi koji nadjačavaju sve ostalo. */
const WHOLE = {
  CODE: 1000,
  ID: 950,
  VARIANT_NAME: 900,
  NAME: 880,
  NAME_PREFIX: 700,
  ALL_TOKENS_IN_NAME: 600,
};

/**
 * Zapis je pokrio SVE reči upita. Bonus je veći od najveće moguće sume
 * pojedinačnih poklapanja po tokenu, pa AND rezultat nikada ne može da padne
 * ispod OR rezultata čak i kad se AND filter ne primeni.
 */
const ALL_TOKENS_MATCHED = 2000;

/** Prefiks pogodak (korisnik još kuca) vredi manje od celog tokena. */
const PREFIX_FACTOR = 0.6;
/** Alias pogodak je najniži rang koji uopšte ulazi u rezultat. */
const ALIAS_FACTOR = 0.28;
/** Svaka dodatna izmena u fuzzy pogotku nosi jasnu, fiksnu kaznu. */
const FUZZY_BASE_FACTOR = 0.55;
const FUZZY_DISTANCE_PENALTY = 0.22;

/** Rang vrste zapisa u tie-breakeru: porodica pre samostalnog pre varijante. */
const KIND_RANK = { family: 0, standalone: 1, variant: 2 };

/**
 * Blagi bonus kanonskom entitetu.
 *
 * Na opšti upit („ral", „antichip") korisnik traži proizvod, ne jedno od
 * četrdeset pakovanja — porodica je tačniji odgovor. Bonus je namerno manji od
 * težine bilo kog stvarnog poklapanja po polju (najniža je 22), pa varijanta
 * koja se poklapa jače i dalje pobeđuje; ovo odlučuje samo izjednačene slučajeve.
 */
const KIND_BONUS = { family: 18, standalone: 9, variant: 0 };

/**
 * Polja u kojima prefiks pogodak uopšte vredi.
 *
 * Prefiks nad kategorijom, pakovanjem ili slobodnim terminom je skoro uvek šum:
 * upit „c" bi kroz `categorySlugs` povukao ceo katalog. Ime, šifra, varijanta,
 * porodica i brend su jedina polja u kojima „počinje na" znači nešto korisniku.
 */
const PREFIX_FIELDS = FIELD.NAME | FIELD.CODE | FIELD.VARIANT | FIELD.FAMILY | FIELD.BRAND;

/**
 * Najkraći upit koji uopšte pokreće pretragu.
 *
 * Jedan znak nije upit nego slučajan pritisak: „c" je poklapao 820 zapisa —
 * brzo, ali bez ijedne informacije za korisnika, i sa jednakom cenom kao pravi
 * upit. Ovde se odbija na nivou ENGINE-a, ne samo u UI-ju, da bi i katalog sa
 * `?q=c` i svaki budući potrošač dobili isto pravilo.
 *
 * Izuzetak bi tražio stvaran jednoslovni SKU. U trenutnim podacima ga nema:
 * najkraća šifra je dvoznakovna, a jednoslovni tokeni (`c`, `r`, `p`) su prvi
 * deo dvodelnih oznaka tipa `C 2E50`, koje se i dalje nalaze u celini.
 */
export const MIN_QUERY_LENGTH = 2;

/** Najviše tokena rečnika koje jedan prefiks sme da unese u plan. */
const MAX_PREFIX_TOKENS = 96;
/** Fuzzy se uključuje tek od ove dužine tokena. */
const MIN_FUZZY_TOKEN_LENGTH = 5;
/** Ukupna dužina upita ispod koje se fuzzy uopšte ne pokreće. */
const MIN_FUZZY_QUERY_LENGTH = 3;

/* -------------------------------------------------------------------------- */
/* Gradnja indeksa                                                             */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} SearchRecord
 * @property {string} id
 * @property {"family" | "standalone" | "variant"} kind
 * @property {string} href
 * @property {string} name
 * @property {string} [familySlug]
 * @property {string} [familyName]
 * @property {string} [variantName]
 * @property {string} [productCode]
 * @property {string} [brandSlug]
 * @property {string} [brandName]
 * @property {string[]} [categorySlugs]
 * @property {string} [technicalLine]
 * @property {string | null} [quantityLabel]
 * @property {string[]} [terms]
 */

/**
 * @typedef {Object} SearchIndex
 * @property {SearchRecord[]} records
 * @property {Map<string, number[]>} postings
 * @property {Map<string, number[]>} exactCode
 * @property {Map<string, number[]>} exactId
 * @property {string[]} vocabulary
 * @property {Map<string, number>[]} fieldsByRecord
 * @property {string[]} normalizedNames
 * @property {string[]} compactNames
 * @property {string[]} sortKeys
 */

function addPosting(map, key, value) {
  const bucket = map.get(key);
  if (!bucket) {
    map.set(key, [value]);
    return;
  }
  if (bucket[bucket.length - 1] !== value) bucket.push(value);
}

/**
 * Gradi inverzni indeks nad zapisima. Radi se jednom po sesiji, u workeru.
 *
 * @param {SearchRecord[]} records
 * @returns {SearchIndex}
 */
export function buildSearchIndex(records) {
  /** @type {Map<string, number[]>} */
  const postings = new Map();
  /** @type {Map<string, number[]>} */
  const exactCode = new Map();
  /** @type {Map<string, number[]>} */
  const exactId = new Map();
  /** @type {Map<string, number>[]} */
  const fieldsByRecord = new Array(records.length);
  const normalizedNames = new Array(records.length);
  const compactNames = new Array(records.length);
  const sortKeys = new Array(records.length);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    /** @type {Map<string, number>} */
    const fields = new Map();

    const addField = (value, field) => {
      if (!value) return;
      for (const token of tokenize(value)) {
        addPosting(postings, token, index);
        fields.set(token, (fields.get(token) ?? 0) | field);
      }
    };

    addField(record.name, FIELD.NAME);
    addField(record.productCode, FIELD.CODE);
    addField(record.variantName, FIELD.VARIANT);
    addField(record.familyName, FIELD.FAMILY);
    addField(record.brandName, FIELD.BRAND);
    addField(record.brandSlug, FIELD.BRAND);
    addField(record.technicalLine, FIELD.LINE);
    addField(record.quantityLabel, FIELD.QUANTITY);
    for (const category of record.categorySlugs ?? []) addField(category, FIELD.CATEGORY);
    for (const term of record.terms ?? []) addField(term, FIELD.TERM);

    fieldsByRecord[index] = fields;

    const normalizedName = normalizeText(record.name);
    normalizedNames[index] = normalizedName;
    compactNames[index] = compactText(record.name);
    // Naziv + id: par je jedinstven po zapisu, pa je završni tie-breaker total.
    sortKeys[index] = `${normalizedName} ${record.id}`;

    /*
     * Exact mape hvataju „ceo upit == celo polje". Kompaktni oblik je tu zbog
     * SKU-a: `C 2E50`, `c2e50` i `c-2e50` moraju pogoditi isti zapis, a to se
     * ne može izvesti iz tokena jer bi `c` bio zaseban, vrlo čest token.
     */
    for (const key of [
      normalizeText(record.productCode ?? ""),
      compactText(record.productCode ?? ""),
    ]) {
      if (key) addPosting(exactCode, key, index);
    }
    for (const key of [
      normalizeText(record.id),
      compactText(record.id),
      normalizeText(record.familySlug ?? ""),
    ]) {
      if (key) addPosting(exactId, key, index);
    }
  }

  return {
    records,
    postings,
    exactCode,
    exactId,
    vocabulary: [...postings.keys()].sort(),
    fieldsByRecord,
    normalizedNames,
    compactNames,
    sortKeys,
  };
}

/* -------------------------------------------------------------------------- */
/* Pretraga                                                                    */
/* -------------------------------------------------------------------------- */

/** Prvi indeks u sortiranom rečniku čiji je token >= `prefix`. */
function lowerBound(vocabulary, prefix) {
  let low = 0;
  let high = vocabulary.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (vocabulary[middle] < prefix) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Tokeni rečnika koji počinju na `prefix`, u leksikografskom redosledu. */
function prefixTokens(index, prefix, limit) {
  const { vocabulary } = index;
  const found = [];
  for (
    let i = lowerBound(vocabulary, prefix);
    i < vocabulary.length && found.length < limit;
    i += 1
  ) {
    if (!vocabulary[i].startsWith(prefix)) break;
    found.push(vocabulary[i]);
  }
  return found;
}

/**
 * Tokeni rečnika unutar dozvoljene greške od `token`.
 *
 * Skenira se rečnik, ne zapisi: filter po dužini i po prva tri znaka svede
 * rečnik od nekoliko hiljada kratkih tokena na nekoliko stotina stvarnih
 * poređenja, dok bi isto poređenje po zapisima bilo hiljade dužih stringova.
 */
function fuzzyTokens(index, token, tolerance) {
  const matches = [];
  const minLength = token.length - tolerance;
  const maxLength = token.length + tolerance;

  for (const candidate of index.vocabulary) {
    if (candidate.length < minLength || candidate.length > maxLength) continue;
    /*
     * Jeftin predfilter: bar jedan od prva tri znaka mora da se poklopi na svom
     * mestu, ili prva dva da budu zamenjena mesta. Greška koja menja sva tri
     * početna znaka nije tipografska greška nego druga reč.
     */
    const sharesHead =
      candidate[0] === token[0] ||
      candidate[1] === token[1] ||
      candidate[2] === token[2] ||
      (candidate[0] === token[1] && candidate[1] === token[0]);
    if (!sharesHead) continue;

    const distance = boundedEditDistance(token, candidate, tolerance);
    if (distance > 0 && distance <= tolerance) matches.push([candidate, distance]);
  }

  return matches;
}

/**
 * Plan pretrage: koji se stvarni tokeni indeksa gledaju za dati upit, sa kojim
 * umanjenjem, za koju reč upita (`group`) i za koji njen alternativni oblik
 * (`slot`).
 *
 * Grupa je REČ koju je korisnik otkucao. Alternativa je jedan njen zapis koji
 * mora da se poklopi u celini: `600ml` ima alternative `["600ml"]` i
 * `["600","ml"]`, pa se grupa smatra pokrivenom ako zapis ima spojeni oblik ILI
 * oba dela. Bez te unutrašnje konjunkcije, upit `1l` bi kroz goli token `l`
 * pokupio svaki proizvod koji se meri u litrima.
 *
 * Prefiks i fuzzy širenje rade samo nad otkucanim oblikom reči (prva
 * alternativa). Izvedeni delovi (`600`, `ml`) ulaze isključivo kao exact — nije
 * korisnik kucao `l`, pa ne treba da dobije sve što počinje na `l`.
 *
 * @param {SearchIndex} index
 * @param {string[][][]} groups alternative po reči upita
 */
function planQuery(index, groups) {
  const plan = [];
  const queryLength = groups.map(([primary]) => primary.join("")).join("").length;

  groups.forEach((alternatives, group) => {
    const seen = new Set();
    const push = (token, slot, alias, mode, distance) => {
      const key = `${token}|${slot}|${alias ? 1 : 0}|${mode}`;
      if (seen.has(key)) return;
      seen.add(key);
      plan.push({ token, group, slot, alias, mode, distance });
    };

    alternatives.forEach((tokens, alternative) => {
      const isTypedForm = alternative === 0;

      tokens.forEach((token, position) => {
        const slot = `${alternative}:${position}`;
        if (index.postings.has(token)) push(token, slot, false, "exact", 0);
        if (!isTypedForm) return;

        /*
         * Prefiks je dozvoljen i za jedan znak — korisnik koji je otkucao „a"
         * treba da vidi da se nešto dešava. Ograničen je brojem tokena rečnika,
         * pa jednoslovni upit ne može da rasplamsa kandidatski skup.
         */
        for (const candidate of prefixTokens(index, token, MAX_PREFIX_TOKENS)) {
          if (candidate !== token) push(candidate, slot, false, "prefix", 0);
        }

        for (const alias of aliasesFor(token)) {
          if (index.postings.has(alias)) push(alias, slot, true, "exact", 0);
        }

        /*
         * Fuzzy tek kad upit ima dovoljno materijala i kad token nije već pravi
         * termin. Jedan znak ne pokreće fuzzy; dva znaka rade samo exact/prefiks
         * — inače bi „ba" kroz distancu 1 povuklo pola kataloga i rezultat bi
         * prestao da bude objašnjiv.
         */
        if (
          token.length >= MIN_FUZZY_TOKEN_LENGTH &&
          queryLength >= MIN_FUZZY_QUERY_LENGTH &&
          !index.postings.has(token)
        ) {
          const tolerance = fuzzyToleranceFor(token);
          for (const [candidate, distance] of fuzzyTokens(index, token, tolerance)) {
            push(candidate, slot, false, "fuzzy", distance);
          }
        }
      });
    });
  });

  return plan;
}

/** Deljeni prazan skup, da provera pokrivenosti ne alocira po zapisu. */
const EMPTY_SLOTS = new Set();

/** Grupa je pokrivena kad je bar jedna njena alternativa pokrivena u celini. */
function groupSatisfied(alternatives, slots) {
  return alternatives.some((tokens, alternative) =>
    tokens.every((_, position) => slots.has(`${alternative}:${position}`)),
  );
}

function bestField(fieldMask) {
  for (const [name, field, weight] of FIELD_WEIGHT) {
    if (fieldMask & field) return { name, weight };
  }
  return { name: "NONE", weight: 0 };
}

/**
 * @typedef {Object} SearchHit
 * @property {SearchRecord} record
 * @property {number} score
 * @property {number} index pozicija zapisa u `index.records`
 * @property {Object} [explain] samo kada je `debug: true`
 */

/**
 * @param {SearchIndex} index
 * @param {string} rawQuery
 * @param {{ limit?: number, debug?: boolean }} [options]
 * @returns {SearchHit[]}
 */
export function searchIndex(index, rawQuery, options = {}) {
  const limit = options.limit ?? 200;
  const debug = options.debug === true;

  const normalized = normalizeText(rawQuery);
  if (!normalized) return [];
  /*
   * Meri se NORMALIZOVANA dužina: „č" i „c " su i dalje jedan znak, a `C 2E50`
   * (5 znakova bez razmaka) prolazi.
   */
  const compact = compactText(rawQuery);
  if (compact.length < MIN_QUERY_LENGTH) return [];

  const words = queryWords(normalized);
  const groups = words.map((word) => tokenAlternatives(word));
  const groupCount = groups.length;
  if (groupCount === 0) return [];

  /**
   * @type {Map<number, {
   *   score: number,
   *   slots: Map<number, Set<string>>,
   *   nameSlots: Map<number, Set<string>>,
   *   parts: unknown[],
   * }>}
   */
  const candidates = new Map();

  const touch = (recordIndex) => {
    let entry = candidates.get(recordIndex);
    if (!entry) {
      entry = { score: 0, slots: new Map(), nameSlots: new Map(), parts: [] };
      candidates.set(recordIndex, entry);
    }
    return entry;
  };

  const markSlot = (map, group, slot) => {
    const bucket = map.get(group);
    if (bucket) bucket.add(slot);
    else map.set(group, new Set([slot]));
  };

  for (const step of planQuery(index, groups)) {
    const postings = index.postings.get(step.token);
    if (!postings) continue;

    let factor = 1;
    if (step.mode === "prefix") factor *= PREFIX_FACTOR;
    if (step.mode === "fuzzy") {
      factor *= Math.max(
        0.1,
        FUZZY_BASE_FACTOR - FUZZY_DISTANCE_PENALTY * (step.distance - 1),
      );
    }
    if (step.alias) factor *= ALIAS_FACTOR;

    for (const recordIndex of postings) {
      const fieldMask = index.fieldsByRecord[recordIndex].get(step.token) ?? 0;
      if (step.mode === "prefix" && !(fieldMask & PREFIX_FIELDS)) continue;

      const field = bestField(fieldMask);
      const gained = field.weight * factor;
      if (gained <= 0) continue;

      const entry = touch(recordIndex);
      entry.score += gained;
      markSlot(entry.slots, step.group, step.slot);
      if (fieldMask & (FIELD.NAME | FIELD.VARIANT)) {
        markSlot(entry.nameSlots, step.group, step.slot);
      }
      if (debug) {
        entry.parts.push({
          word: words[step.group],
          token: step.token,
          mode: step.mode,
          alias: step.alias,
          distance: step.distance,
          field: field.name,
          gained: Number(gained.toFixed(2)),
        });
      }
    }
  }

  /* -- Poklapanje celog upita sa celim poljem ------------------------------ */

  const wholeField = (map, key, bonus, label) => {
    if (!key) return;
    const found = map.get(key);
    if (!found) return;
    for (const recordIndex of found) {
      const entry = touch(recordIndex);
      entry.score += bonus;
      /*
       * Poklapanje celog upita sa celim poljem pokriva sve reči po definiciji —
       * `C 2E50` je jedna šifra, ne dve nezavisne reči koje treba tražiti.
       */
      groups.forEach((alternatives, group) => {
        alternatives.forEach((tokens, alternative) => {
          tokens.forEach((_, position) => {
            markSlot(entry.slots, group, `${alternative}:${position}`);
            markSlot(entry.nameSlots, group, `${alternative}:${position}`);
          });
        });
      });
      if (debug) entry.parts.push({ whole: label, gained: bonus });
    }
  };

  wholeField(index.exactCode, normalized, WHOLE.CODE, "exact-code");
  if (compact !== normalized) {
    wholeField(index.exactCode, compact, WHOLE.CODE, "exact-code-compact");
  }
  wholeField(index.exactId, normalized, WHOLE.ID, "exact-id");
  if (compact !== normalized) {
    wholeField(index.exactId, compact, WHOLE.ID, "exact-id-compact");
  }

  /* -- Bonusi po zapisu ---------------------------------------------------- */

  const full = [];
  const partial = [];

  for (const [recordIndex, entry] of candidates) {
    const record = index.records[recordIndex];
    let score = entry.score + (KIND_BONUS[record.kind] ?? 0);

    const normalizedName = index.normalizedNames[recordIndex];
    if (normalizedName === normalized || index.compactNames[recordIndex] === compact) {
      const bonus = record.kind === "variant" ? WHOLE.VARIANT_NAME : WHOLE.NAME;
      score += bonus;
      if (debug) entry.parts.push({ whole: "exact-name", gained: bonus });
    } else if (normalizedName.startsWith(normalized)) {
      score += WHOLE.NAME_PREFIX;
      if (debug) entry.parts.push({ whole: "name-prefix", gained: WHOLE.NAME_PREFIX });
    }

    const coveredWords = groups.filter((alternatives, group) =>
      groupSatisfied(alternatives, entry.slots.get(group) ?? EMPTY_SLOTS),
    ).length;
    const coveredInName = groups.filter((alternatives, group) =>
      groupSatisfied(alternatives, entry.nameSlots.get(group) ?? EMPTY_SLOTS),
    ).length;

    if (coveredInName === groupCount) {
      score += WHOLE.ALL_TOKENS_IN_NAME;
      if (debug) {
        entry.parts.push({ whole: "all-tokens-in-name", gained: WHOLE.ALL_TOKENS_IN_NAME });
      }
    }

    const matchedAll = coveredWords === groupCount;
    if (matchedAll) {
      score += ALL_TOKENS_MATCHED;
      if (debug) entry.parts.push({ whole: "all-tokens", gained: ALL_TOKENS_MATCHED });
    }

    const hit = { record, score, index: recordIndex };
    if (debug) {
      hit.explain = {
        matchedWords: words.filter((_, group) =>
          groupSatisfied(groups[group], entry.slots.get(group) ?? EMPTY_SLOTS),
        ),
        coveredWords,
        parts: entry.parts,
        total: Number(score.toFixed(4)),
      };
    }
    (matchedAll ? full : partial).push(hit);
  }

  /*
   * AND pre OR: kad postoji ijedan zapis koji pokriva sve reči upita, rezultat
   * su samo takvi zapisi. „cosmos antichip" tada vraća baš tu porodicu, a ne i
   * svaki proizvod koji je slučajno Cosmos. Delimična poklapanja su fallback
   * koji spasava upit u kome je jedna reč promašena, i tada su sama za sebe
   * rangirana po broju pokrivenih reči kroz zbir bodova.
   */
  const hits = full.length > 0 ? full : partial;

  /*
   * Stabilan poredak: score → vrsta → normalizovan naziv → id. Poslednja dva su
   * jedinstvena po zapisu, pa isti upit uvek daje isti niz — bez oslanjanja na
   * stabilnost `Array.prototype.sort` ili na redosled ubacivanja u Map.
   */
  hits.sort((first, second) => {
    if (second.score !== first.score) return second.score - first.score;
    const kindDelta = KIND_RANK[first.record.kind] - KIND_RANK[second.record.kind];
    if (kindDelta !== 0) return kindDelta;
    return index.sortKeys[first.index] < index.sortKeys[second.index] ? -1 : 1;
  });

  return hits.slice(0, limit);
}
