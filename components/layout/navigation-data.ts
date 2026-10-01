export type HeaderMenuKey = "proizvodi" | "brendovi" | "sistemi" | "podrska";

export type HeaderIconName =
  | "prepare"
  | "primer"
  | "paint"
  | "clearcoat"
  | "polish"
  | "catalog"
  | "support"
  | "documents"
  | "contact";

export type NavigationLink = {
  href: string;
  title: string;
  description: string;
  icon?: HeaderIconName;
  logo?: string;
};

export type ProductCategoryLink = {
  label: string;
  slug: string;
  href: string;
  icon: string | null;
  iconScale?: number;
  iconOrigin?: string;
  iconOffsetX?: number;
  iconOffsetY?: number;
  preserveWhiteDetails?: boolean;
};

export type NavigationGroup = {
  title: string;
  links: NavigationLink[];
};

export const PRODUCT_CATEGORIES: ProductCategoryLink[] = [
  {
    label: "Boje",
    slug: "boje",
    href: "/katalog?kategorija=boje",
    icon: "/icons/categories/boje.svg",
    iconScale: 1.12,
  },
  {
    label: "Abrazivi",
    slug: "abrazivi",
    href: "/katalog?kategorija=abrazivi",
    icon: "/icons/categories/abrazivi.svg",
    iconScale: 3.25,
    iconOrigin: "46.5% 38.5%",
    preserveWhiteDetails: true,
  },
  {
    label: "Kitovi",
    slug: "kitovi",
    href: "/katalog?kategorija=kitovi",
    icon: "/icons/categories/kitovi.svg",
    iconScale: 1.17,
  },
  {
    label: "Maskiranje",
    slug: "maskiranje",
    href: "/katalog?kategorija=maskiranje",
    icon: "/icons/categories/maskiranje.svg",
    iconScale: 1.3,
  },
  {
    label: "Sprejevi",
    slug: "sprejevi",
    href: "/katalog?kategorija=sprejevi",
    icon: "/icons/categories/sprejevi.svg",
    iconScale: 1.19,
  },
  {
    label: "Oprema",
    slug: "oprema",
    href: "/katalog?kategorija=oprema",
    icon: "/icons/categories/oprema.svg",
  },
  {
    label: "Pribor",
    slug: "pribor",
    href: "/katalog?kategorija=pribor",
    icon: "/icons/categories/pribor.svg",
    iconScale: 1.25,
    iconOffsetX: 4,
    iconOffsetY: -4,
  },
  {
    label: "Lepkovi",
    slug: "lepkovi",
    href: "/katalog?kategorija=lepkovi",
    icon: "/icons/categories/lepkovi.svg",
    iconScale: 1.2,
  },
  {
    label: "Čišćenje",
    slug: "ciscenje",
    href: "/katalog?kategorija=ciscenje",
    icon: "/icons/categories/ciscenje.svg",
    iconScale: 0.92,
  },
  {
    label: "Zaštita",
    slug: "zastita",
    href: "/katalog?kategorija=zastita",
    icon: "/icons/categories/zastita.svg",
    iconScale: 1.12,
  },
  {
    label: "Poliranje",
    slug: "poliranje",
    href: "/katalog?kategorija=poliranje",
    icon: "/icons/categories/poliranje.svg",
  },
  {
    label: "Radionica",
    slug: "radionica",
    href: "/katalog?kategorija=radionica",
    icon: "/icons/categories/radionica.svg",
    iconScale: 1.08,
  },
];

export const BRAND_LINKS: NavigationLink[] = [
  {
    href: "/brendovi/rm",
    title: "R-M",
    description: "Profesionalni sistemi bojenja i refinish program.",
    logo: "/brands/rm.svg",
  },
  {
    href: "/brendovi/carsystem",
    title: "Carsystem",
    description: "Priprema, obrada i materijal za radionicu.",
    logo: "/brands/carsystem.svg",
  },
  {
    href: "/brendovi/baslac",
    title: "Baslac",
    description: "Pregledan sistem boja, lakova i pratećih materijala.",
    logo: "/brands/baslac.svg",
  },
  {
    href: "/brendovi/norbin",
    title: "Norbin",
    description: "Boje, lakovi i materijali za profesionalnu obradu.",
    logo: "/brands/norbin.svg",
  },
  {
    href: "/brendovi/cosmos-lac",
    title: "Cosmos Lac",
    description: "Aerosolne boje, sprejevi i specijalizovane linije.",
    logo: "/brands/cosmos-spray.svg",
  },
  {
    href: "/brendovi/befar",
    title: "Befar",
    description: "Sunđeri i materijal za završnu obradu.",
    logo: "/brands/befar.svg",
  },
  {
    href: "/brendovi/carfit",
    title: "Car Fit",
    description: "Materijali za pripremu i stabilnu podlogu.",
    logo: "/brands/carfit.svg",
  },
  {
    href: "/brendovi/sata",
    title: "SATA",
    description: "Oprema za precizno i ponovljivo nanošenje.",
    logo: "/brands/sata.svg",
  },
];

export const SYSTEM_GROUPS: NavigationGroup[] = [
  {
    title: "Sistemi bojenja i refinish programi",
    links: [
      {
        href: "/program/boje-i-lakovi",
        title: "Boje i lakovi",
        description: "Bazni sloj, nijansiranje i završni lakovi.",
      },
      {
        href: "/program/priprema-i-abrazivi",
        title: "Priprema i abrazivi",
        description: "Gitovi, prajmeri, punila i brušenje.",
      },
      {
        href: "/program/pistolji-i-oprema",
        title: "Pištolji i oprema",
        description: "Kontrolisano nanošenje i radionička oprema.",
      },
      {
        href: "/program/poliranje",
        title: "Poliranje",
        description: "Korekcija, završna obrada i sjaj.",
      },
      {
        href: "/program/potrosni-materijal",
        title: "Potrošni materijal",
        description: "Maskiranje, zaštita i dnevni radni tok.",
      },
    ],
  },
  {
    title: "Digitalna, edukativna i tehnička podrška",
    links: [
      {
        href: "/kontakt?tema=tehnicka-podrska",
        title: "Tehnička podrška",
        description: "Pošaljite pitanje o procesu, materijalu ili primeni.",
        icon: "support",
      },
      {
        href: "/katalog",
        title: "Katalog i tehnički listovi",
        description: "Pronađite proizvod i dostupna dokumenta na njegovoj stranici.",
        icon: "documents",
      },
      {
        href: "/kontakt?tema=b2b",
        title: "B2B saradnja",
        description: "Razgovarajte sa timom o profesionalnoj saradnji.",
        icon: "contact",
      },
    ],
  },
];

export const SUPPORT_LINKS: NavigationLink[] = [
  {
    href: "/kontakt?tema=tehnicka-podrska",
    title: "Tehnička podrška",
    description: "Pitanja o procesu, materijalu i primeni.",
    icon: "support",
  },
  {
    href: "/katalog",
    title: "Katalog i dokumentacija",
    description: "Tehnički listovi uz odgovarajuće proizvode.",
    icon: "documents",
  },
  {
    href: "/kontakt",
    title: "Kontakt",
    description: "Adresa, e-pošta i obrazac za upit.",
    icon: "contact",
  },
];
