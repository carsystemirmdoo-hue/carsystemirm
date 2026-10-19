export type CarsystemMediaId =
  | "hero-preparation"
  | "hero-painting"
  | "hero-finishing"
  | "process-preparation"
  | "process-application"
  | "process-finish"
  | "workflow-damage"
  | "workflow-prepared"
  | "workflow-painted"
  | "workflow-finished";

export type CarsystemMediaDefinition = {
  id: CarsystemMediaId;
  desktopSrc: string;
  mobileSrc?: string;
  width: number;
  height: number;
  mobileWidth?: number;
  mobileHeight?: number;
  alt: string;
  variant: "prepare" | "apply" | "finish" | "damage";
};

export type CarsystemMediaAvailability = Record<
  CarsystemMediaId,
  {
    desktop: boolean;
    mobile: boolean;
  }
>;

export type CarsystemCatalogHrefOptions = {
  phase?: string;
  program?: string;
  query?: string;
};

export function carsystemCatalogHref({
  phase,
  program,
  query,
}: CarsystemCatalogHrefOptions = {}) {
  const params = new URLSearchParams({ brend: "carsystem" });

  if (phase) params.set("faza", phase);
  if (program) params.set("program", program);
  if (query) params.set("q", query);

  return `/katalog?${params.toString()}`;
}

export const carsystemSeo = {
  title: "Carsystem proizvodi i sistem za autolakirnice",
  description:
    "Carsystem povezuje abrazive, kitove, maskiranje, zaštitu i završnu obradu u profesionalan proces za karoserijske i lakirerske radionice.",
  path: "/brendovi/carsystem",
  imageAlt: "Carsystem program za kompletan radni proces u autolakirnici",
} as const;

export const carsystemMedia: Record<
  CarsystemMediaId,
  CarsystemMediaDefinition
> = {
  "hero-preparation": {
    id: "hero-preparation",
    desktopSrc:
      "/images/brands/carsystem/hero/carsystem-hero-preparation.webp",
    mobileSrc:
      "/images/brands/carsystem/hero/carsystem-hero-preparation-mobile.webp",
    width: 1800,
    height: 1200,
    mobileWidth: 900,
    mobileHeight: 1125,
    alt: "Profesionalna priprema i brušenje karoserijskog panela u radionici",
    variant: "prepare",
  },
  "hero-painting": {
    id: "hero-painting",
    desktopSrc:
      "/images/brands/carsystem/hero/carsystem-hero-painting.webp",
    mobileSrc:
      "/images/brands/carsystem/hero/carsystem-hero-painting-mobile.webp",
    width: 1800,
    height: 1200,
    mobileWidth: 900,
    mobileHeight: 1125,
    alt: "Maskiranje i kontrolisano lakiranje u profesionalnoj kabini",
    variant: "apply",
  },
  "hero-finishing": {
    id: "hero-finishing",
    desktopSrc:
      "/images/brands/carsystem/hero/carsystem-hero-finishing.webp",
    mobileSrc:
      "/images/brands/carsystem/hero/carsystem-hero-finishing-mobile.webp",
    width: 1800,
    height: 1200,
    mobileWidth: 900,
    mobileHeight: 1125,
    alt: "Poliranje i kontrola završnog sjaja lakirane površine",
    variant: "finish",
  },
  "process-preparation": {
    id: "process-preparation",
    desktopSrc:
      "/images/brands/carsystem/process/carsystem-process-preparation.webp",
    width: 1600,
    height: 1050,
    alt: "Brušenje, kitovanje i priprema površine pre lakiranja",
    variant: "prepare",
  },
  "process-application": {
    id: "process-application",
    desktopSrc:
      "/images/brands/carsystem/process/carsystem-process-application.webp",
    width: 1600,
    height: 1050,
    alt: "Maskiranje, nanošenje i prateća oprema u lakirnici",
    variant: "apply",
  },
  "process-finish": {
    id: "process-finish",
    desktopSrc:
      "/images/brands/carsystem/process/carsystem-process-finish.webp",
    width: 1600,
    height: 1050,
    alt: "Završna obrada, poliranje, čišćenje i zaštita",
    variant: "finish",
  },
  "workflow-damage": {
    id: "workflow-damage",
    desktopSrc:
      "/images/brands/carsystem/workflow/carsystem-workflow-damage.webp",
    width: 1200,
    height: 900,
    alt: "Oštećen karoserijski panel pre početka popravke",
    variant: "damage",
  },
  "workflow-prepared": {
    id: "workflow-prepared",
    desktopSrc:
      "/images/brands/carsystem/workflow/carsystem-workflow-prepared.webp",
    width: 1200,
    height: 900,
    alt: "Karoserijski panel posle pripreme i ravnanja",
    variant: "prepare",
  },
  "workflow-painted": {
    id: "workflow-painted",
    desktopSrc:
      "/images/brands/carsystem/workflow/carsystem-workflow-painted.webp",
    width: 1200,
    height: 900,
    alt: "Karoserijski panel posle kontrolisanog nanošenja materijala",
    variant: "apply",
  },
  "workflow-finished": {
    id: "workflow-finished",
    desktopSrc:
      "/images/brands/carsystem/workflow/carsystem-workflow-finished.webp",
    width: 1200,
    height: 900,
    alt: "Završen karoserijski panel sa kontrolisanim sjajem",
    variant: "finish",
  },
};

export const carsystemHero = {
  eyebrow: "Profesionalni refinish sistem",
  title: "Ceo proces popravke. Jedan sistem.",
  description:
    "Od prvog brušenja do završnog sjaja, Carsystem povezuje materijale, alate, zaštitu i prateću opremu u jedan profesionalan radni proces.",
  primaryCta: {
    href: "#process",
    label: "Istražite Carsystem program",
  },
  secondaryCta: {
    href: carsystemCatalogHref(),
    label: "Pogledajte Carsystem proizvode",
  },
  slogan: "Sve počinje dobrim sistemom.",
} as const;

/**
 * Stvarni Carsystem proizvodi iz kataloga za mesto slike dok fotografija faze nema
 * potvrđeno pravo upotrebe — umesto crteža. Namerno drugi proizvodi od lista faza,
 * da se isti packshot ne ponavlja na stranici.
 */
export const carsystemMediaProductSlugs: Partial<Record<CarsystemMediaId, string[]>> = {
  "hero-preparation": [
    "carsystem-multi-flow",
    "carsystem-sanding-block-198-2-0",
    "carsystem-2k-filler-vario-plus",
  ],
  "hero-painting": [
    "carsystem-2k-clear-voc-cc-26-eco-x-15-60",
    "carsystem-paint-system-cps-3-0",
    "carsystem-masking-film-green",
  ],
  "hero-finishing": [
    "carsystem-compound-x1500-hc",
    "carsystem-polish-x8000-ah",
    "carsystem-polishing-pad-x8000",
  ],
};
carsystemMediaProductSlugs["process-preparation"] = carsystemMediaProductSlugs["hero-preparation"];
carsystemMediaProductSlugs["process-application"] = carsystemMediaProductSlugs["hero-painting"];
carsystemMediaProductSlugs["process-finish"] = carsystemMediaProductSlugs["hero-finishing"];

export type CarsystemMediaProducts = Partial<
  Record<CarsystemMediaId, Array<{ src: string; alt: string; name: string }>>
>;

export const carsystemHeroSlides = [
  {
    id: "preparation",
    index: "01",
    label: "Priprema i brušenje",
    detail: "Stabilna površina pre svakog narednog koraka.",
    mediaId: "hero-preparation" as const,
  },
  {
    id: "painting",
    index: "02",
    label: "Maskiranje i lakiranje",
    detail: "Kontrolisana zona rada, nanošenje i zaštita.",
    mediaId: "hero-painting" as const,
  },
  {
    id: "finishing",
    index: "03",
    label: "Poliranje i završetak",
    detail: "Fina korekcija, čistoća i provera rezultata.",
    mediaId: "hero-finishing" as const,
  },
] as const;

export const carsystemSectionNavItems = [
  { label: "Pregled", href: "#overview", sectionId: "overview" },
  { label: "Proces", href: "#process", sectionId: "process" },
  { label: "Sistemi", href: "#systems", sectionId: "systems" },
  { label: "Prema poslu", href: "#use-cases", sectionId: "use-cases" },
  { label: "Proizvodi", href: "#products", sectionId: "products" },
  { label: "RUPES", href: "#rupes", sectionId: "rupes" },
  {
    label: "Dokumentacija",
    href: "#documentation",
    sectionId: "documentation",
  },
] as const;

export const carsystemMetrics = [
  {
    id: "catalog",
    value: "catalog-count",
    label: "Carsystem proizvoda u katalogu",
    detail: "Svaki sa stranicom i upitom",
  },
  {
    id: "phases",
    value: "03",
    label: "povezane radne faze",
    detail: "Od pripreme do završne kontrole",
  },
  {
    id: "programs",
    value: "program-count",
    label: "programa u katalogu",
    detail: "Prema proizvodima u katalogu",
  },
  {
    id: "support",
    value: "01",
    label: "lokalni kontakt za podršku",
    detail: "Carsystem i R-M, Inđija",
  },
] as const;

export type CarsystemProcessPhase = {
  id: "preparation" | "application" | "finish";
  index: string;
  title: string;
  shortTitle: string;
  description: string;
  mediaId: CarsystemMediaId;
  productSlugs: string[];
  categories: Array<{
    label: string;
    icon: string;
    href: string;
  }>;
  cta: {
    href: string;
    label: string;
  };
};

export const carsystemProcessPhases: CarsystemProcessPhase[] = [
  {
    id: "preparation",
    index: "01",
    title: "Priprema",
    shortTitle: "Priprema",
    description:
      "Brušenje, ravnanje i zaštita površine postavljaju tačnu osnovu za svaki naredni sloj.",
    mediaId: "process-preparation",
    productSlugs: [
      "carsystem-f23-brusni-diskovi",
      "carsystem-git-multi-green",
      "carsystem-f19-brusni-diskovi",
    ],
    categories: [
      {
        label: "Abrazivi",
        icon: "/icons/categories/sistem-a-2026-10/abrazivi.svg",
        href: carsystemCatalogHref({ program: "abrazivi" }),
      },
      {
        label: "Kitovi",
        icon: "/icons/categories/sistem-a-2026-10/kitovi.svg",
        href: carsystemCatalogHref({ query: "git" }),
      },
      {
        label: "Priprema površine",
        icon: "/icons/categories/sistem-a-2026-10/pribor.svg",
        href: carsystemCatalogHref({ program: "priprema-povrsine" }),
      },
      {
        label: "Maskiranje",
        icon: "/icons/categories/sistem-a-2026-10/maskiranje.svg",
        href: carsystemCatalogHref({ query: "maskir" }),
      },
    ],
    cta: {
      href: carsystemCatalogHref({ phase: "priprema" }),
      label: "Otvorite proizvode za pripremu",
    },
  },
  {
    id: "application",
    index: "02",
    title: "Reparacija i nanošenje",
    shortTitle: "Nanošenje",
    description:
      "Maskiranje, radionički pribor i lična zaštita drže zonu nanošenja urednom i kontrolisanom.",
    mediaId: "process-application",
    productSlugs: [
      "carsystem-zastitno-odelo",
      "carsystem-git-elastic-weiss",
      "carsystem-f19-brusni-diskovi",
    ],
    categories: [
      {
        label: "Maskiranje",
        icon: "/icons/categories/sistem-a-2026-10/maskiranje.svg",
        href: carsystemCatalogHref({ query: "maskir" }),
      },
      {
        label: "Lepkovi i zaptivanje",
        icon: "/icons/categories/sistem-a-2026-10/lepkovi.svg",
        href: carsystemCatalogHref({ query: "lepljenje" }),
      },
      {
        label: "Lakirerski pribor",
        icon: "/icons/categories/sistem-a-2026-10/pribor.svg",
        href: carsystemCatalogHref({ program: "potrosni-materijal" }),
      },
      {
        label: "Zaštita radnika",
        icon: "/icons/categories/sistem-a-2026-10/zastita.svg",
        href: carsystemCatalogHref({ query: "zaštit" }),
      },
    ],
    cta: {
      href: carsystemCatalogHref({ program: "potrosni-materijal" }),
      label: "Otvorite prateći program",
    },
  },
  {
    id: "finish",
    index: "03",
    title: "Završetak i zaštita",
    shortTitle: "Završetak",
    description:
      "Fino matiranje, korekcija, čišćenje i zaštita zatvaraju proces bez preskakanja završne kontrole.",
    mediaId: "process-finish",
    productSlugs: [
      "carsystem-finish-serija",
      "carsystem-f23-brusni-diskovi",
      "carsystem-zastitno-odelo",
    ],
    categories: [
      {
        label: "Završna obrada",
        icon: "/icons/categories/sistem-a-2026-10/poliranje.svg",
        href: carsystemCatalogHref({ program: "poliranje" }),
      },
      {
        label: "Poliranje",
        icon: "/icons/categories/sistem-a-2026-10/poliranje.svg",
        href: carsystemCatalogHref({ query: "polir" }),
      },
      {
        label: "Čišćenje",
        icon: "/icons/categories/sistem-a-2026-10/ciscenje.svg",
        href: carsystemCatalogHref({ query: "čišćenje" }),
      },
      {
        label: "Lična zaštita",
        icon: "/icons/categories/sistem-a-2026-10/zastita.svg",
        href: carsystemCatalogHref({ query: "zaštit" }),
      },
    ],
    cta: {
      href: carsystemCatalogHref({ program: "poliranje" }),
      label: "Otvorite završnu obradu",
    },
  },
];

export const carsystemWorkflow = {
  title: "Kada svaki korak radi sa sledećim",
  description:
    "Dobar rezultat ne zavisi samo od završnog laka. Počinje pravilnim brušenjem, nastavlja se preciznom pripremom i završava kontrolisanom završnom obradom. Carsystem razvija proizvode koji funkcionišu kao povezan radni sistem.",
  stages: [
    {
      index: "01",
      title: "Oštećenje",
      description: "Procena podloge i obima popravke.",
      mediaId: "workflow-damage" as const,
    },
    {
      index: "02",
      title: "Priprema",
      description: "Ravnanje, brušenje i stabilna površina.",
      mediaId: "workflow-prepared" as const,
    },
    {
      index: "03",
      title: "Nanošenje",
      description: "Čista radna zona i kontrolisan proces.",
      mediaId: "workflow-painted" as const,
    },
    {
      index: "04",
      title: "Završni sjaj",
      description: "Fina korekcija i provera rezultata.",
      mediaId: "workflow-finished" as const,
    },
  ],
} as const;

export const carsystemFamilies = [
  {
    id: "f23",
    eyebrow: "Keramički abraziv",
    title: "F.23 Ceramic",
    description:
      "Filmski disk sa keramičkim sadržajem za kontrolisano brušenje od grube do fine obrade.",
    productSlugs: ["carsystem-f23-brusni-diskovi"],
    href: "/proizvodi/carsystem-f23-brusni-diskovi",
    ctaLabel: "Otvorite F.23 Ceramic",
    layout: "featured",
  },
  {
    id: "multi-green",
    eyebrow: "Priprema i ravnanje",
    title: "Multi Green",
    description:
      "Višenamenski git za popunjavanje i stvaranje stabilne osnove pre brušenja.",
    productSlugs: ["carsystem-git-multi-green"],
    href: "/proizvodi/carsystem-git-multi-green",
    ctaLabel: "Pogledajte Multi Green",
    layout: "medium",
  },
  {
    id: "series-19",
    eyebrow: "Abrazivni program",
    title: "19 serija",
    description:
      "P19 i F19 povezuju grubu i međufaznu obradu.",
    productSlugs: [
      "carsystem-p19-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "abrazivi", query: "19" }),
    ctaLabel: "Uporedite 19 seriju",
    layout: "medium",
  },
  {
    id: "finish",
    eyebrow: "Fina obrada",
    title: "Sistem za završnu obradu",
    description:
      "Fino matiranje i korekcija površine pripremaju lak za ujednačen završni sjaj.",
    // Samo Finish serija: F.23 disk je već kartica 01 i proizvod u procesu.
    productSlugs: ["carsystem-finish-serija"],
    href: carsystemCatalogHref({ program: "poliranje" }),
    ctaLabel: "Otvorite program za završnu obradu",
    layout: "wide",
  },
] as const;

/*
 * „Šta danas radite u radionici?“ (2026-10-19): po tri proizvoda za svaki
 * zadatak, izabrana po nameni, fazi i podlozi iz zvaničnih carsystem.org
 * stranica i kataloga 2026/27 (pregled sa izvorima:
 * docs/carsystem/prema-poslu-2026-10-19.md). `steps` su koraci zadatka redom
 * kartica. `confirmedSystem` je true samo kada izvor proizvođača izričito
 * imenuje ostale proizvode iz trojke; inače su kartice reprezentativni
 * proizvodi za korake, ne potvrđen kompatibilan sistem.
 */
export const carsystemUseCases = [
  {
    id: "new-part",
    label: "Pripremam novi deo",
    title: "Čist, otprašen deo pod prvim punilom",
    description:
      "Novi metalni deo sa fabričkim prajmerom: odmašćivanje, otprašivanje i punilo mokro-na-mokro bez brušenja prajmera.",
    steps: ["Odmašćivanje", "Otprašivanje", "Punilo"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-silicone-remover-mild",
      "carsystem-staub-stop-super-wave",
      "carsystem-af-21-x-pert",
    ],
    href: carsystemCatalogHref({ phase: "podloga" }),
  },
  {
    id: "dent",
    label: "Popravljam udubljenje",
    title: "Kit, brušenje i kontrola površine",
    description:
      "Udubljenje se popunjava kitom, brusi od grube ka finoj granulaciji i proverava kontrolnim prahom pre punila.",
    steps: ["Kitovanje", "Brušenje kita", "Kontrola brušenja"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-git-multi-green",
      "carsystem-f23-brusni-diskovi",
      "carsystem-dry-coat-2-0",
    ],
    href: carsystemCatalogHref({ program: "priprema-povrsine" }),
  },
  {
    id: "mask",
    label: "Maskiram vozilo",
    title: "Čiste granice i zaštićena radna zona",
    description:
      "Folija pokriva vozilo, traka drži ivice maske, a sunđerasta traka zatvara procepe vrata i haube.",
    steps: ["Pokrivanje folijom", "Traka za ivice", "Zatvaranje procepa"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-masking-film-green",
      "carsystem-master-tape-green",
      "carsystem-foam-tape-t-soft",
    ],
    href: carsystemCatalogHref({ program: "potrosni-materijal" }),
  },
  {
    id: "single-panel",
    label: "Lakiram pojedinačni element",
    title: "Mala popravka, isti redosled",
    description:
      "Matiranje i odmašćivanje elementa i prelazne zone, otprašivanje baze i brzi bezbojni lak za mali i srednji posao.",
    steps: ["Matiranje i odmašćivanje", "Otprašivanje baze", "Bezbojni lak"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-prep-scuff",
      "carsystem-staub-stop-water",
      "carsystem-cc-21-x-press-five",
    ],
    href: carsystemCatalogHref({ phase: "lak" }),
  },
  {
    id: "full-paint",
    label: "Radim kompletno lakiranje",
    title: "Ujednačena priprema velike površine",
    description:
      "Mašinsko matiranje velikih površina, zaštita točkova i bezbojni lak namenjen i lakiranju celog vozila.",
    steps: ["Matiranje", "Maskiranje točkova", "Bezbojni lak"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-sanding-fleece-v-19-disc",
      "carsystem-wheel-cover",
      "carsystem-cc-20-x-pert",
    ],
    href: carsystemCatalogHref({ phase: "lak" }),
  },
  {
    id: "paint-defects",
    label: "Uklanjam greške u laku",
    title: "Lokalna korekcija bez grubih prelaza",
    description:
      "Uključak ili curenje se lokalno skida, mesto se mokro izravnava finom granulacijom, a tragovi brušenja uklanjaju pastom.",
    steps: ["Skidanje greške", "Mokro izravnavanje", "Abrazivna pasta"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-proflex-pluto",
      "carsystem-proflex-jupiter-soft-h2o-77-mm",
      "carsystem-compound-x1500-hc",
    ],
    href: carsystemCatalogHref({ program: "poliranje" }),
  },
  {
    id: "polish",
    label: "Poliram vozilo",
    title: "Od abrazivne paste do završnog sjaja",
    description:
      "Abrazivna pasta sa jastučićem koji proizvođač za nju preporučuje, zatim završni korak protiv holograma na tamnim bojama.",
    steps: ["Abrazivna pasta", "Polirni jastučić", "Završna pasta"],
    confirmedSystem: true,
    productSlugs: [
      "carsystem-polish-c-07-cut",
      "carsystem-polish-foam-yellow",
      "carsystem-polish-c-30-finish",
    ],
    href: carsystemCatalogHref({ program: "poliranje" }),
  },
  {
    id: "workshop",
    label: "Opremam radionicu",
    title: "Oprema koja prati ceo tok rada",
    description:
      "Stalak za papir za maskiranje, držač delova za kitovanje, lakiranje i poliranje, i čaše za tačno mešanje materijala.",
    steps: ["Maskiranje", "Držanje delova", "Mešanje"],
    confirmedSystem: false,
    productSlugs: [
      "carsystem-paper-trolley",
      "carsystem-multi-stand",
      "carsystem-multi-mix-cup",
    ],
    href: carsystemCatalogHref({ program: "oprema" }),
  },
] as const;

export const carsystemProductOrder = [
  "carsystem-f23-brusni-diskovi",
  "carsystem-git-multi-green",
  "carsystem-git-elastic-weiss",
  "carsystem-soft-plus-git",
  "carsystem-p19-brusni-diskovi",
  "carsystem-f19-brusni-diskovi",
  "carsystem-p23-brusni-diskovi",
  "carsystem-finish-serija",
  "carsystem-zastitno-odelo",
  // Dopuna do dva puna reda (ranije 6 kartica u mreži od 4 = dva prazna siva polja).
  "carsystem-uv-led-lamp",
  "carsystem-master-tape-green",
] as const;

/**
 * Filteri proizvoda (2026-10-19): deset grupa iz reda „Carsystem asortiman
 * pokriva“ su sada sami filteri. Svaka je vezana za ZVANIČNU kategoriju sa
 * carsystem.org (`officialCategory` u data/carsystem-catalog-products.generated.json),
 * pa uključuje sve artikle te kategorije, ne ručno izabran podskup. Raniji drugi
 * red (Sve / Priprema / Reparacija / Lakiranje / Završna obrada / Zaštita) je
 * uklonjen jer je duplirao ovu kontrolu.
 */
export const carsystemRangeFilters = [
  { id: "brusenje", label: "Brušenje", officialCategory: "Abrasives" },
  { id: "kitovanje", label: "Kitovanje", officialCategory: "Putties" },
  { id: "maskiranje", label: "Maskiranje", officialCategory: "Masking" },
  { id: "lakiranje", label: "Lakiranje", officialCategory: "Painting" },
  { id: "zavrsna-obrada", label: "Završna obrada", officialCategory: "Finish" },
  { id: "lepljenje-i-premazi", label: "Lepljenje i premazi", officialCategory: "Bonding & Sealing" },
  { id: "ciscenje", label: "Čišćenje", officialCategory: "Cleaning" },
  { id: "zastita-na-radu", label: "Zaštita na radu", officialCategory: "Personal Safety" },
  { id: "pribor-za-lakiranje", label: "Pribor za lakiranje", officialCategory: "Painting supplies" },
  { id: "promotivni-materijal", label: "Promotivni materijal", officialCategory: "Merchandising Materials" },
] as const;

export const carsystemDocumentation = {
  title: "Tehnički podaci kada su Vam potrebni",
  description:
    "Dokumentacija je vezana za konkretan proizvod. Dostupni fajlovi otvaraju se direktno, a ostali se proveravaju kroz tehnički upit.",
  resources: [
    {
      id: "catalog",
      label: "Katalog",
      description: "Svi Carsystem proizvodi iz naše ponude.",
      status: "Dostupno",
      href: carsystemCatalogHref(),
    },
    {
      id: "tds",
      label: "Tehnički listovi",
      description: "TDS dokumenti prikazani uz potvrđene proizvode.",
      status: "Dostupno uz proizvod",
      href: "/proizvodi/carsystem-f23-brusni-diskovi",
    },
    {
      id: "sds",
      label: "Bezbednosni listovi",
      description: "Proveravaju se prema tačnom proizvodu i varijanti.",
      status: "Na upit",
      href: "/kontakt?tema=dokument&brend=carsystem&tip=sds",
    },
    {
      id: "instructions",
      label: "Uputstva za primenu",
      description: "Izbor procesa potvrđuje se prema važećem dokumentu.",
      status: "Na upit",
      href: "/kontakt?tema=tehnicka-podrska&brend=carsystem",
    },
    {
      id: "video",
      label: "Video materijali",
      description:
        "Pogledajte zvanične Carsystem video materijale, demonstracije proizvoda i postupke primene.",
      status: "YouTube",
      // Zvanični kanal koji linkuje carsystem.org (odluka vlasnika, GAP-010).
      href: "https://www.youtube.com/carsystem_refinish",
      external: true,
    },
    {
      id: "team",
      label: "Tehnička podrška",
      description: "Pošaljite podatke o podlozi, fazi rada i proizvodu.",
      status: "Kontakt",
      href: "/kontakt?tema=tehnicka-podrska&brend=carsystem",
    },
  ],
  actions: [
    {
      href: carsystemCatalogHref(),
      label: "Otvorite katalog",
      variant: "primary",
    },
    {
      href: "/proizvodi/carsystem-f23-brusni-diskovi",
      label: "Pronađite dokumentaciju",
      variant: "secondary",
    },
    {
      href: "/kontakt?tema=tehnicka-podrska&brend=carsystem",
      label: "Kontaktirajte naš tim",
      variant: "secondary",
    },
  ],
} as const;

/**
 * Finish system spotlight (Polish X-Serie, official Carsystem source, 2026).
 * Two real steps, not an invented three-stage sequence: Compound X1500 is a
 * self-refining compound (coarse cut in the first ~10s, breaks down finer
 * after ~15s of polishing), and Polish X8000 is the separate final finishing
 * step. See docs/CARSYSTEM_DOCUMENT_SOURCE_MAP.md for the source excerpt.
 */
export const carsystemFinishSystem = {
  title: "Završna obrada koja se sama fino podešava",
  description:
    "Polish X-Serie: Compound X1500 kombinuje grubo i fino poliranje u jednom prolazu, Polish X8000 uklanja holograme i zatvara sjaj.",
  steps: [
    {
      id: "compound-x1500",
      index: "01",
      label: "Korekcija",
      title: "Compound X1500",
      description:
        "Vrlo visok cut u prvih 10 sekundi; nakon oko 15 sekundi poliranja zrno se usitni i ostavlja miran, sjajan trag — i na tamnim lakovima.",
      pads: ["Polishing Pad HC X1500", "Polishing Pad MC X1500"],
    },
    {
      id: "polish-x8000",
      index: "02",
      label: "Završni sjaj",
      title: "Polish X8000",
      description:
        "Mikroskopski sitno zrno uklanja holograme i fine ogrebotine, bez silikona — poslednji korak pre isporuke vozila.",
      pads: ["Polishing Pad AH X8000"],
    },
  ],
  accessory: {
    title: "Microfiber X300 Duo",
    description:
      "Dvobojne mikrofiber krpe razdvajaju grubo i fino poliranje u istom radnom procesu.",
  },
  cta: {
    href: carsystemCatalogHref({ program: "poliranje" }),
    label: "Otvorite Carsystem poliranje",
  },
  documentId: "carsystem-polish-x-serie",
} as const;

/**
 * Multi Changer spotlight (official Carsystem source, 2021/2026).
 * Color change is a process-visibility aid during drying/curing — the source
 * does not claim it proves full cure, and neither does this copy.
 */
export const carsystemMultiChanger = {
  title: "Git koji Vam pokazuje gde je u procesu",
  description:
    "Multi Changer serija menja boju tokom sušenja/očvršćavanja — vizuelni signal toka rada, ne zamena za tehnički list.",
  variants: [
    {
      id: "multi-blue-changer",
      title: "Multi Blue Changer",
      from: "Plava",
      to: "Siva",
      phase: "tokom sušenja",
      productCode: "157.623",
      href: carsystemCatalogHref({ query: "git" }),
    },
    {
      id: "multi-green-changer",
      title: "Multi Green Changer",
      from: "Zelena",
      to: "Žuta",
      phase: "tokom očvršćavanja",
      productCode: "157.622",
      href: "/proizvodi/carsystem-git-multi-green",
    },
  ],
  documentId: "carsystem-multi-changer",
} as const;

export const carsystemFinalCta = {
  title: "Napravite bolji proces, ne samo bolji rezultat",
  description:
    "Povežite pripremu, reparaciju, lakiranje i završnu obradu kroz Carsystem program dostupan kod Carsystem i R-M.",
  primaryCta: {
    href: carsystemCatalogHref(),
    label: "Pogledajte Carsystem katalog",
  },
  secondaryCta: {
    href: "/kontakt?tema=proizvod&brend=carsystem",
    label: "Kontaktirajte nas",
  },
} as const;
