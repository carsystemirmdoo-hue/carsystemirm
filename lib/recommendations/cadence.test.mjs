import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  cadenceStatusFor,
  confidenceFor,
  dayNumber,
  dayToIso,
  daysBetween,
  dueSoonLeadFor,
  evaluateAll,
  evaluatePair,
  medianAbsoluteDeviation,
  medianOfSorted,
  stabilityOf,
  toleranceFor,
} from "./cadence.mjs";
import { ALGORITHM_VERSION, CADENCE_STATUSES, DEFAULT_POLICY } from "./policy.mjs";

/**
 * Matematičko jezgro — bez baze i bez okruženja.
 *
 * Ovi testovi ne dokazuju da je algoritam POSLOVNO tačan; stvarnih ponovljenih
 * kupovina još nema. Dokazuju da je DETERMINISTIČAN, da granice statusa stoje
 * tamo gde piše da stoje, i da nijedan rezultat ne zavisi od sata, zone ni
 * redosleda ulaza.
 */

/** Niz od `n` datuma sa fiksnim korakom, počev od `pocetak`. */
function ritam(pocetak, korak, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(addDays(pocetak, korak * i));
  return out;
}

/* =========================================================================
 * Datumi
 * ====================================================================== */

test("dan se računa u UTC-u i ne zavisi od lokalne zone", () => {
  const original = process.env.TZ;
  const zone = ["UTC", "Europe/Belgrade", "Pacific/Kiritimati", "America/Los_Angeles"];
  const mereno = zone.map((tz) => {
    process.env.TZ = tz;
    return {
      tz,
      dan: dayNumber("2026-03-29"),
      razmak: daysBetween("2026-03-28", "2026-03-30"),
      iso: dayToIso(dayNumber("2026-03-29")),
    };
  });
  process.env.TZ = original;

  for (const m of mereno) {
    assert.equal(m.dan, mereno[0].dan, `zona ${m.tz} je pomerila dan`);
    assert.equal(m.razmak, 2, `zona ${m.tz} je pomerila razmak`);
    assert.equal(m.iso, "2026-03-29");
  }
});

test("prestupna godina se broji tačno", () => {
  // 2028 je prestupna: februar ima 29 dana.
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
  // 2027 nije: 28. februar → 1. mart je jedan dan.
  assert.equal(daysBetween("2027-02-28", "2027-03-01"), 1);
  // 2100 nije prestupna iako je deljiva sa 4.
  assert.equal(daysBetween("2100-02-28", "2100-03-01"), 1);
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("prelazak godine ne pravi rupu", () => {
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(addDays("2026-12-20", 30), "2027-01-19");
  assert.equal(daysBetween("2026-01-01", "2027-01-01"), 365);
  assert.equal(daysBetween("2028-01-01", "2029-01-01"), 366);
});

test("nepostojeći i loše oblikovan datum se odbijaju, ne prećutkuju", () => {
  for (const los of ["2026-02-31", "2027-02-29", "2026-13-01", "2026-00-10"]) {
    assert.throws(() => dayNumber(los), /ne postoji u kalendaru/, `prošlo: ${los}`);
  }
  for (const los of ["", "danas", "2026-6-30", "2026-06-30T00:00:00Z", "30.06.2026."]) {
    assert.throws(() => dayNumber(los), /YYYY-MM-DD/, `prošlo: ${los}`);
  }
});

/* =========================================================================
 * Statistika
 * ====================================================================== */

test("medijana je medijana, ne prosek — jedan izlet je ne pomera", () => {
  assert.equal(medianOfSorted([28, 30, 32]), 30);
  // Prosek bi bio 122; medijana ostaje 30.
  assert.equal(medianOfSorted([28, 30, 32, 400].sort((a, b) => a - b)), 31);
  // Paran broj: sredina dva srednja, zaokruženo pola naviše.
  assert.equal(medianOfSorted([30, 31]), 31);
  assert.equal(medianOfSorted([30, 33]), 32);
  assert.throws(() => medianOfSorted([]), /prazn/);
});

test("MAD i stabilnost", () => {
  assert.equal(medianAbsoluteDeviation([30, 30, 30], 30), 0);
  assert.equal(stabilityOf(0, 30), 1);
  assert.equal(medianAbsoluteDeviation([20, 30, 40], 30), 10);
  assert.equal(stabilityOf(10, 30), 0.67);
  // Rasipanje veće od medijane ne daje negativnu stabilnost.
  assert.equal(stabilityOf(90, 30), 0);
  assert.equal(stabilityOf(5, 0), 0);
});

/* =========================================================================
 * Broj kupovina
 * ====================================================================== */

test("nula i jedna kupovina: insufficient_history, bez procene", () => {
  for (const dates of [[], ["2026-01-10"]]) {
    const r = evaluatePair(
      { customerId: "k", articleCode: "A", purchaseDates: dates },
      "2026-06-30",
    );
    assert.equal(r.status, "insufficient_history");
    assert.equal(r.confidence, "low");
    assert.equal(r.expectedNextOn, null);
    assert.equal(r.medianIntervalDays, null);
    assert.equal(r.eventCount, dates.length, "broj događaja mora ostati u dijagnostici");
    assert.deepEqual(r.intervals, []);
  }
});

test("dve kupovine: samo PRIVREMENA procena, uvek niska pouzdanost", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ["2026-01-10", "2026-02-09"] },
    "2026-03-11",
  );
  assert.equal(r.status, "provisional");
  assert.equal(r.confidence, "low");
  assert.equal(r.confidenceComponents.provisional, true);
  // Procena postoji i vidi se — samo nije glavna preporuka.
  assert.equal(r.medianIntervalDays, 30);
  assert.equal(r.expectedNextOn, "2026-03-11");
  assert.equal(r.underlyingStatus, "due");
  assert.match(r.explanation, /privremena procena/);
});

test("tri kupovine su najmanji broj za pun cadence status", () => {
  const r = evaluatePair(
    {
      customerId: "k",
      articleCode: "A",
      purchaseDates: ["2026-01-01", "2026-01-31", "2026-03-02"],
    },
    "2026-04-01",
  );
  assert.equal(r.confidenceComponents.provisional, false);
  assert.equal(r.eventCount, 3);
  assert.equal(r.medianIntervalDays, 30);
  assert.equal(r.status, "due");
  assert.ok(CADENCE_STATUSES.includes(r.status));
});

/* =========================================================================
 * Ritmovi
 * ====================================================================== */

test("redovan mesečni ciklus (30 dana)", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2026-01-01", 30, 6) },
    "2026-05-31",
  );
  assert.deepEqual(r.intervals, [30, 30, 30, 30, 30]);
  assert.equal(r.medianIntervalDays, 30);
  assert.equal(r.dispersionDays, 0);
  assert.equal(r.stability, 1);
  assert.equal(r.lastPurchaseOn, "2026-05-31");
  assert.equal(r.expectedNextOn, "2026-06-30");
  // MAD = 0, pa se prozor drži na donjoj granici — nikad nula dana.
  assert.equal(r.toleranceDays, DEFAULT_POLICY.tolerance.minDays);
  assert.equal(r.confidence, "high");
  assert.equal(r.status, "not_yet");
});

test("dvonedeljni ciklus", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2026-01-05", 14, 8) },
    "2026-04-13",
  );
  assert.equal(r.medianIntervalDays, 14);
  assert.equal(r.lastPurchaseOn, "2026-04-13");
  assert.equal(r.expectedNextOn, "2026-04-27");
  assert.equal(r.toleranceDays, 3, "kod MAD=0 vredi donja granica, ne polovina ciklusa");
  assert.equal(dueSoonLeadFor(14), 4);
  assert.equal(r.confidence, "high");
});

test("veoma nepravilan ciklus: prozor se NE širi preko pola medijane", () => {
  const r = evaluatePair(
    {
      customerId: "k",
      articleCode: "A",
      purchaseDates: ["2026-01-01", "2026-01-06", "2026-04-06", "2026-04-11", "2026-07-10"],
    },
    "2026-07-10",
  );
  assert.ok(r.dispersionDays > r.medianIntervalDays * 0.5, "test ne meri ono što tvrdi");
  assert.equal(
    r.toleranceDays,
    Math.round(r.medianIntervalDays * DEFAULT_POLICY.tolerance.maxRatioOfMedian),
  );
  assert.ok(r.stability < 0.4);
  assert.equal(r.confidence, "low", "nepravilan ritam ne sme dobiti srednju pouzdanost");
  assert.ok(r.reasons.includes("irregular_cycle"));
});

test("outlier interval ne pomera medijanu ni očekivani datum", () => {
  const sa = evaluatePair(
    {
      customerId: "k",
      articleCode: "A",
      // Peti razmak je 200 dana umesto 30 — godišnji odmor, ne promena ritma.
      purchaseDates: [
        "2026-01-01", "2026-01-31", "2026-03-02", "2026-04-01",
        "2026-10-18", "2026-11-17", "2026-12-17",
      ],
    },
    "2026-12-17",
  );
  assert.equal(sa.medianIntervalDays, 30, "jedan izlet je pomerio medijanu");
  assert.equal(sa.expectedNextOn, "2027-01-16");
});

test("velik istorijski niz ostaje stabilan i brz", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2020-01-01", 7, 300) },
    // Tačno na očekivanom danu: poslednja kupovina + medijalni interval.
    addDays("2020-01-01", 7 * 300),
  );
  assert.equal(r.eventCount, 300);
  assert.equal(r.medianIntervalDays, 7);
  assert.equal(r.confidence, "high");
  assert.equal(r.status, "due");
});

/* =========================================================================
 * Granice statusa — svaka se meri sa obe strane
 * ====================================================================== */

test("granice statusa: asOfDate tačno na svakoj", () => {
  // Šest kupovina na 30 dana; poslednja 2026-05-31, očekivano 2026-06-30.
  const dates = ritam("2026-01-01", 30, 6);
  const poslednja = dates[dates.length - 1];
  const ocekivano = addDays(poslednja, 30);
  assert.equal(poslednja, "2026-05-31");
  assert.equal(ocekivano, "2026-06-30");
  const tol = DEFAULT_POLICY.tolerance.minDays; // 3, jer je MAD = 0
  const lead = dueSoonLeadFor(30); // 8

  const naDan = (iso) =>
    evaluatePair({ customerId: "k", articleCode: "A", purchaseDates: dates }, iso).status;

  // not_yet | due_soon granica: očekivano − (tol + lead)
  assert.equal(naDan(addDays(ocekivano, -(tol + lead) - 1)), "not_yet");
  assert.equal(naDan(addDays(ocekivano, -(tol + lead))), "due_soon");

  // due_soon | due granica: očekivano − tol
  assert.equal(naDan(addDays(ocekivano, -tol - 1)), "due_soon");
  assert.equal(naDan(addDays(ocekivano, -tol)), "due");

  // due na samom očekivanom danu
  assert.equal(naDan(ocekivano), "due");

  // due | overdue granica: očekivano + tol
  assert.equal(naDan(addDays(ocekivano, tol)), "due");
  assert.equal(naDan(addDays(ocekivano, tol + 1)), "overdue");
});

test("granica dormant: traži I tri ciklusa I 180 dana", () => {
  const policy = DEFAULT_POLICY;
  const osnov = {
    toleranceDays: 3,
    medianIntervalDays: 30,
    policy,
  };
  // 89 dana od poslednje: manje od 3 × 30 → i dalje kašnjenje.
  assert.equal(
    cadenceStatusFor({ ...osnov, daysSinceLast: 89, daysUntilExpected: -59 }),
    "overdue",
  );
  // 90 dana: tri ciklusa jesu, ali apsolutnih 180 nije — i dalje kašnjenje.
  assert.equal(
    cadenceStatusFor({ ...osnov, daysSinceLast: 90, daysUntilExpected: -60 }),
    "overdue",
  );
  // 179 dana: još uvek ispod apsolutne granice.
  assert.equal(
    cadenceStatusFor({ ...osnov, daysSinceLast: 179, daysUntilExpected: -149 }),
    "overdue",
  );
  // 180 dana: oba uslova važe.
  assert.equal(
    cadenceStatusFor({ ...osnov, daysSinceLast: 180, daysUntilExpected: -150 }),
    "dormant",
  );
  // Nedeljni ritam ne postaje „uspavan" posle tri nedelje.
  assert.equal(
    cadenceStatusFor({
      ...osnov,
      medianIntervalDays: 7,
      daysSinceLast: 25,
      daysUntilExpected: -18,
    }),
    "overdue",
  );
  assert.equal(policy.dormant.minDays, 180, "granica je promenjena bez izmene testa");
});

test("kupac koji kasni i uspavan kupac su različiti odgovori", () => {
  const dates = ritam("2026-01-01", 30, 6); // poslednja 2026-06-29

  const kasni = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: dates },
    "2026-08-15",
  );
  assert.equal(kasni.status, "overdue");
  assert.ok(kasni.daysUntilExpected < 0);
  assert.match(kasni.explanation, /Očekivani termin je prošao/);

  const uspavan = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: dates },
    "2027-06-29",
  );
  assert.equal(uspavan.status, "dormant");
  assert.match(uspavan.explanation, /još uzima ovaj artikal/);
});

test("statusi se ne preklapaju — nikad dva odgovora za isti dan", () => {
  const dates = ritam("2026-01-01", 30, 6);
  const poslednja = dates[dates.length - 1];
  const vidjeni = new Set();
  for (let d = 0; d <= 400; d += 1) {
    const r = evaluatePair(
      { customerId: "k", articleCode: "A", purchaseDates: dates },
      addDays(poslednja, d),
    );
    assert.ok(CADENCE_STATUSES.includes(r.status), `nepoznat status ${r.status}`);
    vidjeni.add(r.status);
  }
  // Prolaz kroz godinu mora da dodirne sve radne statuse i uspavanost.
  for (const ocekivan of ["not_yet", "due_soon", "due", "overdue", "dormant"]) {
    assert.ok(vidjeni.has(ocekivan), `status ${ocekivan} se nikad nije pojavio`);
  }
});

/* =========================================================================
 * Pouzdanost
 * ====================================================================== */

test("pouzdanost traži SVE uslove nivoa", () => {
  const c = (o) => confidenceFor({ provisional: false, ...o });

  assert.equal(c({ cycles: 6, stability: 0.6, spanRatio: 4 }), "high");
  // Jedan uslov manje — pada na sledeći nivo, ne ostaje visok.
  assert.equal(c({ cycles: 5, stability: 0.9, spanRatio: 9 }), "medium");
  assert.equal(c({ cycles: 9, stability: 0.59, spanRatio: 9 }), "medium");
  assert.equal(c({ cycles: 9, stability: 0.9, spanRatio: 3.9 }), "medium");

  assert.equal(c({ cycles: 4, stability: 0.4, spanRatio: 2 }), "medium");
  assert.equal(c({ cycles: 3, stability: 0.9, spanRatio: 9 }), "low");
  assert.equal(c({ cycles: 9, stability: 0.39, spanRatio: 9 }), "low");
  assert.equal(c({ cycles: 9, stability: 0.9, spanRatio: 1.9 }), "low");

  // Privremena procena je uvek niska, bez obzira na ostalo.
  assert.equal(
    confidenceFor({ provisional: true, cycles: 99, stability: 1, spanRatio: 99 }),
    "low",
  );
});

test("komponente pouzdanosti se čuvaju odvojeno, da se vidi ZAŠTO", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2026-01-01", 30, 6) },
    "2026-06-29",
  );
  assert.deepEqual(r.confidenceComponents, {
    cycles: 6,
    stability: 1,
    spanDays: 150,
    spanRatio: 5,
    provisional: false,
  });
});

test("tolerancija i lead su izvedeni iz politike, ne pogođeni", () => {
  assert.equal(toleranceFor(30, 0), 3, "donja granica");
  assert.equal(toleranceFor(30, 5), 5, "MAD unutar granica");
  assert.equal(toleranceFor(30, 40), 15, "gornja granica je pola medijane");
  assert.equal(toleranceFor(4, 9), 3, "kratak ciklus ne pada ispod donje granice");
  assert.equal(dueSoonLeadFor(30), 8);
  assert.equal(dueSoonLeadFor(4), 3, "donja granica leada");
});

/* =========================================================================
 * Determinizam
 * ====================================================================== */

test("isti rezultat bez obzira na ulazni redosled", () => {
  const dates = ritam("2026-01-01", 30, 6);
  const obrnuto = [...dates].reverse();
  const izmesano = [dates[3], dates[0], dates[5], dates[1], dates[4], dates[2]];

  const a = evaluatePair({ customerId: "k", articleCode: "A", purchaseDates: dates }, "2026-07-01");
  const b = evaluatePair({ customerId: "k", articleCode: "A", purchaseDates: obrnuto }, "2026-07-01");
  const c = evaluatePair({ customerId: "k", articleCode: "A", purchaseDates: izmesano }, "2026-07-01");

  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("ponovljen isti dan ne pravi razmak od nula dana", () => {
  const r = evaluatePair(
    {
      customerId: "k",
      articleCode: "A",
      purchaseDates: ["2026-01-01", "2026-01-01", "2026-01-31", "2026-03-02"],
    },
    "2026-04-01",
  );
  assert.equal(r.eventCount, 3);
  assert.deepEqual(r.intervals, [30, 30]);
  assert.equal(r.medianIntervalDays, 30);
});

test("kupovina posle asOfDate je GREŠKA, ne tiho odbačen red", () => {
  assert.throws(
    () =>
      evaluatePair(
        { customerId: "k", articleCode: "A", purchaseDates: ["2026-01-01", "2026-07-01"] },
        "2026-06-30",
      ),
    /posle asOfDate/,
  );
});

test("asOfDate je obavezan i mora biti ispravan", () => {
  assert.throws(
    () => evaluatePair({ customerId: "k", articleCode: "A", purchaseDates: [] }, undefined),
    /YYYY-MM-DD/,
  );
});

test("rezultat nosi verziju algoritma i osnov datuma", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2026-01-01", 30, 4) },
    "2026-05-01",
  );
  assert.equal(r.algorithmVersion, ALGORITHM_VERSION);
  assert.equal(r.algorithmVersion, "cadence_v1");
  assert.equal(r.dateBasis, "issued_on");
  assert.equal(r.asOfDate, "2026-05-01");
});

/* =========================================================================
 * Grupisanje
 * ====================================================================== */

test("evaluateAll grupiše po (kupac, artikal) i sortira deterministički", () => {
  const events = [
    { customerId: "k2", articleCode: "B", issuedOn: "2026-03-01" },
    { customerId: "k1", articleCode: "B", issuedOn: "2026-01-01" },
    { customerId: "k1", articleCode: "A", issuedOn: "2026-02-01" },
    { customerId: "k1", articleCode: "B", issuedOn: "2026-02-01" },
    { customerId: "k1", articleCode: "A", issuedOn: "2026-01-01" },
    { customerId: "k1", articleCode: "B", issuedOn: "2026-03-01" },
  ];
  const r = evaluateAll(events, "2026-04-01");
  assert.deepEqual(
    r.map((x) => `${x.customerId}/${x.articleCode}/${x.eventCount}`),
    ["k1/A/2", "k1/B/3", "k2/B/1"],
  );
  // Isti ulaz u drugom redosledu daje identičan izlaz.
  assert.deepEqual(evaluateAll([...events].reverse(), "2026-04-01"), r);
});

test("naziv artikla dolazi sa NAJNOVIJEG dana, ne sa prvog u nizu", () => {
  const events = [
    { customerId: "k", articleCode: "A", issuedOn: "2026-03-01", articleName: "Novo ime" },
    { customerId: "k", articleCode: "A", issuedOn: "2026-01-01", articleName: "Staro ime" },
  ];
  assert.equal(evaluateAll(events, "2026-04-01")[0].articleName, "Novo ime");
  assert.equal(evaluateAll([...events].reverse(), "2026-04-01")[0].articleName, "Novo ime");
});

test("prazan korpus daje prazan rezultat, bez greške", () => {
  assert.deepEqual(evaluateAll([], "2026-04-01"), []);
});

test("korpus bez ijednog ponovljenog para: sve je insufficient_history", () => {
  const events = [
    { customerId: "k1", articleCode: "A", issuedOn: "2026-01-01" },
    { customerId: "k1", articleCode: "B", issuedOn: "2026-01-01" },
    { customerId: "k2", articleCode: "A", issuedOn: "2026-02-01" },
  ];
  const r = evaluateAll(events, "2026-04-01");
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.status === "insufficient_history"));
  assert.ok(r.every((x) => x.expectedNextOn === null));
});

/* =========================================================================
 * Šta V1 NE sme da tvrdi
 * ====================================================================== */

test("rezultat ne nosi ni količinu, ni cenu, ni jedinicu mere", () => {
  const r = evaluatePair(
    { customerId: "k", articleCode: "A", purchaseDates: ritam("2026-01-01", 30, 6) },
    "2026-06-29",
  );
  const kljucevi = Object.keys(r).join(" ").toLowerCase();
  for (const zabranjeno of ["quantity", "kolicin", "price", "cena", "unit", "margin", "marza"]) {
    assert.ok(!kljucevi.includes(zabranjeno), `rezultat nosi polje „${zabranjeno}"`);
  }
  const tekst = r.explanation.toLowerCase();
  for (const zabranjeno of ["komad", "poruč", "naruč", "din", "cena", "količin"]) {
    assert.ok(!tekst.includes(zabranjeno), `objašnjenje tvrdi „${zabranjeno}": ${r.explanation}`);
  }
});

test("objašnjenje je razumljivo i nosi tačno ono što podaci kažu", () => {
  const r = evaluatePair(
    {
      customerId: "k",
      articleCode: "A",
      // Razmaci 28, 31, 31, 34, 34 → medijana 31, MAD 3, prozor 28–34.
      purchaseDates: [
        "2026-01-01", "2026-01-29", "2026-03-01", "2026-04-01",
        "2026-05-05", "2026-06-08",
      ],
    },
    "2026-07-09",
  );
  assert.equal(r.eventCount, 6);
  assert.deepEqual(r.intervals, [28, 31, 31, 34, 34]);
  assert.equal(r.medianIntervalDays, 31);
  assert.equal(r.dispersionDays, 3);
  assert.equal(r.toleranceDays, 3);
  assert.equal(r.daysSinceLastPurchase, 31);
  assert.equal(
    r.explanation,
    "Kupac je ovaj artikal kupovao 6 puta, tipično na 28–34 dana. " +
      "Poslednja potvrđena kupovina bila je pre 31 dan. Sada je u uobičajenom terminu.",
  );
});
