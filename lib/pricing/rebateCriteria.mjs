/**
 * PRIVREMENI kriterijumi analize rabata — jedino mesto gde se menjaju.
 *
 * Nisu poslovna pravila firme nego pragovi kojima portal razvrstava istoriju
 * faktura dok vlasnik ne potvrdi konačne vrednosti. Ekrani ih prikazuju, a
 * primena pravila na pilotu ih upisuje u obrazloženje svakog pravila, pa se
 * kasnije zna po kom kriterijumu je nastalo.
 */
export const REBATE_CRITERIA = Object.freeze({
  /** Oznaka verzije kriterijuma; menja se uz svaku izmenu vrednosti ispod. */
  version: "rabati-v1-2026-10-07",

  // Pregled po kupcu
  /** Ispod ovoliko faktura nema zaključka o kupcu. */
  minInvoices: 3,
  /** Udeo stavki sa istim rabatom od kog je uslov grupe „stabilan". */
  stableShare: 0.85,
  /** Rabat od ovoliko i više: „visok rabat — proveriti". Sam procenat ne dokazuje akciju. */
  highDiscount: 50,
  /** Promena je „nedavna" ako je počela u ovoliko dana pre poslednje fakture. */
  recentDays: 180,
  /** Najmanje uzastopnih faktura sa novim rabatom da bi to bila promena. */
  changeRun: 3,

  // Pravilo kupac–artikal iz istorije
  /** Najmanje poslednjih uzastopnih faktura sa istim rabatom na artiklu. */
  applyRun: 3,
  /** Te fakture moraju biti u najmanje ovoliko različitih dana… */
  applyDistinctDays: 3,
  /** …i obuhvatati najmanje ovoliko dana (ne jednokratna nabavka). */
  applyMinSpanDays: 30,
  /** Poslednja faktura niza ne sme biti starija od ovoga (dana). */
  applyMaxAgeDays: 548,
});

export const CRITERIA_TEXT = [
  `stabilan uslov grupe: isti rabat na ≥ ${Math.round(REBATE_CRITERIA.stableShare * 100)} % stavki`,
  `visok rabat — proveriti: ≥ ${REBATE_CRITERIA.highDiscount} %`,
  `nedavna promena: ≥ ${REBATE_CRITERIA.changeRun} uzastopne fakture, u poslednjih ${REBATE_CRITERIA.recentDays} dana`,
  `pravilo kupac–artikal: poslednjih ≥ ${REBATE_CRITERIA.applyRun} faktura isti rabat, ≥ ${REBATE_CRITERIA.applyDistinctDays} dana, raspon ≥ ${REBATE_CRITERIA.applyMinSpanDays} dana, poslednja ne starija od ${REBATE_CRITERIA.applyMaxAgeDays} dana`,
];
