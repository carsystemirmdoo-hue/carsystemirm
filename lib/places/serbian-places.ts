/**
 * Pretraga naseljenih mesta Srbije (2026-11-03).
 *
 * Izvor je spisak naselja iz OpenStreetMap-a (granice naselja sa RZS matičnim
 * brojem, ODbL) koji pravi `scripts/places/build-settlements.mts`; opis izvora,
 * pokrivenost i uslovi korišćenja su u docs/NASELJA_SRBIJE.md. Ovde je samo
 * čista logika: normalizacija unosa (latinica, ćirilica, bez dijakritike),
 * pretraga i oznaka mesta. Bez React-a i bez mreže, da bi se testirala.
 */

export type GeoPoint = { lat: number; lng: number };

/** Red u kompaktnom JSON-u: [RZS matični broj, naziv (latinica), indeks opštine, lat, lng, broj stanovnika 2022 | null]. */
export type SettlementRow = [string, string, number, number, number, number | null];

export type SettlementDataset = {
  schema: 1;
  source: {
    name: string;
    license: string;
    attribution: string;
    retrievedAt: string;
    osmTimestamp: string;
  };
  municipalities: string[];
  places: SettlementRow[];
};

export type Settlement = {
  ref: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  population: number | null;
};

type IndexedSettlement = Settlement & {
  folded: string;
  foldedBase: string;
  foldedWords: string[];
  foldedMunicipality: string;
  label: string;
};

export type SettlementIndex = {
  settlements: IndexedSettlement[];
  byRef: Map<string, IndexedSettlement>;
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i",
  ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r",
  с: "s", т: "t", ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};

/** Srpska ćirilica → latinica (Чачак → Čačak, Љиг → Ljig). Ostali znakovi ostaju. */
export function cyrillicToLatin(text: string) {
  let result = "";
  for (const char of text) {
    const lower = char.toLowerCase();
    const latin = CYRILLIC_TO_LATIN[lower];
    if (latin === undefined) {
      result += char;
    } else if (lower !== char) {
      result += latin.charAt(0).toUpperCase() + latin.slice(1);
    } else {
      result += latin;
    }
  }
  return result;
}

/**
 * Ključ za poređenje: isto za „Čačak“, „Чачак“, „Cacak“ i „CACAK“. Đ i „dj“ se
 * svode na „d“, pa „Đurđevo“, „Djurdjevo“ i „Durdevo“ daju isti ključ.
 */
export function foldPlaceText(text: string) {
  return cyrillicToLatin(text)
    .toLocaleLowerCase("sr-Latn")
    .replaceAll("đ", "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("dj", "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Naziv bez dopune u zagradi: „Beograd (Zemun)“ → „Beograd“, „Gruža (selo)“ → „Gruža“. */
function baseName(name: string) {
  return name.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Oznaka za izbor: naziv i opština, jer se oko 350 naziva ponavlja (npr. četiri
 * „Lipovice“). Opština se izostavlja samo kada je već sadržana u nazivu
 * („Čačak“ u Gradu Čačku, „Beograd (Zemun)“ u opštini Zemun).
 */
export function settlementLabel(settlement: Pick<Settlement, "name" | "municipality">) {
  const name = foldPlaceText(settlement.name);
  const municipality = foldPlaceText(settlement.municipality);
  const containsMunicipality = ` ${name} `.includes(` ${municipality} `);
  return containsMunicipality ? settlement.name : `${settlement.name}, ${settlement.municipality}`;
}

export function createSettlementIndex(dataset: SettlementDataset): SettlementIndex {
  const settlements = dataset.places.map(([ref, name, municipalityIndex, lat, lng, population]) => {
    const municipality = dataset.municipalities[municipalityIndex] ?? "";
    const folded = foldPlaceText(name);
    return {
      ref,
      name,
      municipality,
      lat,
      lng,
      population,
      folded,
      foldedBase: foldPlaceText(baseName(name)),
      foldedWords: folded.split(" "),
      foldedMunicipality: foldPlaceText(municipality),
      label: settlementLabel({ name, municipality }),
    };
  });
  return { settlements, byRef: new Map(settlements.map((item) => [item.ref, item])) };
}

function toSettlement(item: IndexedSettlement): Settlement {
  return {
    ref: item.ref,
    name: item.name,
    municipality: item.municipality,
    lat: item.lat,
    lng: item.lng,
    population: item.population,
  };
}

export function getSettlement(index: SettlementIndex, ref: string): Settlement | null {
  const item = index.byRef.get(ref);
  return item ? toSettlement(item) : null;
}

/**
 * Stepen podudaranja (manji je bolji), ili null kada mesto ne odgovara upitu:
 *  0 — ceo naziv („Lipovica“, „Beograd“ za sve delove Beograda);
 *  1 — početak naziva („Čač“ → Čačak);
 *  2 — početak neke reči naziva („Zemun“ → Beograd (Zemun), „Palanka“ → Bačka Palanka);
 *  3 — naziv i opština zajedno („Lipovica Leskovac“, „Grabovac Obrenovac“);
 *  4 — deo reči, za upite od bar tri slova.
 */
function matchRank(item: IndexedSettlement, query: string, queryWords: string[]) {
  if (item.folded === query || item.foldedBase === query) return 0;
  if (item.folded.startsWith(query)) return 1;
  if (item.foldedWords.some((word) => word.startsWith(query))) return 2;
  if (queryWords.length > 1) {
    const words = [...item.foldedWords, ...item.foldedMunicipality.split(" ")];
    const nameMatched = queryWords.some((part) => item.foldedWords.some((word) => word.startsWith(part)));
    if (nameMatched && queryWords.every((part) => words.some((word) => word.startsWith(part)))) return 3;
  }
  if (query.length >= 3 && item.folded.includes(query)) return 4;
  return null;
}

/**
 * Mesta koja odgovaraju unosu, najbolja prva. Unutar istog stepena prednost
 * ima mesto sa više stanovnika (popis 2022), pa naziv — redosled je stabilan.
 */
export function searchSettlements(index: SettlementIndex, query: string, limit = 40): Settlement[] {
  const folded = foldPlaceText(query);
  if (!folded) return [];
  const queryWords = folded.split(" ");

  return index.settlements
    .map((item) => ({ item, rank: matchRank(item, folded, queryWords) }))
    .filter((entry): entry is { item: IndexedSettlement; rank: number } => entry.rank !== null)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        (right.item.population ?? -1) - (left.item.population ?? -1) ||
        left.item.label.localeCompare(right.item.label, "sr-Latn"),
    )
    .slice(0, limit)
    .map((entry) => toSettlement(entry.item));
}

/**
 * Naselje za naziv grada iz podataka lokacija („Batajnica / Beograd“,
 * „Novi Sad“): naziv mora da se poklopi ceo ili po rečima, a od više
 * istoimenih bira se ono najbliže lokaciji.
 */
export function resolvePlaceName(
  index: SettlementIndex,
  placeName: string,
  near?: GeoPoint | null,
): Settlement | null {
  // „Batajnica / Beograd“: Batajnica je deo naselja Beograd (Zemun), pa se
  // proba svaki deo naziva redom.
  for (const part of placeName.split("/")) {
    const found = resolveSinglePlaceName(index, part, near);
    if (found) return found;
  }
  return null;
}

function resolveSinglePlaceName(index: SettlementIndex, placeName: string, near?: GeoPoint | null) {
  const folded = foldPlaceText(placeName);
  if (!folded) return null;
  const candidates = index.settlements.filter(
    (item) => item.folded === folded || item.foldedBase === folded || ` ${item.folded} `.includes(` ${folded} `),
  );
  if (candidates.length === 0) return null;
  const exact = candidates.filter((item) => item.folded === folded || item.foldedBase === folded);
  const pool = exact.length > 0 ? exact : candidates;
  if (!near) {
    return toSettlement(
      [...pool].sort((left, right) => (right.population ?? -1) - (left.population ?? -1))[0],
    );
  }
  const squared = (item: IndexedSettlement) =>
    (item.lat - near.lat) ** 2 + ((item.lng - near.lng) * Math.cos((near.lat * Math.PI) / 180)) ** 2;
  return toSettlement([...pool].sort((left, right) => squared(left) - squared(right))[0]);
}
