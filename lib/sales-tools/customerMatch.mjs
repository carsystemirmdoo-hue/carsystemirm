import { nameKey, placeOf } from "./receivablesParse.mjs";

/**
 * Naziv kupca iz tabele kancelarije („ANTONIJEV, PANČEVO“) → kupac u portalu (2026-11-10).
 *
 * Tabele nemaju PIB, pa se poredi naziv:
 *   - sve reči naziva iz tabele moraju da postoje (cele) u nazivu kupca;
 *   - mesto iz tabele koje se jasno razlikuje od mesta kupca isključuje kandidata, osim ako je
 *     kupac već dodeljen komercijalisti čija je tabela;
 *   - prvo se traži među kupcima komercijaliste čija je tabela, pa među svima;
 *   - više kandidata razdvaja mesto (posle zareza) prema gradu ili nazivu kupca;
 *   - ako ni to ne razdvoji → bez veze (ručno povezivanje), nikad nasumičan izbor.
 */

const words = (/** @type {string} */ s) => s.split(" ").filter(Boolean);

/** Reč se poklapa samo cela (delimično poklapanje je davalo pogrešne kupce: „auto“ ↔ „autolimarska“). */
const wordMatch = (/** @type {string} */ t, /** @type {string[]} */ cand) => cand.includes(t);

/**
 * @typedef {{ id: string, name: string, city: string | null }} Candidate
 * @param {string} label
 * @param {Candidate[]} candidates
 * @param {Set<string>} [preferred] kupci komercijaliste čija je tabela
 * @returns {string | null}
 */
export function matchCustomer(label, candidates, preferred = new Set()) {
  const t = words(nameKey(label));
  if (!t.length) return null;
  const place = placeOf(label);
  const placeWords = words(place);
  const hits = [];
  for (const c of candidates) {
    const cw = words(nameKey(c.name, { keepPlace: true }));
    if (!cw.length) continue;
    if (!t.every((w) => wordMatch(w, cw))) continue;
    const cityWords = words(nameKey(c.city ?? "", { keepPlace: true }));
    const strongPlace = placeWords.filter((w) => w.length >= 3);
    const placeOk = strongPlace.length > 0 && strongPlace.some((w) => cw.includes(w) || cityWords.includes(w));
    // Mesto iz tabele se jasno razlikuje od mesta kupca → nije isti kupac (osim ako je već tog komercijaliste).
    const placeConflict = strongPlace.length > 0 && cityWords.length > 0 && !placeOk;
    if (placeConflict && !preferred.has(c.id)) continue;
    const exact = nameKey(c.name) === t.join(" ");
    hits.push({ id: c.id, preferred: preferred.has(c.id), placeOk, exact });
  }
  if (!hits.length) return null;
  const pick = (/** @type {typeof hits} */ list) => {
    if (list.length === 1) return list[0].id;
    const byPlace = list.filter((h) => h.placeOk);
    if (byPlace.length === 1) return byPlace[0].id;
    const exact = (byPlace.length ? byPlace : list).filter((h) => h.exact);
    if (exact.length === 1) return exact[0].id;
    return undefined;
  };
  const mine = hits.filter((h) => h.preferred);
  if (mine.length) {
    const r = pick(mine);
    if (r) return r;
  }
  return pick(hits) ?? null;
}

/**
 * Naziv tabele („Milan“) → komercijalista: jedini korisnik čije ime počinje tim imenom.
 * @param {string} title @param {{ id: string, name: string }[]} reps
 */
export function repForSheet(title, reps) {
  const key = nameKey(title, { keepPlace: true }).split(" ")[0] ?? "";
  if (!key) return null;
  const found = reps.filter((r) => nameKey(r.name, { keepPlace: true }).split(" ")[0] === key);
  return found.length === 1 ? found[0] : null;
}
