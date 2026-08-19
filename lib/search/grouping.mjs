/**
 * Grupisanje rezultata za panel pretrage.
 *
 * Sa 3.500 zapisa mnoge varijante imaju skoro isto ime: „Cosmos Lac Molotow
 * Burner Chrome 400 ml / 500 ml / 600 ml". Ravna lista bi u Headeru izgledala
 * kao deset puta isti proizvod, pa se varijante iste porodice sklapaju u jednu
 * stavku sa ograničenim brojem pod-rezultata.
 *
 * Ovo je isključivo sloj PRIKAZA. Ne menja rezultat engine-a niti njegov
 * redosled: grupe nastaju jednim prolaskom kroz već rangiranu listu, a katalog
 * (`/katalog?q=`) prikazuje istu tu listu neizmenjenu, sa svim varijantama.
 */

/**
 * Prag „ovo je baš taj zapis".
 *
 * Odgovara redu veličine bonusa za poklapanje celog upita sa celim poljem
 * (šifra, id ili pun naziv) uvećanom za AND bonus u `engine.mjs`. Varijanta
 * koja ga dosegne prikazuje se direktno, a ne uvučena ispod svoje porodice —
 * korisnik koji je ukucao tačan SKU je već rekao koju varijantu hoće.
 */
export const DIRECT_HIT_SCORE = 3400;

/**
 * @typedef {Object} SearchGroup
 * @property {"record" | "family"} type
 * @property {number} headerIndex zapis koji nosi naslov (porodica, ili sam zapis)
 * @property {boolean} headerMatched da li se sam naslov poklopio sa upitom
 * @property {number[]} memberIndices varijante prikazane ispod naslova
 * @property {number} memberTotal koliko ih ukupno ima u rezultatu
 * @property {number} score najbolji score u grupi
 */

/**
 * @param {{ record: import("./engine.mjs").SearchRecord, score: number, index: number }[]} hits
 *   rangirani rezultati; `index` je pozicija zapisa u nizu zapisa indeksa
 * @param {{
 *   familyIndexBySlug?: Map<string, number>,
 *   maxGroups?: number,
 *   maxMembers?: number,
 * }} [options]
 * @returns {SearchGroup[]}
 */
export function groupSearchHits(hits, options = {}) {
  const familyIndexBySlug = options.familyIndexBySlug ?? new Map();
  const maxGroups = options.maxGroups ?? 8;
  const maxMembers = options.maxMembers ?? 3;

  /** @type {SearchGroup[]} */
  const groups = [];
  /** @type {Map<string, SearchGroup>} */
  const byFamily = new Map();

  const openFamilyGroup = (familySlug, hit, headerMatched) => {
    const group = {
      type: "family",
      headerIndex: familyIndexBySlug.get(familySlug) ?? hit.index,
      headerMatched,
      memberIndices: [],
      memberTotal: 0,
      score: hit.score,
    };
    byFamily.set(familySlug, group);
    groups.push(group);
    return group;
  };

  for (const hit of hits) {
    const { record } = hit;
    const familySlug = record.familySlug;

    if (record.kind === "family" && familySlug) {
      const existing = byFamily.get(familySlug);
      if (existing) {
        // Porodica koja se i sama poklopila uvek nosi naslov svoje grupe.
        existing.headerIndex = hit.index;
        existing.headerMatched = true;
        continue;
      }
      openFamilyGroup(familySlug, hit, true);
      continue;
    }

    if (record.kind === "variant" && familySlug) {
      /*
       * Tačan pogodak varijante ide direktno, bez uvlačenja pod porodicu — ali
       * samo dok njegova porodica nije već otvorena, da isti zapis ne bi bio i
       * samostalna stavka i član grupe.
       */
      if (hit.score >= DIRECT_HIT_SCORE && !byFamily.has(familySlug)) {
        groups.push({
          type: "record",
          headerIndex: hit.index,
          headerMatched: true,
          memberIndices: [],
          memberTotal: 0,
          score: hit.score,
        });
        continue;
      }

      /*
       * Kad se porodica nije poklopila sama za sebe (upit je bio po nijansi ili
       * pakovanju), naslov grupe je ipak porodica — njen zapis uvek postoji u
       * indeksu, pa grupa ima ispravan naziv i ispravan `href` ka grupnoj
       * stranici, a varijante ostaju vidljive ispod njega.
       */
      const group = byFamily.get(familySlug) ?? openFamilyGroup(familySlug, hit, false);
      group.memberTotal += 1;
      if (group.memberIndices.length < maxMembers) group.memberIndices.push(hit.index);
      continue;
    }

    groups.push({
      type: "record",
      headerIndex: hit.index,
      headerMatched: true,
      memberIndices: [],
      memberTotal: 0,
      score: hit.score,
    });
  }

  return groups.slice(0, maxGroups);
}
