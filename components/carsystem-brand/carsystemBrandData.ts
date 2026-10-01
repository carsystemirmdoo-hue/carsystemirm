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
  eyebrow: "Professional refinish system",
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
  slogan: "It’s all about a good system.",
} as const;

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
    label: "javnih Carsystem zapisa",
    detail: "Povezano sa postojećim katalogom",
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
    label: "zastupljene programske celine",
    detail: "Prema proizvodima u katalogu",
  },
  {
    id: "support",
    value: "01",
    label: "lokalni kontakt za podršku",
    detail: "Carsystem i R-M DOO, Inđija",
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
        icon: "/icons/categories/abrazivi.svg",
        href: carsystemCatalogHref({ program: "abrazivi" }),
      },
      {
        label: "Kitovi",
        icon: "/icons/categories/kitovi.svg",
        href: carsystemCatalogHref({ query: "git" }),
      },
      {
        label: "Priprema površine",
        icon: "/icons/categories/pribor.svg",
        href: carsystemCatalogHref({ program: "priprema-povrsine" }),
      },
      {
        label: "Maskiranje",
        icon: "/icons/categories/maskiranje.svg",
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
        icon: "/icons/categories/maskiranje.svg",
        href: carsystemCatalogHref({ query: "maskir" }),
      },
      {
        label: "Lepkovi i zaptivanje",
        icon: "/icons/categories/lepkovi.svg",
        href: carsystemCatalogHref({ query: "lepljenje" }),
      },
      {
        label: "Lakirerski pribor",
        icon: "/icons/categories/pribor.svg",
        href: carsystemCatalogHref({ program: "potrosni-materijal" }),
      },
      {
        label: "Zaštita radnika",
        icon: "/icons/categories/zastita.svg",
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
        icon: "/icons/categories/poliranje.svg",
        href: carsystemCatalogHref({ program: "poliranje" }),
      },
      {
        label: "Poliranje",
        icon: "/icons/categories/poliranje.svg",
        href: carsystemCatalogHref({ query: "polir" }),
      },
      {
        label: "Čišćenje",
        icon: "/icons/categories/ciscenje.svg",
        href: carsystemCatalogHref({ query: "čišćenje" }),
      },
      {
        label: "Lična zaštita",
        icon: "/icons/categories/zastita.svg",
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
    title: "Finish sistem",
    description:
      "Fino matiranje i korekcija površine pripremaju lak za ujednačen završni sjaj.",
    productSlugs: [
      "carsystem-finish-serija",
      "carsystem-f23-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "poliranje" }),
    ctaLabel: "Otvorite Finish program",
    layout: "wide",
  },
] as const;

export const carsystemUseCases = [
  {
    id: "new-part",
    label: "Pripremam novi deo",
    title: "Stabilna osnova pre prvog sloja",
    description:
      "Izbor granulacije i kontrolisana priprema usklađuju površinu sa materijalom koji sledi.",
    categories: ["Abrazivi", "Priprema površine", "Zaštita"],
    productSlugs: [
      "carsystem-f23-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
      "carsystem-zastitno-odelo",
    ],
    href: carsystemCatalogHref({ phase: "priprema" }),
  },
  {
    id: "dent",
    label: "Popravljam udubljenje",
    title: "Ravnanje, brušenje, kontrola",
    description:
      "Git i odgovarajući abraziv vode od popunjavanja neravnine do stabilne površine.",
    categories: ["Kitovi", "Abrazivi", "Priprema površine"],
    productSlugs: [
      "carsystem-git-multi-green",
      "carsystem-git-elastic-weiss",
      "carsystem-p19-brusni-diskovi",
      "carsystem-f23-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "priprema-povrsine" }),
  },
  {
    id: "mask",
    label: "Maskiram vozilo",
    title: "Čiste granice i zaštićena radna zona",
    description:
      "Potrošni materijal i zaštita pomažu da zona popravke ostane precizno definisana.",
    categories: ["Maskiranje", "Potrošni materijal", "Zaštita"],
    productSlugs: [
      "carsystem-zastitno-odelo",
      "carsystem-f19-brusni-diskovi",
      "carsystem-p19-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "potrosni-materijal" }),
  },
  {
    id: "single-panel",
    label: "Lakiram pojedinačni element",
    title: "Kompaktan proces bez preskakanja pripreme",
    description:
      "Priprema ivice, maskiranje i zaštita povezuju malu popravku sa kontrolisanom aplikacijom.",
    categories: ["Priprema", "Maskiranje", "Zaštita"],
    productSlugs: [
      "carsystem-f19-brusni-diskovi",
      "carsystem-zastitno-odelo",
      "carsystem-f23-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ phase: "priprema" }),
  },
  {
    id: "full-paint",
    label: "Radim kompletno lakiranje",
    title: "Uredna priprema za veliku radnu zonu",
    description:
      "Kod većih površina ritam brušenja, maskiranja i zaštite mora ostati dosledan kroz ceo posao.",
    categories: ["Abrazivi", "Maskiranje", "Zaštita"],
    productSlugs: [
      "carsystem-p19-brusni-diskovi",
      "carsystem-zastitno-odelo",
      "carsystem-f19-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "potrosni-materijal" }),
  },
  {
    id: "paint-defects",
    label: "Uklanjam greške u laku",
    title: "Kontrolisana korekcija bez grubih prelaza",
    description:
      "Fina granulacija i završna obrada vode od lokalne nepravilnosti do ujednačene površine.",
    categories: ["Fina obrada", "Abrazivi", "Poliranje"],
    productSlugs: [
      "carsystem-finish-serija",
      "carsystem-f23-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "poliranje" }),
  },
  {
    id: "polish",
    label: "Poliram vozilo",
    title: "Od fine korekcije do završnog sjaja",
    description:
      "Završna serija i polirni program prate stanje laka i željeni nivo korekcije.",
    categories: ["Fina obrada", "Poliranje", "Čišćenje"],
    productSlugs: [
      "carsystem-finish-serija",
      "carsystem-f23-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
    ],
    href: carsystemCatalogHref({ program: "poliranje" }),
  },
  {
    id: "workshop",
    label: "Opremljam radionicu",
    title: "Potrošni program koji prati dnevni ritam",
    description:
      "Zaštita, maskiranje i potvrđene abrazivne serije čine praktičnu osnovu radnog mesta.",
    categories: ["Zaštita", "Maskiranje", "Abrazivi"],
    productSlugs: [
      "carsystem-zastitno-odelo",
      "carsystem-p19-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
      "carsystem-f23-brusni-diskovi",
    ],
    href: carsystemCatalogHref(),
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
] as const;

/**
 * Realna kategorijska širina Carsystem asortimana (10 kategorija, prema
 * zvaničnoj carsystem.org taksonomiji) — informativni prikaz obima programa,
 * ne filter vezan za lokalno uvezenih 9 SKU. Svaka kategorija vodi na opšti
 * filtrirani katalog dok ne postoje potvrđeni lokalni zapisi po kategoriji.
 */
export const carsystemRangeCategories = [
  "Brušenje",
  "Kitovanje",
  "Maskiranje",
  "Lakiranje",
  "Završna obrada",
  "Lepljenje i premazi",
  "Čišćenje",
  "Zaštita na radu",
  "Pribor za lakiranje",
  "Promotivni materijal",
] as const;

export const carsystemProductFilters = [
  {
    id: "all",
    label: "Sve",
    productSlugs: carsystemProductOrder,
  },
  {
    id: "preparation",
    label: "Priprema",
    productSlugs: [
      "carsystem-f23-brusni-diskovi",
      "carsystem-p19-brusni-diskovi",
      "carsystem-f19-brusni-diskovi",
      "carsystem-p23-brusni-diskovi",
    ],
  },
  {
    id: "repair",
    label: "Reparacija",
    productSlugs: [
      "carsystem-git-multi-green",
      "carsystem-git-elastic-weiss",
      "carsystem-soft-plus-git",
    ],
  },
  {
    id: "painting",
    label: "Lakiranje",
    productSlugs: [
      "carsystem-zastitno-odelo",
      "carsystem-f19-brusni-diskovi",
    ],
  },
  {
    id: "finish",
    label: "Završna obrada",
    productSlugs: [
      "carsystem-finish-serija",
      "carsystem-f23-brusni-diskovi",
    ],
  },
  {
    id: "protection",
    label: "Zaštita",
    productSlugs: ["carsystem-zastitno-odelo"],
  },
] as const;

export const carsystemDocumentation = {
  title: "Tehnički podaci kada su Vam potrebni",
  description:
    "Dokumentacija je vezana za konkretan proizvod. Dostupni fajlovi otvaraju se direktno, a ostali se proveravaju kroz tehnički upit.",
  resources: [
    {
      id: "catalog",
      label: "Javni katalog",
      description: "Carsystem proizvodi i postojeći lokalni zapisi.",
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
      label: "Sigurnosni listovi",
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
      description: "Video materijali za Carsystem program još nisu objavljeni.",
      status: "U pripremi",
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
  title: "Finiš sistem koji sam sebe fino podešava",
  description:
    "Polish X-Serie: Compound X1500 kombinuje grubo i fino poliranje u jednom prolazu, Polish X8000 uklanja holograme i zatvara sjaj.",
  steps: [
    {
      id: "compound-x1500",
      index: "01",
      label: "Cut & Refine",
      title: "Compound X1500",
      description:
        "Vrlo visok cut u prvih 10 sekundi; nakon oko 15 sekundi poliranja zrno se usitni i ostavlja miran, sjajan trag — i na tamnim lakovima.",
      pads: ["Polishing Pad HC X1500", "Polishing Pad MC X1500"],
    },
    {
      id: "polish-x8000",
      index: "02",
      label: "Finish",
      title: "Polish X8000",
      description:
        "Mikroskopski sitno zrno uklanja holograme i fine ogrebotine, bez silikona — poslednji korak pre isporuke vozila.",
      pads: ["Polishing Pad AH X8000"],
    },
  ],
  accessory: {
    title: "Microfiber X300 Duo",
    description:
      "Dvobojne mikrofiber krpe razdvajaju grubu i finu poliru u istom radnom procesu.",
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
    "Povežite pripremu, reparaciju, lakiranje i završnu obradu kroz Carsystem program dostupan kod Carsystem i R-M DOO.",
  primaryCta: {
    href: carsystemCatalogHref(),
    label: "Pogledajte Carsystem katalog",
  },
  secondaryCta: {
    href: "/kontakt?tema=proizvod&brend=carsystem",
    label: "Kontaktirajte nas",
  },
} as const;
