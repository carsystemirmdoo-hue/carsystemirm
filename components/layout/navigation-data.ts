export type NavLink = {
  href: string;
  label: string;
  activeKey: "home" | "katalog" | "prodavnice" | "kontakt";
};

export type MegaLink = {
  href: string;
  title: string;
  description: string;
  meta?: string;
  logo?: string;
};

export const MAIN_LINKS: NavLink[] = [
  { href: "/", label: "Početna", activeKey: "home" },
  { href: "/katalog", label: "Katalog", activeKey: "katalog" },
  { href: "/prodavnice", label: "Prodavnice", activeKey: "prodavnice" },
  { href: "/kontakt", label: "Kontakt", activeKey: "kontakt" },
];

export const PROGRAM_LINKS: MegaLink[] = [
  {
    href: "/program/boje-i-lakovi",
    title: "Boje i lakovi",
    description: "Bazne boje, pigmenti, bezbojni lakovi i sistemi bojenja.",
    meta: "Završni sloj",
  },
  {
    href: "/program/priprema-i-abrazivi",
    title: "Priprema i abrazivi",
    description: "Gitovi, prajmeri, abrazivi i priprema površine.",
    meta: "Osnova procesa",
  },
  {
    href: "/program/pistolji-i-oprema",
    title: "Pištolji i oprema",
    description: "Pištolji, oprema i pribor za precizno nanošenje.",
    meta: "Radionica",
  },
  {
    href: "/program/poliranje",
    title: "Poliranje",
    description: "Paste, sunđeri, polirke i završna obrada.",
    meta: "Finalna obrada",
  },
  {
    href: "/program/potrosni-materijal",
    title: "Potrošni materijal",
    description: "Trake, zaštita, čaše, krpe i svakodnevni materijal.",
    meta: "Dnevna potrošnja",
  },
];

export const BRAND_LINKS: MegaLink[] = [
  {
    href: "/brendovi/rm",
    title: "R-M",
    description: "Refinish program za precizno usklađivanje nijanse i lakiranje.",
    logo: "/brands/rm.svg",
  },
  {
    href: "/brendovi/carsystem",
    title: "Carsystem",
    description: "Priprema, obrada i prateći materijal za profesionalnu radionicu.",
    logo: "/brands/carsystem.svg",
  },
  {
    href: "/brendovi/baslac",
    title: "Baslac",
    description: "Pregledan program boja, lakova i pratećih materijala.",
    logo: "/brands/baslac.svg",
  },
  {
    href: "/brendovi/norbin",
    title: "Norbin",
    description: "Program boja, lakova i pratećih materijala za lakirnice.",
    logo: "/brands/norbin.svg",
  },
  {
    href: "/brendovi/sata",
    title: "SATA",
    description: "Oprema za kontrolisano nanošenje materijala u lakirnici.",
    logo: "/brands/sata.svg",
  },
  {
    href: "/brendovi/carfit",
    title: "Car Fit",
    description: "Materijali za pripremu, podlogu i svakodnevni rad.",
    logo: "/brands/carfit.svg",
  },
  {
    href: "/brendovi/cosmos-spray",
    title: "Cosmos Spray",
    description: "Aerosol program za brze intervencije i pomoćne radove.",
    logo: "/brands/cosmos-spray.svg",
  },
  {
    href: "/brendovi/befar",
    title: "Befar",
    description: "Program sunđera i pratećeg materijala za završnu obradu.",
    logo: "/brands/befar.svg",
  },
];
