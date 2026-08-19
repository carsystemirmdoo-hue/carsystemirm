export type BaslacMediaId =
  | "hero-system"
  | "hero-45-line"
  | "hero-color-tools"
  | "hero-fast-process"
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

export type BaslacHeroSlide = {
  id: "system" | "line-45" | "color" | "fast-process";
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  mediaId: BaslacMediaId;
  controlLabel: string;
};

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
  const params = new URLSearchParams({ brend: "baslac" });

  if (phase) params.set("faza", phase);
  if (query) params.set("q", query);

  return `/katalog?${params.toString()}`;
}

export const baslacMedia: Record<BaslacMediaId, BaslacMediaDefinition> = {
  "hero-system": {
    id: "hero-system",
    section: "Hero 1",
    desktopSrc:
      "/images/brands/baslac/banners/baslac-system-desktop.webp",
    mobileSrc: "/images/brands/baslac/banners/baslac-system-mobile.webp",
    width: 1600,
    height: 1080,
    mobileWidth: 900,
    mobileHeight: 1080,
    alt: "Organizovan prikaz kompletnog baslac sistema proizvoda",
    priority: "high",
  },
  "hero-45-line": {
    id: "hero-45-line",
    section: "Hero 2",
    desktopSrc:
      "/images/brands/baslac/banners/baslac-45-line-desktop.webp",
    mobileSrc: "/images/brands/baslac/banners/baslac-45-line-mobile.webp",
    width: 1600,
    height: 1080,
    mobileWidth: 900,
    mobileHeight: 1080,
    alt: "45 Line vodeni sistem boja u profesionalnoj primeni",
    priority: "high",
  },
  "hero-color-tools": {
    id: "hero-color-tools",
    section: "Hero 3",
    desktopSrc:
      "/images/brands/baslac/banners/baslac-color-tools-desktop.webp",
    mobileSrc:
      "/images/brands/baslac/banners/baslac-color-tools-mobile.webp",
    width: 1600,
    height: 1080,
    mobileWidth: 900,
    mobileHeight: 1080,
    alt: "Digitalni baslac koloristički alati i workflow mešanja",
    priority: "high",
  },
  "hero-fast-process": {
    id: "hero-fast-process",
    section: "Hero 4",
    desktopSrc:
      "/images/brands/baslac/banners/baslac-fast-process-desktop.webp",
    mobileSrc:
      "/images/brands/baslac/banners/baslac-fast-process-mobile.webp",
    width: 1600,
    height: 1080,
    mobileWidth: 900,
    mobileHeight: 1080,
    alt: "Kontrolisan profesionalni proces sušenja u radionici",
    priority: "high",
  },
  "repair-rhythm": {
    id: "repair-rhythm",
    section: "Glavni proces",
    desktopSrc:
      "/images/brands/baslac/process/baslac-repair-rhythm-desktop.webp",
    mobileSrc:
      "/images/brands/baslac/process/baslac-repair-rhythm-mobile.webp",
    width: 1600,
    height: 1000,
    mobileWidth: 900,
    mobileHeight: 1125,
    alt: "Povezane faze profesionalne refinish popravke u radionici",
    priority: "highest",
  },
  "line-45-system": {
    id: "line-45-system",
    section: "45 Line sistem",
    desktopSrc:
      "/images/brands/baslac/systems/baslac-45-line-system.webp",
    width: 1400,
    height: 1050,
    alt: "45 Line mixing sistem i aplikacija vodene bazne boje",
    priority: "high",
  },
  "clearcoat-range": {
    id: "clearcoat-range",
    section: "Bezbojni lakovi",
    desktopSrc:
      "/images/brands/baslac/clearcoats/baslac-clearcoat-range.webp",
    width: 1600,
    height: 1000,
    alt: "Grupa baslac bezbojnih lakova organizovana prema procesu",
    priority: "medium",
  },
  "primer-process": {
    id: "primer-process",
    section: "Prajmeri i punioci",
    desktopSrc:
      "/images/brands/baslac/primers/baslac-primer-process.webp",
    width: 1400,
    height: 1050,
    alt: "Priprema podloge i nanošenje baslac primer-filler sistema",
    priority: "medium",
  },
  "color-workflow": {
    id: "color-workflow",
    section: "Digitalna koloristika",
    desktopSrc:
      "/images/brands/baslac/color/baslac-color-workflow.webp",
    width: 1600,
    height: 900,
    alt: "e-finder, formula, vaga i mixing radna stanica",
    priority: "medium",
  },
  "commercial-vehicles": {
    id: "commercial-vehicles",
    section: "Komercijalna vozila",
    desktopSrc:
      "/images/brands/baslac/commercial/baslac-commercial-vehicles.webp",
    width: 1600,
    height: 1050,
    alt: "Komercijalno vozilo u profesionalnoj lakirnici",
    priority: "medium",
  },
};

export const baslacHeroSlides: BaslacHeroSlide[] = [
  {
    id: "system",
    eyebrow: "baslac kompletan program",
    title: "Od pripreme podloge do završnog sjaja.",
    description:
      "Povezan sistem kitova, prajmera, boja, lakova i pomoćnih proizvoda za profesionalne refinish popravke.",
    primaryCta: {
      href: baslacCatalogHref(),
      label: "Svi baslac proizvodi",
    },
    secondaryCta: {
      href: "#repair-process",
      label: "Pogledajte kompletan proces",
    },
    mediaId: "hero-system",
    controlLabel: "Kompletan program",
  },
  {
    id: "line-45",
    eyebrow: "Vodeni sistem boja",
    title: "45 Line. Precizna nijansa u savremenom vodenom sistemu.",
    description:
      "Solid, metallic i pearl basecoat uz povezanu koloristiku, blendovanje i odgovarajući clearcoat proces.",
    primaryCta: {
      href: "#line-45",
      label: "Pogledajte 45 Line",
    },
    secondaryCta: {
      href: "/kontakt?tema=podrska&brend=baslac&oblast=nijansa",
      label: "Pronađite nijansu",
    },
    mediaId: "hero-45-line",
    controlLabel: "45 Line",
  },
  {
    id: "color",
    eyebrow: "Digital Color Management",
    title: "Od očitavanja nijanse do spremne formule.",
    description:
      "e-finder star, Formula Finder i Refinity povezuju merenje, formulu i pripremu boje.",
    primaryCta: {
      href: "#koloristika",
      label: "Istražite koloristiku",
    },
    secondaryCta: {
      href: "/kontakt?tema=podrska&brend=baslac&oblast=nijansa",
      label: "Zatražite pomoć za nijansu",
    },
    mediaId: "hero-color-tools",
    controlLabel: "Koloristika",
  },
  {
    id: "fast-process",
    eyebrow: "Brži protok kroz radionicu",
    title: "Izaberite sistem prema ritmu popravke.",
    description:
      "Standardni, brzi, wet-on-wet i ambient proces povezuju različite faze i grupe proizvoda.",
    primaryCta: {
      href: "#repair-rhythm",
      label: "Uporedite procese",
    },
    secondaryCta: {
      href: "#clearcoats",
      label: "Pogledajte bezbojne lakove",
    },
    mediaId: "hero-fast-process",
    controlLabel: "Ritam popravke",
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
