import type {
  RefinishPhaseSlug,
  RmCategorySlug,
  RmSeriesSlug,
  RmSystemSlug,
} from "@/lib/carsystem-data";

export type RmCampaignVisual =
  | "agilis-performance"
  | "agilis-color"
  | "refinity"
  | "esense";

export type RmCampaignSlideData = {
  /**
   * Statička paleta tranzicije. Definiše se ručno po kampanji — slike se ne
   * uzorkuju dinamički u browseru.
   */
  transitionFrom: string;
  transitionTo: string;
  progressColor: string;
  controlTheme: "on-dark" | "on-light";
  contentAlign: "left" | "right";
  desktopImage: string;
  id: string;
  imageAlt: string;
  imagePositionDesktop: string;
  imagePositionMobile: string;
  imageScaleDesktop?: number;
  imageScaleMobile?: number;
  mobileImage: string;
  eyebrow: string;
  overlayStrength: number;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  theme: "agilis-performance" | "agilis-color" | "refinity" | "esense";
  visualFocus: "left" | "center" | "right";
  visual: RmCampaignVisual;
};

export type RmQuickAccessItem = {
  href: string;
  label: string;
  dominant?: boolean;
};

export type RmProcessStep = {
  description: string;
  href: string;
  number: string;
  phase: RefinishPhaseSlug;
  productGroups: string[];
  title: string;
};

export type RmSeriesData = {
  description: string;
  label: string;
  series: RmSeriesSlug;
};

export type RmColorSystemData = {
  benefit: string;
  description: string;
  productSlugs?: string[];
  stages: string[];
  system: RmSystemSlug;
  technology: string;
  title: string;
};

export type RmCompatibleBrand = {
  alt: string;
  id: string;
  logo?: string;
  name: string;
};

export type RmProductImageSlotData = {
  group: string;
  name: string;
  technology: string;
};

export type RmImageAsset = {
  id: string;
  src?: string;
  alt: string;
  status: "final" | "temporary" | "missing";
  aspectRatio: string;
  objectPosition?: string;
};

export type RmGallerySystemData = {
  catalogHref: string;
  description: string;
  eyebrow: string;
  id: RmSystemSlug | RmSeriesSlug;
  inquiryHref: string;
  kind: "system" | "series";
  label: string;
  productSlugs?: string[];
  slots: RmProductImageSlotData[];
  technology: string;
};

export type RmProductFamilyData = {
  category?: RmCategorySlug;
  description: string;
  href: string;
  id: string;
  label: string;
  productSlugs?: string[];
  slots: RmProductImageSlotData[];
  tags: string[];
  visualCount: number;
};

export function rmCatalogHref({
  category,
  phase,
  query,
  series,
  system,
}: {
  category?: RmCategorySlug;
  phase?: RefinishPhaseSlug;
  query?: string;
  series?: RmSeriesSlug;
  system?: RmSystemSlug;
} = {}) {
  const params = new URLSearchParams({ brend: "rm" });

  if (system) params.set("sistem", system);
  if (series) params.set("serija", series);
  if (category) params.set("rm-kategorija", category);
  if (phase) params.set("faza", phase);
  if (query) params.set("q", query);

  return `/katalog?${params.toString()}`;
}

export const rmCampaignSlides: RmCampaignSlideData[] = [
  {
    id: "agilis-performance",
    transitionFrom: "#06140f",
    transitionTo: "#1f7a52",
    progressColor: "#8ee06a",
    controlTheme: "on-dark",
    contentAlign: "left",
    desktopImage:
      "/images/brands/rm/campaign/rm-hero-agilis-performance-desktop.webp",
    mobileImage:
      "/images/brands/rm/campaign/rm-hero-agilis-performance-mobile.webp",
    imageAlt:
      "AGILIS lakirer sa pištoljem za lakiranje u zelenoj kampanjskoj atmosferi",
    imagePositionDesktop: "50% 50%",
    imagePositionMobile: "58% 50%",
    imageScaleDesktop: 1,
    imageScaleMobile: 1,
    eyebrow: "R-M AGILIS",
    overlayStrength: 0.14,
    title: "Brži proces. Precizniji rezultat.",
    description:
      "Vodena bazna linija razvijena za visoku pokrivnost, stabilnu nijansu i kraće vreme rada.",
    primaryCta: {
      href: rmCatalogHref({ system: "agilis" }),
      label: "Pogledajte AGILIS proizvode",
    },
    secondaryCta: {
      href: "#agilis",
      label: "Upoznajte AGILIS",
    },
    theme: "agilis-performance",
    visualFocus: "right",
    visual: "agilis-performance",
  },
  {
    id: "agilis-color",
    transitionFrom: "#170b04",
    transitionTo: "#b5541a",
    progressColor: "#f0a03c",
    controlTheme: "on-dark",
    contentAlign: "left",
    desktopImage:
      "/images/brands/rm/campaign/rm-hero-agilis-color-desktop.webp",
    mobileImage: "/images/brands/rm/campaign/rm-hero-agilis-color-mobile.webp",
    imageAlt:
      "R-M AGILIS lakirerka sa pištoljem i digitalnom kolorističkom opremom",
    imagePositionDesktop: "50% 50%",
    imagePositionMobile: "60% 50%",
    imageScaleDesktop: 1,
    imageScaleMobile: 1,
    eyebrow: "AGILIS COLOR SOLUTIONS",
    overlayStrength: 0.16,
    title: "Nijansa bez nagađanja.",
    description:
      "Digitalno podržano pronalaženje nijanse i pouzdana reprodukcija savremenih automobilskih boja.",
    primaryCta: {
      href: "#refinity-tools",
      label: "R-M koloristika",
    },
    secondaryCta: {
      href: "#agilis",
      label: "Upoznajte AGILIS",
    },
    theme: "agilis-color",
    visualFocus: "right",
    visual: "agilis-color",
  },
  {
    id: "refinity",
    transitionFrom: "#070d1c",
    transitionTo: "#2b2f8f",
    progressColor: "#7b5cf0",
    controlTheme: "on-dark",
    contentAlign: "left",
    desktopImage: "/images/brands/rm/campaign/rm-hero-refinity-desktop.webp",
    mobileImage: "/images/brands/rm/campaign/rm-hero-refinity-mobile.webp",
    imageAlt:
      "Refinity digitalni vizuel sa lakirerom i spektralnim svetlosnim prstenovima",
    imagePositionDesktop: "50% 50%",
    imagePositionMobile: "62% 44%",
    imageScaleDesktop: 1,
    imageScaleMobile: 1,
    eyebrow: "REFINITY",
    overlayStrength: 0.2,
    title: "Digitalna snaga za celu radionicu.",
    description:
      "Jedna platforma za boju, formule, procese, učenje, poslovno upravljanje i podršku.",
    primaryCta: {
      href: "#refinity",
      label: "Otkrijte Refinity",
    },
    secondaryCta: {
      href: "#refinity-tools",
      label: "Digitalna koloristika",
    },
    theme: "refinity",
    visualFocus: "right",
    visual: "refinity",
  },
  {
    id: "esense",
    transitionFrom: "#f3f5ec",
    transitionTo: "#8fbf3f",
    progressColor: "#5aa61e",
    controlTheme: "on-light",
    contentAlign: "left",
    desktopImage: "/images/brands/rm/campaign/rm-hero-esense-desktop.webp",
    mobileImage: "/images/brands/rm/campaign/rm-hero-esense-mobile.webp",
    imageAlt:
      "R-M eSense proizvodi i pištolj koji raspršuje zelenu boju",
    imagePositionDesktop: "50% 50%",
    imagePositionMobile: "58% 55%",
    imageScaleDesktop: 1,
    imageScaleMobile: 1,
    eyebrow: "R-M eSENSE",
    overlayStrength: 0.08,
    title: "Efikasniji proces sa manjim uticajem.",
    description:
      "R-M rešenja razvijena za savremene reparaturne procese, kontrolu potrošnje i održiviji rad radionice.",
    primaryCta: {
      href: "#esense",
      label: "Upoznajte eSense",
    },
    secondaryCta: {
      href: "#color-systems-title",
      label: "R-M sistemi",
    },
    theme: "esense",
    visualFocus: "right",
    visual: "esense",
  },
];

export const rmEditorialAssets = {
  agilis: {
    id: "rm-agilis-editorial",
    src: "/images/brands/rm/campaign/rm-agilis-editorial.webp",
    alt: "R-M AGILIS lakirerka sa pištoljem i digitalnom radnom stanicom",
    status: "final",
    aspectRatio: "14 / 9",
    objectPosition: "68% center",
  },
  refinity: {
    id: "rm-refinity-editorial",
    src: "/images/brands/rm/campaign/rm-refinity-editorial.webp",
    alt: "Refinity digitalni tok sa lakirerom i svetlosnim prstenovima",
    status: "final",
    aspectRatio: "1 / 1",
    objectPosition: "center 10%",
  },
  esense: {
    id: "rm-esense-editorial",
    src: "/images/brands/rm/campaign/rm-esense-editorial.webp",
    alt: "R-M eSense proizvodi i pištolj sa zelenim raspršivanjem",
    status: "final",
    aspectRatio: "5 / 3",
    objectPosition: "36% center",
  },
  partnership: {
    id: "rm-emil-frey-partnership",
    src: "/images/brands/rm/campaign/rm-emil-frey-partnership.webp",
    alt: "Emil Frey Racing automobil sa R-M oznakom",
    status: "final",
    aspectRatio: "5 / 3",
    objectPosition: "58% center",
  },
} satisfies Record<string, RmImageAsset>;

export const rmQuickAccessItems: RmQuickAccessItem[] = [
  { href: rmCatalogHref(), label: "Svi R-M proizvodi", dominant: true },
  {
    href: rmCatalogHref({ category: "basecoat" }),
    label: "Boje",
  },
  {
    href: rmCatalogHref({ category: "clearcoat" }),
    label: "Bezbojni lakovi",
  },
  {
    href: rmCatalogHref({ category: "primer-filler" }),
    label: "Prajmeri i punioci",
  },
  {
    href: rmCatalogHref({ category: "bodyfiller" }),
    label: "Kitovi",
  },
  {
    href: rmCatalogHref({ category: "hardener" }),
    label: "Učvršćivači",
  },
  {
    href: rmCatalogHref({ category: "thinner" }),
    label: "Razređivači",
  },
  {
    href: rmCatalogHref({ category: "additive" }),
    label: "Aditivi",
  },
  {
    href: rmCatalogHref({ system: "graphite-hd" }),
    label: "Komercijalna vozila",
  },
];

export const rmProcessSteps: RmProcessStep[] = [
  {
    number: "01",
    phase: "priprema",
    title: "Priprema",
    description:
      "Čišćenje, ravnanje i stabilna površina pre nanošenja podloge.",
    productGroups: ["Čistači", "Kitovi", "Abrazivi"],
    href: rmCatalogHref({ phase: "priprema" }),
  },
  {
    number: "02",
    phase: "podloga",
    title: "Prajmer i punilac",
    description:
      "Izolacija podloge i precizna priprema za ravnomeran bazni sloj.",
    productGroups: ["Prajmeri", "Punioci", "Sealer-i"],
    href: rmCatalogHref({ phase: "podloga" }),
  },
  {
    number: "03",
    phase: "boja",
    title: "Bazna boja",
    description:
      "Formula nijanse i kontrolisan nanos baznog sistema.",
    productGroups: ["AGILIS", "ONYX HD", "DIAMONT"],
    href: rmCatalogHref({ phase: "boja" }),
  },
  {
    number: "04",
    phase: "lak",
    title: "Bezbojni lak",
    description:
      "Završni sloj za dubinu, sjaj i zaštitu lakirane površine.",
    productGroups: ["Bezbojni lakovi", "Učvršćivači", "Aditivi"],
    href: rmCatalogHref({ phase: "lak" }),
  },
  {
    number: "05",
    phase: "poliranje",
    title: "Završna obrada",
    description:
      "Korekcija površine i kontrolisana finalna obrada laka.",
    productGroups: ["Paste", "Poliranje", "Nega površine"],
    href: rmCatalogHref({ phase: "poliranje" }),
  },
];

export const rmSeries: RmSeriesData[] = [
  {
    label: "Pioneer",
    series: "pioneer",
    description:
      "Najnaprednija tehnologija, održivost i efikasni procesi.",
  },
  {
    label: "Advance",
    series: "advance",
    description:
      "Visoka produktivnost, stabilan rezultat i kraće procesno vreme.",
  },
  {
    label: "Element",
    series: "element",
    description:
      "Ekonomična i pouzdana rešenja za svakodnevni rad.",
  },
];

export const rmColorSystems: RmColorSystemData[] = [
  {
    system: "agilis",
    productSlugs: [
      "p-2p81-race-wet-fill-r-white",
      "2220-agilis-activator",
      "c-2p42-race-finish-r",
      "h-2p15-clear-harden-r",
    ],
    title: "AGILIS",
    technology: "Vodena bazna linija nove generacije",
    description:
      "Sistem za produktivan proces, precizno podudaranje nijanse i kontrolisanu potrošnju materijala.",
    stages: ["Priprema", "Prajmer", "AGILIS", "Bezbojni lak"],
    benefit: "Precizna nijansa uz efikasniji proces",
  },
  {
    system: "onyx-hd",
    productSlugs: [
      "hb-032-hydromix",
      "p-2a41-performfiller-white",
      "c-2a40-airtop",
    ],
    title: "ONYX HD",
    technology: "Provereni vodeni sistem",
    description:
      "Vodena bazna tehnologija za profesionalno usklađivanje nijanse u savremenoj lakirnici.",
    stages: ["Priprema", "Podloga", "ONYX HD", "Bezbojni lak"],
    benefit: "Proveren vodeni radni tok",
  },
  {
    system: "diamont",
    productSlugs: ["rm-diamont-bazna-boja"],
    title: "DIAMONT",
    technology: "Solventna bazna linija",
    description:
      "Sistem baznih boja sa postojećim artiklima i direktnim ulazom u naš R-M katalog.",
    stages: ["Priprema", "Prajmer", "DIAMONT", "Bezbojni lak"],
    benefit: "Direktan ulaz u postojeći katalog",
  },
  {
    system: "uno-hd",
    title: "UNO HD",
    technology: "2K direktni sjaj",
    description:
      "Rešenje za pune nijanse i direktan završni sjaj u profesionalnom procesu.",
    // Sistemski zapis kataloga; slika dolazi iz kataloga (`supplied-images.json`).
    productSlugs: ["rm-uno-hd"],
    stages: ["Priprema", "Prajmer", "UNO HD"],
    benefit: "Puna nijansa i direktni završni sjaj",
  },
  {
    system: "crystal-base",
    title: "CRYSTAL BASE",
    technology: "Specijalni efektni pigmenti",
    description:
      "Sistemska podrška za specijalne efekte i zahtevne nijanse.",
    stages: ["Priprema", "Bazni sloj", "CRYSTAL BASE", "Završni lak"],
    benefit: "Kontrola zahtevnih efekata i nijansi",
  },
  {
    system: "graphite-hd",
    productSlugs: [
      "ghd-topcoat",
      "p-5480-ghd-universal-epoxy",
      "c-5450-ghd-clear",
    ],
    title: "GRAPHITE HD",
    technology: "Program za komercijalna vozila",
    description:
      "R-M sistem namenjen procesu lakiranja komercijalnih vozila.",
    stages: ["Priprema", "Prajmer", "GRAPHITE HD", "Završna zaštita"],
    benefit: "Proces prilagođen komercijalnim vozilima",
  },
];

const rmCompatibleBrandNames = [
  ["acura", "Acura"],
  ["alfa-romeo", "Alfa Romeo"],
  ["audi", "Audi"],
  ["buick", "Buick"],
  ["bmw", "BMW"],
  ["cadillac", "Cadillac"],
  ["chevrolet", "Chevrolet"],
  ["chrysler", "Chrysler"],
  ["dodge", "Dodge"],
  ["faraday-future", "Faraday Future"],
  ["fiat", "Fiat"],
  ["ford", "Ford"],
  ["genesis", "Genesis"],
  ["gm", "GM"],
  ["gmc", "GMC"],
  ["honda", "Honda"],
  ["hyundai", "Hyundai"],
  ["infiniti", "Infiniti"],
  ["isuzu", "Isuzu"],
  ["jaguar", "Jaguar"],
  ["jeep", "Jeep"],
  ["kia", "Kia"],
  ["lucid", "Lucid"],
  ["land-rover", "Land Rover"],
  ["lincoln", "Lincoln"],
  ["lexus", "Lexus"],
  ["mazda", "Mazda"],
  ["mercedes-benz", "Mercedes-Benz"],
  ["mini", "Mini"],
  ["mitsubishi", "Mitsubishi"],
  ["nissan", "Nissan"],
  ["porsche", "Porsche"],
  ["ram", "Ram"],
  ["rivian", "Rivian"],
  ["saab", "Saab"],
  ["scion", "Scion"],
  ["stellantis", "Stellantis"],
  ["subaru", "Subaru"],
  ["suzuki", "Suzuki"],
  ["tesla", "Tesla"],
  ["toyota", "Toyota"],
  ["vinfast", "VinFast"],
  ["volkswagen", "Volkswagen"],
] as const;

export const rmCompatibleBrands: RmCompatibleBrand[] =
  rmCompatibleBrandNames.map(([id, name]) => ({
    alt: name,
    id,
    name,
  }));

export const rmGallerySystems: RmGallerySystemData[] = [
  {
    id: "agilis",
    kind: "system",
    eyebrow: "Vodeni bazni sistem",
    label: "AGILIS",
    technology: "WATERBORNE",
    description:
      "Bazna linija i pomoćne procesne grupe prikazane kao jedan povezan sistem.",
    catalogHref: rmCatalogHref({ system: "agilis" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=agilis",
    productSlugs: [
      "p-2p81-race-wet-fill-r-white",
      "2220-agilis-activator",
      "c-2p42-race-finish-r",
      "h-2p15-clear-harden-r",
      "ra-050x-agilis-mix",
    ],
    slots: [
      {
        name: "AGILIS bazne komponente",
        group: "Bazne boje",
        technology: "WATERBORNE",
      },
      {
        name: "Prajmer ili punilac sistema",
        group: "Podloga",
        technology: "SYSTEM STEP",
      },
      {
        name: "Bezbojni lak sistema",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
      {
        name: "Učvršćivač",
        group: "Pomoćna komponenta",
        technology: "HARDENER",
      },
      {
        name: "Razređivač ili dodatak",
        group: "Pomoćna komponenta",
        technology: "ADDITIVE",
      },
    ],
  },
  {
    id: "onyx-hd",
    kind: "system",
    eyebrow: "Provereni vodeni sistem",
    label: "ONYX HD",
    technology: "WATERBORNE",
    description:
      "Sistemski prikaz vodene baze, podloge, završnog laka i pratećih komponenti.",
    catalogHref: rmCatalogHref({ system: "onyx-hd" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=onyx-hd",
    productSlugs: [
      "hb-032-hydromix",
      "p-2a41-performfiller-white",
      "c-2a40-airtop",
      "h-2a14-topcure",
      "r-2a10-airtopthinn",
    ],
    slots: [
      {
        name: "ONYX HD bazne komponente",
        group: "Bazne boje",
        technology: "WATERBORNE",
      },
      {
        name: "Prajmer ili punilac sistema",
        group: "Podloga",
        technology: "SYSTEM STEP",
      },
      {
        name: "Bezbojni lak sistema",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
      {
        name: "Učvršćivač i razređivač",
        group: "Pomoćne komponente",
        technology: "AUXILIARY",
      },
    ],
  },
  {
    id: "diamont",
    kind: "system",
    eyebrow: "Solventni bazni sistem",
    label: "DIAMONT",
    technology: "SOLVENT",
    description:
      "Potvrđeni DIAMONT artikli iz lokalnog kataloga povezani su sa pripadajućim procesnim grupama.",
    catalogHref: rmCatalogHref({ system: "diamont" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=diamont",
    productSlugs: ["rm-diamont-bazna-boja"],
    slots: [
      {
        name: "DIAMONT bazna boja",
        group: "Bazne boje",
        technology: "SOLVENT",
      },
      {
        name: "DIAMONT bezbojni lak",
        group: "Završni sloj",
        technology: "2K CLEARCOAT",
      },
      {
        name: "Učvršćivač sistema",
        group: "Pomoćna komponenta",
        technology: "HARDENER",
      },
      {
        name: "Razređivač sistema",
        group: "Pomoćna komponenta",
        technology: "THINNER",
      },
    ],
  },
  {
    id: "uno-hd",
    kind: "system",
    eyebrow: "Direktni završni sjaj",
    label: "UNO HD",
    technology: "2K DIRECT GLOSS",
    description:
      "Direktni sjaj i prateće procesne grupe; prikazani su samo artikli koje R-M katalog vodi u UNO HD sistemu.",
    catalogHref: rmCatalogHref({ system: "uno-hd" }),
    productSlugs: ["rm-uno-hd"],
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=uno-hd",
    slots: [
      {
        name: "UNO HD komponente boje",
        group: "Direktni sjaj",
        technology: "2K",
      },
      {
        name: "Prajmer ili punilac sistema",
        group: "Podloga",
        technology: "SYSTEM STEP",
      },
      {
        name: "Učvršćivač i razređivač",
        group: "Pomoćne komponente",
        technology: "AUXILIARY",
      },
    ],
  },
  {
    id: "crystal-base",
    kind: "system",
    eyebrow: "Specijalni efekti",
    label: "CRYSTAL BASE",
    technology: "EFFECT PIGMENTS",
    description:
      "Posebna vizuelna grupa za efektne pigmente i zahtevne kolorističke procese.",
    catalogHref: rmCatalogHref({ system: "crystal-base" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=crystal-base",
    slots: [
      {
        name: "CRYSTAL BASE efektne komponente",
        group: "Specijalni efekti",
        technology: "EFFECT",
      },
      {
        name: "Kompatibilna bazna linija",
        group: "Bazna boja",
        technology: "SYSTEM STEP",
      },
      {
        name: "Završni bezbojni lak",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
    ],
  },
  {
    id: "pioneer",
    kind: "series",
    eyebrow: "Procesna serija",
    label: "PIONEER",
    technology: "ADVANCED PROCESS",
    description:
      "Napredna procesna arhitektura sa jasno izdvojenim podlogama, završnim lakovima i pomoćnim komponentama.",
    catalogHref: rmCatalogHref({ series: "pioneer" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&serija=pioneer",
    productSlugs: [
      "c-2p42-race-finish-r",
      "c-2p45-speed-finish-r",
      "c-2p85-power-finish-r",
      "c-2p91-mat-finish-r",
      "c-2p96-satin-finish-r",
    ],
    slots: [
      {
        name: "Prajmer ili punilac serije",
        group: "Podloga",
        technology: "PRIMER / FILLER",
      },
      {
        name: "Kompatibilni bazni sistem",
        group: "Bazna boja",
        technology: "SYSTEM LINK",
      },
      {
        name: "Bezbojni lak serije",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
      {
        name: "Učvršćivač",
        group: "Pomoćna komponenta",
        technology: "HARDENER",
      },
      {
        name: "Razređivač",
        group: "Pomoćna komponenta",
        technology: "THINNER",
      },
    ],
  },
  {
    id: "advance",
    kind: "series",
    eyebrow: "Procesna serija",
    label: "ADVANCE",
    technology: "PRODUCTIVE PROCESS",
    description:
      "Procesne grupe za stabilan rezultat i produktivan svakodnevni rad.",
    catalogHref: rmCatalogHref({ series: "advance" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&serija=advance",
    productSlugs: [
      "c-2a40-airtop",
      "c-2a54-performtop",
      "c-2a64-glosstop",
      "c-2a84-protecttop",
      "p-2a41-performfiller-white",
    ],
    slots: [
      {
        name: "Prajmer ili punilac serije",
        group: "Podloga",
        technology: "PRIMER / FILLER",
      },
      {
        name: "Bezbojni lak serije",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
      {
        name: "Učvršćivač i razređivač",
        group: "Pomoćne komponente",
        technology: "AUXILIARY",
      },
    ],
  },
  {
    id: "element",
    kind: "series",
    eyebrow: "Procesna serija",
    label: "ELEMENT",
    technology: "ESSENTIAL PROCESS",
    description:
      "Osnovne procesne grupe za pouzdan i pregledan radni tok.",
    catalogHref: rmCatalogHref({ series: "element" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&serija=element",
    productSlugs: [
      "p-2e23-primer-filler-grey",
      "c-2e10-clear-coat-premixed",
      "h-2e20-hardener",
      "r-2e10-thinner-fast",
    ],
    slots: [
      {
        name: "Prajmer ili punilac serije",
        group: "Podloga",
        technology: "PRIMER / FILLER",
      },
      {
        name: "Bezbojni lak serije",
        group: "Završni sloj",
        technology: "CLEARCOAT",
      },
      {
        name: "Pomoćne komponente",
        group: "Procesna podrška",
        technology: "AUXILIARY",
      },
    ],
  },
  {
    id: "graphite-hd",
    kind: "system",
    eyebrow: "Komercijalna vozila",
    label: "GRAPHITE HD",
    technology: "COMMERCIAL VEHICLES",
    description:
      "Sistemski pregled grupa namenjenih procesu lakiranja komercijalnih vozila.",
    catalogHref: rmCatalogHref({ system: "graphite-hd" }),
    inquiryHref: "/kontakt?tema=proizvod&brend=rm&sistem=graphite-hd",
    productSlugs: [
      "ghd-topcoat",
      "p-5480-ghd-universal-epoxy",
      "p-5530-ghd-uni-wash",
      "c-5450-ghd-clear",
      "h-380-ghd-hardener",
    ],
    slots: [
      {
        name: "GRAPHITE HD komponente boje",
        group: "Komercijalna vozila",
        technology: "COLOR SYSTEM",
      },
      {
        name: "Podloga za komercijalna vozila",
        group: "Prajmer i punilac",
        technology: "SYSTEM STEP",
      },
      {
        name: "Završni sloj sistema",
        group: "Zaštita i završnica",
        technology: "TOPCOAT",
      },
    ],
  },
];

export const rmProductFamilies: RmProductFamilyData[] = [
  {
    id: "basecoats",
    label: "Bazne boje",
    category: "basecoat",
    href: rmCatalogHref({ category: "basecoat" }),
    description:
      "Vodene i solventne baze, direktni sjaj i efektne komponente organizovane prema sistemu.",
    tags: ["AGILIS", "ONYX HD", "DIAMONT", "UNO HD", "CRYSTAL BASE"],
    visualCount: 3,
    productSlugs: [
      "hb-032-hydromix",
      "rm-diamont-bazna-boja",
      "ghd-topcoat",
    ],
    slots: [
      {
        name: "Vodene bazne komponente",
        group: "AGILIS / ONYX HD",
        technology: "WATERBORNE",
      },
      {
        name: "Solventna bazna linija",
        group: "DIAMONT",
        technology: "SOLVENT",
      },
      {
        name: "Direktni sjaj i efektne komponente",
        group: "UNO HD / CRYSTAL BASE",
        technology: "DIRECT GLOSS / EFFECT",
      },
    ],
  },
  {
    id: "clearcoats",
    label: "Bezbojni lakovi",
    category: "clearcoat",
    href: rmCatalogHref({ category: "clearcoat" }),
    description:
      "Završni lakovi predstavljeni prema procesnoj nameni, bez izmišljanja nedostupnih komercijalnih naziva.",
    tags: [
      "Brzo sušenje",
      "Vazdušno sušenje",
      "Univerzalni",
      "Visok sjaj",
      "Scratch resistant",
      "Mat završnica",
      "Low-bake / EV",
    ],
    productSlugs: [
      "c-2p42-race-finish-r",
      "c-2p45-speed-finish-r",
      "c-2p85-power-finish-r",
      "c-2a40-airtop",
    ],
    visualCount: 4,
    slots: [
      {
        name: "Grupa za brzo i vazdušno sušenje",
        group: "Bezbojni lakovi",
        technology: "FAST / AIR DRYING",
      },
      {
        name: "Univerzalni, visok sjaj i scratch resistant",
        group: "Bezbojni lakovi",
        technology: "UNIVERSAL / HIGH GLOSS",
      },
      {
        name: "Mat i low-bake proces",
        group: "Bezbojni lakovi",
        technology: "MATTE / LOW-BAKE",
      },
    ],
  },
  {
    id: "primers-fillers",
    label: "Prajmeri i punioci",
    category: "primer-filler",
    href: rmCatalogHref({ category: "primer-filler" }),
    description:
      "Podloge podeljene prema načinu nanošenja i mestu u pripremnom procesu.",
    tags: ["Za brušenje", "Wet-on-wet", "Direktno na metal", "UV", "Vazdušno sušenje"],
    productSlugs: [
      "p-2p81-race-wet-fill-r-white",
      "p-2p51-sanding-fill-r-white",
      "p-2a41-performfiller-white",
    ],
    visualCount: 3,
    slots: [
      {
        name: "Prajmer i punilac za brušenje",
        group: "Podloga",
        technology: "SANDING",
      },
      {
        name: "Wet-on-wet i DTM grupa",
        group: "Podloga",
        technology: "WET-ON-WET / DTM",
      },
      {
        name: "UV i vazdušno sušenje",
        group: "Podloga",
        technology: "UV / AIR DRYING",
      },
    ],
  },
  {
    id: "bodyfillers",
    label: "Kitovi",
    category: "bodyfiller",
    href: rmCatalogHref({ category: "bodyfiller" }),
    description:
      "Materijali za ravnanje i finu završnu pripremu pre podloge.",
    tags: ["Univerzalni kitovi", "Fini završni kitovi", "UV kitovi", "Specijalne varijante"],
    visualCount: 3,
    productSlugs: ["b-2p93-uv-bodyfill-r"],
    slots: [
      {
        name: "Univerzalni i fini kitovi",
        group: "Priprema",
        technology: "BODYFILLER",
      },
      {
        name: "UV i specijalne varijante",
        group: "Priprema",
        technology: "UV / SPECIAL",
      },
    ],
  },
  {
    id: "hardeners",
    label: "Učvršćivači",
    category: "hardener",
    href: rmCatalogHref({ category: "hardener" }),
    description:
      "Učvršćivači su prikazani kao obavezna sistemska komponenta, povezani sa podlogom ili završnim lakom.",
    tags: ["Sistemska kompatibilnost", "Procesna brzina", "Završni lak"],
    productSlugs: [
      "h-2p15-clear-harden-r",
      "h-2a14-topcure",
      "h-2e20-hardener",
    ],
    visualCount: 2,
    slots: [
      {
        name: "Učvršćivači za podloge",
        group: "Pomoćna komponenta",
        technology: "HARDENER",
      },
      {
        name: "Učvršćivači za završni lak",
        group: "Pomoćna komponenta",
        technology: "CLEARCOAT HARDENER",
      },
    ],
  },
  {
    id: "thinners",
    label: "Razređivači",
    category: "thinner",
    href: rmCatalogHref({ category: "thinner" }),
    description:
      "Razređivači i regulatori procesa organizovani prema sistemu i uslovima rada.",
    tags: ["Bazni sistem", "Podloga", "Završni lak", "Uslovi rada"],
    productSlugs: [
      "ra-050x-agilis-mix",
      "r-2p15-clear-thinn-r",
      "r-2a10-airtopthinn",
    ],
    visualCount: 2,
    slots: [
      {
        name: "Razređivači baznog sistema",
        group: "Pomoćna komponenta",
        technology: "THINNER",
      },
      {
        name: "Razređivači podloge i laka",
        group: "Pomoćna komponenta",
        technology: "PROCESS CONTROL",
      },
    ],
  },
  {
    id: "additives",
    label: "Aditivi",
    category: "additive",
    href: rmCatalogHref({ category: "additive" }),
    description:
      "Procesni dodaci koji prilagođavaju primenu, sušenje ili završni efekat.",
    tags: ["Procesni dodatak", "Sušenje", "Blend-in proizvodi", "Završni efekat"],
    productSlugs: [
      "2p15-air-tune-r",
      "2p80-texture-tune-r",
      "2530-agilis-blender",
    ],
    visualCount: 3,
    slots: [
      {
        name: "Aditivi za proces nanošenja",
        group: "Dodatni proizvodi",
        technology: "ADDITIVE",
      },
      {
        name: "Aditivi za završni efekat",
        group: "Dodatni proizvodi",
        technology: "FINISH CONTROL",
      },
      {
        name: "Blend-in proizvodi",
        group: "Dodatni proizvodi",
        technology: "BLEND-IN",
      },
    ],
  },
  {
    id: "cleaners",
    label: "Čistači i odmašćivači",
    category: "cleaner",
    href: rmCatalogHref({ category: "cleaner" }),
    description:
      "Početak stabilnog procesa, čišćenje i priprema površine pre nanošenja materijala.",
    tags: ["Čišćenje", "Odmašćivanje", "Priprema površine"],
    visualCount: 2,
    slots: [
      {
        name: "Čistači površine",
        group: "Priprema",
        technology: "SURFACE CLEANING",
      },
      {
        name: "Odmašćivači",
        group: "Priprema",
        technology: "DEGREASING",
      },
    ],
  },
  {
    id: "effects",
    label: "Specijalni efektni proizvodi",
    href: rmCatalogHref({ system: "crystal-base" }),
    description:
      "Efektne komponente izdvojene kao posebna koloristička porodica unutar CRYSTAL BASE sistema.",
    tags: ["CRYSTAL BASE", "Efektni pigmenti", "Koloristika"],
    visualCount: 2,
    slots: [
      {
        name: "Efektne komponente",
        group: "CRYSTAL BASE",
        technology: "EFFECT PIGMENTS",
      },
      {
        name: "Kompatibilna završnica",
        group: "Sistemska veza",
        technology: "SYSTEM FINISH",
      },
    ],
  },
  {
    id: "commercial",
    label: "Komercijalna vozila",
    href: rmCatalogHref({ system: "graphite-hd" }),
    description:
      "Procesne grupe za komercijalna vozila objedinjene kroz GRAPHITE HD sistem.",
    tags: ["GRAPHITE HD", "Podloga", "Boja", "Završna zaštita"],
    productSlugs: [
      "ghd-topcoat",
      "p-5480-ghd-universal-epoxy",
    ],
    visualCount: 2,
    slots: [
      {
        name: "Boje za komercijalna vozila",
        group: "GRAPHITE HD",
        technology: "COMMERCIAL VEHICLES",
      },
      {
        name: "Podloga i završna zaštita",
        group: "Sistemska veza",
        technology: "SYSTEM PROCESS",
      },
    ],
  },
];

export const rmAgilisBenefits = [
  "Precizno podudaranje nijanse",
  "Visoka pokrivnost",
  "Kraće vreme procesa",
  "Efikasnija potrošnja materijala",
];

export const rmAgilisFeatureProductSlugs = [
  "p-2p81-race-wet-fill-r-white",
  "2220-agilis-activator",
  "c-2p42-race-finish-r",
  "ra-050x-agilis-mix",
] as const;

export type RmRefinityFlowStep = {
  title: string;
  /** Zvanična fotografija sa Surventis Brand Portala (hub 51); poreklo u `docs/RM_PORTAL_ASSETS.md`. */
  image: { src: string; alt: string };
};

const RM_REFINITY_DIR = "/images/brands/rm/refinity";

export const rmRefinityFlow: RmRefinityFlowStep[] = [
  {
    title: "Vozilo",
    image: {
      src: `${RM_REFINITY_DIR}/rm-refinity-step-01-vehicle.webp`,
      alt: "Lakirani prednji blatobran i vrata srebrnog vozila",
    },
  },
  {
    title: "ScanR",
    image: {
      src: `${RM_REFINITY_DIR}/rm-refinity-step-02-scanr.webp`,
      alt: "Ruke u zaštitnim rukavicama drže R-M ScanR spektrofotometar na tamnoplavom laku haube",
    },
  },
  {
    title: "Refinity formula",
    image: {
      src: `${RM_REFINITY_DIR}/rm-refinity-step-03-formula.webp`,
      alt: "Tehničar bira formulu na ekranu R-M Refinity mešaone, pored vage i polica sa tonerima",
    },
  },
  {
    title: "Automatsko mešanje",
    image: {
      src: `${RM_REFINITY_DIR}/rm-refinity-step-04-mixing.webp`,
      alt: "R-M automatska mašina za mešanje boje sa oznakama R-M i Refinity",
    },
  },
  {
    title: "Spremna boja",
    image: {
      src: `${RM_REFINITY_DIR}/rm-refinity-step-05-result.webp`,
      alt: "Lakiran tamnoplavi panel na stalku, na otvorenom",
    },
  },
];

export const rmRefinityAreas = [
  "Digitalna pretraga nijanse",
  "Vizuelno poređenje formule",
  "Upravljanje zalihama",
  "Radni nalozi i izveštavanje",
];
