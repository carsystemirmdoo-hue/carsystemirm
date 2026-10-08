import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  daysBetween,
  formatSerbianDate,
  formatZonedIso,
  instantFrom,
  zonedDateTimeToInstant,
} from "./vreme.mjs";
import {
  articlePublicationState,
  isArticlePublic,
  publicArticles,
  slotDate,
  slotInstant,
  slotReport,
} from "./objava.mjs";
import { planSchedule, schedulingBlockers } from "./planer.mjs";
import { parseArticleMarkdown, wordCount } from "./markdown.mjs";
import { checkSerbianText, technicalValues } from "./jezik.mjs";

/* ---------------- Vreme i letnje/zimsko računanje ---------------- */

test("09:00 u Beogradu je 08:00 UTC zimi i 07:00 UTC leti", () => {
  assert.equal(zonedDateTimeToInstant("2026-01-15", "09:00").toISOString(), "2026-01-15T08:00:00.000Z");
  assert.equal(zonedDateTimeToInstant("2026-07-15", "09:00").toISOString(), "2026-07-15T07:00:00.000Z");
});

test("prelaz na letnje vreme (29. 3. 2026) i nazad (25. 10. 2026)", () => {
  // Dan pre i dan prelaza: razlika se menja baš tog dana.
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-03-28", "09:00")), "2026-03-28T09:00:00+01:00");
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-03-29", "09:00")), "2026-03-29T09:00:00+02:00");
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-10-24", "09:00")), "2026-10-24T09:00:00+02:00");
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-10-25", "09:00")), "2026-10-25T09:00:00+01:00");
  // Između dva termina preko prelaza nije 72 h, nego 71 h (proleće) ili 73 h (jesen).
  const springGap = zonedDateTimeToInstant("2026-03-30", "09:00") - zonedDateTimeToInstant("2026-03-27", "09:00");
  const autumnGap = zonedDateTimeToInstant("2026-10-26", "09:00") - zonedDateTimeToInstant("2026-10-23", "09:00");
  assert.equal(springGap / 3600000, 71);
  assert.equal(autumnGap / 3600000, 73);
});

test("nepostojeći i dvosmisleni lokalni sat imaju definisan ishod", () => {
  // 02:30 ne postoji 29. 3. 2026 — pomera se unapred na 03:30 lokalno.
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-03-29", "02:30")), "2026-03-29T03:30:00+02:00");
  // 02:30 postoji dvaput 25. 10. 2026 — uzima se raniji (letnji) trenutak.
  assert.equal(formatZonedIso(zonedDateTimeToInstant("2026-10-25", "02:30")), "2026-10-25T02:30:00+02:00");
});

test("kalendarski dani, razmak i datum za prikaz", () => {
  assert.equal(addCalendarDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addCalendarDays("2028-02-27", 3), "2028-03-01"); // prestupna godina: 29. 2.
  assert.equal(daysBetween("2026-11-02", "2026-11-08"), 6);
  assert.equal(formatSerbianDate("2026-11-03"), "3. novembar 2026.");
  assert.throws(() => instantFrom("2026-11-03T09:00:00"), /zonu/);
});

/* ---------------- Kapija objave ---------------- */

const CONFIG = {
  aktivan: true,
  pocetniDatum: "2026-11-02",
  vremeObjave: "09:00",
  vremenskaZona: "Europe/Belgrade",
  razmakDana: 3,
  pauzaOd: null,
};

function article(id, extra = {}) {
  return {
    id,
    slug: id.toLowerCase(),
    tip: "postupak",
    otisak: `otisak-${id}`,
    imaTekst: true,
    status: { pisanje: "napisano", tehnickaProvera: "provereno", jezickaProvera: "provereno" },
    strucnaPotvrda: { potrebna: false },
    odobrenje: { odobrio: "Test Recenzent", datum: "2026-10-20T10:00:00+02:00", otisak: `otisak-${id}` },
    ...extra,
  };
}

function schedule(termini, config = {}) {
  return { podesavanja: { ...CONFIG, ...config }, termini };
}

test("članak je nevidljiv pre termina i vidljiv od tačno 09:00", () => {
  const a = article("SV-0001");
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-02T08:59:59+01:00")).stanje, "zakazan");
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-02T09:00:00+01:00")).stanje, "objavljen");
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-02T07:59:59Z")).stanje, "zakazan");
});

test("neaktivan raspored ne objavljuje ništa, ni odobreno", () => {
  const a = article("SV-0001");
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }], { aktivan: false });
  assert.equal(articlePublicationState(a, s, instantFrom("2027-01-01")).stanje, "raspored-neaktivan");
});

test("neodobren članak čeka, a posle termina je propušten — nikad javan", () => {
  const a = article("SV-0001", { odobrenje: null });
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-01")).stanje, "ceka-odobrenje");
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-05")).stanje, "propusten");
});

test("tekst izmenjen posle odobrenja se ne objavljuje", () => {
  const a = article("SV-0001", { otisak: "novi-otisak" });
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  const state = articlePublicationState(a, s, instantFrom("2026-11-05"));
  assert.equal(state.stanje, "propusten");
  assert.match(state.razlog, /otisak/);
});

test("odobrenje posle termina ne objavljuje unazad", () => {
  const a = article("SV-0001", {
    odobrenje: { odobrio: "Test", datum: "2026-11-03T10:00:00+01:00", otisak: "otisak-SV-0001" },
  });
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  assert.equal(articlePublicationState(a, s, instantFrom("2026-11-04")).stanje, "propusten");
});

test("pauza zadržava termine od datuma pauze, ranije objavljeni ostaju", () => {
  const s = schedule(
    [
      { redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" },
      { redniBroj: 1, datum: "2026-11-05", clanak: "SV-0002" },
    ],
    { pauzaOd: "2026-11-04" },
  );
  const now = instantFrom("2026-11-10");
  assert.equal(articlePublicationState(article("SV-0001"), s, now).stanje, "objavljen");
  assert.equal(articlePublicationState(article("SV-0002"), s, now).stanje, "pauziran");
});

test("povučen članak nije javan", () => {
  const a = article("SV-0001", { povucen: { datum: "2026-11-10T10:00:00+01:00", razlog: "zastareo podatak" } });
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  assert.equal(isArticlePublic(a, s, instantFrom("2026-11-20")), false);
});

test("novost sa isteklom proverom se ne objavljuje", () => {
  const news = article("SV-0100", { tip: "novost", proveraVaziDo: "2026-11-01" });
  const fresh = article("SV-0101", { tip: "novost", proveraVaziDo: "2026-11-05" });
  const s = schedule([
    { redniBroj: 0, datum: "2026-11-02", clanak: "SV-0100" },
    { redniBroj: 1, datum: "2026-11-05", clanak: "SV-0101" },
  ]);
  const now = instantFrom("2026-11-06");
  assert.equal(articlePublicationState(news, s, now).stanje, "zastarela-provera");
  assert.equal(articlePublicationState(fresh, s, now).stanje, "objavljen");
});

test("datum objave je trenutak termina, ponovljeno računanje daje isto (idempotentno)", () => {
  const s = schedule([
    { redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" },
    { redniBroj: 1, datum: "2026-11-05", clanak: "SV-0002" },
  ]);
  const list = [article("SV-0001"), article("SV-0002")];
  const now = instantFrom("2026-11-06T12:00:00+01:00");
  const first = publicArticles(list, s, now);
  const second = publicArticles(list, s, now);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((item) => [item.id, item.datumObjave]),
    [
      ["SV-0002", "2026-11-05T08:00:00.000Z"],
      ["SV-0001", "2026-11-02T08:00:00.000Z"],
    ],
  );
});

test("izveštaj termina beleži prazan termin sa razlogom", () => {
  const s = schedule([{ redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" }]);
  const rows = slotReport([article("SV-0001")], s, instantFrom("2026-11-06"), { fromIndex: 0, toIndex: 1 });
  assert.equal(rows[0].stanje, "objavljen");
  assert.equal(rows[1].stanje, "prazan");
  assert.match(rows[1].razlog, /nema spremnog/);
  assert.equal(slotDate(CONFIG, 1), "2026-11-05");
  assert.equal(slotInstant(CONFIG, 1).toISOString(), "2026-11-05T08:00:00.000Z");
});

/* ---------------- Planer ---------------- */

test("planer: novosti prve, trajni članci redom prioriteta, nespremni van kalendara", () => {
  const articles = [
    article("SV-0010", { prioritet: 2 }),
    article("SV-0011", { prioritet: 1 }),
    article("SV-0200", { tip: "novost", proveraVaziDo: "2026-12-31", datumDogadjaja: "2026-09-10" }),
    article("SV-0012", { status: { pisanje: "nacrt", tehnickaProvera: "nije-provereno", jezickaProvera: "nije-provereno" } }),
    article("SV-0013", { strucnaPotvrda: { potrebna: true, razlog: "kontradiktorni podaci", status: "potrebno" } }),
  ];
  const { termini, izvestaj } = planSchedule({
    articles,
    schedule: schedule([], { aktivan: false }),
    now: instantFrom("2026-10-08"),
  });
  assert.deepEqual(termini.map((slot) => slot.clanak), ["SV-0200", "SV-0011", "SV-0010"]);
  assert.deepEqual(termini.map((slot) => slot.datum), ["2026-11-02", "2026-11-05", "2026-11-08"]);
  assert.deepEqual(izvestaj.nezakazano.map((item) => item.clanak).sort(), ["SV-0012", "SV-0013"]);
});

test("planer: prošli termin ostaje, propušten članak ide u sledeći slobodan termin", () => {
  const articles = [
    article("SV-0001"),
    article("SV-0002", { odobrenje: null }),
    article("SV-0003"),
  ];
  const initial = schedule([
    { redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" },
    { redniBroj: 1, datum: "2026-11-05", clanak: "SV-0002" },
    { redniBroj: 2, datum: "2026-11-08", clanak: "SV-0003" },
  ]);
  const now = instantFrom("2026-11-06T12:00:00+01:00");
  const { termini, izvestaj } = planSchedule({ articles, schedule: initial, now });
  assert.equal(termini[0].clanak, "SV-0001");
  assert.equal(termini[1].clanak, null);
  assert.equal(termini[1].preskocen.clanak, "SV-0002");
  // SV-0003 zadržava svoj budući termin; SV-0002 dolazi posle njega.
  assert.deepEqual(termini.slice(2).map((slot) => slot.clanak), ["SV-0003", "SV-0002"]);
  assert.equal(izvestaj.skinuto.length, 1);
  // Objavljen članak nikada ne menja datum.
  const again = planSchedule({ articles, schedule: { ...initial, termini }, now });
  assert.equal(again.termini[0].clanak, "SV-0001");
  assert.equal(again.termini[0].datum, "2026-11-02");
});

test("planer: nova novost dobija prvi slobodan termin, trajni se pomeraju", () => {
  const articles = [article("SV-0001"), article("SV-0002"), article("SV-0300", { tip: "novost", proveraVaziDo: "2027-01-31" })];
  const initial = schedule([
    { redniBroj: 0, datum: "2026-11-02", clanak: "SV-0001" },
    { redniBroj: 1, datum: "2026-11-05", clanak: "SV-0002" },
  ]);
  const { termini } = planSchedule({ articles, schedule: initial, now: instantFrom("2026-11-03") });
  assert.deepEqual(termini.map((slot) => slot.clanak), ["SV-0001", "SV-0300", "SV-0002"]);
});

test("planer: novost se ne zakazuje posle roka važenja provere", () => {
  const articles = [article("SV-0400", { tip: "novost", proveraVaziDo: "2026-11-01" })];
  const { termini, izvestaj } = planSchedule({ articles, schedule: schedule([], { aktivan: false }), now: instantFrom("2026-10-08") });
  assert.equal(termini.length, 0);
  assert.match(izvestaj.nezakazano[0].razlozi[0], /važi do/);
});

test("razlozi za izostavljanje iz rasporeda", () => {
  assert.deepEqual(schedulingBlockers(article("SV-0001")), []);
  assert.ok(schedulingBlockers(article("SV-0001", { imaTekst: false })).includes("tekst ne postoji"));
});

/* ---------------- Markdown i jezik ---------------- */

test("markdown: blokovi, citat, link, tabela i zabrana sirovog HTML-a", () => {
  const { blocks, errors } = parseArticleMarkdown(
    [
      "Kratak odgovor sa izvorom.[^tds]",
      "",
      "## Koraci",
      "",
      "1. Prvi korak sa [linkom](/katalog?brend=rm).",
      "2. Drugi korak.",
      "",
      "| Podatak | Vrednost |",
      "| --- | --- |",
      "| Odnos | 2:1[^tds] |",
      "",
      "> [!upozorenje] Radite uz zaštitu.",
    ].join("\n"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks.map((block) => block.t), ["p", "h", "ol", "table", "callout"]);
  assert.ok(wordCount(blocks) > 5);
  const html = parseArticleMarkdown("Tekst <script>x</script>");
  assert.ok(html.errors.some((message) => /HTML/.test(message)));
});

test("jezik: ijekavica, persiranje, brendovi van programa, tehnička vrednost", () => {
  assert.ok(checkSerbianText("Prije nanošenja provjerite vrijeme.").errors.length >= 3);
  assert.ok(checkSerbianText("Ako vi želite, možeš probati.").errors.length >= 2);
  assert.ok(checkSerbianText("Koristite 3M traku.").errors.length >= 1);
  assert.deepEqual(checkSerbianText("Pre nanošenja proverite da li je Vaša površina suva i bez sjaja.").errors, []);
  assert.deepEqual(technicalValues("Mešajte 2:1 i sušite 30 min na 60 °C."), ["2:1", "30 min", "60 °C"]);
});
