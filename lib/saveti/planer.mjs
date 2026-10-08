/**
 * Planer rasporeda rubrike „Saveti i vodiči“.
 *
 * Planer NE objavljuje ništa. On samo raspoređuje napisane i proverene članke
 * po terminima (jedan termin na svakih `razmakDana` dana) i rezultat se
 * komituje u `content/saveti/raspored.json`. Objavu kasnije odlučuje kapija
 * (`objava.mjs`) za svaki članak posebno — uključujući odobrenje.
 *
 * Pravila:
 *  - Termin čiji je trenutak prošao je zamrznut. Objavljen članak ostaje gde
 *    jeste; datum objave se nikada ne pomera unazad ni unapred.
 *  - Prošao termin čiji članak NIJE izašao (nije odobren na vreme, provera
 *    zastarela…) ostaje prazan, sa zapisanim razlogom, a članak se vraća u
 *    red za sledeći slobodan termin. Ne objavljuje se unazad.
 *  - Novosti imaju prednost u prvom slobodnom terminu; pomereni trajni članci
 *    ostaju u redu istim redosledom.
 *  - Novost se ne zakazuje posle roka važenja svoje provere.
 *  - Članak koji čeka stručnu potvrdu ili nije prošao tehničku i jezičku
 *    proveru ne dobija termin.
 *  - Dok raspored nije aktiviran, kalendar je probni: planira se ceo, od
 *    početnog datuma, bez zamrzavanja.
 */

import { articlePublicationState, slotDate, slotInstant, slotsByArticle } from "./objava.mjs";

/** Razlozi zbog kojih članak još ne sme u raspored (prazan niz = sme). */
export function schedulingBlockers(article) {
  const blockers = [];
  const status = article.status ?? {};
  if (!article.imaTekst) blockers.push("tekst ne postoji");
  if (status.pisanje !== "napisano") blockers.push(`pisanje: ${status.pisanje ?? "nepoznato"}`);
  if (status.tehnickaProvera !== "provereno") {
    blockers.push(`tehnička provera: ${status.tehnickaProvera ?? "nepoznato"}`);
  }
  if (status.jezickaProvera !== "provereno") {
    blockers.push(`jezička provera: ${status.jezickaProvera ?? "nepoznato"}`);
  }
  const expert = article.strucnaPotvrda;
  if (expert?.potrebna && expert.status !== "potvrdjeno") {
    blockers.push(`čeka stručnu potvrdu: ${expert.razlog ?? "bez razloga"}`);
  }
  if (article.povucen) blockers.push("članak je povučen");
  return blockers;
}

function newsFitsSlot(article, date) {
  if (article.tip !== "novost") return true;
  return Boolean(article.proveraVaziDo) && date <= article.proveraVaziDo;
}

function comparePriority(a, b) {
  const pa = a.prioritet ?? 9999;
  const pb = b.prioritet ?? 9999;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

function compareNews(a, b) {
  const byPriority = comparePriority(a, b);
  if ((a.prioritet ?? 9999) !== (b.prioritet ?? 9999)) return byPriority;
  return (b.datumDogadjaja ?? "").localeCompare(a.datumDogadjaja ?? "") || a.id.localeCompare(b.id);
}

/**
 * @param {{ articles: object[], schedule: object, now: Date, reorder?: boolean }} input
 * @returns {{ termini: object[], izvestaj: { zamrznuto: number, skinuto: object[], nezakazano: object[], upozorenja: string[] } }}
 */
export function planSchedule({ articles, schedule, now, reorder = false }) {
  const config = schedule.podesavanja;
  const report = { zamrznuto: 0, skinuto: [], nezakazano: [], upozorenja: [] };
  const byId = new Map(articles.map((article) => [article.id, article]));
  const index = slotsByArticle(schedule);

  /* 1. Zamrznuti termini (samo kada je raspored aktivan). */
  const frozen = [];
  const placed = new Set();
  let firstFree = 0;
  if (config.aktivan) {
    while (slotInstant(config, firstFree).getTime() <= now.getTime()) firstFree += 1;
    const existing = new Map(schedule.termini.map((slot) => [slot.redniBroj, slot]));
    for (let n = 0; n < firstFree; n += 1) {
      const slot = existing.get(n);
      const date = slotDate(config, n);
      report.zamrznuto += 1;
      if (!slot || !slot.clanak) {
        frozen.push({
          redniBroj: n,
          datum: date,
          clanak: null,
          preskocen: slot?.preskocen ?? { razlog: "nije bilo spremnog članka za ovaj termin" },
        });
        continue;
      }
      const article = byId.get(slot.clanak);
      const state = article
        ? articlePublicationState(article, schedule, now, index)
        : { stanje: "nepoznat-clanak", razlog: "članak ne postoji" };
      if (state.stanje === "objavljen" || state.stanje === "povucen") {
        frozen.push({ redniBroj: n, datum: date, clanak: slot.clanak });
        placed.add(slot.clanak);
      } else {
        frozen.push({
          redniBroj: n,
          datum: date,
          clanak: null,
          preskocen: { clanak: slot.clanak, razlog: state.razlog },
        });
        report.skinuto.push({ redniBroj: n, clanak: slot.clanak, razlog: state.razlog });
      }
    }
  } else if (slotInstant(config, 0).getTime() <= now.getTime()) {
    report.upozorenja.push(
      `probni početni datum ${config.pocetniDatum} je već prošao — pre aktivacije podesite pocetniDatum`,
    );
  }

  /* 2. Kandidati za buduće termine. */
  const eligible = [];
  for (const article of articles) {
    if (placed.has(article.id)) continue;
    const blockers = schedulingBlockers(article);
    if (blockers.length) {
      report.nezakazano.push({ clanak: article.id, razlozi: blockers });
      continue;
    }
    eligible.push(article);
  }

  // Postojeći redosled budućih termina čuva se radi stabilnosti kalendara.
  const previousOrder = new Map();
  if (!reorder) {
    for (const slot of schedule.termini) {
      if (slot.clanak && slot.redniBroj >= firstFree) previousOrder.set(slot.clanak, slot.redniBroj);
    }
  }
  const byPrevious = (a, b) => {
    const pa = previousOrder.get(a.id);
    const pb = previousOrder.get(b.id);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return 0;
  };

  const news = eligible
    .filter((article) => article.tip === "novost")
    .sort((a, b) => (previousOrder.has(a.id) || previousOrder.has(b.id) ? byPrevious(a, b) || compareNews(a, b) : compareNews(a, b)));
  const evergreen = eligible
    .filter((article) => article.tip !== "novost")
    .sort((a, b) => byPrevious(a, b) || comparePriority(a, b));

  /* 3. Popunjavanje: novosti u prve slobodne termine, zatim trajni članci. */
  const future = [];
  let n = firstFree;
  for (const article of news) {
    const date = slotDate(config, n);
    if (!newsFitsSlot(article, date)) {
      report.nezakazano.push({
        clanak: article.id,
        razlozi: [`provera novosti važi do ${article.proveraVaziDo ?? "—"}, prvi slobodan termin je ${date}`],
      });
      continue;
    }
    future.push({ redniBroj: n, datum: date, clanak: article.id });
    n += 1;
  }
  for (const article of evergreen) {
    future.push({ redniBroj: n, datum: slotDate(config, n), clanak: article.id });
    n += 1;
  }

  return { termini: [...frozen, ...future], izvestaj: report };
}
