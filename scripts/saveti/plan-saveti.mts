/**
 * Planer kalendara rubrike „Saveti i vodiči“.
 *
 *   npm run saveti:plan                    raspoređuje i upisuje content/saveti/raspored.json
 *   npm run saveti:plan -- --suvo          samo izveštaj, bez upisa
 *   npm run saveti:plan -- --preuredi      zanemaruje postojeći redosled budućih termina
 *   npm run saveti:plan -- --sada=2027-01-05T10:00:00+01:00   (probe; samo lokalno)
 *
 * Posle upisa generiše docs/saveti/KALENDAR.md. Ništa ne objavljuje — objavu
 * odlučuje kapija u trenutku generisanja stranice.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planSchedule } from "../../lib/saveti/planer.mjs";
import { articlePublicationState, slotInstant, slotsByArticle } from "../../lib/saveti/objava.mjs";
import { formatZonedIso, instantFrom } from "../../lib/saveti/vreme.mjs";
import { getSavetiKategorija, SAVETI_TIPOVI } from "../../lib/saveti/kategorije.mjs";

// Ulaz su YAML frontmatter i generisani JSON neproverenog oblika; svako polje se proverava eksplicitno.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCHEDULE = path.join(ROOT, "content/saveti/raspored.json");
const ARTICLES = path.join(ROOT, "data/saveti/clanci.generated.json");
const CALENDAR = path.join(ROOT, "docs/saveti/KALENDAR.md");

const dry = process.argv.includes("--suvo");
const reorder = process.argv.includes("--preuredi");
const nowArg = process.argv.find((arg) => arg.startsWith("--sada="))?.slice(7);
const now = nowArg ? instantFrom(nowArg) : new Date();

const schedule = JSON.parse(readFileSync(SCHEDULE, "utf8"));
const { clanci: articles } = JSON.parse(readFileSync(ARTICLES, "utf8"));

const { termini, izvestaj } = planSchedule({ articles, schedule, now, reorder });
const next = { ...schedule, termini };

const byId = new Map(articles.map((article: Loose) => [article.id, article]));
const index = slotsByArticle(next);
const config = next.podesavanja;

const rows = termini.map((slot: Loose) => {
  const at = slotInstant(config, slot.redniBroj);
  const article: Loose = slot.clanak ? byId.get(slot.clanak) : undefined;
  const state = article ? articlePublicationState(article, next, now, index) : null;
  return {
    n: slot.redniBroj,
    at: formatZonedIso(at, config.vremenskaZona),
    id: article?.id ?? "—",
    naslov: article?.naslov ?? (slot.preskocen ? `(preskočeno: ${slot.preskocen.razlog})` : "(prazno)"),
    tip: article ? (SAVETI_TIPOVI as Record<string, string>)[article.tip] : "",
    kategorija: article ? getSavetiKategorija(article.kategorija)?.naziv ?? article.kategorija : "",
    stanje: state ? `${state.stanje}` : "prazan",
  };
});

const first = rows[0];
const last = rows[rows.length - 1];
const lines = [
  "# Kalendar objave — Saveti i vodiči",
  "",
  "Generiše `npm run saveti:plan`. Ne menjati ručno; izmene idu kroz `content/saveti/raspored.json` (podešavanja) i frontmatter članaka.",
  "",
  `- Raspored: **${config.aktivan ? "AKTIVAN" : "PROBNI — nije aktiviran"}**${config.pocetakPretpostavljen ? " (početni datum je pretpostavka, nije odluka firme)" : ""}`,
  `- Vremenska zona: ${config.vremenskaZona}; termin u ${config.vremeObjave}; razmak ${config.razmakDana} dana`,
  `- Pauza od: ${config.pauzaOd ?? "nema"}`,
  `- Termina u kalendaru: ${rows.length}`,
  first ? `- Prvi termin: ${first.at} — ${first.id}` : "- Prvi termin: —",
  last ? `- Poslednji termin: ${last.at} — ${last.id}` : "- Poslednji termin: —",
  `- Stanje izračunato za trenutak: ${formatZonedIso(now, config.vremenskaZona)}`,
  "",
  `Napomena: kolona „stanje“ je ishod kapije u tom trenutku. „ceka-odobrenje“ znači da tekst postoji i proveren je, ali ga imenovana osoba još nije odobrila; takav termin se pri dolasku preskače, a planer članak premešta u sledeći slobodan termin.`,
  "",
  "| # | Termin (lokalno) | ID | Naslov | Tip | Kategorija | Stanje |",
  "| ---: | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row: Loose) => `| ${row.n} | ${row.at} | ${row.id} | ${row.naslov.replace(/\|/g, "\\|")} | ${row.tip} | ${row.kategorija} | ${row.stanje} |`),
  "",
  `## Nisu u kalendaru (${izvestaj.nezakazano.length})`,
  "",
  ...(izvestaj.nezakazano.length
    ? izvestaj.nezakazano.map((item: Loose) => `- ${item.clanak} ${(byId.get(item.clanak) as Loose)?.naslov ?? ""}: ${item.razlozi.join("; ")}`)
    : ["Nema."]),
  "",
  `## Skinuto sa prošlih termina u ovom prolazu (${izvestaj.skinuto.length})`,
  "",
  ...(izvestaj.skinuto.length
    ? izvestaj.skinuto.map((item: Loose) => `- termin ${item.redniBroj}: ${item.clanak} — ${item.razlog}`)
    : ["Nema."]),
  "",
  ...(izvestaj.upozorenja.length ? ["## Upozorenja", "", ...izvestaj.upozorenja.map((text: string) => `- ${text}`), ""] : []),
];

if (!dry) {
  writeFileSync(SCHEDULE, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(CALENDAR, lines.join("\n"));
}

console.log(
  JSON.stringify({
    aktivan: config.aktivan,
    termina: rows.length,
    prvi: first?.at,
    poslednji: last?.at,
    nezakazano: izvestaj.nezakazano.length,
    skinuto: izvestaj.skinuto.length,
    upozorenja: izvestaj.upozorenja,
    upisano: !dry,
  }),
);
