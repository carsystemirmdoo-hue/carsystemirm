/**
 * Cadence engine — matematičko jezgro preporuka.
 *
 * ČISTA funkcija nad nizom datuma. Bez baze, bez React-a, bez `fetch`-a i, što
 * je najvažnije, BEZ `new Date()`. `asOfDate` je obavezan parametar u svakom
 * ulazu, jer je jedini način da isti recompute nad istim podacima dva puta da
 * isti rezultat — a bez toga idempotentnost nije proverljiva, nego stvar sreće.
 *
 * Šta ovaj modul NE radi
 * ----------------------
 *  - ne prognozira količinu i ne dodiruje jedinicu mere (JM istorijski nije
 *    sačuvana na `invoice_lines` — nalaz GO/NO-GO audita);
 *  - ne računa cenu, maržu ni profit;
 *  - ne predlaže nabavku i ne pravi porudžbinu;
 *  - ne povezuje artikle po nazivu i ne radi cross-sell;
 *  - ne uči ni iz čega i nema nijednu ML zavisnost.
 *
 * Odgovara na jedno pitanje: KADA je ovaj kupac obično ponovo tražio ovaj
 * artikal, i gde smo danas u odnosu na taj ritam.
 */

import {
  ALGORITHM_VERSION,
  DATE_BASIS,
  DEFAULT_POLICY,
  STATUS_LABELS,
} from "./policy.mjs";

export { ALGORITHM_VERSION, DATE_BASIS };

/* =========================================================================
 * Datumi — isključivo UTC, isključivo celi dani
 * ====================================================================== */

const ISO_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PO_DANU = 86_400_000;

/**
 * `YYYY-MM-DD` → redni broj dana.
 *
 * `Date.UTC` NAMERNO, ne `new Date("2026-03-01")` i ne lokalno vreme. Lokalna
 * zona bi značila da isti podaci u Inđiji i na serveru u drugoj zoni daju
 * intervale koji se razlikuju za jedan dan oko ponoći i oko prelaska na letnje
 * računanje — a to je greška koja se pojavljuje dvaput godišnje i nikad se ne
 * reprodukuje kad je neko traži.
 *
 * Prestupne godine i prelazak godine ne traže nijedno posebno pravilo: `Date.UTC`
 * ih već zna, pa se ovde ništa ne broji ručno.
 *
 * @param {string} iso
 * @returns {number}
 */
export function dayNumber(iso) {
  const m = ISO_DATUM.exec(String(iso));
  if (!m) throw new Error(`Datum mora biti YYYY-MM-DD, dobijeno: ${JSON.stringify(iso)}`);
  const [, g, mes, d] = m;
  const ms = Date.UTC(Number(g), Number(mes) - 1, Number(d));
  const nazad = new Date(ms);
  /*
   * `Date.UTC(2026, 1, 31)` tiho postaje 3. mart. Provera vraćanja hvata svaki
   * nepostojeći datum umesto da ga pretvori u pogrešan.
   */
  if (
    nazad.getUTCFullYear() !== Number(g) ||
    nazad.getUTCMonth() !== Number(mes) - 1 ||
    nazad.getUTCDate() !== Number(d)
  ) {
    throw new Error(`Datum ne postoji u kalendaru: ${iso}`);
  }
  return Math.round(ms / MS_PO_DANU);
}

/**
 * Redni broj dana → `YYYY-MM-DD`.
 * @param {number} dan
 * @returns {string}
 */
export function dayToIso(dan) {
  return new Date(dan * MS_PO_DANU).toISOString().slice(0, 10);
}

/**
 * Razlika u KALENDARSKIM danima. Uvek ceo broj, uvek isti u svakoj zoni.
 * @param {string} od
 * @param {string} do_
 */
export function daysBetween(od, do_) {
  return dayNumber(do_) - dayNumber(od);
}

/** @param {string} iso @param {number} dana */
export function addDays(iso, dana) {
  return dayToIso(dayNumber(iso) + dana);
}

/* =========================================================================
 * Robusna statistika
 * ====================================================================== */

/**
 * Medijana nad već sortiranim nizom, zaokružena na ceo dan.
 *
 * MEDIJANA, ne prosek: jedna vanredna nabavka pred sezonu pomerila bi prosek i
 * proizvela pogrešan očekivani datum za sve naredne mesece. Medijana to ne radi.
 *
 * Zaokruživanje je „pola naviše" i dešava se JEDNOM, ovde: očekivani datum je
 * dan, a ne dan i po. Da se zaokruživalo kasnije, dve grane koda bi mogle da
 * zaokruže različito i isti par bi dobio dva očekivana datuma.
 *
 * @param {number[]} sortirano
 * @returns {number}
 */
export function medianOfSorted(sortirano) {
  const n = sortirano.length;
  if (n === 0) throw new Error("Medijana praznog niza ne postoji.");
  const sredina = Math.floor(n / 2);
  const tacna =
    n % 2 === 1 ? sortirano[sredina] : (sortirano[sredina - 1] + sortirano[sredina]) / 2;
  return Math.round(tacna);
}

/**
 * Median absolute deviation — robusna mera rasipanja.
 *
 * Standardna devijacija bi jedan izuzetan razmak (godišnji odmor, zastoj u
 * proizvodnji) pretvorila u tvrdnju da kupac nema ritam. MAD gleda tipično
 * odstupanje, pa jedan izlet ne obara sliku.
 *
 * @param {number[]} vrednosti
 * @param {number} medijana
 */
export function medianAbsoluteDeviation(vrednosti, medijana) {
  const odstupanja = vrednosti.map((v) => Math.abs(v - medijana)).sort((a, b) => a - b);
  return medianOfSorted(odstupanja);
}

/**
 * Stabilnost ritma, 0–1.
 *
 * `1 − min(1, MAD / medijana)`. Vrednost 1 znači da kupac dolazi kao sat;
 * vrednost 0 znači nasumične nabavke i tada pouzdanost pada, a prozor se ne
 * širi (vidi `policy.tolerance.maxRatioOfMedian`).
 *
 * @param {number} mad
 * @param {number} medijana
 */
export function stabilityOf(mad, medijana) {
  if (medijana <= 0) return 0;
  const s = 1 - Math.min(1, mad / medijana);
  // Dve decimale: vrednost se prikazuje i čuva, pa mora biti ista svaki put.
  return Math.round(s * 100) / 100;
}

/* =========================================================================
 * Jezgro
 * ====================================================================== */

/**
 * @typedef {object} PairInput
 * @property {string} customerId
 * @property {string} articleCode
 * @property {string} [articleName]
 * @property {string[]} purchaseDates  `YYYY-MM-DD`; redosled je nebitan, duplikati se sažimaju
 * @property {number} [documentCount]  broj različitih faktura iza ovih dana (dijagnostika)
 */

/**
 * @typedef {object} PairResult
 * @property {string} customerId
 * @property {string} articleCode
 * @property {string|null} articleName
 * @property {import("./policy.mjs").CadenceStatus} status
 * @property {import("./policy.mjs").CadenceStatus|null} underlyingStatus
 * @property {import("./policy.mjs").ConfidenceLevel} confidence
 * @property {number} eventCount
 * @property {string|null} firstPurchaseOn
 * @property {string|null} lastPurchaseOn
 * @property {number[]} intervals
 * @property {number|null} medianIntervalDays
 * @property {number|null} dispersionDays
 * @property {number|null} stability
 * @property {string|null} expectedNextOn
 * @property {number|null} toleranceDays
 * @property {string|null} windowFromOn
 * @property {string|null} windowToOn
 * @property {number|null} daysUntilExpected  <0 = prošlo, >0 = predstoji
 * @property {number|null} daysSinceLastPurchase
 * @property {{cycles:number, stability:number|null, spanDays:number|null, spanRatio:number|null, provisional:boolean}} confidenceComponents
 * @property {string[]} reasons
 * @property {string} explanation
 * @property {string} algorithmVersion
 * @property {string} dateBasis
 * @property {string} asOfDate
 */

/**
 * Ocenjuje JEDAN par (kupac, artikal).
 *
 * @param {PairInput} input
 * @param {string} asOfDate
 * @param {import("./policy.mjs").CadencePolicy} [policy]
 * @returns {PairResult}
 */
export function evaluatePair(input, asOfDate, policy = DEFAULT_POLICY) {
  const asOf = dayNumber(asOfDate);

  /*
   * Ulazni redosled se NE poštuje — sortira se ovde.
   *
   * Zahtev „isti rezultat bez obzira na ulazni redosled" ne sme da počiva na
   * tome što upit slučajno vraća sortirano. Duplikati se sažimaju iz istog
   * razloga: sloj iznad ih već ne pravi, ali jezgro ne sme da zavisi od tuđe
   * discipline — dva puta isti dan bi dao interval od nula dana i oborio
   * medijanu na nulu.
   */
  const dani = [...new Set(input.purchaseDates.map(dayNumber))].sort((a, b) => a - b);

  for (const d of dani) {
    if (d > asOf) {
      /*
       * Događaj iz budućnosti je greška pozivaoca, ne ulaz koji treba tiho
       * odbaciti. Tiho odbacivanje bi značilo da isti recompute sa pogrešnim
       * `asOfDate` daje rezultat koji izgleda ispravno.
       */
      throw new Error(
        `Kupovina ${dayToIso(d)} je posle asOfDate ${asOfDate} — ulaz nije filtriran.`,
      );
    }
  }

  const n = dani.length;
  const zajednicko = {
    customerId: input.customerId,
    articleCode: input.articleCode,
    articleName: input.articleName ?? null,
    eventCount: n,
    firstPurchaseOn: n > 0 ? dayToIso(dani[0]) : null,
    lastPurchaseOn: n > 0 ? dayToIso(dani[n - 1]) : null,
    daysSinceLastPurchase: n > 0 ? asOf - dani[n - 1] : null,
    algorithmVersion: ALGORITHM_VERSION,
    dateBasis: DATE_BASIS,
    asOfDate,
  };

  /* ---- Manje od dve kupovine: ne postoji nijedan razmak ---------------- */
  if (n < policy.minForEstimate) {
    return {
      ...zajednicko,
      status: "insufficient_history",
      underlyingStatus: null,
      confidence: "low",
      intervals: [],
      medianIntervalDays: null,
      dispersionDays: null,
      stability: null,
      expectedNextOn: null,
      toleranceDays: null,
      windowFromOn: null,
      windowToOn: null,
      daysUntilExpected: null,
      confidenceComponents: {
        cycles: n,
        stability: null,
        spanDays: null,
        spanRatio: null,
        provisional: false,
      },
      reasons: ["insufficient_history"],
      explanation:
        n === 0
          ? "Nema nijedne potvrđene kupovine ovog artikla."
          : "Postoji samo jedna potvrđena kupovina. Za procenu ritma potrebne su najmanje dve.",
    };
  }

  /* ---- Razmaci, medijana, rasipanje ------------------------------------ */
  const intervals = [];
  for (let i = 1; i < n; i += 1) intervals.push(dani[i] - dani[i - 1]);
  const sortiraniIntervali = [...intervals].sort((a, b) => a - b);
  const medianIntervalDays = medianOfSorted(sortiraniIntervali);
  const dispersionDays = medianAbsoluteDeviation(intervals, medianIntervalDays);
  const stability = stabilityOf(dispersionDays, medianIntervalDays);

  const poslednji = dani[n - 1];
  const spanDays = poslednji - dani[0];
  const spanRatio =
    medianIntervalDays > 0 ? Math.round((spanDays / medianIntervalDays) * 100) / 100 : null;

  const expectedDan = poslednji + medianIntervalDays;
  const toleranceDays = toleranceFor(medianIntervalDays, dispersionDays, policy);
  const daysUntilExpected = expectedDan - asOf;
  const daysSinceLast = asOf - poslednji;

  const provisional = n < policy.minForCadence;
  const underlyingStatus = cadenceStatusFor({
    daysUntilExpected,
    daysSinceLast,
    toleranceDays,
    medianIntervalDays,
    policy,
  });

  const confidenceComponents = {
    cycles: n,
    stability,
    spanDays,
    spanRatio,
    provisional,
  };

  const okvir = {
    ...zajednicko,
    /*
     * Sa dve kupovine status JE `provisional`, i to je jedini status.
     *
     * Nije „due koji je slabo pouzdan": jedan razmak ne dokazuje ritam, pa bi
     * prikazivanje takvog para među radnim preporukama bilo tvrdnja koju
     * podaci ne nose. Ono što bi status bio ostaje vidljivo u
     * `underlyingStatus`, radi sortiranja i objašnjenja — ali nikad kao status.
     */
    status: provisional ? "provisional" : underlyingStatus,
    underlyingStatus,
    confidence: confidenceFor(confidenceComponents, policy),
    intervals,
    medianIntervalDays,
    dispersionDays,
    stability,
    expectedNextOn: dayToIso(expectedDan),
    toleranceDays,
    windowFromOn: dayToIso(expectedDan - toleranceDays),
    windowToOn: dayToIso(expectedDan + toleranceDays),
    daysUntilExpected,
    confidenceComponents,
  };

  return {
    ...okvir,
    reasons: reasonsFor(okvir),
    explanation: explain(okvir),
  };
}

/**
 * Polovina prozora „na vreme", u danima.
 *
 * Donja granica brani savršeno pravilnog kupca (MAD = 0) od prozora od nula
 * dana; gornja brani status od toga da postane bezvredan kod nepravilnog ritma.
 *
 * @param {number} medijana
 * @param {number} mad
 * @param {import("./policy.mjs").CadencePolicy} policy
 */
export function toleranceFor(medijana, mad, policy = DEFAULT_POLICY) {
  const gornja = Math.max(
    policy.tolerance.minDays,
    Math.round(medijana * policy.tolerance.maxRatioOfMedian),
  );
  return Math.min(gornja, Math.max(policy.tolerance.minDays, mad));
}

/**
 * Koliko unapred se javlja „uskoro", u danima.
 * @param {number} medijana
 * @param {import("./policy.mjs").CadencePolicy} policy
 */
export function dueSoonLeadFor(medijana, policy = DEFAULT_POLICY) {
  return Math.max(
    policy.dueSoon.minLeadDays,
    Math.round(medijana * policy.dueSoon.leadRatioOfMedian),
  );
}

/**
 * Status po ritmu. Prvi uslov koji odgovara je jedini — statusi se ne preklapaju.
 *
 * Granice, izgovorene rečima (d = daysUntilExpected, t = tolerancija):
 *
 *   dormant   daysSinceLast ≥ 3 × medijana  I  daysSinceLast ≥ 180
 *   overdue   d < −t
 *   due       −t ≤ d ≤ t
 *   due_soon  t < d ≤ t + lead
 *   not_yet   d > t + lead
 *
 * @param {{daysUntilExpected:number, daysSinceLast:number, toleranceDays:number, medianIntervalDays:number, policy:import("./policy.mjs").CadencePolicy}} arg
 * @returns {import("./policy.mjs").CadenceStatus}
 */
export function cadenceStatusFor({
  daysUntilExpected,
  daysSinceLast,
  toleranceDays,
  medianIntervalDays,
  policy = DEFAULT_POLICY,
}) {
  /*
   * `dormant` PRE `overdue`.
   *
   * Kupac koji se nije javio godinu dana jeste u kašnjenju, ali rečenica
   * „kasni 340 dana" navodi komercijalistu da traži zaboravljenu porudžbinu
   * umesto da pita da li je kupac uopšte još aktivan.
   */
  if (
    daysSinceLast >= medianIntervalDays * policy.dormant.multipleOfMedian &&
    daysSinceLast >= policy.dormant.minDays
  ) {
    return "dormant";
  }
  if (daysUntilExpected < -toleranceDays) return "overdue";
  if (daysUntilExpected <= toleranceDays) return "due";
  if (daysUntilExpected <= toleranceDays + dueSoonLeadFor(medianIntervalDays, policy)) {
    return "due_soon";
  }
  return "not_yet";
}

/**
 * Nivo pouzdanosti. SVI uslovi nivoa moraju da važe.
 *
 * Nije verovatnoća i ne sme se prikazati kao procenat: nijedan nivo nije
 * kalibrisan nad stvarnim ishodima, jer stvarnih ponovljenih kupovina još nema.
 * Komponente se čuvaju odvojeno da bi se u interfejsu videlo ZAŠTO je nivo baš
 * takav, umesto da čovek dobije oznaku bez obrazloženja.
 *
 * @param {{cycles:number, stability:number|null, spanRatio:number|null, provisional:boolean}} c
 * @param {import("./policy.mjs").CadencePolicy} policy
 * @returns {import("./policy.mjs").ConfidenceLevel}
 */
export function confidenceFor(c, policy = DEFAULT_POLICY) {
  // Privremena procena je uvek niska — jedan razmak ne postaje pouzdan ni po čemu.
  if (c.provisional) return "low";
  if (c.stability === null || c.spanRatio === null) return "low";

  const { high, medium } = policy.confidence;
  if (
    c.cycles >= high.minCycles &&
    c.stability >= high.minStability &&
    c.spanRatio >= high.minSpanRatio
  ) {
    return "high";
  }
  if (
    c.cycles >= medium.minCycles &&
    c.stability >= medium.minStability &&
    c.spanRatio >= medium.minSpanRatio
  ) {
    return "medium";
  }
  return "low";
}

/**
 * Šifre razloga — stabilne, za merenje i filtriranje.
 *
 * Šifre, ne slobodan tekst: uspešnost preporuke se kasnije meri PO RAZLOGU, a
 * to nad rečenicama nije moguće.
 *
 * @param {{status:string, underlyingStatus:string|null, confidenceComponents:{provisional:boolean}, stability:number|null, eventCount:number}} r
 */
function reasonsFor(r) {
  const out = [];
  if (r.confidenceComponents.provisional) out.push("provisional_single_interval");
  out.push(`status_${r.underlyingStatus ?? r.status}`);
  if (r.stability !== null && r.stability >= 0.6) out.push("stable_cycle");
  if (r.stability !== null && r.stability < 0.4) out.push("irregular_cycle");
  if (r.eventCount >= 6) out.push("long_history");
  return out;
}

/** Množina dana na srpskom; „31 dan", „2 dana", „5 dana". */
function dana(n) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/** Množina kupovina; „2 puta", „6 puta" — „puta" je nepromenljivo. */
function puta(n) {
  return `${n} puta`;
}

/**
 * Objašnjenje na jeziku kojim komercijalista govori sa kupcem.
 *
 * Nijedna rečenica ne sme da tvrdi količinu, cenu, dostupnost ni porudžbinu.
 * Ograda da je ovo interna procena stoji na EKRANU, jednom, a ne u svakom redu
 * — ponovljeno upozorenje se prestaje čitati.
 *
 * @param {any} r
 */
function explain(r) {
  const delovi = [];

  if (r.confidenceComponents.provisional) {
    delovi.push(
      `Kupac je ovaj artikal kupovao ${puta(r.eventCount)}, sa jednim razmakom od ` +
        `${dana(r.intervals[0])}.`,
    );
    delovi.push("Jedan razmak nije ritam, pa je ovo privremena procena.");
  } else {
    const od = Math.max(1, r.medianIntervalDays - r.toleranceDays);
    const do_ = r.medianIntervalDays + r.toleranceDays;
    delovi.push(
      `Kupac je ovaj artikal kupovao ${puta(r.eventCount)}, tipično na ${od}–${do_} dana.`,
    );
  }

  delovi.push(
    r.daysSinceLastPurchase === 0
      ? "Poslednja potvrđena kupovina bila je danas."
      : `Poslednja potvrđena kupovina bila je pre ${dana(r.daysSinceLastPurchase)}.`,
  );

  const status = r.underlyingStatus ?? r.status;
  if (status === "overdue") {
    delovi.push(`Očekivani termin je prošao pre ${dana(r.daysUntilExpected)}.`);
  } else if (status === "due") {
    delovi.push("Sada je u uobičajenom terminu.");
  } else if (status === "due_soon") {
    delovi.push(`Uobičajeni termin je za ${dana(r.daysUntilExpected)}.`);
  } else if (status === "not_yet") {
    delovi.push(`Do uobičajenog termina ima još ${dana(r.daysUntilExpected)}.`);
  } else if (status === "dormant") {
    delovi.push(
      "To je znatno duže od uobičajenog razmaka — vredi proveriti da li kupac " +
        "još uzima ovaj artikal.",
    );
  }

  return delovi.join(" ");
}

/* =========================================================================
 * Grupisanje
 * ====================================================================== */

/**
 * @typedef {object} PurchaseEventLike
 * @property {string} customerId
 * @property {string} articleCode
 * @property {string} issuedOn
 * @property {string} [articleName]
 * @property {string[]} [invoiceIds]
 */

/**
 * Grupiše događaje u parove (kupac, artikal) i ocenjuje svaki.
 *
 * I ovo je čista funkcija: ulaz je niz, izlaz je niz, nema upita. Sortiranje
 * izlaza je potpuno određeno (kupac, šifra) da bi dva prolaza nad istim ulazom
 * dala bajt-identičan rezultat, bez obzira na redosled ulaza.
 *
 * @param {PurchaseEventLike[]} events
 * @param {string} asOfDate
 * @param {import("./policy.mjs").CadencePolicy} [policy]
 * @returns {PairResult[]}
 */
export function evaluateAll(events, asOfDate, policy = DEFAULT_POLICY) {
  /** @type {Map<string, {customerId:string, articleCode:string, articleName:string|null, articleNameOn:string, dates:string[], documentCount:number}>} */
  const parovi = new Map();

  for (const e of events) {
    /*
     * Razdvajač je znak jedinice (U+001F), ne razmak ni crtica.
     *
     * UUID kupca je fiksne dužine, ali šifra artikla je tekst iz izvora i sme
     * da sadrži bilo koji štampljiv znak — uključujući onaj koji bi neko
     * izabrao za razdvajač. Kontrolni znak koji u tim vrednostima ne postoji
     * je jedini razdvajač koji ne može da spoji dva različita para u jedan
     * ključ.
     */
    const kljuc = `${e.customerId}\u001F${e.articleCode}`;
    let par = parovi.get(kljuc);
    if (!par) {
      par = {
        customerId: e.customerId,
        articleCode: e.articleCode,
        articleName: null,
        articleNameOn: "",
        dates: [],
        documentCount: 0,
      };
      parovi.set(kljuc, par);
    }
    par.dates.push(e.issuedOn);
    par.documentCount += e.invoiceIds?.length ?? 1;
    /*
     * Naziv sa NAJNOVIJEG dana, ne sa prvog koji naiđe.
     *
     * Poređenje ide po datumu, ne po redosledu u nizu — inače bi isti ulaz u
     * drugom redosledu dao drugi naziv, a rezultat prestao da bude
     * reproducibilan.
     */
    if (e.articleName && e.issuedOn >= par.articleNameOn) {
      par.articleName = e.articleName;
      par.articleNameOn = e.issuedOn;
    }
  }

  return [...parovi.values()]
    .map((par) =>
      evaluatePair(
        {
          customerId: par.customerId,
          articleCode: par.articleCode,
          articleName: par.articleName ?? undefined,
          purchaseDates: par.dates,
          documentCount: par.documentCount,
        },
        asOfDate,
        policy,
      ),
    )
    .sort(
      (a, b) =>
        a.customerId.localeCompare(b.customerId) ||
        a.articleCode.localeCompare(b.articleCode),
    );
}

export { STATUS_LABELS };
