/**
 * Pragovi cadence algoritma — na jednom mestu, ne razasuti po kodu.
 *
 * Zašto konfiguracija a ne konstante u funkcijama
 * -----------------------------------------------
 * Ove brojeve treba podesiti nad STVARNIM ponovljenim kupovinama, a ne nad
 * sintetičkim testovima. Dok su u telu funkcije, podešavanje znači izmenu
 * algoritma i niko ne može da odgovori „šta se tačno promenilo između dva
 * prolaza". Ovde su vrednost, verzija ih prati, a `algorithmVersion` se menja
 * kad se promene.
 *
 * Nijedna vrednost NIJE kalibrisana nad stvarnim podacima. To su polazne
 * granice, izabrane tako da budu razumljive čoveku, i takve moraju i ostati dok
 * ne postoji korpus na kome se mere.
 */

/**
 * Verzija algoritma.
 *
 * Ulazi u SVAKI sačuvan rezultat. Bez nje se posle izmene pragova ne može
 * odgovoriti koji su redovi računati kojim pravilima — a to je prvo pitanje kad
 * neko kaže „juče je pisalo drugačije".
 *
 * Menja se pri SVAKOJ promeni pragova ili formule, ne samo pri promeni koda.
 */
export const ALGORITHM_VERSION = "cadence_v1";

/**
 * Osnov datuma. V1 računa nad datumom izdavanja dokumenta.
 *
 * `trade_date` (datum prometa) postoji u šemi, ali je `null` za sve zatečeno i
 * za sve što izvor ne štampa. Mešanje dva osnova značilo bi da su intervali
 * računati nad dva različita pojma vremena, a razlika bi se videla tek kao
 * neobjašnjivo pomeren očekivani datum.
 */
export const DATE_BASIS = "issued_on";

/** @typedef {"insufficient_history"|"provisional"|"not_yet"|"due_soon"|"due"|"overdue"|"dormant"} CadenceStatus */
/** @typedef {"low"|"medium"|"high"} ConfidenceLevel */

/**
 * Statusi, u redosledu kojim ih algoritam proverava.
 *
 * Redosled je deo pravila, ne stila: `dormant` se proverava PRE `overdue` zato
 * što je kupac koji se nije javio godinu dana takođe „u kašnjenju", a rečenica
 * „kasni 340 dana" je tačna i beskorisna. Prvi status koji odgovara je jedini
 * status — nikad dva.
 */
export const CADENCE_STATUSES = /** @type {const} */ ([
  "insufficient_history",
  "provisional",
  "dormant",
  "overdue",
  "due",
  "due_soon",
  "not_yet",
]);

export const CONFIDENCE_LEVELS = /** @type {const} */ (["low", "medium", "high"]);

export const DEFAULT_POLICY = Object.freeze({
  /**
   * Koliko kupovina traži koja procena.
   *
   * `minForEstimate = 2` — jedan razmak je jedini razmak; iz njega se ne vidi da
   * li je ritam ili slučajnost, pa rezultat nosi status `provisional` i nikad ne
   * ulazi među glavne preporuke.
   *
   * `minForCadence = 3` — dva razmaka su najmanji broj iz kog medijana uopšte
   * ima smisla (srednji od tri broja, ili prosek dva).
   */
  minForEstimate: 2,
  minForCadence: 3,

  tolerance: Object.freeze({
    /**
     * Najuži prozor „na vreme".
     *
     * Bez donje granice bi savršeno pravilan kupac (MAD = 0) dobio prozor od
     * nula dana i bio „u kašnjenju" već sutradan po očekivanom datumu.
     */
    minDays: 3,
    /**
     * Prozor ne sme preći polovinu tipičnog ciklusa.
     *
     * Kupac sa medijanom 30 i rasipanjem 40 dana bi inače dobio prozor ±40, u
     * kome je „na vreme" praktično uvek — a status koji je uvek isti nije
     * status. Umesto širenja prozora, takav par pada na nisku pouzdanost.
     */
    maxRatioOfMedian: 0.5,
  }),

  /**
   * Koliko unapred se javlja „uskoro".
   *
   * Vezano za ciklus, ne fiksno: 7 dana unapred je mnogo za nedeljni ritam i
   * malo za polugodišnji.
   */
  dueSoon: Object.freeze({ minLeadDays: 3, leadRatioOfMedian: 0.25 }),

  /**
   * Kada kupac prestaje da „kasni" i postaje uspavan.
   *
   * Oba uslova moraju da važe: relativni (tri tipična ciklusa) i apsolutni
   * (180 dana). Bez apsolutnog bi kupac sa nedeljnim ritmom bio „uspavan" posle
   * tri nedelje, što je za refinish program prerano da bi značilo išta.
   */
  dormant: Object.freeze({ multipleOfMedian: 3, minDays: 180 }),

  /**
   * Pouzdanost — SVI uslovi jednog nivoa moraju da važe.
   *
   * `minSpanRatio` je dužina istorije izražena u tipičnim ciklusima:
   * (poslednja − prva kupovina) / medijalni interval. Pri savršeno pravilnom
   * ritmu jednak je broju kupovina umanjenom za jedan, pa se ne sudara sa
   * `minCycles` nego ga potvrđuje iz drugog ugla — para sa šest kupovina
   * nagurane u dve nedelje nema četiri ciklusa istorije.
   *
   * Ovo NIJE verovatnoća i ne sme se prikazati kao procenat. Nijedan nivo nije
   * kalibrisan nad stvarnim ishodima.
   */
  confidence: Object.freeze({
    high: Object.freeze({ minCycles: 6, minStability: 0.6, minSpanRatio: 4 }),
    medium: Object.freeze({ minCycles: 4, minStability: 0.4, minSpanRatio: 2 }),
  }),
});

/** @typedef {typeof DEFAULT_POLICY} CadencePolicy */

/**
 * Statusi koje interni ekran podrazumevano prikazuje kao „radne".
 *
 * `provisional` NIJE među njima — vidi se kroz filter, odvojeno. Isto važi za
 * `insufficient_history`, koji je dijagnostika, ne preporuka.
 */
export const ACTIONABLE_STATUSES = /** @type {const} */ ([
  "overdue",
  "due",
  "due_soon",
]);

/** Čitljive oznake; jedini izvor teksta statusa u celom sistemu. */
export const STATUS_LABELS = Object.freeze({
  insufficient_history: "Nedovoljno istorije",
  provisional: "Privremena procena",
  dormant: "Uspavan",
  overdue: "Kasni",
  due: "Treba kontaktirati sada",
  due_soon: "Uskoro",
  not_yet: "Još nije vreme",
});

export const CONFIDENCE_LABELS = Object.freeze({
  low: "niska",
  medium: "srednja",
  high: "visoka",
});
