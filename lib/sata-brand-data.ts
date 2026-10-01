/**
 * SATA brend stranica — podaci.
 *
 * Izvor svake tvrdnje: `docs/SATA_RESEARCH.md` (istraživanje 2026-08-20,
 * zvanični `sata.com`). Asset/gap evidencija: `docs/SATA_CONTENT_ASSET_MAP.md`.
 *
 * PRAVILA KOJA SE NE SMEJU PREKRŠITI:
 *
 * 1. SATA proizvodi opremu, ne premaze. Nijedna tvrdnja o materijalima.
 * 2. Nijedan podatak o ceni, lageru, roku isporuke ili servisu kod nas.
 *    Carsystem i R-M nema potvrđen distributerski ni servisni status za SATA.
 * 3. Globalni SATA program se prikazuje kao program proizvođača, nikada kao
 *    naša ponuda. Jedini SATA artikal evidentiran u našem online katalogu je
 *    `satajet-x-5500` — evidencija u katalogu NIJE potvrda prodaje, zaliha ni
 *    komercijalnog statusa. Ne pisati „potvrđena ponuda", „kod nas dostupno"
 *    ni bilo šta što implicira prodaju.
 * 4. `SATAjet X 5500` nije SATA-in najnoviji premium pištolj — `jet X` jeste.
 *    Obe porodice su aktuelne; ne mešati ih i ne proglašavati X 5500 novim.
 * 5. Brojevi se navode samo ako su potvrđeni na zvaničnoj stranici i ako je
 *    jasno na koju konfiguraciju se odnose. Masa `jet X` se NE navodi —
 *    zvanični izvori se ne slažu (26 g vs 38 g).
 * 6. SATA plava je NAŠA UI aproksimacija za vlasništvo stranice, ne zvanična
 *    SATA brand boja. Zvanična boja logotipa je crvena `#E2001A`.
 * 7. Nijedan link ne vodi na proizvod ili dokument koji lokalno ne postoji.
 *    Linkovi ka `sata.com` su eksplicitno označeni kao zvanični izvor.
 */

export const SATA_BRAND_SLUG = "sata";

/** Zvanični SATA servisi. Otvaraju se kao spoljni linkovi, jasno označeni. */
export const SATA_OFFICIAL = {
  site: "https://www.sata.com/en/",
  sparePartsFinder: "https://www.sata.com/en-us/service/spare-parts-finder/",
  premiumWarranty:
    "https://www.sata.com/en-us/service/product-service/premium-warranty/",
} as const;

/* -------------------------------------------------------------------------- */
/* 01 — Hero                                                                  */
/* -------------------------------------------------------------------------- */

export type SataHeroReadout = {
  /** Vrednost — prikazuje se mono fontom. */
  value: string;
  /** Šta je izmereno. */
  label: string;
  /** Na šta se tačno odnosi. Bez ovoga broj je marketing. */
  scope: string;
};

/**
 * Tri broja u hero-u. Svaki ima naveden opseg da se ne bi čitao kao univerzalna
 * specifikacija. Izvori: art. 1200386 (jet X RP 1.2), art. 1099953 (filter 584),
 * `adam X pro` stranica.
 */
export const sataHeroReadouts: SataHeroReadout[] = [
  {
    value: "0,5–2,4 bar",
    label: "Radni ulazni pritisak",
    scope: "jet X RP 1.2 · preporučeno dinamički 2 bar",
  },
  {
    value: "0,01 µm",
    label: "Granica finog filtera",
    scope: "SATA filter 584 · efikasnost 99,998 %",
  },
  {
    value: "0,2 bar",
    label: "Prag alarma odstupanja",
    scope: "adam X pro · optičko upozorenje",
  },
];

/* -------------------------------------------------------------------------- */
/* 02 — Zašto SATA                                                            */
/* -------------------------------------------------------------------------- */

export type SataArgument = {
  id: string;
  index: string;
  title: string;
  body: string;
  /** Konkretan dokaz — brojevi ili zvanična oznaka. Nikad prazna fraza. */
  evidence: string;
};

export const sataArguments: SataArgument[] = [
  {
    id: "merenje",
    index: "01",
    title: "Pritisak se meri, ne procenjuje",
    body:
      "Digitalna jedinica na pištolju prikazuje stvarni i zadati ulazni pritisak i grafički pokazuje odstupanje tokom rada. Podešavanje prestaje da bude stvar osećaja i postaje vrednost koju sledeći put ponovite.",
    evidence: "adam X pro — optički alarm pri odstupanju većem od 0,2 bar",
  },
  {
    id: "vazduh",
    index: "02",
    title: "Čist vazduh je deklarisan brojem",
    body:
      "Trostepena filtracija ima navedene granice po stepenu: separator ulja i vode, fini filter i stepen sa aktivnim ugljem koji adsorbuje uljne pare. Kod vodorazredivih materijala treći stepen nije opcija nego uslov.",
    evidence: "SATA filter 584 — > 5 µm / > 0,01 µm pri 99,998 % / aktivni ugalj",
  },
  {
    id: "opseg",
    index: "03",
    title: "Svaka mlaznica ima definisan radni opseg",
    body:
      "Potrošnja vazduha, ulazni pritisak i preporučeno rastojanje navedeni su po konkretnoj konfiguraciji, a ne za brend uopšte. To je podatak sa kojim radionica može da planira kompresor i tehniku nanošenja.",
    evidence: "jet X RP 1.2 — 330 l/min, rastojanje 17–21 cm",
  },
  {
    id: "servis",
    index: "04",
    title: "Delovi i garancija su sistemski rešeni",
    body:
      "SATA vodi zvanični pretraživač rezervnih delova po modelu i nudi registraciju produžene garancije. Oprema se održava i popravlja, umesto da se menja kompletno.",
    evidence: "SATA Premium Warranty — produženje na 3 godine uz registraciju",
  },
];

/* -------------------------------------------------------------------------- */
/* 03 — SATA kao radni sistem                                                 */
/* -------------------------------------------------------------------------- */

export type SataChainStage = {
  id: string;
  step: string;
  title: string;
  body: string;
  /** Zvanične porodice/proizvodi koji pokrivaju ovaj korak. */
  parts: string[];
};

/**
 * Lanac postoji zato što ga zvanični portfolio pokriva — svaki korak ima
 * potvrđenu SATA kategoriju iza sebe. Nijedan korak nije izmišljen.
 */
export const sataChain: SataChainStage[] = [
  {
    id: "vazduh",
    step: "01",
    title: "Priprema vazduha",
    body:
      "Filtracija pre pištolja. Jednostepeno, dvostepeno ili trostepeno, u zavisnosti od toga da li se radi sa vodorazredivim materijalima i da li se vazduh koristi i za respiratornu zaštitu.",
    parts: ["SATA filter 500 series", "SATA filter series 400", "SATA filter series 200"],
  },
  {
    id: "pritisak",
    step: "02",
    title: "Kontrola pritiska",
    body:
      "Merenje na samom pištolju. Zadata vrednost, stvarna vrednost i odstupanje, uz evidenciju sati rada i vremena lakiranja.",
    parts: ["adam X", "adam X pro"],
  },
  {
    id: "cup",
    step: "03",
    title: "Mešanje i cup sistem",
    body:
      "Čaša se spaja direktno na pištolj preko QCC priključka, bez adaptera. Liner sistem ili višenamenska čaša, u zavisnosti od toga da li se materijal čuva posle rada.",
    parts: ["QCC", "LCS — the Liner", "RPS"],
  },
  {
    id: "nanosenje",
    step: "04",
    title: "Nanošenje",
    body:
      "Izbor pištolja prema poslu i materijalu: završni sloj, prajmer i punilo, mala površina i spot reparatura, ili velika površina pod pritiskom.",
    parts: ["jet X", "SATAjet X 5500", "SATAjet 100 B", "SATAminijet 4400 B", "jet K"],
  },
  {
    id: "zastita",
    step: "05",
    title: "Zaštita lakirera",
    body:
      "Kapuljače sa dovodom vazduha i polumaske. Kada se zaštita napaja komprimovanim vazduhom, kvalitet vazduha iz prvog koraka postaje pitanje bezbednosti, ne samo kvaliteta filma.",
    parts: ["SATA air vision 5000", "SATA vision 2000", "SATA air star C"],
  },
  {
    id: "odrzavanje",
    step: "06",
    title: "Čišćenje i održavanje",
    body:
      "Pranje pištolja, sušenje između slojeva i procena nijanse pod svetlom sa širokim spektrom. Održavanje je deo procesa, ne posledica kvara.",
    parts: ["SATA multi clean 2", "SATA dry jet 2", "SATA trueSun"],
  },
];

/* -------------------------------------------------------------------------- */
/* 04 — Porodice programa                                                     */
/* -------------------------------------------------------------------------- */

export type SataFamilyGroup = {
  id: string;
  title: string;
  /** Kratko objašnjenje šta grupa rešava. */
  body: string;
  families: {
    name: string;
    /** Namena po zvaničnom SATA opisu, parafrazirano. */
    role: string;
    /** `true` samo za porodicu koju SATA sama ističe kao aktuelnu referencu. */
    highlight?: boolean;
  }[];
};

export const sataFamilyGroups: SataFamilyGroup[] = [
  {
    id: "zavrsni-sloj",
    title: "Završni sloj",
    body: "Bazne boje i lakovi — gravitacioni pištolji za najviši zahtev kontrole atomizacije.",
    families: [
      { name: "jet X", role: "Aktuelna premium referenca za refinish", highlight: true },
      { name: "SATAjet X 5500", role: "Premium X-nozzle porodica, i dalje aktuelna" },
      { name: "SATAjet 5000 B", role: "Prethodna premium generacija" },
      { name: "SATAjet 1000 B", role: "Univerzalni gravitacioni pištolj" },
    ],
  },
  {
    id: "podloga",
    title: "Prajmeri i punila",
    body: "Materijali veće viskoznosti i veće debljine filma traže drugu geometriju mlaza.",
    families: [
      { name: "SATAjet 100 B F", role: "Prajmeri i punila, RP i HVLP verzija" },
      { name: "SATAjet 100 B P", role: "Poliesterska punila i visoke debljine filma" },
      { name: "SATAjet 20 B", role: "Ulazni model programa" },
    ],
  },
  {
    id: "detalj",
    title: "Male površine i spot reparatura",
    body: "Teško dostupna mesta i lokalne popravke, sa manjim mlazom i manjom čašom.",
    families: [
      { name: "SATAminijet 4400 B", role: "Kompaktni pištolj, SR mlaznice za spot reparature" },
      { name: "SATAminijet 1000 K", role: "Mala površina, izvedba pod pritiskom" },
    ],
  },
  {
    id: "velike-povrsine",
    title: "Velike površine",
    body: "Rad pod pritiskom materijala, sa spoljnim rezervoarom umesto čaše.",
    families: [
      { name: "jet K", role: "Nova premium izvedba za velike površine", highlight: true },
      { name: "SATAjet 1000 K", role: "Univerzalna izvedba pod pritiskom" },
      { name: "SATAjet 3000 K", role: "Premium izvedba za velike površine" },
      { name: "SATAjet H", role: "Sifonska izvedba" },
    ],
  },
  {
    id: "cup",
    title: "Cup sistemi",
    body: "Spoj čaše i pištolja bez adaptera, sa izborom između linera i višenamenske čaše.",
    families: [
      { name: "LCS — the Liner", role: "Liner sistem, 0,40 / 0,65 / 0,85 l" },
      { name: "RPS", role: "Mešanje, lakiranje, dopunjavanje i čuvanje u istoj čaši" },
      { name: "QCC", role: "Zajednički priključak čaše i pištolja" },
    ],
  },
  {
    id: "vazduh-oprema",
    title: "Vazduh, zaštita i održavanje",
    body: "Infrastruktura oko pištolja — bez nje se podešavanje ne ponavlja.",
    families: [
      { name: "SATA filter 500 series", role: "Trostepena priprema komprimovanog vazduha", highlight: true },
      { name: "adam X pro", role: "Digitalno merenje pritiska i evidencija rada" },
      { name: "SATA air vision 5000", role: "Respiratorna zaštita sa dovodom vazduha" },
      { name: "SATA multi clean 2", role: "Mašina za pranje pištolja" },
      { name: "SATA trueSun", role: "Svetlo za procenu nijanse" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* 05 — Istaknuta tehnologija                                                 */
/* -------------------------------------------------------------------------- */

export type SataSpecRow = { label: string; value: string };

export type SataTechColumn = {
  id: string;
  name: string;
  /** Kako SATA sama pozicionira porodicu. */
  standing: string;
  lead: string;
  features: string[];
  specs: SataSpecRow[];
  /** Tačna konfiguracija na koju se `specs` odnose. Obavezno. */
  specScope: string;
};

/**
 * Dve kolone, ne jedna. Poenta sekcije je razlika između aktuelne reference i
 * aktuelne, ali starije premium porodice — a upravo je ta razlika bila pogrešno
 * prikazana u prethodnom stanju sajta.
 */
export const sataTechColumns: SataTechColumn[] = [
  {
    id: "jet-x",
    name: "jet X",
    standing: "Aktuelna referenca",
    lead:
      "Labirintni tok vazduha vodi vazduh kroz mlaznicu tako da izlazi bez turbulencije i pulsiranja. Rezultat koji SATA navodi je finija i ujednačenija atomizacija.",
    features: [
      "Mlaz I (Control) za kontrolu ili O (Speed) za brzinu nanošenja",
      "RP i HVLP tehnologija, mlaznice 1,1 / 1,2 / 1,3 / 1,4 mm",
      "Varijante BASIC, DIGITAL i DIGITAL pro",
      "Priključak vazduha sa obrtnim zglobom i novim mikrometrom",
      "Štitnik okidača se skida bez alata, sa integrisanim ključem za diznu",
    ],
    specs: [
      { label: "Potrošnja vazduha", value: "330 l/min" },
      { label: "Ulazni pritisak", value: "0,5 – 2,4 bar" },
      { label: "Preporučeno dinamički", value: "2 bar" },
      { label: "Rastojanje", value: "17 – 21 cm" },
    ],
    specScope: "jet X RP 1.2 I (Control) DIGITAL · art. 1200386",
  },
  {
    id: "x-5500",
    name: "SATAjet X 5500",
    standing: "I dalje aktuelna porodica",
    lead:
      "X-nozzle sistem sa izborom I ili O mlaznice u obe tehnologije. Whisper mlaznice imaju optimizovanu geometriju toka koja, prema SATA, primetno smanjuje nivo buke.",
    features: [
      "Izbor I ili O mlaznice, u RP i u HVLP izvedbi",
      "Whisper mlaznice za niži nivo buke",
      "QCC priključak za brzu i čistu zamenu čaše",
      "Opciona digitalna kontrola pritiska",
      "Varijante PHASER i Custom Design Gun su tehnički ista porodica",
    ],
    specs: [
      { label: "Potrošnja vazduha", value: "290 l/min" },
      { label: "Ulazni pritisak", value: "0,5 – 2,4 bar" },
      { label: "Preporučeno dinamički", value: "2 bar" },
      { label: "Čaša u isporuci", value: "RPS 0,6 l i 0,9 l" },
    ],
    specScope: "SATAjet X5500 RP 1.3 I RPS · art. 1061564",
  },
];

/** Objašnjenje oznaka mlaza. Ovo je jedina stvar koju kupac stvarno bira. */
export const sataNozzleLetters: {
  letter: string;
  name: string;
  body: string;
}[] = [
  {
    letter: "I",
    name: "Kontrola",
    body:
      "Izduženi mlaz sa minimalnom suvom zonom i suvljim centrom. Manja brzina nanošenja, veća kontrola nad procesom.",
  },
  {
    letter: "O",
    name: "Brzina",
    body:
      "Ovalni mlaz sa širom suvom zonom i vlažnim jezgrom. Veća brzina nanošenja, nešto manja kontrola.",
  },
];

/* -------------------------------------------------------------------------- */
/* 06 — Izbor rešenja                                                         */
/* -------------------------------------------------------------------------- */

export type SataSelectorRow = {
  id: string;
  /** Posao koji radionica stvarno radi. */
  task: string;
  /** Oblast SATA programa koja taj posao pokriva. */
  area: string;
  /** Zvanične porodice. */
  families: string[];
  /** Šta se bira unutar te oblasti. */
  decision: string;
};

export const sataSelectorRows: SataSelectorRow[] = [
  {
    id: "bazna-lak",
    task: "Bazna boja i bezbojni lak",
    area: "Završni sloj",
    families: ["jet X", "SATAjet X 5500"],
    decision: "Tehnologija RP ili HVLP, mlaz I ili O, veličina mlaznice",
  },
  {
    id: "prajmer",
    task: "Prajmer, punilo, sealer",
    area: "Podloga",
    families: ["SATAjet 100 B F", "SATAjet 100 B P"],
    decision: "Verzija F za prajmere i punila, verzija P za poliestersko punilo",
  },
  {
    id: "spot",
    task: "Spot reparatura i teško dostupna mesta",
    area: "Detalj",
    families: ["SATAminijet 4400 B"],
    decision: "SR mlaznica i veličina čaše",
  },
  {
    id: "velika-povrsina",
    task: "Velika površina i kontinuirani rad",
    area: "Pod pritiskom",
    families: ["jet K", "SATAjet 1000 K"],
    decision: "Rezervoar pod pritiskom, dužina creva, visina mlaza",
  },
  {
    id: "caša",
    task: "Mešanje i čuvanje materijala",
    area: "Cup sistem",
    families: ["LCS — the Liner", "RPS"],
    decision: "Liner ili višenamenska čaša, zapremina, gustina cediljke",
  },
  {
    id: "vazduh-izbor",
    task: "Vodorazredivi materijali i respiratorna zaštita",
    area: "Priprema vazduha",
    families: ["SATA filter 500 series"],
    decision: "Broj stepeni filtracije — trostepeno je uslov, ne opcija",
  },
];

/* -------------------------------------------------------------------------- */
/* 07 — Servis                                                                */
/* -------------------------------------------------------------------------- */

export type SataServiceItem = {
  id: string;
  title: string;
  body: string;
  /** Spoljni zvanični link, ili `undefined` kada se rešava kroz upit. */
  href?: string;
  linkLabel?: string;
};

export const sataServices: SataServiceItem[] = [
  {
    id: "delovi",
    title: "Rezervni delovi po modelu",
    body:
      "SATA vodi zvanični pretraživač rezervnih delova: bira se kategorija, zatim model, pa gotov set ili pojedinačni deo.",
    href: SATA_OFFICIAL.sparePartsFinder,
    linkLabel: "Zvanični SATA pretraživač delova",
  },
  {
    id: "garancija",
    title: "Produžena garancija",
    body:
      "SATA Premium Warranty produžava garanciju na tri godine uz registraciju proizvoda. Uslov je da se proizvod preda sklopljen i u originalnom stanju, sa sertifikatom i dokazom o kupovini.",
    href: SATA_OFFICIAL.premiumWarranty,
    linkLabel: "Uslovi na sata.com",
  },
  {
    id: "izbor",
    title: "Izbor konfiguracije",
    body:
      "Tehnologija, mlaz, veličina mlaznice i cup sistem zavise od materijala koji radite i od vazduha koji imate. Ako niste sigurni šta Vam treba, pošaljite upit sa opisom posla.",
  },
];

/* -------------------------------------------------------------------------- */
/* Navigacija sekcija                                                         */
/* -------------------------------------------------------------------------- */

export const sataSections = [
  { id: "zasto", label: "Zašto SATA" },
  { id: "sistem", label: "Radni sistem" },
  { id: "program", label: "Program" },
  { id: "tehnologija", label: "Tehnologija" },
  { id: "izbor", label: "Izbor" },
  { id: "servis", label: "Servis" },
  { id: "kod-nas", label: "Kod nas" },
] as const;

/* -------------------------------------------------------------------------- */
/* SEO                                                                        */
/* -------------------------------------------------------------------------- */

export const sataSeo = {
  title: "SATA — oprema za nanošenje, cup sistemi i priprema vazduha",
  description:
    "SATA program u pregledu Carsystem i R-M: pištolji jet X i SATAjet X 5500, prajmer i detail pištolji, LCS i RPS cup sistemi, trostepena priprema vazduha i digitalno merenje pritiska. Dostupnost se proverava kroz upit.",
  path: "/brendovi/sata",
  imageAlt: "SATA program opreme za lakirnicu u pregledu Carsystem i R-M",
} as const;
