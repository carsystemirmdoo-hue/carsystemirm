/**
 * Ključ „sistemi“ je padajući meni „Saveti i podrška“ (2026-11-01: objedinjeni „Sistemi i
 * programi“, „Saveti i vodiči“, „Katalozi“ i „Podrška“). Naziv ključa je ostao radi stanja i stilova.
 */
export type HeaderMenuKey = "proizvodi" | "brendovi" | "sistemi";

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
    label: "Boje i lakovi",
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

/** Pet stranica programa (/program/*) — „Materijali i postupci“. */
export const PROGRAM_LINKS: NavigationLink[] = [
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
];

/** Biblioteka vodiča — u meniju samo kada postoji bar jedan objavljen članak. */
export const SAVETI_LINKS: NavigationLink[] = [
  {
    href: "/vodici",
    title: "Saveti i vodiči",
    description: "Objašnjenja i postupci za pripremu, materijale i opremu.",
    icon: "catalog",
  },
  {
    href: "/vodici?tip=problemi",
    title: "Problemi i rešenja",
    description: "Uzroci grešaka u radu i šta proveriti.",
    icon: "support",
  },
];

export const DOCUMENTATION_LINKS: NavigationLink[] = [
  {
    href: "/dokumentacija",
    title: "Tehnički i bezbednosni listovi",
    description: "Listovi i uputstva za proizvode iz kataloga, sa pretragom.",
    icon: "documents",
  },
  {
    href: "/katalozi",
    title: "Katalozi proizvođača",
    description: "Katalozi i brošure brendova iz naše ponude.",
    icon: "documents",
  },
];

/** Tehnička podrška; B2B saradnja stoji uz Kontakt (odluka vlasnika 2026-11-01). */
export const SUPPORT_LINKS: NavigationLink[] = [
  {
    href: "/kontakt?tema=tehnicka-podrska",
    title: "Tehnička podrška",
    description: "Pitanja o procesu, materijalu i primeni.",
    icon: "support",
  },
  {
    href: "/kontakt",
    title: "Kontakt",
    description: "Adresa, e-pošta i obrazac za upit.",
    icon: "contact",
  },
  {
    href: "/b2b-saradnja",
    title: "B2B saradnja",
    description: "Razgovarajte sa timom o profesionalnoj saradnji.",
    icon: "contact",
  },
];

export type SupportMenuGroup = NavigationGroup & {
  key: "materijali" | "saveti" | "dokumentacija" | "podrska";
};

/** Grupe menija „Saveti i podrška“. Grupa „saveti“ se prikazuje samo uz objavljen sadržaj. */
export const SUPPORT_MENU_GROUPS: SupportMenuGroup[] = [
  { key: "materijali", title: "Materijali i postupci", links: PROGRAM_LINKS },
  { key: "saveti", title: "Saveti i vodiči", links: SAVETI_LINKS },
  { key: "dokumentacija", title: "Dokumentacija", links: DOCUMENTATION_LINKS },
  { key: "podrska", title: "Tehnička podrška", links: SUPPORT_LINKS },
];

/** „Problemi i rešenja“ tek uz objavljen tekst te vrste, da veza ne vodi na prazan spisak. */
export function visibleSupportGroups(saveti: { biblioteka: boolean; problemi: boolean }) {
  return SUPPORT_MENU_GROUPS.filter((group) => group.key !== "saveti" || saveti.biblioteka).map((group) =>
    group.key === "saveti" && !saveti.problemi ? { ...group, links: group.links.filter((link) => !link.href.includes("tip=problemi")) } : group,
  );
}
