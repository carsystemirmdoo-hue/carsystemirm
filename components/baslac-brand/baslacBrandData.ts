export type BaslacMediaId =
  | "repair-rhythm"
  | "line-45-system"
  | "clearcoat-range"
  | "primer-process"
  | "color-workflow"
  | "commercial-vehicles";

export type BaslacMediaDefinition = {
  id: BaslacMediaId;
  section: string;
  desktopSrc: string;
  mobileSrc?: string;
  width: number;
  height: number;
  mobileWidth?: number;
  mobileHeight?: number;
  alt: string;
  priority: "highest" | "high" | "medium";
};

export type BaslacMediaAvailability = Record<
  BaslacMediaId,
  {
    desktop: boolean;
    mobile: boolean;
  }
>;

export type BaslacCampaignSlideId = "20-years" | "surventis";

export type BaslacCampaignSlide = {
  id: BaslacCampaignSlideId;
  /**
   * `artwork` je providni foreground sloj iznad kontrolisane tamne povrsine.
   * `photo` je full-bleed fotografija sa gradijentom samo radi citljivosti.
   */
  visual: "artwork" | "photo";
  desktopImage: string;
  /** Art-directed kadar; koristi se preko `<source media>`, ne preko cover crop-a. */
  mobileImage: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  mobileImageWidth: number;
  mobileImageHeight: number;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  controlLabel: string;
  /** Statička paleta tranzicije, ručno definisana po kampanji. */
  transitionFrom: string;
  transitionTo: string;
  progressColor: string;
  controlTheme: "on-dark" | "on-light";
};

/**
 * Sezonski slajd se ne upisuje ovde, nego se izvodi iz centralne konfiguracije
 * (`lib/seasonal/seasonalCampaigns.config.mjs`) — vidi `baslacSeasonal.ts`.
 * Bez odobrenog vizuala (`image: null`) slajd nosi samo CSS dekoraciju.
 */
export type BaslacSeasonalSlide = {
  id: `seasonal-${string}`;
  visual: "seasonal";
  season: "winter" | "spring";
  image: {
    desktopSrc: string;
    mobileSrc: string;
    width: number;
    height: number;
    mobileWidth: number;
    mobileHeight: number;
  } | null;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  controlLabel: string;
  transitionFrom: string;
  transitionTo: string;
  progressColor: string;
  controlTheme: "on-dark";
};

export type BaslacHeroSlide = BaslacCampaignSlide | BaslacSeasonalSlide;

export type BaslacSectionNavItem = {
  href: string;
  label: string;
  sectionId: string;
};

export type BaslacRepairProcess = {
  id: "standard" | "fast" | "wet-on-wet" | "ambient";
  title: string;
  shortTitle: string;
  description: string;
  stages: string[];
  productGroups: string[];
};

export type BaslacProcessStep = {
  id: string;
  index: string;
  title: string;
  description: string;
  productGroups: string[];
  query: string;
};

export type BaslacClearcoat = {
  code: string;
  name: string;
  role: string;
  process: string;
  metric: string;
};

export function baslacCatalogHref({
  phase,
  query,
}: {
  phase?: string;
  query?: string;
} = {}) {
  const params = new URLSearchParams({ brend: "Baslac" });

  if (phase) params.set("faza", phase);
  if (query) params.set("q", query);

  return `/katalog?${params.toString()}`;
}

export const baslacMedia: Record<BaslacMediaId, BaslacMediaDefinition> = {
  "repair-rhythm": {
    id: "repair-rhythm",
    section: "Glavni proces",
    desktopSrc:
      "/images/brands/baslac/process/baslac-repair-rhythm-desktop.webp",
    mobileSrc:
      "/images/brands/baslac/process/baslac-repair-rhythm-mobile.webp",
    width: 2000,
    height: 1250,
    mobileWidth: 1066,
    mobileHeight: 1333,
    alt: "Lakirer u zaštitnom odelu nanosi materijal pištoljem na maskiran popravljeni deo vozila u kabini",
    priority: "highest",
  },
  "line-45-system": {
    id: "line-45-system",
    section: "45 Line sistem",
    desktopSrc:
      "/images/brands/baslac/systems/baslac-45-line-system.webp",
    width: 2800,
    height: 2100,
    alt: "Ambalaža baslac 45 Line: 45-W00 Basecoat Converter Water 5 L, 45-W1010 White 1 L, 45-W1020 White blue flip 0,5 L i 45-W1390 Red Shining 0,1 L",
    priority: "high",
  },
  "clearcoat-range": {
    id: "clearcoat-range",
    section: "Bezbojni lakovi",
    desktopSrc:
      "/images/brands/baslac/clearcoats/baslac-clearcoat-range.webp",
    mobileSrc:
      "/images/brands/baslac/clearcoats/baslac-clearcoat-range-mobile.webp",
    width: 3600,
    height: 1350,
    mobileWidth: 1600,
    mobileHeight: 1520,
    alt: "Baslac bezbojni lakovi 40-10, 40-440, 40-450 i 40-620 u pakovanju od 1 L i 40-510 u pakovanju od 2 L",
    priority: "medium",
  },
  "primer-process": {
    id: "primer-process",
    section: "Prajmeri i punioci",
    desktopSrc:
      "/images/brands/baslac/primers/baslac-primer-process.webp",
    width: 1400,
    height: 1050,
    alt: "Priprema podloge i nanošenje Baslac primer-filler sistema",
    priority: "medium",
  },
  "color-workflow": {
    id: "color-workflow",
    section: "Digitalna koloristika",
    desktopSrc:
      "/images/brands/baslac/color/baslac-color-workflow.webp",
    width: 2400,
    height: 1350,
    alt: "Spektrofotometar e-finder star na crvenoj metalik površini vozila, sa potvrđenim merenjem na ekranu",
    priority: "medium",
  },
  "commercial-vehicles": {
    id: "commercial-vehicles",
    section: "Komercijalna vozila",
    desktopSrc:
      "/images/brands/baslac/commercial/baslac-commercial-vehicles.webp",
    width: 2400,
    height: 1575,
    alt: "Zvanični baslac render dostavnog kamiona sa sandukom, obojenog u svetloplavu",
    priority: "medium",
  },
};

const BASLAC_CAMPAIGN_DIR = "/images/brands/baslac/campaign";

export const baslacCampaignSlides: BaslacCampaignSlide[] = [
  {
    id: "20-years",
    visual: "artwork",
    desktopImage: `${BASLAC_CAMPAIGN_DIR}/baslac-20-years-artwork.webp`,
    mobileImage: `${BASLAC_CAMPAIGN_DIR}/baslac-20-years-artwork.webp`,
    imageAlt:
      "Jubilarni Baslac vizual: broj 20 sastavljen od ilustracija i kantica Baslac boje",
    imageWidth: 798,
    imageHeight: 871,
    mobileImageWidth: 798,
    mobileImageHeight: 871,
    eyebrow: "BASLAC · 20 GODINA",
    title: "20 godina pametnog reparaturnog lakiranja.",
    description:
      "Dve decenije boje koja daje rezultate, vrednosti koja ima smisla i partnerstva koje traje. A ovo je tek početak.",
    primaryCta: {
      href: baslacCatalogHref(),
      label: "Pogledajte Baslac proizvode",
    },
    controlLabel: "20 godina",
    transitionFrom: "#04090c",
    transitionTo: "#1d7fb0",
    progressColor: "#29a3dc",
    controlTheme: "on-dark",
  },
  {
    id: "surventis",
    visual: "photo",
    desktopImage: `${BASLAC_CAMPAIGN_DIR}/baslac-surventis-desktop.webp`,
    mobileImage: `${BASLAC_CAMPAIGN_DIR}/baslac-surventis-mobile.webp`,
    imageAlt:
      "Surventis zastave na jarbolima ispred vedrog neba",
    imageWidth: 3440,
    imageHeight: 1440,
    mobileImageWidth: 1800,
    mobileImageHeight: 1440,
    eyebrow: "NOVO POGLAVLJE",
    title: "Sledeći korak jednostavno ima smisla.",
    description:
      "Baslac ulazi u novo poglavlje sa istim praktičnim pristupom i podrškom kompanije Surventis, ostajući pouzdan izbor za ekonomična rešenja u reparaturnom lakiranju.",
    primaryCta: {
      href: "#overview",
      label: "Upoznajte Baslac",
    },
    controlLabel: "Novo poglavlje",
    transitionFrom: "#0d2436",
    transitionTo: "#4f8fc0",
    progressColor: "#7bb7e0",
    controlTheme: "on-dark",
  },
];

export const baslacSectionNavItems: BaslacSectionNavItem[] = [
  { label: "Pregled", href: "#overview", sectionId: "overview" },
  {
    label: "Sistemi boja",
    href: "#color-systems",
    sectionId: "color-systems",
  },
  {
    label: "Proces popravke",
    href: "#repair-rhythm",
    sectionId: "repair-rhythm",
  },
  {
    label: "Bezbojni lakovi",
    href: "#clearcoats",
    sectionId: "clearcoats",
  },
  { label: "Prajmeri", href: "#primers", sectionId: "primers" },
  {
    label: "Sive nijanse",
    href: "#grey-shade",
    sectionId: "grey-shade",
  },
  {
    label: "Koloristika",
    href: "#koloristika",
    sectionId: "koloristika",
  },
  {
    label: "Komercijalna vozila",
    href: "#commercial",
    sectionId: "commercial",
  },
  { label: "Svi proizvodi", href: "#products", sectionId: "products" },
];

export const baslacRepairProcesses: BaslacRepairProcess[] = [
  {
    id: "standard",
    title: "Standardna popravka",
    shortTitle: "Standardna",
    description:
      "Povezan proces pripreme, podloge, bazne boje i univerzalnog bezbojnog laka za svakodnevni rad.",
    stages: ["Priprema", "Primer-filler", "35 ili 45 Line", "Universal clear"],
    productGroups: ["20- serija", "35 / 45 Line", "40-40 / 440 / 450"],
  },
  {
    id: "fast",
    title: "Brza popravka",
    shortTitle: "Brza",
    description:
      "Kraći radni tok kombinuje odgovarajuću pripremu, bazu i high-speed završni sistem prema TDS procesu.",
    stages: ["Priprema", "Brza podloga", "Bazna boja", "40-100"],
    productGroups: ["20-35 / 95", "35 / 45 Line", "40-100", "50-415 / 420 / 430"],
  },
  {
    id: "wet-on-wet",
    title: "Wet-on-wet proces",
    shortTitle: "Wet-on-wet",
    description:
      "Proces bez međubrušenja koristi odgovarajući surfacer, propisani flash-off i povezani sistem boje i laka.",
    stages: ["Priprema", "20-35 / 95", "Flash-off prema TDS", "Boja i lak"],
    productGroups: ["20-35 / 95", "35 / 45 Line", "40- clearcoat"],
  },
  {
    id: "ambient",
    title: "Ambient / air-dry proces",
    shortTitle: "Ambient",
    description:
      "Završni sistem je usmeren na očvršćavanje pri sobnoj temperaturi, uz izbor hardenera prema površini i uslovima.",
    stages: ["Priprema", "Bazna boja", "40-510", "Ambient sušenje"],
    productGroups: ["35 / 45 Line", "40-510", "50-510 / 530"],
  },
];

export const baslacProcessSteps: BaslacProcessStep[] = [
  {
    id: "clean",
    index: "01",
    title: "Čišćenje",
    description:
      "Kontrolisana priprema metala, stare završne obrade ili plastike pre sledećeg koraka.",
    productGroups: ["70-10", "70-20", "70-45"],
    query: "70-",
  },
  {
    id: "putty",
    index: "02",
    title: "Kit",
    description:
      "Ispravljanje standardnih neravnina univerzalnim bodyfiller sistemom.",
    productGroups: ["11-40", "12-20", "56-20"],
    query: "12-20",
  },
  {
    id: "corrosion",
    index: "03",
    title: "Antikorozija",
    description:
      "Washprimer ili epoxy zaštita bira se prema podlozi i zahtevima procesa.",
    productGroups: ["25-30 epoxy", "27-10 washprimer"],
    query: "25-30",
  },
  {
    id: "filler",
    index: "04",
    title: "Prajmer i punilac",
    description:
      "Sanding i wet-on-wet opcije za stabilnu, ujednačenu podlogu pre boje.",
    productGroups: ["20-24/34/94", "20-35/95", "21-10/11/20"],
    query: "20-",
  },
  {
    id: "color",
    index: "05",
    title: "Boja",
    description:
      "Vodeni 45 Line, solventni 35 Line ili 30 Line direct-gloss, prema vrsti posla.",
    productGroups: ["45 Line", "35 Line", "30 Line"],
    query: "35-",
  },
  {
    id: "clear",
    index: "06",
    title: "Bezbojni lak",
    description:
      "Panel, univerzalni, high-speed, ambient ili mat sistem bira se prema procesu.",
    productGroups: ["40-100", "40-510", "40-620"],
    query: "40-",
  },
  {
    id: "dry",
    index: "07",
    title: "Sušenje",
    description:
      "Brzina hardenera i temperatura procesa usklađuju se sa površinom i uslovima rada.",
    productGroups: ["50-415/420/430", "50-510/530"],
    query: "50-",
  },
  {
    id: "finish",
    index: "08",
    title: "Finalna obrada",
    description:
      "Kontrola očvršćavanja, eventualno poliranje i proverena završna površina.",
    productGroups: ["65-10 blend", "TDS proces"],
    query: "65-10",
  },
];

export const baslacClearcoats: BaslacClearcoat[] = [
  {
    code: "40-100",
    name: "High Speed 2K Clear VOC",
    role: "Brzi i low-bake proces",
    process: "Kontrolisan high-speed proces",
    metric: "2:1, bez dodatnog razređivača",
  },
  {
    code: "40-510",
    name: "Ambient Clear VOC",
    role: "Sušenje na sobnoj temperaturi",
    process: "Ambient / air-dry radni tok",
    metric: "50-510 ili 50-530",
  },
  {
    code: "40-440 / 40-450",
    name: "VOC i HS Universal Clear",
    role: "Standardne univerzalne popravke",
    process: "Više brzina hardenera prema uslovima",
    metric: "Fleksibilan radionički sistem",
  },
  {
    code: "40-10",
    name: "2K Panel Clear",
    role: "Male i panel popravke",
    process: "Kompaktan panel proces",
    metric: "Završna obrada prema TDS-u",
  },
  {
    code: "40-620",
    name: "2K Clear Mat VOC",
    role: "Mat i satin završna obrada",
    process: "Meša se sa 40-440 ili 40-450",
    metric: "Kontrolisan nivo sjaja",
  },
];

export const baslacSystemLines = [
  {
    id: "line-45",
    code: "45",
    title: "45 Line",
    technology: "Vodeni basecoat",
    description:
      "Vodena linija za solid, metallic, pearl i effect nijanse, uz pripadajući reducer, blend i aktivirani proces.",
    tags: ["vodeni sistem", "solid", "metallic", "pearl"],
  },
  {
    id: "line-35",
    code: "35",
    title: "35 Line",
    technology: "Solventni basecoat",
    description:
      "Pregledan solventni sistem za standardne refinish popravke i povezani clearcoat proces.",
    tags: ["solventni sistem", "basecoat", "standardni proces"],
  },
  {
    id: "line-30",
    code: "30",
    title: "30 Line",
    technology: "2K direct gloss",
    description:
      "Pigmentirani high-solids topcoat sa direktnim sjajem, bez obaveznog posebnog bezbojnog laka.",
    tags: ["2K", "direct gloss", "high solids"],
  },
  {
    id: "line-30-cv",
    code: "CV",
    title: "30 Line CV",
    technology: "Komercijalna vozila",
    description:
      "Direct-gloss sistem za kamione, autobuse, prikolice i druge velike transportne površine.",
    tags: ["velike površine", "51- hardeneri", "81-30"],
  },
] as const;
