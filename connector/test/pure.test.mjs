import assert from "node:assert/strict";
import test from "node:test";

/**
 * Čista logika konektora, iz SPAKOVANOG paketa.
 *
 * Uvozi se `../dist/...`, ne `../src/...`. Ono što se testira mora biti ono što
 * se isporučuje: greška u pakovanju (izostavljen fajl, pogrešan format modula)
 * ne bi se videla ni u jednom testu koji gleda izvor.
 */

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;

const kal = await import(D("calendar.mjs"));
const raspored = await import(D("schedule.mjs"));
const ishodi = await import(D("outcomes.mjs"));

/* =========================================================================
 * Kalendar
 * ====================================================================== */

test("pravoslavni Vaskrs se poklapa sa poznatim godinama", () => {
  /*
   * Očekivane vrednosti su ISPISANE, ne izračunate istim algoritmom — inače bi
   * test tvrdio samo da funkcija radi ono što radi.
   */
  assert.equal(kal.pravoslavniVaskrs(2024), "2024-05-05");
  assert.equal(kal.pravoslavniVaskrs(2025), "2025-04-20");
  assert.equal(kal.pravoslavniVaskrs(2026), "2026-04-12");
  assert.equal(kal.pravoslavniVaskrs(2027), "2027-05-02");
  assert.equal(kal.pravoslavniVaskrs(2028), "2028-04-16");
});

test("fiksni praznici su neradni", () => {
  for (const d of ["2026-01-01", "2026-01-02", "2026-01-07", "2026-02-16", "2026-05-01", "2026-11-11"]) {
    assert.equal(kal.jeRadniDan(d), false, `„${d}“ je proglašen radnim`);
    assert.ok(kal.razlogNeradnog(d), `„${d}“ nema razlog`);
  }
});

test("Veliki petak i drugi dan Vaskrsa pomeraju raspored", () => {
  // Vaskrs 2026 = 12. april (nedelja) → petak 10, ponedeljak 13.
  assert.equal(kal.jeRadniDan("2026-04-10"), false);
  assert.equal(kal.jeRadniDan("2026-04-13"), false);
  // Utorak posle je opet radni.
  assert.equal(kal.jeRadniDan("2026-04-14"), true);
});

test("državni praznik u nedelju se pomera, verski ne", () => {
  /*
   * 2027: 1. maj je subota, 2. maj nedelja.
   *
   * Drugi dan Praznika rada pada u nedelju i pomera se na PRVI naredni radni
   * dan. Ponedeljak 3. maj je te godine Drugi dan Vaskrsa (Vaskrs je 2. maja),
   * pa je i on neradan — pomeranje ga preskače i pada na utorak 4. maja.
   * Da se preskakanje ne radi, pomeranje bi se „potrošilo“ na dan koji je ionako
   * neradan i firma bi izgubila jedan neradni dan.
   */
  const p2027 = kal.prazniciZaGodinu(2027);
  assert.equal(p2027.get("2027-05-03"), "Drugi dan Vaskrsa");
  assert.ok(p2027.has("2027-05-04"), "pomeranje državnog praznika nije primenjeno");
  assert.match(p2027.get("2027-05-04"), /pomereno/);

  /*
   * Božić 7. januar je VERSKI praznik; član 3a ga ne pomera. 2029. pada u
   * nedelju, i ponedeljak 8. januar mora ostati radni.
   */
  const p2029 = kal.prazniciZaGodinu(2029);
  assert.ok(p2029.has("2029-01-07"));
  assert.ok(!p2029.has("2029-01-08"), "verski praznik je pomeren, a ne bi smeo");
});

test("vikend nije radni dan", () => {
  assert.equal(kal.jeRadniDan("2026-03-07"), false); // subota
  assert.equal(kal.jeRadniDan("2026-03-08"), false); // nedelja
  assert.equal(kal.jeRadniDan("2026-03-09"), true); // ponedeljak
});

test("zatvaranje firme se poštuje uz zakonske praznike", () => {
  const o = { dodatnaZatvaranja: ["2026-03-09"] };
  assert.equal(kal.jeRadniDan("2026-03-09", o), false);
  assert.equal(kal.razlogNeradnog("2026-03-09", o), "zatvaranje firme");
});

test("van pokrivenosti kalendar je `calendar_unverified`", () => {
  assert.equal(kal.opisiPokrivenost(2026).status, "calendar_ok");
  assert.equal(kal.opisiPokrivenost(2099).status, "calendar_unverified");
  assert.equal(kal.opisiPokrivenost(2000).status, "calendar_unverified");
  // Izvor i opseg moraju biti imenovani, ne podrazumevani.
  assert.match(kal.KALENDAR_IZVOR, /Zakon o državnim/);
  assert.equal(typeof kal.POKRIVENE_GODINE.od, "number");
});

/* =========================================================================
 * Raspored
 * ====================================================================== */

/** Trenutak iz beogradskog zidnog sata — bez fiksnog UTC pomaka. */
const trenutak = (iso) => new Date(iso);

test("lokalno vreme prati DST, ne fiksni UTC pomak", () => {
  // Zima: Beograd je UTC+1.
  assert.deepEqual(raspored.lokalnoVreme(trenutak("2026-01-15T08:00:00Z")), {
    datum: "2026-01-15",
    sat: 9,
    minut: 0,
  });
  // Leto: Beograd je UTC+2 — isti UTC sat daje 10:00 lokalno.
  assert.deepEqual(raspored.lokalnoVreme(trenutak("2026-07-15T08:00:00Z")), {
    datum: "2026-07-15",
    sat: 10,
    minut: 0,
  });
});

test("pre 09:00 se čeka, u 09:00 se pokreće", () => {
  // 2026-03-10 je utorak.
  const pre = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-10T07:59:00Z"), // 08:59 lokalno
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(pre.akcija, "cekaj");
  assert.equal(pre.razlog, "pre_termina");

  const tacno = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-10T08:00:00Z"), // 09:00 lokalno
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(tacno.akcija, "pokreni");
});

test("propušten termin daje TAČNO JEDAN naknadni ciklus", () => {
  const kasno = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-10T13:00:00Z"), // 14:00 lokalno
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(kasno.akcija, "pokreni");
  assert.equal(kasno.razlog, "naknadni");

  /*
   * Posle izvršenja istog dana više se ne pokreće.
   *
   * Konektor koji je bio ugašen nedelju dana NE sme da izvrši pet ciklusa
   * zaredom — preostali red se ionako obrađuje u jednom ograničenom prolazu.
   */
  const opet = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-10T15:00:00Z"),
    poslednjiIzvrsenDatum: "2026-03-10",
  });
  assert.equal(opet.akcija, "cekaj");
  assert.equal(opet.razlog, "vec_izvrseno_danas");
});

test("vikend i praznik čekaju sledeći radni dan", () => {
  const subota = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-07T10:00:00Z"),
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(subota.akcija, "cekaj");
  assert.equal(subota.razlog, "neradni_dan");
  assert.equal(subota.sledeciTermin, "2026-03-09");

  const praznik = raspored.odlukaOCiklusu({
    now: trenutak("2026-01-07T10:00:00Z"), // Božić, sreda
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(praznik.akcija, "cekaj");
  assert.equal(praznik.detalj, "Božić (pravoslavni)");
});

test("petak: sledeći termin je ponedeljak, ne subota", () => {
  // 2026-03-13 je petak.
  const sledeci = raspored.sledeciTermin({
    now: trenutak("2026-03-13T13:00:00Z"),
    poslednjiIzvrsenDatum: "2026-03-13",
  });
  assert.equal(sledeci, "2026-03-16 09:00");
});

test("neuspeh se ponavlja najranije SLEDEĆEG radnog dana", () => {
  assert.equal(raspored.sledeciPokusajPosleNeuspeha("2026-03-13"), "2026-03-16"); // petak → ponedeljak
  assert.equal(raspored.sledeciPokusajPosleNeuspeha("2026-01-06"), "2026-01-08"); // pre Božića → posle
});

test("odloženo se ne pokreće pre svog termina", () => {
  const rano = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-10T13:00:00Z"),
    poslednjiIzvrsenDatum: null,
    odlozenoDo: "2026-03-12",
  });
  assert.equal(rano.akcija, "cekaj");
  assert.equal(rano.razlog, "odlozeno_do_sledeceg_termina");

  const stiglo = raspored.odlukaOCiklusu({
    now: trenutak("2026-03-12T13:00:00Z"),
    poslednjiIzvrsenDatum: null,
    odlozenoDo: "2026-03-12",
  });
  assert.equal(stiglo.akcija, "pokreni");
});

test("van pokrivenosti kalendara automatski ciklus je BLOKIRAN", () => {
  const d = raspored.odlukaOCiklusu({
    now: trenutak("2099-03-10T13:00:00Z"),
    poslednjiIzvrsenDatum: null,
  });
  assert.equal(d.akcija, "blokirano");
  assert.equal(d.razlog, "calendar_unverified");
});

test("prelazak godine ne pomera termin unazad", () => {
  /*
   * 31.12.2026 je četvrtak. 1. januar 2027 je petak (Nova godina), 2. januar
   * subota (i drugi dan Nove godine), 3. nedelja — pa je prvi radni dan
   * ponedeljak 4. januar.
   *
   * Član 3a se NE primenjuje: nijedan od ta dva praznika ne pada u nedelju.
   */
  assert.equal(
    raspored.sledeciTermin({
      now: trenutak("2026-12-31T13:00:00Z"),
      poslednjiIzvrsenDatum: "2026-12-31",
    }),
    "2027-01-04 09:00",
  );
});

/* =========================================================================
 * Ishodi
 * ====================================================================== */

const S = ishodi.STANJA;

test("`ingested` i `duplicate_file` su potvrda", () => {
  assert.equal(ishodi.odlukaZaOdgovor({ httpStatus: 200, code: "ingested" }).stanje, S.POTVRDJENO);
  assert.equal(
    ishodi.odlukaZaOdgovor({ httpStatus: 200, code: "duplicate_file" }).stanje,
    S.POTVRDJENO,
  );
});

test("ishodi za pregled NISU knjiženje i ne ponavljaju se", () => {
  for (const kod of [
    "business_key_conflict",
    "already_imported_other_source",
    "source_hash_content_mismatch",
  ]) {
    const o = ishodi.odlukaZaOdgovor({ httpStatus: 409, code: kod, ok: true });
    assert.equal(o.stanje, S.ZA_PREGLED, kod);
    assert.equal(o.ponovi, false, `${kod} se ponavlja`);
    assert.notEqual(o.stanje, S.POTVRDJENO, `${kod} je prikazan kao knjižen`);
  }
});

test("HTTP 409 nosi DVE različite stvari — razlikuje se po kodu", () => {
  const replay = ishodi.odlukaZaOdgovor({ httpStatus: 409, code: "nonce_replayed" });
  const pregled = ishodi.odlukaZaOdgovor({ httpStatus: 409, code: "business_key_conflict" });
  assert.equal(replay.ponovi, true, "replay se mora ponoviti sa novim nonce-om");
  assert.equal(pregled.ponovi, false, "pregled se ne sme ponavljati");
  assert.notEqual(replay.stanje, pregled.stanje);
});

test("`ok: true` na 409 nije dokaz knjiženja", () => {
  /*
   * Ruta vraća `ok: true` i za ishode koje je server sačuvao za pregled. Zato se
   * odluka vezuje za `code`, ne za `ok`.
   */
  const o = ishodi.odlukaZaOdgovor({ httpStatus: 409, code: "business_key_conflict", ok: true });
  assert.notEqual(o.stanje, S.POTVRDJENO);
});

test("nepoznat odgovor NIKAD nije potvrda", () => {
  for (const slucaj of [
    { httpStatus: 200, code: null }, // HTML ili prazno telo
    { httpStatus: 200, code: "nesto_novo" },
    { httpStatus: 204, code: null },
  ]) {
    const o = ishodi.odlukaZaOdgovor(slucaj);
    assert.notEqual(o.stanje, S.POTVRDJENO, JSON.stringify(slucaj));
    assert.equal(o.stanje, S.ODLOZENO);
    assert.equal(o.ponovi, true);
  }
});

test("opoziv, potpis i issuer blokiraju CEO ciklus", () => {
  for (const kod of ["device_not_active", "unknown_device", "signature_invalid", "issuer_mismatch", "not_found"]) {
    const o = ishodi.odlukaZaOdgovor({ httpStatus: 401, code: kod });
    assert.equal(o.stanje, S.BLOKIRANO, kod);
    assert.equal(o.ciklus, ishodi.ZAUSTAVLJA_CIKLUS, `${kod} ne zaustavlja ciklus`);
  }
});

test("pomeren sat blokira, bez menjanja sistemskog vremena", () => {
  const o = ishodi.odlukaZaOdgovor({ httpStatus: 401, code: "timestamp_out_of_window" });
  assert.equal(o.stanje, S.BLOKIRANO);
  assert.equal(o.razlog, "sat_van_prozora");
  assert.equal(o.ponovi, false);
});

test("odbijen sadržaj se ne ponavlja", () => {
  for (const kod of ["currency_unsupported", "trade_date_unsupported", "totals_mismatch", "schema_invalid"]) {
    const o = ishodi.odlukaZaOdgovor({ httpStatus: 422, code: kod });
    assert.equal(o.stanje, S.ODBIJENO, kod);
    assert.equal(o.ponovi, false);
  }
});

test("429 i 5xx se odlažu", () => {
  const rl = ishodi.odlukaZaOdgovor({ httpStatus: 429, code: "rate_limited" });
  assert.equal(rl.stanje, S.ODLOZENO);
  assert.equal(rl.ciklus, ishodi.ZAUSTAVLJA_CIKLUS);

  for (const s of [500, 502, 503]) {
    const o = ishodi.odlukaZaOdgovor({ httpStatus: s, code: "temporarily_unavailable" });
    assert.equal(o.stanje, S.ODLOZENO, String(s));
    assert.equal(o.ponovi, true);
  }
});

test("`Retry-After` je ograničen i ne skraćuje poslovni raspored", () => {
  assert.equal(ishodi.ogranicenRetryAfter("120"), 120);
  assert.equal(ishodi.ogranicenRetryAfter("999999"), 86400); // ograničeno
  assert.equal(ishodi.ogranicenRetryAfter("-5"), null);
  assert.equal(ishodi.ogranicenRetryAfter("uskoro"), null);
  assert.equal(ishodi.ogranicenRetryAfter(null), null);
});
