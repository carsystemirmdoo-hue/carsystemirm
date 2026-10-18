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
  /**
   * Optička visina logotipa u meniju brendova (px). Logotipi imaju vrlo različite
   * proporcije (R-M i Carsystem su skoro kvadratni, C.A.R.FIT i SATA široki), pa
   * ista visina daje vrlo različitu prividnu veličinu.
   */
  menuLogoHeight?: number;
  /**
   * Galerija u meniju brendova (predlog A, 2026-10-18): visine su izračunate
   * za istu optičku površinu znaka (pune pločice R-M/Carsystem/SATA/Befar dobijaju
   * manje, tanki C.A.R.FIT više). U tamnoj temi se prikazuje `monoSrc` (ili isti
   * logotip) prebojen u belo, zato ima svoju visinu.
   */
  menuGallery?: { height: number; monoSrc?: string; monoHeight: number };
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
    // Linijska ilustracija diskova (2026-10-15) umesto punog tamnog diska.
    icon: "/icons/categories/abrazivi.svg",
    iconScale: 1.12,
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
    menuLogoHeight: 62,
    menuGallery: { height: 87, monoSrc: "/brands/mono/rm.svg", monoHeight: 81 },
  },
  {
    href: "/brendovi/carsystem",
    title: "Carsystem",
    description: "Priprema, obrada i materijal za radionicu.",
    logo: "/brands/carsystem.svg",
    menuLogoHeight: 48,
    menuGallery: { height: 59, monoSrc: "/brands/mono/carsystem.svg", monoHeight: 59 },
  },
  {
    href: "/brendovi/baslac",
    title: "Baslac",
    description: "Pregledan sistem boja, lakova i pratećih materijala.",
    logo: "/brands/baslac.svg",
    menuLogoHeight: 58,
    menuGallery: { height: 67, monoSrc: "/brands/mono/baslac.svg", monoHeight: 60 },
  },
  {
    href: "/brendovi/norbin",
    title: "Norbin",
    description: "Bezbojni lakovi, punioci i učvršćivači.",
    logo: "/brands/norbin.svg",
    menuLogoHeight: 52,
    menuGallery: { height: 57, monoSrc: "/brands/mono/norbin.svg", monoHeight: 44 },
  },
  {
    href: "/brendovi/cosmos-lac",
    title: "Cosmos Lac",
    description: "Aerosolne boje, sprejevi i specijalizovane linije.",
    logo: "/brands/cosmos-spray.svg",
    menuLogoHeight: 48,
    menuGallery: { height: 58, monoHeight: 58 },
  },
  {
    href: "/brendovi/befar",
    title: "Befar",
    description: "Sunđeri i materijal za završnu obradu.",
    logo: "/brands/befar.svg",
    menuLogoHeight: 30,
    menuGallery: { height: 35, monoSrc: "/brands/mono/befar.svg", monoHeight: 35 },
  },
  {
    href: "/brendovi/carfit",
    title: "C.A.R.FIT",
    description: "Materijali za pripremu i stabilnu podlogu.",
    logo: "/brands/carfit.svg",
    menuLogoHeight: 24,
    menuGallery: { height: 33, monoHeight: 33 },
  },
  {
    href: "/brendovi/sata",
    title: "SATA",
    description: "Oprema za precizno i ponovljivo nanošenje.",
    logo: "/brands/sata.svg",
    menuLogoHeight: 30,
    menuGallery: { height: 35, monoSrc: "/brands/mono/sata.svg", monoHeight: 35 },
  },
];
// Yachtcare nije u meniju (odluka vlasnika 2026-10-17): osam brendova daje dva puna reda.
// Stranica /brendovi/yachtcare i proizvodi ostaju. RUPES nije zaseban brend u meniju —
// prikazan je u okviru Carsystem ponude (/brendovi/carsystem#rupes).

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
      // „Tehnička podrška“ je u meniju „Podrška“ i u podnožju (odluka vlasnika 2026-10-15).
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
