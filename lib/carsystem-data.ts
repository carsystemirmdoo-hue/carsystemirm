export type CarsystemBrand = {
  slug: string;
  name: string;
  logo: string;
  description: string;
  overview?: string;
  programSlugs?: string[];
};

export type ProgramGroup = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
};

export type FutureBrand = {
  slug: string;
  name: string;
  description: string;
  status: "placeholder";
};

export type BrandReference =
  | (CarsystemBrand & {
      status: "active";
    })
  | FutureBrand;

export type RefinishPhaseSlug =
  | "priprema"
  | "podloga"
  | "boja"
  | "lak"
  | "poliranje";

export type RefinishPhase = {
  slug: RefinishPhaseSlug;
  name: string;
  description: string;
  step: number;
};

export type PublicProgramGroup = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  badges: string[];
  internalProgramSlugs: string[];
  phaseSlugs: RefinishPhaseSlug[];
  brandSlugs: string[];
  guidanceTitle: string;
  guidanceText: string;
};

export type ProductImageAsset = {
  src: string;
  alt: string;
};

export type ProductPackage = {
  label: string;
  detail?: string;
};

export type ProductSpecification = {
  label: string;
  value: string;
  detail?: string;
};

export type ProductDocument = {
  title: string;
  kind: string;
  href?: string;
  status: "available" | "placeholder" | "disabled";
  note?: string;
};

export type ProductPublicStatus =
  | "Na upit"
  | "Na stanju"
  | "Proveriti telefonom"
  | "Po porudžbini"
  | "Trenutno nije dostupno";

export type ProductStockStatus =
  | "unknown"
  | "in_stock"
  | "check_by_phone"
  | "backorder"
  | "unavailable";

export type CarsystemProduct = {
  slug: string;
  name: string;
  brandSlug: string;
  programSlug: string;
  phaseSlug: RefinishPhaseSlug;
  shortDescription: string;
  longDescription: string;
  sku: string;
  packages: ProductPackage[];
  purpose: string;
  badges: string[];
  publicStatus?: ProductPublicStatus;
  stockStatus?: ProductStockStatus;
  erpSku?: string;
  externalSku?: string;
  biznisSoftSku?: string;
  stockManaged?: boolean;
  productImage: ProductImageAsset | null;
  galleryImages: ProductImageAsset[];
  specifications: ProductSpecification[];
  documents: ProductDocument[];
  relatedProductSlugs: string[];
  seoTitle?: string;
  seoDescription?: string;
};

export function getProductPublicStatus(product: CarsystemProduct): ProductPublicStatus {
  return product.publicStatus ?? "Na upit";
}

export const brands: CarsystemBrand[] = [
  {
    slug: "rm",
    name: "R-M",
    logo: "/brands/rm.svg",
    description:
      "Profesionalni refinish program za precizno usklađivanje nijanse, lakiranje i radioničku efikasnost.",
    overview:
      "R-M u Carsystem i R-M programu pokriva sisteme bojenja, bazne boje, završne lakove i tehničku podršku za izbor formule i refinish procesa.",
    programSlugs: ["boje-i-lakovi", "priprema-povrsine", "poliranje"],
  },
  {
    slug: "carsystem",
    name: "Carsystem",
    logo: "/brands/carsystem.svg",
    description:
      "Širok program pripreme, obrade i pratećeg materijala za karoserijske i lakirerske radionice.",
    overview:
      "Carsystem povezuje pripremu površine, abrazive, poliranje i potrošni materijal za svakodnevni rad u lakirnici.",
    programSlugs: ["priprema-povrsine", "abrazivi", "poliranje", "potrosni-materijal"],
  },
  {
    slug: "sata",
    name: "SATA",
    logo: "/brands/sata.svg",
    description:
      "Oprema za profesionalno nanošenje materijala u lakirnici, sa fokusom na kontrolu i ponovljiv rezultat.",
    overview:
      "SATA je deo programa za profesionalne pištolje, opremu i kontrolisano nanošenje materijala u refinish procesu.",
    programSlugs: ["oprema"],
  },
  {
    slug: "carfit",
    name: "Car Fit",
    logo: "/brands/carfit.svg",
    description:
      "Materijali za pripremu i podlogu, namenjeni svakodnevnom radu u profesionalnoj radionici.",
    overview:
      "Car Fit pokriva praktične materijale za pripremu, podlogu i stabilan radni tok pre nanošenja boje.",
    programSlugs: ["priprema-povrsine", "potrosni-materijal"],
  },
  {
    slug: "cosmos-spray",
    name: "Cosmos Spray",
    logo: "/brands/cosmos-spray.svg",
    description:
      "Aerosol program za brze intervencije, pripremu i pomoćne radove u servisu i radionici.",
    overview:
      "Cosmos Spray je povezan sa sprejevima, pomoćnim artiklima i potrošnim programom za brzu radioničku dopunu.",
    programSlugs: ["aerosoli", "potrosni-materijal"],
  },
  {
    slug: "baslac",
    name: "Baslac",
    logo: "/brands/baslac.svg",
    description:
      "Refinish sistem za radionice kojima je potreban pregledan, pouzdan i praktičan program boja i lakova.",
    overview:
      "Baslac u ponudi pokriva boje, lakove i prateće materijale za radionice kojima je važan pregledan refinish sistem.",
    programSlugs: ["boje-i-lakovi", "poliranje"],
  },
  {
    slug: "norbin",
    name: "Norbin",
    logo: "/brands/norbin.svg",
    description:
      "Program boja, lakova i pratećih materijala za profesionalnu obradu u lakirnici.",
    overview:
      "Norbin je aktivan brend u programu boja i lakova, sa fokusom na završne slojeve i radioničku podršku kroz upit.",
    programSlugs: ["boje-i-lakovi"],
  },
  {
    slug: "befar",
    name: "Befar",
    logo: "/brands/befar.svg",
    description:
      "Program sunđera i pratećeg materijala za poliranje i završnu obradu u lakirnici.",
    overview:
      "Befar u javnom katalogu pokriva sunđere za poliranje po boji, dimenziji i nameni, sa jasnim upitom za dostupnost.",
    programSlugs: ["poliranje"],
  },
];

export const futureBrands: FutureBrand[] = [
  {
    slug: "rupes",
    name: "Rupes",
    description: "Budući program u pripremi za javni katalog.",
    status: "placeholder",
  },
  {
    slug: "autofit",
    name: "A.U.T.O. Fit",
    description: "Budući program u pripremi za javni katalog.",
    status: "placeholder",
  },
];

export const programGroups: ProgramGroup[] = [
  {
    slug: "boje-i-lakovi",
    name: "Boje i lakovi",
    shortName: "Boje",
    description:
      "Bazne boje, bezbojni lakovi i sistemi za završni sloj u profesionalnom refinish procesu.",
  },
  {
    slug: "priprema-povrsine",
    name: "Priprema površine",
    shortName: "Priprema",
    description:
      "Kitovi, prajmeri, punila i pomoćni materijali za stabilnu osnovu pre bojenja.",
  },
  {
    slug: "abrazivi",
    name: "Abrazivi",
    shortName: "Abrazivi",
    description:
      "Brusni materijali za kontrolisanu obradu površine od grube pripreme do finalnog matiranja.",
  },
  {
    slug: "oprema",
    name: "Oprema za lakirnice",
    shortName: "Oprema",
    description:
      "Pištolji, dodaci i radionička oprema za precizno nanošenje materijala.",
  },
  {
    slug: "aerosoli",
    name: "Aerosol program",
    shortName: "Aerosoli",
    description:
      "Sprejevi i pomoćni aerosol proizvodi za manje popravke, probe i servisne intervencije.",
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    shortName: "Poliranje",
    description:
      "Paste, podloške i prateći materijali za korekciju površine i završni sjaj.",
  },
  {
    slug: "potrosni-materijal",
    name: "Potrošni materijal",
    shortName: "Potrošni",
    description:
      "Maskiranje, pomoćni materijali i radionička potrošnja za stabilan refinish proces.",
  },
];

export const refinishPhases: RefinishPhase[] = [
  {
    slug: "priprema",
    name: "Priprema",
    description: "Čišćenje, brušenje, gitovanje i priprema površine.",
    step: 1,
  },
  {
    slug: "podloga",
    name: "Podloga",
    description: "Prajmeri, punila i izolacija podloge pre bojenja.",
    step: 2,
  },
  {
    slug: "boja",
    name: "Boja",
    description: "Bazni sloj i usklađivanje nijanse vozila.",
    step: 3,
  },
  {
    slug: "lak",
    name: "Lak",
    description: "Bezbojni lak, sjaj i završna zaštita.",
    step: 4,
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    description: "Finalna dorada, korekcija i dubina sjaja.",
    step: 5,
  },
];

export const publicProgramGroups: PublicProgramGroup[] = [
  {
    slug: "boje-i-lakovi",
    name: "Boje i lakovi",
    shortName: "Boje",
    description:
      "Sistemi bojenja, bazne boje i završni lakovi za profesionalni refinish rezultat.",
    badges: ["Bazni sloj", "Lak", "Nijansiranje"],
    internalProgramSlugs: ["boje-i-lakovi"],
    phaseSlugs: ["boja", "lak"],
    brandSlugs: ["rm", "baslac", "norbin"],
    guidanceTitle: "Sistemi, finiš i podrška za nijansu",
    guidanceText:
      "Program boja i lakova povezuje bazni sloj, završni lak, izbor nijanse i tehničku podršku za stabilan rezultat u lakirnici.",
  },
  {
    slug: "priprema-i-abrazivi",
    name: "Priprema i abrazivi",
    shortName: "Priprema",
    description:
      "Gitovi, prajmeri, punila i abrazivi za stabilnu površinu pre bojenja.",
    badges: ["Git", "Prajmer", "Brušenje"],
    internalProgramSlugs: ["priprema-povrsine", "abrazivi"],
    phaseSlugs: ["priprema", "podloga"],
    brandSlugs: ["carsystem", "carfit", "rm"],
    guidanceTitle: "Priprema površine bez preskakanja faza",
    guidanceText:
      "Ovaj program pokriva ravnanje, izolaciju, brušenje i završnu pripremu površine pre nanošenja baznog sloja.",
  },
  {
    slug: "pistolji-i-oprema",
    name: "Pištolji i oprema",
    shortName: "Oprema",
    description:
      "Profesionalna oprema za precizno nanošenje materijala i kontrolu rada u lakirnici.",
    badges: ["Pištolji", "Dizne", "Kontrola nanosa"],
    internalProgramSlugs: ["oprema"],
    phaseSlugs: ["boja", "lak"],
    brandSlugs: ["sata", "carsystem", "autofit"],
    guidanceTitle: "Precizna oprema i kontrola aplikacije",
    guidanceText:
      "Pištolji, dizne i prateća oprema pomažu radionici da kontroliše nanos, potrošnju materijala i ponovljivost završnog sloja.",
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    shortName: "Poliranje",
    description:
      "Paste, podloške i rešenja za korekciju površine, dubinu sjaja i finalnu obradu.",
    badges: ["Korekcija", "Sjaj", "Finalna obrada"],
    internalProgramSlugs: ["poliranje"],
    phaseSlugs: ["poliranje"],
    brandSlugs: ["carsystem", "rm", "baslac", "befar", "rupes"],
    guidanceTitle: "Završna obrada, korekcija i sjaj",
    guidanceText:
      "Program poliranja je poslednji korak za uklanjanje tragova obrade, podizanje sjaja i usklađen finalni izgled površine.",
  },
  {
    slug: "potrosni-materijal",
    name: "Potrošni materijal",
    shortName: "Potrošni",
    description:
      "Maskiranje, sprejevi i radionički materijali za svakodnevni refinish proces.",
    badges: ["Maskiranje", "Sprejevi", "Radionica"],
    internalProgramSlugs: ["potrosni-materijal", "aerosoli"],
    phaseSlugs: ["priprema", "podloga", "poliranje"],
    brandSlugs: ["carsystem", "carfit", "cosmos-spray"],
    guidanceTitle: "Materijali za dnevni ritam radionice",
    guidanceText:
      "Potrošni program pokriva maskiranje, zaštitu, pomoćne sprejeve i artikle koji održavaju stabilan radni tok u radionici.",
  },
];

const placeholderProductImage = "/images/products/placeholder-product.svg";

const legacyProducts: CarsystemProduct[] = [
  {
    slug: "rm-diamont-bazna-boja",
    name: "R-M DIAMONT bazna boja",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription:
      "Bazna boja za profesionalno usklađivanje nijanse u refinish procesu.",
    longDescription:
      "DIAMONT je pozicioniran kao bazni sistem za radionice koje traže pregledan radni tok, stabilnu reprodukciju nijanse i tehničku podršku pri izboru formule. Stranica prikazuje ključne informacije za upit i povezivanje sa zvaničnim tehničkim listovima.",
    sku: "RM-DIA-BASE",
    packages: [
      { label: "0.5 L", detail: "Toneri i pomoćni materijali" },
      { label: "1 L" },
      { label: "3.5 L" },
    ],
    purpose: "Usklađivanje nijanse i bazni sloj pre bezbojnog laka",
    badges: ["Bazna boja", "R-M sistem", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "R-M DIAMONT bazna boja, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bazna boja, detalj ambalaže",
      },
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bazna boja, tehnički prikaz",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema formuli i tehničkom listu" },
      { label: "Viskozitet", value: "Podešava se po sistemu i uslovima rada" },
      { label: "Nanošenje", value: "Profesionalni pištolj za bazni sloj" },
      { label: "Sušenje", value: "Zavisno od sloja, temperature i protoka vazduha" },
      { label: "Pokrivnost", value: "Zavisno od nijanse i podloge" },
      { label: "Površina", value: "Pripremljena i odmašćena podloga" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Mešanje i nijanse",
        kind: "Baza formula",
        status: "disabled",
        note: "Dostupno kroz tehničku podršku",
      },
    ],
    relatedProductSlugs: [
      "rm-body-filler-white-b-2e11",
      "baslac-60-20-razredjivac",
      "satajet-x-5500",
      "carsystem-p19-brusni-diskovi",
    ],
    seoTitle: "R-M DIAMONT bazna boja",
    seoDescription:
      "R-M DIAMONT bazna boja u katalogu Carsystem i R-M Inđija, sa upitom, dokumentacijom i refinish fazom.",
  },
  {
    slug: "rm-diamont-bezbojni-lak",
    name: "R-M DIAMONT bezbojni lak",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription:
      "Bezbojni lak za završni sloj, sjaj i zaštitu farbane površine.",
    longDescription:
      "Bezbojni lak u DIAMONT programu je prikazan kao završni materijal za profesionalnu obradu nakon bazne boje. Stranica povezuje tehničke vrednosti po proizvodu, dokumentaciju i upit bez javnog naručivanja.",
    sku: "RM-DIA-CLEAR",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Set", detail: "Lak i prateći učvršćivači po ponudi" },
    ],
    purpose: "Završni sloj, sjaj i zaštita nakon bazne boje",
    badges: ["Bezbojni lak", "Završni sloj", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "R-M DIAMONT bezbojni lak, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bezbojni lak, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "2 sloja prema radioničkim uslovima" },
      { label: "Sušenje", value: "Zavisno od sistema, temperature i učvršćivača" },
      { label: "Pokrivnost", value: "Zavisno od debljine sloja" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "disabled",
        note: "Biće povezano sa zvaničnim dokumentom",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
      "baslac-900-basecoat",
      "carsystem-abraziv-p80-p2000",
      "carsystem-soft-plus-git",
    ],
  },
  {
    slug: "carsystem-soft-plus-git",
    name: "Carsystem Soft Plus git",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription:
      "Poliesterski git za ravnanje površine u pripremi pre podloge.",
    longDescription:
      "Soft Plus git predstavlja proizvod iz pripremne faze. Stranica prikazuje namenu, pakovanja, tehničke parametre i povezane proizvode bez javnog prikaza privatnih komercijalnih uslova.",
    sku: "CS-SOFT-PLUS",
    packages: [
      { label: "1.8 kg" },
      { label: "3 kg" },
      { label: "Set", detail: "Pakovanje sa učvršćivačem" },
    ],
    purpose: "Ravnanje i popunjavanje pre nanošenja prajmera ili punila",
    badges: ["Priprema", "Git", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem Soft Plus git, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem Soft Plus git, detalj ambalaže",
      },
      {
        src: placeholderProductImage,
        alt: "Carsystem Soft Plus git, radionički prikaz",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Sa učvršćivačem prema tehničkom listu" },
      { label: "Nanošenje", value: "Špahtlom na pripremljenu površinu" },
      { label: "Sušenje", value: "Zavisno od debljine sloja i temperature" },
      { label: "Površina", value: "Metal, stari premazi i pripremljene podloge" },
      { label: "Potrošnja", value: "Zavisno od neravnine i obima popravke" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "disabled",
        note: "U pripremi",
      },
    ],
    relatedProductSlugs: [
      "carsystem-git-multi-green",
      "carsystem-p19-brusni-diskovi",
      "rm-diamont-bazna-boja",
      "carsystem-finish-serija",
    ],
    seoTitle: "Carsystem Soft Plus git",
    seoDescription:
      "Carsystem Soft Plus git u katalogu Carsystem i R-M Inđija, sa tehničkim specifikacijama i upitom.",
  },
  {
    slug: "carsystem-abraziv-p80-p2000",
    name: "Carsystem abraziv P80-P2000",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription:
      "Abrazivni raspon za pripremu, oblikovanje i finalno matiranje površine.",
    longDescription:
      "Abrazivni program je prikazan kao modularan proizvod sa varijantama po granulaciji. Stranica podržava više pakovanja, jasnu namenu i veze ka proizvodima iz sledećih faza refinish procesa.",
    sku: "CS-ABR-P80-P2000",
    packages: [
      { label: "P80-P180", detail: "Gruba obrada" },
      { label: "P240-P600", detail: "Međufaze" },
      { label: "P800-P2000", detail: "Fina priprema" },
    ],
    purpose: "Brušenje, nivelisanje i priprema površine pre podloge i boje",
    badges: ["Abrazivi", "Više granulacija", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem abraziv P80-P2000, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem abraziv P80-P2000, detalj pakovanja",
      },
    ],
    specifications: [
      { label: "Površina", value: "Kit, prajmer, lak i pripremljene podloge" },
      { label: "Granulacija", value: "P80-P2000 prema fazi obrade" },
      { label: "Nanošenje", value: "Ručno ili mašinski, prema tipu nosača" },
      { label: "Potrošnja", value: "Zavisno od površine i načina rada" },
    ],
    documents: [
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "disabled",
        note: "Dodaje se po proizvodnoj liniji",
      },
    ],
    relatedProductSlugs: [
      "carsystem-soft-plus-git",
      "car-fit-prajmer",
      "rm-diamont-bazna-boja",
      "baslac-900-basecoat",
    ],
  },
  {
    slug: "satajet-x-5500",
    name: "SATAjet X 5500",
    brandSlug: "sata",
    programSlug: "oprema",
    phaseSlug: "boja",
    shortDescription:
      "Profesionalni pištolj za lakiranje za kontrolisano nanošenje materijala.",
    longDescription:
      "SATAjet X 5500 je predstavljen kao profesionalna oprema koja se povezuje sa fazama boje i laka. Stranica omogućava prikaz ključnih parametara opreme bez javnog naručivanja.",
    sku: "SATA-X5500",
    packages: [
      { label: "Pištolj" },
      { label: "Set dizni", detail: "Konfiguracija po upitu" },
    ],
    purpose: "Nanošenje baznih boja i lakova u profesionalnoj lakirnici",
    badges: ["Oprema", "Lakiranje", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "SATAjet X 5500, ilustrativni prikaz proizvoda",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "SATAjet X 5500, detalj proizvoda",
      },
    ],
    specifications: [
      { label: "Nanošenje", value: "Bazne boje i lakovi, prema konfiguraciji" },
      { label: "Površina", value: "Radionički refinish proces" },
      { label: "Potrošnja", value: "Zavisi od podešavanja i materijala" },
      { label: "Dokumentacija", value: "Model i konfiguracija se potvrđuju kroz upit" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "disabled",
        note: "Povezuje se sa tačnim modelom",
      },
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
      "baslac-30-s510-s-serija",
      "cosmos-spray-335-crni",
      "carsystem-p19-brusni-diskovi",
    ],
    seoTitle: "SATAjet X 5500",
    seoDescription:
      "SATAjet X 5500 u katalogu Carsystem i R-M Inđija, sa upitom i povezanim refinish proizvodima.",
  },
  {
    slug: "car-fit-prajmer",
    name: "Car Fit prajmer",
    brandSlug: "carfit",
    programSlug: "priprema-povrsine",
    phaseSlug: "podloga",
    shortDescription:
      "Prajmer za stabilnu podlogu između pripreme površine i nanošenja boje.",
    longDescription:
      "Car Fit prajmer je proizvod iz faze podloge. Stranica prikazuje tehničke informacije za korisnike koji traže proizvod, podršku ili najbližu prodavnicu.",
    sku: "CF-PRIMER",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Aerosol", detail: "Ako je dostupno u programu" },
    ],
    purpose: "Izolacija, prijanjanje i priprema podloge pre bazne boje",
    badges: ["Prajmer", "Podloga", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Car Fit prajmer, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Car Fit prajmer, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "Pištoljem ili prema tipu proizvoda" },
      { label: "Sušenje", value: "Prema debljini sloja i uslovima" },
      { label: "Površina", value: "Pripremljene metalne i obrađene površine" },
      { label: "Rok trajanja", value: "Prema deklaraciji" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "carsystem-soft-plus-git",
      "carsystem-abraziv-p80-p2000",
      "rm-diamont-bazna-boja",
      "baslac-900-basecoat",
    ],
  },
  {
    slug: "cosmos-spray-sprej",
    name: "Cosmos Spray sprej",
    brandSlug: "cosmos-spray",
    programSlug: "aerosoli",
    phaseSlug: "podloga",
    shortDescription:
      "Aerosol proizvod za brze popravke, pripremu i pomoćne radioničke zadatke.",
    longDescription:
      "Cosmos Spray je predstavljen kao aerosol artikl koji se u katalogu može povezati sa više namena. Template podržava status dokumentacije i jasnu CTA strukturu za upit ili pronalazak prodavnice.",
    sku: "COSMOS-SPRAY",
    packages: [
      { label: "400 ml" },
      { label: "Više nijansi", detail: "Po programu i dostupnosti" },
    ],
    purpose: "Brza intervencija, pomoćna priprema ili lokalna popravka",
    badges: ["Aerosol", "Servisna upotreba", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Cosmos Spray sprej, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Cosmos Spray sprej, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Nanošenje", value: "Aerosol sprej, prema uputstvu na ambalaži" },
      { label: "Površina", value: "Zavisno od namene i pripreme podloge" },
      { label: "Sušenje", value: "Prema proizvodu i uslovima rada" },
      { label: "Rok trajanja", value: "Prema deklaraciji" },
    ],
    documents: [
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "disabled",
        note: "Dodaje se po artiklu",
      },
    ],
    relatedProductSlugs: [
      "car-fit-prajmer",
      "carsystem-abraziv-p80-p2000",
      "satajet-x-5500",
      "rm-diamont-bezbojni-lak",
    ],
  },
  {
    slug: "baslac-900-basecoat",
    name: "Baslac 900 basecoat",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription:
      "Bazni sistem za refinish bojenje sa preglednom primenom u radionici.",
    longDescription:
      "Baslac 900 basecoat je proizvod iz iste faze refinish procesa. Struktura stranice omogućava poređenje po programu, fazi i dokumentaciji bez prikaza komercijalnih uslova.",
    sku: "BASLAC-900",
    packages: [
      { label: "0.5 L" },
      { label: "1 L" },
      { label: "3.5 L" },
    ],
    purpose: "Bazni sloj i izrada nijanse pre završnog laka",
    badges: ["Basecoat", "Boja", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Baslac 900 basecoat, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Baslac 900 basecoat, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema formuli i tehničkom listu" },
      { label: "Nanošenje", value: "Bazni sloj profesionalnim pištoljem" },
      { label: "Sušenje", value: "Zavisno od uslova u radionici" },
      { label: "Pokrivnost", value: "Zavisno od nijanse i podloge" },
      { label: "Površina", value: "Pripremljena podloga posle prajmera" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Mešanje i nijanse",
        kind: "Baza formula",
        status: "disabled",
        note: "Dostupno kroz tehničku podršku",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
      "rm-diamont-bezbojni-lak",
      "satajet-x-5500",
      "carsystem-abraziv-p80-p2000",
    ],
  },
  {
    slug: "norbin-2k-bezbojni-lak",
    name: "Norbin 2K bezbojni lak",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription:
      "Bezbojni lak za završni sloj i zaštitu u profesionalnoj obradi površine.",
    longDescription:
      "Norbin 2K bezbojni lak je deo Norbin programa u katalogu. Stranica povezuje upit, dokumentaciju i srodne refinish proizvode.",
    sku: "NORBIN-2K-CLEAR",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Set", detail: "Lak i prateći učvršćivač po upitu" },
    ],
    purpose: "Završni sloj, sjaj i zaštita nakon baznog sistema",
    badges: ["Bezbojni lak", "Završni sloj", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Norbin 2K bezbojni lak, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Norbin 2K bezbojni lak, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "Profesionalni pištolj za završni sloj" },
      { label: "Sušenje", value: "Zavisno od sistema i uslova u lakirnici" },
      { label: "Površina", value: "Bazni sloj spreman za lakiranje" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "disabled",
        note: "Biće povezano sa zvaničnim dokumentom",
      },
    ],
    relatedProductSlugs: [
      "baslac-900-basecoat",
      "rm-diamont-bezbojni-lak",
      "rm-diamont-bazna-boja",
      "satajet-x-5500",
    ],
  },
  {
    slug: "carsystem-finish-cut-polir-pasta",
    name: "Carsystem Finish Cut polir pasta",
    brandSlug: "carsystem",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription:
      "Pasta za korekciju i završnu obradu lakirane površine posle refinish procesa.",
    longDescription:
      "Finish Cut je proizvod za poliranje u katalogu. Namenjen je završnoj fazi procesa, povezivanju sa tehničkom podrškom i dokumentima bez prikaza komercijalnih uslova.",
    sku: "CS-FINISH-CUT",
    packages: [
      { label: "250 ml" },
      { label: "1 L" },
      { label: "Set", detail: "Pasta i prateća podloška po upitu" },
    ],
    purpose: "Korekcija tragova obrade, završni sjaj i finalna dorada laka",
    badges: ["Poliranje", "Finalna obrada", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem Finish Cut polir pasta, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem Finish Cut polir pasta, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Nanošenje", value: "Mašinski ili ručno, prema stanju površine" },
      { label: "Površina", value: "Očvrsli bezbojni lak i pripremljene površine" },
      { label: "Potrošnja", value: "Zavisno od površine i nivoa korekcije" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "disabled",
        note: "Dodaje se po proizvodnoj liniji",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bezbojni-lak",
      "carsystem-abraziv-p80-p2000",
      "carsystem-maskirna-traka",
      "carsystem-soft-plus-git",
    ],
  },
  {
    slug: "carsystem-maskirna-traka",
    name: "Carsystem maskirna traka",
    brandSlug: "carsystem",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription:
      "Potrošni materijal za precizno maskiranje tokom pripreme i lakiranja.",
    longDescription:
      "Maskirna traka predstavlja potrošni materijal u katalogu. Stranica prikazuje namenu i osnovne informacije bez lagera ili naručivanja.",
    sku: "CS-MASK-TAPE",
    packages: [
      { label: "19 mm" },
      { label: "38 mm" },
      { label: "50 mm" },
    ],
    purpose: "Maskiranje ivica, zaštita površina i radionička priprema",
    badges: ["Potrošni materijal", "Maskiranje", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem maskirna traka, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem maskirna traka, detalj pakovanja",
      },
    ],
    specifications: [
      { label: "Površina", value: "Pripremljene, čiste i suve radioničke površine" },
      { label: "Nanošenje", value: "Ručno maskiranje prema ivici popravke" },
      { label: "Potrošnja", value: "Zavisno od obima popravke i zone zaštite" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "disabled",
        note: "Dodaje se po proizvodnoj liniji",
      },
    ],
    relatedProductSlugs: [
      "carsystem-abraziv-p80-p2000",
      "carsystem-soft-plus-git",
      "car-fit-prajmer",
      "cosmos-spray-sprej",
    ],
  },
];

type ProductSeed = Omit<CarsystemProduct, "badges" | "documents" | "galleryImages" | "productImage"> & {
  badges: string[];
  documents?: ProductDocument[];
  galleryImages?: ProductImageAsset[];
  productImage?: ProductImageAsset | null;
};

type ProductAssetUpdate = {
  documents?: ProductDocument[];
  galleryImages?: ProductImageAsset[];
  productImage: ProductImageAsset;
};

function archivedProduct(slug: string) {
  const product = legacyProducts.find((item) => item.slug === slug);
  if (!product) {
    throw new Error(`Missing archived product: ${slug}`);
  }

  return product;
}

function productAsset(src: string, alt: string): ProductImageAsset {
  return { src, alt };
}

function withProductAssets(
  product: CarsystemProduct,
  { documents, galleryImages = [], productImage }: ProductAssetUpdate,
): CarsystemProduct {
  return {
    ...product,
    productImage,
    galleryImages,
    documents: documents ?? product.documents,
  };
}

function tdsDocument(href: string): ProductDocument {
  return {
    title: "Tehnički list",
    kind: "PDF",
    href,
    status: "available",
    note: "Dostupno iz dostavljenog TDS materijala.",
  };
}

function documentsWithTds(productName: string, href: string): ProductDocument[] {
  return [
    tdsDocument(href),
    {
      title: "Bezbednosni list",
      kind: "PDF",
      status: "placeholder",
      note: `Dostupno na upit za ${productName}.`,
    },
    {
      title: "Uputstvo za upotrebu",
      kind: "PDF",
      status: "disabled",
      note: "U pripremi za javni katalog.",
    },
  ];
}

function documentsOnRequest(productName: string): ProductDocument[] {
  return [
    {
      title: "Tehnički list",
      kind: "PDF",
      status: "placeholder",
      note: `Dostupno na upit za ${productName}.`,
    },
    {
      title: "Bezbednosni list",
      kind: "PDF",
      status: "placeholder",
      note: "Dostavlja se kada je primenljivo za potvrđen artikal.",
    },
    {
      title: "Uputstvo za upotrebu",
      kind: "PDF",
      status: "disabled",
      note: "U pripremi za javni katalog.",
    },
  ];
}

function createProduct(seed: ProductSeed): CarsystemProduct {
  const image = seed.productImage ?? {
    src: placeholderProductImage,
    alt: `${seed.name}, ilustrativni prikaz proizvoda`,
  };

  return {
    ...seed,
    badges: seed.badges.includes("Na upit") ? seed.badges : [...seed.badges, "Na upit"],
    productImage: image,
    galleryImages: seed.galleryImages ?? [],
    documents: seed.documents ?? documentsOnRequest(seed.name),
  };
}

const befarPadColors = [
  {
    label: "narandžasti",
    labelTitle: "Narandžasti",
    slug: "narandzasti",
    sku: "OR",
    role: "Srednja korekcija i ujednačavanje traga poliranja.",
  },
  {
    label: "crni",
    labelTitle: "Crni",
    slug: "crni",
    sku: "BK",
    role: "Fina završna obrada i kontrola holograma.",
  },
  {
    label: "beli",
    labelTitle: "Beli",
    slug: "beli",
    sku: "WH",
    role: "Kontrolisana korekcija na pripremljenom laku.",
  },
  {
    label: "plavi",
    labelTitle: "Plavi",
    slug: "plavi",
    sku: "BL",
    role: "Završni sjaj i finalno ujednačavanje površine.",
  },
] as const;

const befarPadSizes = [
  {
    label: "25 mm x 150 mm",
    slug: "25x150",
    detail: "Uska kontaktna površina",
  },
  {
    label: "50 mm x 150 mm",
    slug: "50x150",
    detail: "Šira kontaktna površina",
  },
] as const;

const befarPadProducts = befarPadColors.flatMap((color) =>
  befarPadSizes.map((size) =>
    createProduct({
      slug: `befar-sundjer-${color.slug}-${size.slug}`,
      name: `Befar sunđer ${color.label} ${size.slug}`,
      brandSlug: "befar",
      programSlug: "poliranje",
      phaseSlug: "poliranje",
      shortDescription: `Sunđer za poliranje, ${color.label} izvedba, dimenzija ${size.label}.`,
      longDescription:
        "Befar sunđeri su prikazani kao radionički potrošni program za korekciju, završnu obradu i kontrolu sjaja. Varijante su odvojene po boji i dimenziji kako bi upit bio precizan.",
      sku: `BEFAR-PAD-${color.sku}-${size.slug.toUpperCase()}`,
      packages: [{ label: size.label, detail: size.detail }],
      purpose: color.role,
      badges: ["Sunđer", color.labelTitle, "Poliranje", "Na upit"],
      productImage: productAsset(
        `/products/befar/befar-sundjer-${color.slug}-${size.slug}.svg`,
        `Befar sunđer ${color.label} ${size.label}`,
      ),
      specifications: [
        { label: "Boja", value: color.labelTitle },
        { label: "Dimenzija", value: size.label },
        { label: "Primena", value: "Mašinsko ili ručno poliranje prema nosaču" },
        { label: "Faza", value: "Završna obrada laka" },
      ],
      relatedProductSlugs: [
        `befar-sundjer-${color.slug}-${size.slug === "25x150" ? "50x150" : "25x150"}`,
        "carsystem-finish-serija",
        "rm-pasta-190-1l",
      ],
    }),
  ),
);

export const products: CarsystemProduct[] = [
  withProductAssets(archivedProduct("rm-diamont-bazna-boja"), {
    productImage: productAsset(
      "/products/rm/rm-diamont-bazna-boja.jpg",
      "R-M DIAMONT bazna boja u limenci",
    ),
  }),
  archivedProduct("rm-diamont-bezbojni-lak"),
  createProduct({
    slug: "rm-body-filler-white-b-2e11",
    name: "R-M Body Filler White B 2E11",
    brandSlug: "rm",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Beli body filler za ravnanje i pripremu površine pre podloge.",
    longDescription:
      "R-M Body Filler White B 2E11 je pozicioniran kao pripremni proizvod za popunjavanje, ravnanje i stabilnu osnovu pre nanošenja prajmera ili punila.",
    sku: "RM-BF-WHITE-B-2E11",
    packages: [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit" }],
    purpose: "Gitovanje, ravnanje i lokalna priprema površine",
    badges: ["Body filler", "Git", "Priprema", "Na upit"],
    productImage: productAsset(
      "/products/rm/rm-body-filler-white-b-2e11.jpg",
      "R-M Body Filler White B 2E11 sa učvršćivačem",
    ),
    specifications: [
      { label: "Tip", value: "Body filler / git" },
      { label: "Boja", value: "Bela" },
      { label: "Nanošenje", value: "Špahtlom na pripremljenu površinu" },
      { label: "Sledeća faza", value: "Brušenje i podloga" },
    ],
    relatedProductSlugs: [
      "carsystem-p19-brusni-diskovi",
      "carsystem-soft-plus-git",
      "rm-diamont-bazna-boja",
    ],
  }),
  createProduct({
    slug: "rm-pasta-190-1l",
    name: "R-M Pasta 190 1 L",
    brandSlug: "rm",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription: "Pasta za poliranje u pakovanju 1 L za završnu obradu laka.",
    longDescription:
      "R-M Pasta 190 u pakovanju 1 L je prikazana kao profesionalna pasta za korekciju i završnu obradu nakon lakiranja, sa upitom za dostupnost i prateću dokumentaciju.",
    sku: "RM-PASTA-190-1L",
    packages: [{ label: "1 L" }],
    purpose: "Korekcija površine i priprema finalnog sjaja",
    badges: ["Pasta", "Poliranje", "Na upit"],
    productImage: productAsset(
      "/products/rm/rm-pasta-190-1l.jpg",
      "R-M DIAMONT BC 190 proizvod u limenci",
    ),
    specifications: [
      { label: "Pakovanje", value: "1 L" },
      { label: "Primena", value: "Poliranje očvrslog laka" },
      { label: "Nanošenje", value: "Mašinski ili ručno prema stanju površine" },
      { label: "Faza", value: "Poliranje" },
    ],
    relatedProductSlugs: ["rm-pasta-190-5l", "befar-sundjer-crni-25x150", "carsystem-finish-serija"],
  }),
  createProduct({
    slug: "rm-pasta-190-5l",
    name: "R-M Pasta 190 5 L",
    brandSlug: "rm",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription: "Radioničko pakovanje paste za poliranje i završnu obradu laka.",
    longDescription:
      "R-M Pasta 190 u pakovanju 5 L namenjena je radionicama koje traže veće pakovanje za kontinuiran rad na korekciji i finalnom sjaju.",
    sku: "RM-PASTA-190-5L",
    packages: [{ label: "5 L" }],
    purpose: "Poliranje većeg obima i završna obrada lakirane površine",
    badges: ["Pasta", "Radioničko pakovanje", "Na upit"],
    productImage: productAsset(
      "/products/rm/rm-pasta-190-5l.jpg",
      "R-M DIAMONT BC 605 proizvod u limenci",
    ),
    specifications: [
      { label: "Pakovanje", value: "5 L" },
      { label: "Primena", value: "Korekcija i završni sjaj" },
      { label: "Površina", value: "Očvrsli bezbojni lak" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["rm-pasta-190-1l", "befar-sundjer-crni-50x150", "carsystem-finish-serija"],
  }),
  createProduct({
    slug: "carsystem-git-multi-green",
    name: "Carsystem Git Multi Green",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Višenamenski zeleni git za pripremu i ravnanje površine.",
    longDescription:
      "Carsystem Git Multi Green je deo pripremne faze za popunjavanje, ravnanje i stvaranje stabilne osnove pre brušenja i podloge.",
    sku: "CS-GIT-MULTI-GREEN",
    packages: [
      { label: "1.8 kg" },
      { label: "2 kg" },
    ],
    purpose: "Ravnanje površine i popunjavanje neravnina pre brušenja",
    badges: ["Git", "Priprema", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-git-multi-green.jpg",
      "Carsystem Git Multi Green u limenci",
    ),
    documents: documentsWithTds(
      "Carsystem Git Multi Green",
      "/documents/products/carsystem/carsystem-git-multi-green-tds.pdf",
    ),
    specifications: [
      { label: "Tip", value: "Body filler / git" },
      { label: "Boja", value: "Zelena" },
      { label: "Pakovanje", value: "1.8 kg / 2 kg" },
      { label: "Nanošenje", value: "Špahtlom uz prateći učvršćivač" },
    ],
    relatedProductSlugs: [
      "carsystem-soft-plus-git",
      "carsystem-p19-brusni-diskovi",
      "rm-body-filler-white-b-2e11",
    ],
  }),
  createProduct({
    slug: "carsystem-git-elastic-weiss",
    name: "Carsystem Git Elastic Weiss",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Elastični beli git za pripremne radove i finije ravnanje.",
    longDescription:
      "Carsystem Git Elastic Weiss je pozicioniran kao beli pripremni git za radionice kojima je potrebna kontrola ravnanja i stabilan nastavak procesa brušenja.",
    sku: "CS-GIT-ELASTIC-WEISS",
    packages: [
      { label: "1 kg" },
      { label: "1.8 kg" },
    ],
    purpose: "Elastično popunjavanje i ravnanje pre podloge",
    badges: ["Git", "Beli", "Priprema", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-git-elastic-weiss.png",
      "Carsystem Git Elastic Weiss u limenci",
    ),
    documents: documentsWithTds(
      "Carsystem Git Elastic Weiss",
      "/documents/products/carsystem/carsystem-git-elastic-weiss-tds.pdf",
    ),
    specifications: [
      { label: "Tip", value: "Elastični git" },
      { label: "Boja", value: "Bela" },
      { label: "Pakovanje", value: "1 kg / 1.8 kg" },
      { label: "Obrada", value: "Brušenje nakon sušenja prema tehničkom listu" },
    ],
    relatedProductSlugs: [
      "carsystem-git-multi-green",
      "carsystem-f19-brusni-diskovi",
      "carsystem-p23-brusni-diskovi",
    ],
  }),
  archivedProduct("carsystem-soft-plus-git"),
  createProduct({
    slug: "carsystem-p19-brusni-diskovi",
    name: "Carsystem P19 brusni diskovi",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription: "Brusni diskovi u rasponu granulacija P40-P800 za pripremu površine.",
    longDescription:
      "Carsystem P19 brusni diskovi pokrivaju grubu i međufaznu obradu u pripremi površine, sa granulacijama za ravnanje, matiranje i kontrolisanu obradu.",
    sku: "CS-P19-DISC",
    packages: [{ label: "P40-P800", detail: "Granulacije po izboru" }],
    purpose: "Brušenje gita, podloge i pripremljenih površina",
    badges: ["Abrazivi", "P40-P800", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-p19-brusni-diskovi.png",
      "Carsystem P19 brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-p19-brusni-diskovi-detail.jpg",
        "Carsystem P19 brusni diskovi, dodatni prikaz",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem P19 brusni diskovi",
      "/documents/products/carsystem/carsystem-p19-brusni-diskovi-tds.pdf",
    ),
    specifications: [
      { label: "Granulacija", value: "P40-P800" },
      { label: "Forma", value: "Brusni diskovi" },
      { label: "Primena", value: "Mašinsko brušenje" },
      { label: "Faza", value: "Priprema površine" },
    ],
    relatedProductSlugs: [
      "carsystem-p23-brusni-diskovi",
      "carsystem-git-multi-green",
      "carsystem-soft-plus-git",
    ],
  }),
  createProduct({
    slug: "carsystem-f19-brusni-diskovi",
    name: "Carsystem F19 brusni diskovi",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription: "Brusni diskovi P80-P800 za kontrolisanu pripremu i međufaznu obradu.",
    longDescription:
      "Carsystem F19 brusni diskovi su deo abrazivnog programa za pripremu površine, od obrade gita do finije pripreme pre naredne faze.",
    sku: "CS-F19-DISC",
    packages: [{ label: "P80-P800", detail: "Granulacije po izboru" }],
    purpose: "Međufazno brušenje i priprema za podlogu ili boju",
    badges: ["Abrazivi", "P80-P800", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-f19-brusni-diskovi.png",
      "Carsystem F19 brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-f19-brusni-diskovi-detail.jpg",
        "Carsystem F19 brusni diskovi, dodatni prikaz",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem F19 brusni diskovi",
      "/documents/products/carsystem/carsystem-f19-brusni-diskovi-tds.pdf",
    ),
    specifications: [
      { label: "Granulacija", value: "P80-P800" },
      { label: "Forma", value: "Brusni diskovi" },
      { label: "Nosač", value: "Prema varijanti proizvoda" },
      { label: "Primena", value: "Suvo brušenje u pripremi" },
    ],
    relatedProductSlugs: [
      "carsystem-f23-brusni-diskovi",
      "carsystem-git-elastic-weiss",
      "carsystem-finish-serija",
    ],
  }),
  createProduct({
    slug: "carsystem-f23-brusni-diskovi",
    name: "Carsystem F23 brusni diskovi",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription: "Nova serija brusnih diskova za preciznu pripremu površine.",
    longDescription:
      "Carsystem F23 je prikazan kao nova generacija abrazivnog programa, sa fokusom na stabilan radni tok i izbor granulacije prema fazi obrade.",
    sku: "CS-F23-DISC",
    packages: [{ label: "Granulacije na upit", detail: "Nova serija" }],
    purpose: "Precizna priprema i međufazna obrada površine",
    badges: ["Abrazivi", "Nova serija", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-f23-brusni-diskovi.png",
      "Carsystem F23 brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-f23-brusni-diskovi-detail-1.jpg",
        "Carsystem F23 brusni diskovi, dodatni prikaz",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem F23 brusni diskovi",
      "/documents/products/carsystem/carsystem-f23-brusni-diskovi-tds.pdf",
    ),
    specifications: [
      { label: "Serija", value: "F23" },
      { label: "Forma", value: "Brusni diskovi" },
      { label: "Granulacija", value: "Potvrđuje se kroz upit" },
      { label: "Primena", value: "Priprema površine i međufaze" },
    ],
    relatedProductSlugs: [
      "carsystem-f19-brusni-diskovi",
      "carsystem-p23-brusni-diskovi",
      "carsystem-git-elastic-weiss",
    ],
  }),
  createProduct({
    slug: "carsystem-p23-brusni-diskovi",
    name: "Carsystem P23 brusni diskovi",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription: "Nova serija P23 brusnih diskova za pripremu i obradu površine.",
    longDescription:
      "Carsystem P23 brusni diskovi proširuju abrazivni program novom serijom za pripremne i međufazne radove u karoserijskoj i lakirerskoj radionici.",
    sku: "CS-P23-DISC",
    packages: [{ label: "Granulacije na upit", detail: "Nova serija" }],
    purpose: "Brušenje i kontrolisana priprema površine",
    badges: ["Abrazivi", "Nova serija", "Na upit"],
    specifications: [
      { label: "Serija", value: "P23" },
      { label: "Forma", value: "Brusni diskovi" },
      { label: "Granulacija", value: "Potvrđuje se kroz upit" },
      { label: "Faza", value: "Priprema" },
    ],
    relatedProductSlugs: [
      "carsystem-p19-brusni-diskovi",
      "carsystem-f23-brusni-diskovi",
      "carsystem-git-multi-green",
    ],
  }),
  createProduct({
    slug: "carsystem-finish-serija",
    name: "Carsystem Finish serija",
    brandSlug: "carsystem",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription: "Finish serija za fino matiranje, korekciju i završnu pripremu sjaja.",
    longDescription:
      "Carsystem Finish serija povezuje fine granulacije i završnu obradu površine pre ili tokom poliranja, zavisno od radioničkog procesa.",
    sku: "CS-FINISH-SERIES",
    packages: [
      { label: "P1000" },
      { label: "P1200" },
      { label: "P1500" },
      { label: "P2000" },
    ],
    purpose: "Fina obrada i priprema površine za završni sjaj",
    badges: ["Finish", "Poliranje", "P1000-P2000", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-finish-serija.png",
      "Carsystem Finish serija brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-finish-serija-packovanje.webp",
        "Carsystem Finish serija u pakovanju",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem Finish serija",
      "/documents/products/carsystem/carsystem-finish-serija-tds.pdf",
    ),
    specifications: [
      { label: "Granulacija", value: "P1000 / P1200 / P1500 / P2000" },
      { label: "Primena", value: "Fina završna obrada" },
      { label: "Površina", value: "Lak i pripremljene površine" },
      { label: "Faza", value: "Poliranje ili fina priprema" },
    ],
    relatedProductSlugs: [
      "befar-sundjer-plavi-50x150",
      "rm-pasta-190-1l",
      "carsystem-f19-brusni-diskovi",
    ],
  }),
  createProduct({
    slug: "carsystem-zastitno-odelo",
    name: "Carsystem zaštitno odelo",
    brandSlug: "carsystem",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription: "Zaštitno odelo za rad u pripremi, lakirnici i završnoj obradi.",
    longDescription:
      "Carsystem zaštitno odelo je potrošni radionički artikal za uredniji i bezbedniji radni proces u pripremi i lakiranju.",
    sku: "CS-PROTECTIVE-SUIT",
    packages: [{ label: "Komad" }],
    purpose: "Zaštita korisnika i smanjenje kontaminacije radne zone",
    badges: ["Zaštita", "Potrošni materijal", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-zastitno-odelo.png",
      "Carsystem zaštitno odelo",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-zastitno-odelo-detail-1.jpg",
        "Carsystem zaštitno odelo, dodatni prikaz",
      ),
      productAsset(
        "/products/carsystem/carsystem-zastitno-odelo-detail-2.jpg",
        "Carsystem zaštitno odelo, detalj proizvoda",
      ),
    ],
    specifications: [
      { label: "Pakovanje", value: "Komad" },
      { label: "Primena", value: "Priprema, lakiranje i završna obrada" },
      { label: "Veličina", value: "Potvrđuje se kroz upit" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: [
      "carfit-maskirna-folija-4x150m",
      "carsystem-p19-brusni-diskovi",
      "cosmos-spray-300",
    ],
  }),
  createProduct({
    slug: "baslac-35-m331-pasta",
    name: "Baslac 35-M331 pasta",
    brandSlug: "baslac",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription: "Pasta u pakovanju 0.5 L za korekciju i završnu obradu.",
    longDescription:
      "Baslac 35-M331 pasta je deo programa za završnu obradu, prikazana sa jasnim pakovanjem i upitom za tehničku potvrdu primene.",
    sku: "BASLAC-35-M331",
    packages: [{ label: "0.5 L" }],
    purpose: "Poliranje i završno ujednačavanje površine",
    badges: ["Pasta", "0.5 L", "Na upit"],
    productImage: productAsset(
      "/products/baslac/baslac-35-m331-pasta.webp",
      "Baslac proizvod iz programa boja i lakova",
    ),
    specifications: [
      { label: "Pakovanje", value: "0.5 L" },
      { label: "Primena", value: "Završna obrada laka" },
      { label: "Nanošenje", value: "Mašinski ili ručno prema procesu" },
      { label: "Faza", value: "Poliranje" },
    ],
    relatedProductSlugs: ["befar-sundjer-beli-50x150", "rm-pasta-190-1l", "carsystem-finish-serija"],
  }),
  createProduct({
    slug: "baslac-30-s510-s-serija",
    name: "Baslac 30-S510 S serija",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Baslac S serija za rad u sistemu boja i pratećih materijala.",
    longDescription:
      "Baslac 30-S510 S serija je prikazana kao proizvod iz programa boja i lakova, sa pakovanjem koje se potvrđuje kroz upit.",
    sku: "BASLAC-30-S510",
    packages: [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit" }],
    purpose: "Rad u sistemu boja i pratećih materijala",
    badges: ["S serija", "Boje i lakovi", "Na upit"],
    productImage: productAsset(
      "/products/baslac/baslac-30-s510-s-serija.webp",
      "Baslac proizvod iz programa boja i lakova",
    ),
    specifications: [
      { label: "Serija", value: "30-S510 S" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Pakovanje", value: "Na upit" },
      { label: "Primena", value: "Prema tehničkom listu i sistemu" },
    ],
    relatedProductSlugs: ["baslac-60-20-razredjivac", "baslac-35-m214", "rm-diamont-bazna-boja"],
  }),
  createProduct({
    slug: "baslac-35-m214",
    name: "Baslac 35-M214",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Baslac 35-M214 u pakovanju 3.5 L za završni refinish proces.",
    longDescription:
      "Baslac 35-M214 je proizvod iz programa boja i lakova sa naglašenim pakovanjem 3.5 L i upitom za potvrdu tehničke namene.",
    sku: "BASLAC-35-M214",
    packages: [{ label: "3.5 L" }],
    purpose: "Završni refinish rad prema tehničkom sistemu",
    badges: ["3.5 L", "Boje i lakovi", "Na upit"],
    productImage: productAsset(
      "/products/baslac/baslac-35-m214.jpg",
      "Baslac proizvod iz programa boja i lakova",
    ),
    specifications: [
      { label: "Pakovanje", value: "3.5 L" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Primena", value: "Prema tehničkom listu" },
      { label: "Faza", value: "Lak / završni sloj" },
    ],
    relatedProductSlugs: ["baslac-30-s510-s-serija", "baslac-60-20-razredjivac", "satajet-x-5500"],
  }),
  createProduct({
    slug: "baslac-60-20-razredjivac",
    name: "Baslac 60-20 razređivač",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Razređivač u pakovanju 5 L za rad u Baslac sistemu.",
    longDescription:
      "Baslac 60-20 razređivač je pomoćni proizvod u programu boja i lakova, prikazan sa jasnim upitom za dostupnost.",
    sku: "BASLAC-60-20-5L",
    packages: [{ label: "5 L" }],
    purpose: "Podešavanje sistema prema tehničkom listu",
    badges: ["Razređivač", "5 L", "Na upit"],
    productImage: productAsset(
      "/products/baslac/baslac-60-20-razredjivac.jpg",
      "Baslac proizvod iz programa boja i lakova",
    ),
    specifications: [
      { label: "Pakovanje", value: "5 L" },
      { label: "Tip", value: "Razređivač" },
      { label: "Primena", value: "Prema Baslac tehničkom sistemu" },
      { label: "Faza", value: "Boja" },
    ],
    relatedProductSlugs: ["baslac-30-s510-s-serija", "rm-diamont-bazna-boja", "satajet-x-5500"],
  }),
  createProduct({
    slug: "norbin-n15-020-5l",
    name: "Norbin N15-020 5 L",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Norbin N15-020 u pakovanju 5 L za refinish program boja i lakova.",
    longDescription:
      "Norbin N15-020 5 L je prikazan kao radioničko pakovanje iz programa boja i lakova, sa upitom za potvrdu primene i dostupnosti.",
    sku: "NORBIN-N15-020-5L",
    packages: [{ label: "5 L" }],
    purpose: "Radionički refinish proces u programu boja i lakova",
    badges: ["5 L", "Boje i lakovi", "Na upit"],
    specifications: [
      { label: "Šifra", value: "N15-020" },
      { label: "Pakovanje", value: "5 L" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["norbin-n15-020-1l", "baslac-35-m214", "rm-diamont-bazna-boja"],
  }),
  createProduct({
    slug: "norbin-n15-020-1l",
    name: "Norbin N15-020 1 L",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Norbin N15-020 u pakovanju 1 L za manje potrebe i dopunu programa.",
    longDescription:
      "Norbin N15-020 1 L dopunjuje istoimeni artikal u većem pakovanju i omogućava precizniji upit prema potrebama radionice.",
    sku: "NORBIN-N15-020-1L",
    packages: [{ label: "1 L" }],
    purpose: "Dopuna refinish programa u manjem pakovanju",
    badges: ["1 L", "Boje i lakovi", "Na upit"],
    productImage: productAsset(
      "/products/norbin/norbin-n15-020-1l.jpg",
      "Norbin N15-020 proizvod u pakovanju 1 L",
    ),
    specifications: [
      { label: "Šifra", value: "N15-020" },
      { label: "Pakovanje", value: "1 L" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["norbin-n15-020-5l", "baslac-60-20-razredjivac", "rm-diamont-bazna-boja"],
  }),
  createProduct({
    slug: "carfit-maskirna-folija-4x5m",
    name: "Car Fit maskirna folija 4 x 5 m",
    brandSlug: "carfit",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription: "Maskirna folija 4 x 5 m za zaštitu površina tokom pripreme i lakiranja.",
    longDescription:
      "Car Fit maskirna folija 4 x 5 m je potrošni artikal za brzu zaštitu vozila i radne zone tokom pripreme i lakiranja.",
    sku: "CARFIT-FILM-4X5M",
    packages: [{ label: "4 x 5 m" }],
    purpose: "Maskiranje i zaštita površina u pripremnoj fazi",
    badges: ["Maskiranje", "Folija", "Na upit"],
    productImage: productAsset(
      "/products/carfit/carfit-maskirna-folija-4x5m.jpg",
      "Car Fit maskirna folija u pakovanju",
    ),
    specifications: [
      { label: "Dimenzija", value: "4 x 5 m" },
      { label: "Tip", value: "Maskirna folija" },
      { label: "Primena", value: "Zaštita vozila i delova" },
      { label: "Faza", value: "Priprema" },
    ],
    relatedProductSlugs: ["carfit-maskirna-folija-4x150m", "carsystem-zastitno-odelo", "cosmos-spray-300"],
  }),
  createProduct({
    slug: "carfit-maskirna-folija-4x150m",
    name: "Car Fit maskirna folija 4 x 150 m",
    brandSlug: "carfit",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription: "Maskirna folija u rolni 4 x 150 m za radioničku potrošnju.",
    longDescription:
      "Car Fit maskirna folija u rolni 4 x 150 m namenjena je radionicama kojima treba kontinuirana zaštita i maskiranje u svakodnevnom procesu.",
    sku: "CARFIT-FILM-4X150M",
    packages: [{ label: "4 x 150 m" }],
    purpose: "Radioničko maskiranje većeg obima",
    badges: ["Maskiranje", "Rolna", "Na upit"],
    specifications: [
      { label: "Dimenzija", value: "4 x 150 m" },
      { label: "Tip", value: "Maskirna folija u rolni" },
      { label: "Primena", value: "Zaštita vozila tokom pripreme i lakiranja" },
      { label: "Faza", value: "Priprema" },
    ],
    relatedProductSlugs: ["carfit-maskirna-folija-4x5m", "carsystem-zastitno-odelo", "carsystem-p19-brusni-diskovi"],
  }),
  ...befarPadProducts,
  createProduct({
    slug: "cosmos-spray-335-crni",
    name: "Cosmos Spray 335 crni",
    brandSlug: "cosmos-spray",
    programSlug: "aerosoli",
    phaseSlug: "podloga",
    shortDescription: "Crni aerosol iz Cosmos Spray programa za brze radioničke intervencije.",
    longDescription:
      "Cosmos Spray 335 crni je aerosol artikal za pomoćne radioničke radove, manje intervencije i dopunu potrošnog programa.",
    sku: "COSMOS-335-BLACK",
    packages: [{ label: "Na upit", detail: "Aerosol pakovanje" }],
    purpose: "Brza intervencija i pomoćna aerosol primena",
    badges: ["Aerosol", "Crni", "Na upit"],
    productImage: productAsset(
      "/products/cosmos-spray/cosmos-spray-335-crni.png",
      "Cosmos Spray 335 crni aerosol",
    ),
    specifications: [
      { label: "Šifra", value: "335" },
      { label: "Boja", value: "Crna" },
      { label: "Forma", value: "Aerosol" },
      { label: "Primena", value: "Prema uputstvu na ambalaži" },
    ],
    relatedProductSlugs: ["cosmos-spray-300", "cosmos-flame-blue-fb-904-deep-black", "carfit-maskirna-folija-4x5m"],
  }),
  createProduct({
    slug: "cosmos-spray-300",
    name: "Cosmos Spray 300",
    brandSlug: "cosmos-spray",
    programSlug: "aerosoli",
    phaseSlug: "podloga",
    shortDescription: "Aerosol artikal iz Cosmos Spray programa za servisne i pomoćne radove.",
    longDescription:
      "Cosmos Spray 300 je prikazan kao aerosol proizvod za brzu dopunu radioničkog programa, sa tehničkim detaljima koji se potvrđuju kroz upit.",
    sku: "COSMOS-300",
    packages: [{ label: "Na upit", detail: "Aerosol pakovanje" }],
    purpose: "Pomoćni aerosol radovi u servisu i radionici",
    badges: ["Aerosol", "Servisna upotreba", "Na upit"],
    productImage: productAsset(
      "/products/cosmos-spray/cosmos-spray-300.png",
      "Cosmos Lac aerosol proizvod",
    ),
    specifications: [
      { label: "Šifra", value: "300" },
      { label: "Forma", value: "Aerosol" },
      { label: "Primena", value: "Prema nameni i pripremi podloge" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["cosmos-spray-335-crni", "cosmos-flame-orange-fo-420-viola-dark", "carsystem-zastitno-odelo"],
  }),
  createProduct({
    slug: "cosmos-flame-blue-fb-904-deep-black",
    name: "Flame Blue FB 904 Deep Black",
    brandSlug: "cosmos-spray",
    programSlug: "aerosoli",
    phaseSlug: "boja",
    shortDescription: "Aerosol nijansa Deep Black u pakovanju 400 ml.",
    longDescription:
      "Flame Blue FB 904 Deep Black je aerosol proizvod u pakovanju 400 ml, prikazan kao konkretna nijansa za upit i tehničku proveru.",
    sku: "COSMOS-FB-904",
    packages: [{ label: "400 ml" }],
    purpose: "Aerosol bojenje i lokalna dopuna nijanse",
    badges: ["Aerosol", "400 ml", "Deep Black", "Na upit"],
    specifications: [
      { label: "Šifra", value: "FB 904" },
      { label: "Nijansa", value: "Deep Black" },
      { label: "Pakovanje", value: "400 ml" },
      { label: "Forma", value: "Aerosol" },
    ],
    relatedProductSlugs: ["cosmos-flame-orange-fo-420-viola-dark", "cosmos-spray-335-crni", "satajet-x-5500"],
  }),
  createProduct({
    slug: "cosmos-flame-orange-fo-420-viola-dark",
    name: "Flame Orange FO 420 Viola Dark",
    brandSlug: "cosmos-spray",
    programSlug: "aerosoli",
    phaseSlug: "boja",
    shortDescription: "Aerosol nijansa Viola Dark u pakovanju 400 ml.",
    longDescription:
      "Flame Orange FO 420 Viola Dark je konkretan aerosol artikal za javni katalog, sa pakovanjem, šifrom i upitom za dostupnost.",
    sku: "COSMOS-FO-420",
    packages: [{ label: "400 ml" }],
    purpose: "Aerosol bojenje i lokalne popravke prema nijansi",
    badges: ["Aerosol", "400 ml", "Viola Dark", "Na upit"],
    specifications: [
      { label: "Šifra", value: "FO 420" },
      { label: "Nijansa", value: "Viola Dark" },
      { label: "Pakovanje", value: "400 ml" },
      { label: "Forma", value: "Aerosol" },
    ],
    relatedProductSlugs: ["cosmos-flame-blue-fb-904-deep-black", "cosmos-spray-300", "rm-diamont-bazna-boja"],
  }),
  archivedProduct("satajet-x-5500"),
];

export function getAllCarsystemProducts() {
  return [...products];
}

export function getAllCarsystemBrands() {
  return [...brands];
}

export function getAllPublicProgramGroups() {
  return [...publicProgramGroups];
}

export function getCarsystemProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCarsystemBrandBySlug(slug: string) {
  return brands.find((brand) => brand.slug === slug);
}

export function getProgramGroupBySlug(slug: string) {
  return programGroups.find((program) => program.slug === slug);
}

export function getPublicProgramGroupBySlug(slug: string) {
  return publicProgramGroups.find((program) => program.slug === slug);
}

export function getFutureBrandBySlug(slug: string) {
  return futureBrands.find((brand) => brand.slug === slug);
}

export function getBrandReferenceBySlug(slug: string) {
  const brand = getCarsystemBrandBySlug(slug);
  if (brand) return { ...brand, status: "active" as const } satisfies BrandReference;

  return getFutureBrandBySlug(slug);
}

export function getCarsystemProductsByBrandSlug(brandSlug: string) {
  return products.filter((product) => product.brandSlug === brandSlug);
}

export function getCarsystemProductsByProgramSlugs(programSlugs: string[]) {
  const allowedProgramSlugs = new Set(programSlugs);
  return products.filter((product) => allowedProgramSlugs.has(product.programSlug));
}

export function getCarsystemProductsByPublicProgramSlug(slug: string) {
  const program = getPublicProgramGroupBySlug(slug);
  if (!program) return [];

  return getCarsystemProductsByProgramSlugs(program.internalProgramSlugs);
}

export function getPublicProgramGroupsForBrand(brandSlug: string) {
  const brand = getCarsystemBrandBySlug(brandSlug);
  const brandPrograms = new Set(brand?.programSlugs ?? []);
  const productPrograms = new Set(
    getCarsystemProductsByBrandSlug(brandSlug).map((product) => product.programSlug),
  );

  return publicProgramGroups.filter((program) => {
    if (program.brandSlugs.includes(brandSlug)) return true;

    return program.internalProgramSlugs.some(
      (programSlug) => brandPrograms.has(programSlug) || productPrograms.has(programSlug),
    );
  });
}

export function getRefinishPhaseBySlug(slug: RefinishPhaseSlug) {
  return refinishPhases.find((phase) => phase.slug === slug);
}

export function getRelatedProducts(product: CarsystemProduct, limit = 4) {
  const explicit = product.relatedProductSlugs
    .map((slug) => getCarsystemProductBySlug(slug))
    .filter((item): item is CarsystemProduct => Boolean(item));

  const explicitSlugs = new Set(explicit.map((item) => item.slug));
  const similar = products
    .filter((item) => item.slug !== product.slug && !explicitSlugs.has(item.slug))
    .map((item) => {
      let score = 0;
      if (item.brandSlug === product.brandSlug) score += 3;
      if (item.programSlug === product.programSlug) score += 2;
      if (item.phaseSlug === product.phaseSlug) score += 2;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  return [...explicit, ...similar]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.slug === item.slug) === index)
    .slice(0, limit);
}
