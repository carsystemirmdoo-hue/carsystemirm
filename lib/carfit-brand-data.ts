import {
  getCarsystemProductBySlug,
  getCarsystemProductsByBrandSlug,
  type CarsystemProduct,
  type RefinishPhaseSlug,
} from "@/lib/carsystem-data";

/**
 * Sadržaj Car Fit brend stranice.
 *
 * Pravilo jednog izvora istine: ovde se ne prepisuju nazivi, šifre, slike ni
 * dokumenti proizvoda. Sve što je proizvod referencira se slugom iz centralnog
 * kataloga (`lib/carsystem-data.ts`) i razrešava tek pri renderu, tako da se
 * budući Car Fit artikli uključe automatski čim uđu u centralni katalog.
 */

export const CARFIT_BRAND_SLUG = "carfit";

/** Katalog čita filtere iz query parametara (vidi `CatalogExplorer`). */
export type CarfitCatalogTarget = {
  href: string;
  label: string;
  /** `brand` = filtriran na Car Fit, `program` = šira kategorija kataloga. */
  scope: "brand" | "program";
};

/**
 * Media slot. `src: null` znači da fotografija još nije isporučena — komponenta
 * tada renderuje tehnički modul umesto praznog okvira, bez vidljive oznake
 * placeholdera.
 */
export type CarfitMediaSlot = {
  id: string;
  src: string | null;
  alt: string;
  width: number;
  height: number;
};

/** Pravilo za automatsko preuzimanje budućih artikala iz centralnog kataloga. */
export type CarfitProductMatch = {
  programSlugs?: string[];
  phaseSlugs?: RefinishPhaseSlug[];
};

export type CarfitWorkflowStep = {
  code: string;
  title: string;
  note: string;
};

export type CarfitTask = {
  id: string;
  code: string;
  label: string;
  marker: string;
  lead: string;
  body: string;
  workflow: CarfitWorkflowStep[];
  categoryIds: string[];
  /**
   * Artikli koji se prikazuju prvi, ako postoje u centralnom katalogu.
   * Slugovi koji još nisu objavljeni (npr. `car-fit-prajmer`, koji postoji samo
   * u `legacyProducts`) tiho se preskaču i uključe se sami kada budu objavljeni.
   */
  preferredProductSlugs: string[];
  match?: CarfitProductMatch;
  catalogTarget: CarfitCatalogTarget | null;
  media: CarfitMediaSlot;
};

export type CarfitCategory = {
  id: string;
  code: string;
  name: string;
  note: string;
  preferredProductSlugs: string[];
  match?: CarfitProductMatch;
  catalogTarget: CarfitCatalogTarget | null;
};

export type CarfitFamily = {
  id: string;
  code: string;
  name: string;
  claim: string;
  categoryIds: string[];
  /** Veličina modula u asimetričnoj mreži. */
  span: "hero" | "tall" | "wide" | "unit";
  media: CarfitMediaSlot;
};

export type CarfitNavItem = {
  id: string;
  label: string;
};

function media(
  id: string,
  alt: string,
  width: number,
  height: number,
  src: string | null = null,
): CarfitMediaSlot {
  return { id, src, alt, width, height };
}

const CATALOG_BRAND = `/katalog?brand=${CARFIT_BRAND_SLUG}`;

function brandTarget(programSlug: string, label: string): CarfitCatalogTarget {
  return { href: `${CATALOG_BRAND}&program=${programSlug}`, label, scope: "brand" };
}

function programTarget(programSlug: string, label: string): CarfitCatalogTarget {
  return { href: `/katalog?program=${programSlug}`, label, scope: "program" };
}

export const carfitHero = {
  // Wordmark nosi originalni logo asset u hero-u, pa ga eyebrow ne ponavlja.
  eyebrow: "Profesionalni refinish materijal",
  title: "Sve što svakodnevni posao traži.",
  lead:
    "Od maskiranja i pripreme površine do bezbojnog laka i završnog poliranja — Car Fit donosi praktične proizvode za poslove koji se svakodnevno ponavljaju u radionici.",
  secondary: "Pravi proizvod. Pravi korak. Bez komplikovanja.",
  primaryCta: { href: "#poslovi", label: "Istražite Car Fit program" },
  secondaryCta: { href: "#proizvodi", label: "Pogledajte proizvode" },
  markers: [
    { id: "priprema", label: "Priprema", taskId: "priprema-povrsine" },
    { id: "maskiranje", label: "Maskiranje", taskId: "maskiranje" },
    { id: "reparacija", label: "Reparacija", taskId: "reparacija" },
    { id: "lakiranje", label: "Lakiranje", taskId: "lakiranje" },
    { id: "finish", label: "Finish", taskId: "zavrsna-obrada" },
  ],
  media: media(
    "carfit-hero-workbench",
    "Car Fit materijali pripremljeni na radnom stolu u lakirerskoj radionici",
    2400,
    1600,
  ),
};

export const carfitNav: CarfitNavItem[] = [
  { id: "pregled", label: "Pregled" },
  { id: "kategorije", label: "Kategorije" },
  { id: "poslovi", label: "Poslovi" },
  { id: "program", label: "Program" },
  { id: "proizvodi", label: "Proizvodi" },
  { id: "dokumentacija", label: "Dokumentacija" },
];

export const carfitCategories: CarfitCategory[] = [
  {
    id: "abrazivi",
    code: "01",
    name: "Abrazivi",
    note: "Brusni diskovi i papiri po granulaciji",
    preferredProductSlugs: [],
    match: { programSlugs: ["abrazivi"] },
    catalogTarget: programTarget("priprema-i-abrazivi", "Abrazivi u katalogu"),
  },
  {
    id: "kitovi",
    code: "02",
    name: "Kitovi",
    note: "Poliesterski kitovi za izravnavanje",
    preferredProductSlugs: [],
    match: { programSlugs: ["priprema-povrsine"], phaseSlugs: ["priprema"] },
    catalogTarget: programTarget("priprema-i-abrazivi", "Kitovi u katalogu"),
  },
  {
    id: "fileri-prajmeri",
    code: "03",
    name: "Fileri i prajmeri",
    note: "Podloga, izolacija i prijanjanje",
    preferredProductSlugs: ["car-fit-prajmer"],
    match: { programSlugs: ["priprema-povrsine"], phaseSlugs: ["podloga"] },
    catalogTarget: brandTarget("priprema-i-abrazivi", "Car Fit podloga u katalogu"),
  },
  {
    id: "maskiranje",
    code: "04",
    name: "Maskiranje",
    note: "Folije, trake i zaštita zone",
    preferredProductSlugs: ["carfit-maskirna-folija-4x5m", "carfit-maskirna-folija-4x150m"],
    match: { programSlugs: ["potrosni-materijal"], phaseSlugs: ["priprema"] },
    catalogTarget: brandTarget("potrosni-materijal", "Car Fit maskiranje u katalogu"),
  },
  {
    id: "bezbojni-lakovi",
    code: "05",
    name: "Bezbojni lakovi",
    note: "Završni sloj i zaštita boje",
    preferredProductSlugs: [],
    match: { programSlugs: ["boje-i-lakovi"], phaseSlugs: ["lak"] },
    catalogTarget: programTarget("boje-i-lakovi", "Bezbojni lakovi u katalogu"),
  },
  {
    id: "aerosoli",
    code: "06",
    name: "Aerosoli",
    note: "Sprejevi za lokalne zahvate",
    preferredProductSlugs: [],
    match: { programSlugs: ["aerosoli"] },
    catalogTarget: programTarget("potrosni-materijal", "Aerosoli u katalogu"),
  },
  {
    id: "priprema-ciscenje",
    code: "07",
    name: "Priprema i čišćenje",
    note: "Razređivači i odstranjivači silikona",
    preferredProductSlugs: [],
    catalogTarget: programTarget("priprema-i-abrazivi", "Priprema u katalogu"),
  },
  {
    id: "poliranje",
    code: "08",
    name: "Poliranje",
    note: "Paste, padovi i krpe",
    preferredProductSlugs: [],
    match: { programSlugs: ["poliranje"] },
    catalogTarget: programTarget("poliranje", "Poliranje u katalogu"),
  },
  {
    id: "zastita-lepkovi",
    code: "09",
    name: "Zaštita i lepkovi",
    note: "Zaštitni premazi i lepljenje",
    preferredProductSlugs: [],
    catalogTarget: null,
  },
  {
    id: "pribor",
    code: "10",
    name: "Radionički pribor",
    note: "Pomoćna oprema za radni tok",
    preferredProductSlugs: [],
    catalogTarget: programTarget("potrosni-materijal", "Pribor u katalogu"),
  },
];

export const carfitTasks: CarfitTask[] = [
  {
    id: "priprema-povrsine",
    code: "01",
    label: "Pripremam površinu",
    marker: "PREP",
    lead: "Sve počinje od podloge koja drži.",
    body:
      "Skidanje starog sloja, brušenje po gradaciji i odmašćivanje određuju koliko će ceo zahvat trajati. Ako se ovde preskoči korak, vidi se tek u laku.",
    workflow: [
      { code: "01", title: "Očistite", note: "Odmašćivanje i uklanjanje nečistoća sa zone rada" },
      { code: "02", title: "Brusite", note: "Gradacija od grube ka finijoj, bez preskakanja koraka" },
      { code: "03", title: "Otprašite", note: "Priprema površine pre nanošenja bilo kog materijala" },
    ],
    categoryIds: ["abrazivi", "priprema-ciscenje"],
    preferredProductSlugs: [],
    match: { programSlugs: ["abrazivi"] },
    catalogTarget: programTarget("priprema-i-abrazivi", "Pogledajte abrazive u katalogu"),
    media: media(
      "carfit-task-preparation",
      "Brušenje i priprema površine vozila pre nanošenja materijala",
      1800,
      1200,
    ),
  },
  {
    id: "reparacija",
    code: "02",
    label: "Ispravljam oštećenje",
    marker: "REPAIR",
    lead: "Geometrija se vraća pre nego što se boja i pomisli.",
    body:
      "Udubljenja, ivice i prelazi rešavaju se kitom u tankim slojevima i kontrolisanim brušenjem. Cilj je ravna površina koja ne traži korekciju kasnije.",
    workflow: [
      { code: "01", title: "Nanesite", note: "Kit u tankim slojevima, prema uputstvu proizvođača" },
      { code: "02", title: "Oblikujte", note: "Brušenje do prelaza koji se ne oseća pod rukom" },
      { code: "03", title: "Proverite", note: "Kontrola ravnosti pre prelaska na podlogu" },
    ],
    categoryIds: ["kitovi", "abrazivi"],
    preferredProductSlugs: [],
    match: { programSlugs: ["priprema-povrsine"], phaseSlugs: ["priprema"] },
    catalogTarget: programTarget("priprema-i-abrazivi", "Pogledajte kitove u katalogu"),
    media: media(
      "carfit-task-body-repair",
      "Nanošenje i obrada kita na oštećenom delu karoserije",
      1800,
      1200,
    ),
  },
  {
    id: "maskiranje",
    code: "03",
    label: "Maskiram vozilo",
    marker: "MASK",
    lead: "Čista ivica se definiše pre prvog nanosa.",
    body:
      "Maskiranje odlučuje koliko će posla biti posle lakiranja. Folija štiti površinu, traka definiše ivicu, a dobro pripremljena zona skraćuje završnu obradu.",
    workflow: [
      { code: "01", title: "Zaštitite", note: "Maskirna folija preko svega što ne ide u zonu rada" },
      { code: "02", title: "Definišite ivicu", note: "Traka na prelazu koji mora ostati oštar" },
      { code: "03", title: "Pripremite zonu", note: "Provera prelaza i pristupa pre lakiranja" },
    ],
    categoryIds: ["maskiranje", "pribor"],
    preferredProductSlugs: ["carfit-maskirna-folija-4x5m", "carfit-maskirna-folija-4x150m"],
    match: { programSlugs: ["potrosni-materijal"], phaseSlugs: ["priprema"] },
    catalogTarget: brandTarget("potrosni-materijal", "Pogledajte proizvode za maskiranje"),
    media: media(
      "carfit-task-masking",
      "Maskiranje vrata vozila folijom i trakom pre lakiranja",
      1800,
      1200,
    ),
  },
  {
    id: "podloga",
    code: "04",
    label: "Pripremam za lakiranje",
    marker: "PRIME",
    lead: "Podloga odlučuje kako će boja da legne.",
    body:
      "Prajmer i filer izjednačavaju upijanje, izoluju podlogu i daju baznom sloju stabilan temelj. Bez toga se razlike u podlozi vide kroz završni sloj.",
    workflow: [
      { code: "01", title: "Izolujte", note: "Prajmer prema tipu podloge i tehničkom listu" },
      { code: "02", title: "Izravnajte", note: "Filer za sitne nepravilnosti pre baznog sloja" },
      { code: "03", title: "Matirajte", note: "Fino brušenje podloge pre nanošenja boje" },
    ],
    categoryIds: ["fileri-prajmeri", "abrazivi"],
    preferredProductSlugs: ["car-fit-prajmer"],
    match: { programSlugs: ["priprema-povrsine"], phaseSlugs: ["podloga"] },
    catalogTarget: brandTarget("priprema-i-abrazivi", "Pogledajte Car Fit podlogu"),
    media: media(
      "carfit-task-priming",
      "Nanošenje prajmera na pripremljenu površinu vozila",
      1800,
      1200,
    ),
  },
  {
    id: "lakiranje",
    code: "05",
    label: "Lakiram element",
    marker: "APPLY",
    lead: "Završni sloj je ono što ostaje vidljivo.",
    body:
      "Bezbojni lak zatvara sistem, štiti bazni sloj i nosi sjaj. Izbor laka i razređivača prati temperaturu radionice i veličinu elementa koji se radi.",
    workflow: [
      { code: "01", title: "Pripremite materijal", note: "Odnos mešanja i viskozitet prema uslovima" },
      { code: "02", title: "Nanesite", note: "Kontrolisani slojevi prema tehničkom listu" },
      { code: "03", title: "Sušite", note: "Vreme i temperatura prema debljini sloja" },
    ],
    categoryIds: ["bezbojni-lakovi", "priprema-ciscenje"],
    preferredProductSlugs: [],
    match: { programSlugs: ["boje-i-lakovi"], phaseSlugs: ["lak"] },
    catalogTarget: programTarget("boje-i-lakovi", "Pogledajte bezbojne lakove u katalogu"),
    media: media(
      "carfit-task-painting",
      "Nanošenje bezbojnog laka na element vozila u lakirnici",
      1800,
      1200,
    ),
  },
  {
    id: "spot-repair",
    code: "06",
    label: "Radim spot repair",
    marker: "SPOT",
    lead: "Mali zahvat, kompletan posao.",
    body:
      "Lokalna reparacija traži isti redosled kao i ceo element, samo u manjoj zoni. Prelaz mora da se izgubi, inače se popravka vidi iz svakog ugla.",
    workflow: [
      { code: "01", title: "Ograničite zonu", note: "Priprema i maskiranje uže radne površine" },
      { code: "02", title: "Korigujte", note: "Reparacija oštećenja i priprema podloge" },
      { code: "03", title: "Stopite prelaz", note: "Aerosol ili pištolj, pa lak i završna obrada" },
    ],
    categoryIds: ["aerosoli", "maskiranje", "bezbojni-lakovi"],
    preferredProductSlugs: [],
    match: { programSlugs: ["aerosoli"] },
    catalogTarget: programTarget("potrosni-materijal", "Pogledajte aerosol program u katalogu"),
    media: media(
      "carfit-task-spot-repair",
      "Lokalna reparacija manjeg oštećenja na karoseriji",
      1800,
      1200,
    ),
  },
  {
    id: "zavrsna-obrada",
    code: "07",
    label: "Završavam površinu",
    marker: "FINISH",
    lead: "Poslednji sloj traži najmirniju ruku.",
    body:
      "Uklanjanje sitnih tragova, provera prelaza i priprema za poliranje. U ovoj fazi se ispravlja ono što bi inače ostalo trajno vidljivo.",
    workflow: [
      { code: "01", title: "Pregledajte", note: "Kontrola površine pod odgovarajućim osvetljenjem" },
      { code: "02", title: "Fino obradite", note: "Najfinija gradacija za tragove u laku" },
      { code: "03", title: "Očistite", note: "Priprema površine pre poliranja" },
    ],
    categoryIds: ["abrazivi", "poliranje"],
    preferredProductSlugs: [],
    match: { programSlugs: ["abrazivi"], phaseSlugs: ["poliranje"] },
    catalogTarget: programTarget("priprema-i-abrazivi", "Pogledajte finu obradu u katalogu"),
    media: media(
      "carfit-task-finishing",
      "Fina obrada lakirane površine pre poliranja",
      1800,
      1200,
    ),
  },
  {
    id: "poliranje",
    code: "08",
    label: "Poliram vozilo",
    marker: "POLISH",
    lead: "Poslednjih pet procenata menja ceo rezultat.",
    body:
      "Poliranje je sistem: pasta, pad i krpa rade zajedno. Pogrešna kombinacija ostavlja hologram ili skida više nego što treba.",
    workflow: [
      { code: "01", title: "Korigujte", note: "Pasta i pad prema stanju površine" },
      { code: "02", title: "Ujednačite", note: "Prelaz na finiju kombinaciju za dubinu sjaja" },
      { code: "03", title: "Završite", note: "Krpa i finalna kontrola pod svetlom" },
    ],
    categoryIds: ["poliranje"],
    preferredProductSlugs: [],
    match: { programSlugs: ["poliranje"] },
    catalogTarget: programTarget("poliranje", "Pogledajte program poliranja u katalogu"),
    media: media(
      "carfit-task-polishing",
      "Mašinsko poliranje lakirane površine vozila",
      1800,
      1200,
    ),
  },
];

export const carfitWorkbenchZones = [
  {
    id: "prep",
    code: "01",
    title: "Prep",
    lead: "Priprema površine",
    items: ["Abrazivi", "Odstranjivači silikona", "Maskiranje"],
    categoryIds: ["abrazivi", "priprema-ciscenje", "maskiranje"],
  },
  {
    id: "repair",
    code: "02",
    title: "Repair",
    lead: "Reparacija i podloga",
    items: ["Kitovi", "Fileri i prajmeri", "Zaštitni materijali"],
    categoryIds: ["kitovi", "fileri-prajmeri", "zastita-lepkovi"],
  },
  {
    id: "apply",
    code: "03",
    title: "Apply",
    lead: "Nanošenje materijala",
    items: ["Bezbojni lakovi", "Aerosoli", "Pribor za lakiranje"],
    categoryIds: ["bezbojni-lakovi", "aerosoli", "pribor"],
  },
  {
    id: "finish",
    code: "04",
    title: "Finish",
    lead: "Završna obrada",
    items: ["Paste", "Padovi", "Krpe i pomoćna oprema"],
    categoryIds: ["poliranje", "pribor"],
  },
];

export const carfitFamilies: CarfitFamily[] = [
  {
    id: "abrazivi",
    code: "01",
    name: "Abrazivni program",
    claim:
      "Gradacija koja vodi od grubog zahvata do površine spremne za podlogu, bez preskakanja koraka.",
    categoryIds: ["abrazivi"],
    span: "hero",
    media: media("carfit-abrasives", "Car Fit brusni disk, prikaz abrazivnog programa", 1600, 1600),
  },
  {
    id: "kitovi",
    code: "02",
    name: "Kitovi",
    claim: "Poliesterski kitovi za izravnavanje nepravilnosti pre podloge.",
    categoryIds: ["kitovi"],
    span: "tall",
    media: media("carfit-putties", "Car Fit kit u pakovanju", 1200, 1200),
  },
  {
    id: "maskiranje",
    code: "03",
    name: "Maskiranje",
    claim: "Folije i trake koje definišu zonu rada i čuvaju ivicu.",
    categoryIds: ["maskiranje"],
    span: "unit",
    media: media("carfit-masking", "Car Fit maskirna folija", 1200, 1200),
  },
  {
    id: "bezbojni-lakovi",
    code: "04",
    name: "Bezbojni lakovi",
    claim: "Završni sloj koji nosi sjaj i štiti bazu.",
    categoryIds: ["bezbojni-lakovi"],
    span: "unit",
    media: media("carfit-clearcoat", "Car Fit bezbojni lak u pakovanju", 1200, 1200),
  },
  {
    id: "poliranje",
    code: "05",
    name: "Poliranje",
    claim: "Pasta, pad i krpa kao jedan sistem za završnu korekciju.",
    categoryIds: ["poliranje"],
    span: "wide",
    media: media("carfit-polishing", "Car Fit program za poliranje", 1600, 900),
  },
];

export const carfitAbrasiveStory = {
  eyebrow: "Gradacija",
  title: "Od grubog zahvata do kontrolisane površine.",
  lead:
    "Brušenje nije jedan korak nego niz. Svaka gradacija skida tragove prethodne, a poslednja odlučuje kako će podloga primiti materijal.",
  steps: [
    { code: "P80 – P180", title: "Skidanje", note: "Uklanjanje starog sloja i grubo oblikovanje" },
    { code: "P240 – P400", title: "Oblikovanje", note: "Izravnavanje kita i priprema prelaza" },
    { code: "P500 – P800", title: "Podloga", note: "Priprema pre prajmera i filera" },
    { code: "P1000 – P2000", title: "Finiš", note: "Matiranje i priprema pre poliranja" },
  ],
  note:
    "Prikazane gradacije opisuju uobičajen redosled brušenja u refinish procesu. Tačan raspon zrna zavisi od proizvoda i podloge — proverite tehnički list ili pošaljite upit.",
  media: media("carfit-abrasive-disc", "Brusni disk, detalj abrazivne površine", 1400, 1400),
};

export const carfitMaskingStory = {
  eyebrow: "Maskiranje",
  title: "Čista ivica počinje pre lakiranja.",
  lead:
    "Zona rada se definiše folijom i trakom. Ako je prelaz jasan pre nanošenja materijala, posle laka nema korekcije.",
  callouts: [
    { code: "01", title: "Maskirna folija", note: "Zaštita površina van zone rada" },
    { code: "02", title: "Maskirna traka", note: "Oštra ivica na prelazu" },
    { code: "03", title: "Zaštita zone", note: "Pristup i prelazi pripremljeni pre lakiranja" },
  ],
  media: media("carfit-masking-scene", "Maskirano vozilo pripremljeno za lakiranje", 2000, 1100),
};

export const carfitFinishStory = {
  eyebrow: "Finish",
  title: "Poslednjih pet procenata menja ceo rezultat.",
  lead:
    "Poliranje se ne rešava jednom pastom. Kombinacija paste, pada i krpe određuje da li će površina imati dubinu ili tragove obrade.",
  system: [
    { code: "01", title: "Pasta", note: "Korekcija prema stanju laka" },
    { code: "02", title: "Pad", note: "Tvrdoća prilagođena koraku poliranja" },
    { code: "03", title: "Krpa", note: "Uklanjanje ostatka bez novih tragova" },
    { code: "04", title: "Kontrola", note: "Provera površine pod usmerenim svetlom" },
  ],
  media: media("carfit-finish-scene", "Poliranje završnog sloja laka na vozilu", 2000, 1100),
};

export const carfitStory = {
  eyebrow: "Brend",
  title: "Napravljeno da prati stvaran rad.",
  body:
    "Radionica ne traži komplikovaniju policu. Traži proizvod koji je jasan, dostupan i odgovara poslu koji je pred njom. Car Fit program razvijen je upravo oko takvih svakodnevnih potreba profesionalne reparacije.",
  meta: "C.A.R.FIT · brand of August Handel GmbH",
  tag: "REBEL FLAIR",
};

export const carfitDocumentation = {
  eyebrow: "Dokumentacija",
  title: "Informacija koja Vam treba, bez traženja po kutiji.",
  lead:
    "Tehnički i bezbednosni podaci vezani su za stranicu proizvoda. Ako dokument nije objavljen online, tim Carsystem i R-M ga dostavlja na upit.",
  items: [
    { code: "01", title: "Tehnički list", note: "Odnos mešanja, nanošenje i sušenje" },
    { code: "02", title: "Bezbednosni list", note: "Rukovanje, skladištenje i zaštita" },
    { code: "03", title: "Uputstvo za primenu", note: "Redosled koraka u radionici" },
    { code: "04", title: "Tehnička podrška", note: "Direktan kontakt sa našim timom" },
  ],
};

export const carfitFinalCta = {
  title: "Posao je jednostavniji kada je pravi proizvod pri ruci.",
  body:
    "Istražite Car Fit program dostupan kroz Carsystem i R-M i pronađite materijale za sledeći posao u radionici.",
  primaryCta: { href: CATALOG_BRAND, label: "Pogledajte Car Fit proizvode" },
  secondaryCta: { href: `/kontakt?tema=proizvod&brand=${CARFIT_BRAND_SLUG}`, label: "Kontaktirajte nas" },
};

export const carfitProductFilters = [
  { id: "sve", label: "Sve", phaseSlugs: null },
  { id: "priprema", label: "Priprema", phaseSlugs: ["priprema"] as RefinishPhaseSlug[] },
  { id: "podloga", label: "Podloga", phaseSlugs: ["podloga"] as RefinishPhaseSlug[] },
  { id: "lakiranje", label: "Lakiranje", phaseSlugs: ["boja", "lak"] as RefinishPhaseSlug[] },
  { id: "finish", label: "Finish", phaseSlugs: ["poliranje"] as RefinishPhaseSlug[] },
];

/** Svi Car Fit artikli koji trenutno postoje u centralnom katalogu. */
export function getCarfitProducts() {
  return getCarsystemProductsByBrandSlug(CARFIT_BRAND_SLUG);
}

function matchesProduct(product: CarsystemProduct, match: CarfitProductMatch | undefined) {
  if (!match) return false;
  if (match.programSlugs && !match.programSlugs.includes(product.programSlug)) return false;
  if (match.phaseSlugs && !match.phaseSlugs.includes(product.phaseSlug)) return false;
  return true;
}

/**
 * Razrešava artikle za task/kategoriju: prvo kurirani slugovi koji stvarno
 * postoje, zatim svi Car Fit artikli koji odgovaraju pravilu — tako budući
 * import automatski popunjava stranicu.
 */
export function resolveCarfitProducts(
  { preferredProductSlugs, match }: { preferredProductSlugs: string[]; match?: CarfitProductMatch },
  limit = 5,
) {
  const resolved: CarsystemProduct[] = [];
  const seen = new Set<string>();

  for (const slug of preferredProductSlugs) {
    const product = getCarsystemProductBySlug(slug);
    if (!product || product.brandSlug !== CARFIT_BRAND_SLUG || seen.has(product.slug)) continue;
    seen.add(product.slug);
    resolved.push(product);
  }

  for (const product of getCarfitProducts()) {
    if (seen.has(product.slug) || !matchesProduct(product, match)) continue;
    seen.add(product.slug);
    resolved.push(product);
  }

  return resolved.slice(0, limit);
}

export function getCarfitCategoryById(id: string) {
  return carfitCategories.find((category) => category.id === id);
}
