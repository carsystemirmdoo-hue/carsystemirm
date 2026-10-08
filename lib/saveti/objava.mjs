/**
 * Kapija objave rubrike „Saveti i vodiči“.
 *
 * Objava je čista funkcija stanja u repozitorijumu i trenutka:
 *
 *   javno(članak) = f(članak, raspored, sada)
 *
 * Ništa se ne upisuje u trenutku objave — nema baze, brojača ni zastavice
 * „objavljeno“ koju bi ponovljen ili propušten zakazani posao mogao da
 * pokvari. Isti ulaz uvek daje isti izlaz, pa dvostruko pokretanje ne može da
 * napravi duplu objavu, a propušten posao ne može da zadrži članak: stranica
 * pri sledećem generisanju sama izračuna isto stanje.
 *
 * Članak postaje javan samo kada važi SVE:
 *   1. raspored je aktiviran (`aktivan: true`) — glavni prekidač;
 *   2. članak ima termin u rasporedu i taj termin je prošao;
 *   3. članak je odobren (imenovana osoba, datum) PRE svog termina;
 *   4. odobren je baš ovaj tekst (otisak sadržaja se poklapa);
 *   5. termin nije u pauzi (`pauzaOd`);
 *   6. članak nije povučen;
 *   7. za novost: provera važi i na dan termina (`proveraVaziDo`).
 *
 * Svaki drugi ishod ima ime i razlog, da bi izveštaj i zakazani posao mogli
 * da kažu ZAŠTO termin nije iskorišćen umesto da ćute.
 */

import { addCalendarDays, instantFrom, zonedDateTimeToInstant } from "./vreme.mjs";

/** @typedef {"objavljen"|"zakazan"|"ceka-odobrenje"|"propusten"|"pauziran"|"povucen"|"nezakazan"|"zastarela-provera"|"raspored-neaktivan"} StanjeObjave */

export const JAVNO_STANJE = "objavljen";

/** Trenutak termina n (0 = prvi) prema podešavanju rasporeda. */
export function slotInstant(config, index) {
  const date = addCalendarDays(config.pocetniDatum, index * config.razmakDana);
  return zonedDateTimeToInstant(date, config.vremeObjave, config.vremenskaZona);
}

export function slotDate(config, index) {
  return addCalendarDays(config.pocetniDatum, index * config.razmakDana);
}

/** Indeks termina sa datim datumom ili `undefined` ako datum nije termin. */
export function slotIndexForDate(config, date) {
  const start = Date.parse(`${config.pocetniDatum}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  const days = Math.round((target - start) / 86400000);
  if (days < 0 || days % config.razmakDana !== 0) return undefined;
  return days / config.razmakDana;
}

/**
 * Mapa id članka → termin. Jedan članak sme imati najviše jedan termin;
 * validator to proverava, a ovde prvi zapis pobeđuje da bi ishod bio
 * deterministički i kad je podatak pogrešan.
 */
export function slotsByArticle(schedule) {
  const map = new Map();
  for (const slot of schedule.termini) {
    if (slot.clanak && !map.has(slot.clanak)) map.set(slot.clanak, slot);
  }
  return map;
}

function approvalIsValid(article) {
  const approval = article.odobrenje;
  return Boolean(
    approval &&
      typeof approval.odobrio === "string" &&
      approval.odobrio.trim() &&
      approval.datum &&
      approval.otisak &&
      approval.otisak === article.otisak,
  );
}

/**
 * Stanje jednog članka u datom trenutku.
 *
 * @param {object} article  zapis iz generisanog skupa (ima `id`, `otisak`, …)
 * @param {object} schedule raspored (`podesavanja`, `termini`)
 * @param {Date} now
 * @param {Map<string, object>} [slotIndex] keš iz `slotsByArticle`
 * @returns {{ stanje: StanjeObjave, razlog: string, termin?: object, objavljeno?: Date }}
 */
export function articlePublicationState(article, schedule, now, slotIndex) {
  const config = schedule.podesavanja;
  const slot = (slotIndex ?? slotsByArticle(schedule)).get(article.id);

  if (article.povucen) {
    return { stanje: "povucen", razlog: `povučen ${article.povucen.datum}: ${article.povucen.razlog}` };
  }
  if (!slot) return { stanje: "nezakazan", razlog: "članak nema termin u rasporedu" };

  const publishAt = slotInstant(config, slot.redniBroj);
  const base = { termin: slot, objavljeno: publishAt };

  if (!config.aktivan) {
    return { ...base, stanje: "raspored-neaktivan", razlog: "raspored nije aktiviran (aktivan: false)" };
  }
  if (config.pauzaOd && publishAt.getTime() >= instantFrom(config.pauzaOd).getTime()) {
    return { ...base, stanje: "pauziran", razlog: `objava je pauzirana od ${config.pauzaOd}` };
  }
  if (article.tip === "novost") {
    const validUntil = article.proveraVaziDo;
    if (!validUntil) {
      return { ...base, stanje: "zastarela-provera", razlog: "novost nema rok važenja provere" };
    }
    // Rok važi do kraja navedenog dana u zoni rubrike.
    const expiry = zonedDateTimeToInstant(addCalendarDays(validUntil, 1), "00:00", config.vremenskaZona);
    if (publishAt.getTime() >= expiry.getTime()) {
      return {
        ...base,
        stanje: "zastarela-provera",
        razlog: `provera novosti važila je do ${validUntil}, a termin je posle tog dana`,
      };
    }
  }

  const passed = now.getTime() >= publishAt.getTime();
  if (!approvalIsValid(article)) {
    const why = article.odobrenje
      ? "odobreni tekst je kasnije izmenjen (otisak se ne poklapa)"
      : "članak nije odobren";
    return passed
      ? { ...base, stanje: "propusten", razlog: `termin je prošao, a ${why}` }
      : { ...base, stanje: "ceka-odobrenje", razlog: why };
  }
  if (instantFrom(article.odobrenje.datum).getTime() > publishAt.getTime()) {
    return {
      ...base,
      stanje: "propusten",
      razlog: `odobren ${article.odobrenje.datum}, posle termina — planer ga premešta u sledeći slobodan termin`,
    };
  }
  if (!passed) return { ...base, stanje: "zakazan", razlog: "čeka svoj termin" };
  return { ...base, stanje: JAVNO_STANJE, razlog: "objavljen u svom terminu" };
}

export function isArticlePublic(article, schedule, now, slotIndex) {
  return articlePublicationState(article, schedule, now, slotIndex).stanje === JAVNO_STANJE;
}

/**
 * Javni članci, od najnovijeg ka najstarijem, sa stvarnim datumom objave.
 * Datum objave je trenutak termina — ne datum builda ni datum odobrenja.
 */
export function publicArticles(articles, schedule, now) {
  const index = slotsByArticle(schedule);
  return articles
    .map((article) => ({ article, state: articlePublicationState(article, schedule, now, index) }))
    .filter(({ state }) => state.stanje === JAVNO_STANJE)
    .map(({ article, state }) => ({ ...article, datumObjave: state.objavljeno.toISOString() }))
    .sort((a, b) => b.datumObjave.localeCompare(a.datumObjave));
}

/**
 * Datum stvarne izmene: poslednja zabeležena revizija posle objave.
 * Revizija pre objave nije „ažuriranje“ za čitaoca, pa se ne prikazuje.
 */
export function effectiveModifiedAt(article, publishedAtIso) {
  const published = Date.parse(publishedAtIso);
  const later = (article.revizije ?? [])
    .map((revision) => instantFrom(revision.datum).getTime())
    .filter((time) => time > published)
    .sort((a, b) => b - a);
  return later.length ? new Date(later[0]).toISOString() : publishedAtIso;
}

/**
 * Pregled termina u prozoru oko trenutka — ulaz za zakazani posao i izveštaj.
 * Za svaki termin kaže ko je trebalo da izađe i šta se desilo.
 * @param {any[]} articles
 * @param {any} schedule
 * @param {Date} now
 * @param {{ fromIndex?: number, toIndex?: number }} [options]
 * @returns {{ redniBroj: number, datum: string, trenutak: string, clanak: string | null, slug?: string, stanje: string, razlog: string }[]}
 */
export function slotReport(articles, schedule, now, { fromIndex = 0, toIndex } = {}) {
  const config = schedule.podesavanja;
  const byId = new Map(articles.map((article) => [article.id, article]));
  const index = slotsByArticle(schedule);
  const last = toIndex ?? Math.max(-1, ...schedule.termini.map((slot) => slot.redniBroj));
  const bySlot = new Map(schedule.termini.map((slot) => [slot.redniBroj, slot]));
  const rows = [];
  for (let n = fromIndex; n <= last; n += 1) {
    const slot = bySlot.get(n);
    const at = slotInstant(config, n);
    if (!slot || !slot.clanak) {
      rows.push({
        redniBroj: n,
        datum: slotDate(config, n),
        trenutak: at.toISOString(),
        clanak: null,
        stanje: "prazan",
        razlog: slot?.preskocen?.razlog ?? "nema spremnog članka za ovaj termin",
      });
      continue;
    }
    const article = byId.get(slot.clanak);
    if (!article) {
      rows.push({
        redniBroj: n,
        datum: slotDate(config, n),
        trenutak: at.toISOString(),
        clanak: slot.clanak,
        stanje: "nepoznat-clanak",
        razlog: "termin pokazuje na članak koji ne postoji",
      });
      continue;
    }
    const state = articlePublicationState(article, schedule, now, index);
    rows.push({
      redniBroj: n,
      datum: slotDate(config, n),
      trenutak: at.toISOString(),
      clanak: article.id,
      slug: article.slug,
      stanje: state.stanje,
      razlog: state.razlog,
    });
  }
  return rows;
}
