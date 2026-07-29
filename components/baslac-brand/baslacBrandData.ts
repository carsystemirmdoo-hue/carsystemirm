export type BaslacHeroSlide = {
  id: "system" | "line-45" | "speed" | "color" | "cv";
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  theme: "cyan" | "blue" | "coral" | "violet" | "graphite";
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
  tone: "cyan" | "warm" | "violet" | "dark" | "neutral";
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

export const baslacHeroSlides: BaslacHeroSlide[] = [
  {
    id: "system",
    eyebrow: "baslac kompletan program",
    title: "Od pripreme podloge do završnog sjaja.",
    description:
      "Povezan sistem kitova, prajmera, boja, lakova i pomoćnih proizvoda za profesionalne refinish popravke.",
    primaryCta: {
      href: baslacCatalogHref(),
      label: "Pogledajte baslac proizvode",
    },
    secondaryCta: {
      href: "#proces",
      label: "Istražite kompletan proces",
    },
    theme: "cyan",
  },
  {
    id: "line-45",
    eyebrow: "Vodeni sistem boja",
    title: "45 Line. Precizna nijansa u savremenom vodenom sistemu.",
    description:
      "Solid, metallic i pearl basecoat uz digitalnu koloristiku, jednostavno blendovanje i povezan clearcoat sistem.",
    primaryCta: {
      href: "#line-systems",
      label: "Upoznajte 45 Line",
    },
    secondaryCta: {
      href: "/kontakt?tema=proizvod&brend=baslac&oblast=koloristika",
      label: "Pošaljite šifru boje",
    },
    theme: "blue",
  },
  {
    id: "speed",
    eyebrow: "Brži protok kroz kabinu",
    title: "40-100 High Speed Clear. Brzo sušenje već na 40°C.",
    description:
      "High-speed VOC bezbojni lak za radionice koje žele kraći proces i nižu temperaturu sušenja.",
    primaryCta: {
      href: "#clearcoats",
      label: "Uporedite bezbojne lakove",
    },
    secondaryCta: {
      href: "/kontakt?tema=proizvod&brend=baslac&proizvod=40-100",
      label: "Zatražite 40-100",
    },
    theme: "coral",
  },
  {
    id: "color",
    eyebrow: "Digital Color Management",
    title: "Od očitavanja nijanse do spremne formule.",
    description:
      "e-finder star, Formula Finder i Refinity povezuju merenje boje, formule, mešanje i organizaciju radionice.",
    primaryCta: {
      href: "#koloristika",
      label: "Istražite koloristiku",
    },
    secondaryCta: {
      href: "/kontakt?tema=podrska&brend=baslac&oblast=nijansa",
      label: "Zatražite pomoć za nijansu",
    },
    theme: "violet",
  },
  {
    id: "cv",
    eyebrow: "baslac Commercial Vehicles",
    title: "30 Line CV za velike površine i ozbiljan radni ritam.",
    description:
      "2K direct-gloss sistem sa namenskim hardenerima i procesima za komercijalna vozila, šasije i velike transportne površine.",
    primaryCta: {
      href: "#commercial",
      label: "Pogledajte CV program",
    },
    secondaryCta: {
      href: "/kontakt?tema=proizvod&brend=baslac&program=30-line-cv",
      label: "Kontaktirajte savetnika",
    },
    theme: "graphite",
  },
];

export const baslacQuickAccess: ReadonlyArray<{
  dominant?: boolean;
  href: string;
  label: string;
}> = [
  { label: "Svi baslac proizvodi", href: baslacCatalogHref(), dominant: true },
  { label: "45 Line", href: "#line-45" },
  { label: "35 Line", href: "#line-35" },
  { label: "30 Line", href: "#line-30" },
  { label: "Bezbojni lakovi", href: "#clearcoats" },
  { label: "Prajmeri i punioci", href: "#primers" },
  { label: "Koloristika", href: "#koloristika" },
  { label: "Komercijalna vozila", href: "#commercial" },
  { label: "Tehnički listovi", href: "#support" },
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
    process: "20 do 30 min na 40°C",
    metric: "2:1, bez dodatnog razređivača",
    tone: "cyan",
  },
  {
    code: "40-510",
    name: "Ambient Clear VOC",
    role: "Sušenje na sobnoj temperaturi",
    process: "Poliranje približno za 2 do 3 h na 20°C",
    metric: "50-510 ili 50-530",
    tone: "warm",
  },
  {
    code: "40-440 / 40-450",
    name: "VOC i HS Universal Clear",
    role: "Standardne univerzalne popravke",
    process: "Više brzina hardenera prema uslovima",
    metric: "Fleksibilan radionički sistem",
    tone: "neutral",
  },
  {
    code: "40-10",
    name: "2K Panel Clear",
    role: "Male i panel popravke",
    process: "Brzo sušenje i jednostavno poliranje",
    metric: "Kompaktan panel proces",
    tone: "dark",
  },
  {
    code: "40-620",
    name: "2K Clear Mat VOC",
    role: "Mat i satin završna obrada",
    process: "Meša se sa 40-440 ili 40-450",
    metric: "Kontrolisan nivo sjaja",
    tone: "violet",
  },
];

export const baslacSystemLines = [
  {
    id: "line-45",
    code: "45",
    title: "45 Line",
    technology: "Vodeni basecoat",
    description:
      "Glavna vodena linija za solid, metallic, pearl i effect nijanse, uz 45-R45, 45-W10 i opciju aktivacije sa 50-45.",
    tags: ["vodeni sistem", "solid", "metallic", "pearl"],
  },
  {
    id: "line-35",
    code: "35",
    title: "35 Line",
    technology: "Solventni basecoat",
    description:
      "Pregledan solventni sistem za standardne refinish popravke, dobro pokrivanje i racionalnu potrošnju materijala.",
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
      "Direct-gloss sistem za autobuse, kamione, prikolice, šasije i druge velike transportne površine.",
    tags: ["velike površine", "51- hardeneri", "81-30"],
  },
] as const;
