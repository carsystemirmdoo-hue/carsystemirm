/**
 * Befar brend stranica — podaci.
 *
 * Izvori (vidi docs/):
 *  - `BEFAR_BRAND_RESEARCH.md`        — identitet proizvođača i proverene činjenice
 *  - `BEFAR_PRODUCT_ARCHITECTURE.md`  — zvanični katalog, hardness legenda, pravilo uparivanja
 *  - `BEFAR_CARSYSTEM_ASSORTMENT.md`  — naš stvarni asortiman (lager 23.07.2026)
 *  - `BEFAR_LANDING_BLUEPRINT.md`     — sekcije, vizuelni sistem, motion
 *
 * PRAVILA KOJA SE NE SMEJU PREKRŠITI:
 *
 * 1. Nijedna količina ni cena iz lagera ne sme se pojaviti u ovom fajlu. Lager je
 *    isključivo interni dokaz da je artikal živ komercijalni proizvod, ne tvrdnja
 *    o dostupnosti. `stockEvidence` govori samo da je artikal postojao sa
 *    količinom > 0 na dan 23.07.2026 — nikada se ne prikazuje kao „na stanju“.
 * 2. Sistem montaže (M14 navoj vs čičak) nije dimenzija. Ne spajati ih.
 * 3. Boje pene su UI aproksimacije, ne zvanične Befar brand boje. Befarova
 *    fotografija nije kolorimetrijski pouzdana (vidi research §7.1).
 * 4. Nema neproverenih marketinških tvrdnji. Befarove tvrdnje se atribuiraju.
 */

export const BEFAR_BRAND_SLUG = "befar";

/** Interni dokaz o aktivnosti artikla. Nikada nije javna tvrdnja o zalihama. */
export type BefarStockEvidence = "recent" | "recent-zero" | "not-carried";

export type BefarAttachment =
  | "m14"
  | "cicak"
  | "cicak-orbital"
  | "rucno"
  | "podloska"
  | "medjupodloska";

export const befarAttachmentLabels: Record<BefarAttachment, string> = {
  m14: "M14 navoj",
  cicak: "Čičak",
  "cicak-orbital": "Čičak / orbital",
  rucno: "Ručno",
  podloska: "Podloška",
  medjupodloska: "Međupodloška",
};

/* -------------------------------------------------------------------------- */
/* Navigacija                                                                 */
/* -------------------------------------------------------------------------- */

export type BefarNavItem = { id: string; label: string };

export const befarNav: BefarNavItem[] = [
  { id: "objekat", label: "Objekat" },
  { id: "materijal", label: "Materijal" },
  { id: "tvrdoca", label: "Tvrdoća" },
  { id: "geometrija", label: "Geometrija" },
  { id: "uparivanje", label: "Uparivanje" },
  { id: "porodice", label: "Porodice" },
  { id: "detalj", label: "Detalj" },
  { id: "u-radu", label: "U radu" },
  { id: "proizvodi", label: "Proizvodi" },
];

/* -------------------------------------------------------------------------- */
/* 01 — Hero                                                                  */
/* -------------------------------------------------------------------------- */

export const befarHero = {
  kicker: "Befar Otomotiv · Bursa, Turska · od 2002.",
  /** Namerno nije „kompletan sistem za profesionalce“ — to već koriste tri druge brend stranice. */
  titleLines: ["Precizno", "na tački", "kontakta."],
  lead:
    "Befar ne pravi lak. Befar pravi sloj koji lak dodiruje — penu, disk, podlogu i međupodlošku između mašine, ruke i površine.",
  object: {
    src: "/brands/befar/products/befar-opencell-foam-macro.webp",
    alt: "Befar pene za poliranje naslagane jedna na drugu, vidljiva struktura pene i čičak površina",
    width: 2000,
    height: 1333,
  },
  /** Ogromna tehnička oznaka u pozadini heroja. Samo šifra — meta linija je
      uklonjena jer je preklapala lead pasus. */
  backdropCode: "04402",
  logo: {
    src: "/brands/befar/brand/befar-logo-white-on-red.png",
    alt: "Befar",
    width: 635,
    height: 192,
  },
  scrollCue: "Skala tvrdoće",
};

/* -------------------------------------------------------------------------- */
/* 02 — Šta Befar pravi                                                       */
/* -------------------------------------------------------------------------- */

export const befarMaterialGroups = [
  {
    id: "pena",
    label: "Pena",
    body: "Pene za mašinsko i ručno poliranje. Boja pene označava tvrdoću, ne izgled.",
    image: {
      src: "/brands/befar/hardness/befar-pad-family-row.webp",
      alt: "Niz Befar pena za poliranje u profilu, različitih boja i debljina",
      width: 2000,
      height: 1949,
    },
  },
  {
    id: "nosaci",
    label: "Nosači i međupodloške",
    body: "Podloške za čičak pene i perforirane međupodloške za brušenje.",
    image: {
      src: "/brands/befar/products/befar-interface-pad-multihole-face.webp",
      alt: "Befar međupodloška, crna sa narandžastom ivicom i perforacijom",
      width: 2000,
      height: 1333,
    },
  },
  {
    id: "abraziv",
    label: "Abrazivni program",
    body: "Brusni blokovi po tvrdoći i netkani abrazivni tabaci za matiranje.",
    image: {
      src: "/brands/befar/products/befar-sanding-blocks-red-hard.webp",
      alt: "Befar brusni blokovi, tvrda crvena izvedba u tri veličine",
      width: 1600,
      height: 1067,
    },
  },
  {
    id: "hemija",
    label: "Hemija",
    body: "Paste, politure i zaštita laka. Broj na pakovanju je i prefiks šifre.",
    image: {
      src: "/brands/befar/products/befar-chem-75-liquid-compound.webp",
      alt: "Befar Likit Pasta, kutija i boca sa oznakom 75",
      width: 1600,
      height: 1067,
    },
  },
];

/* -------------------------------------------------------------------------- */
/* 03 — Skala tvrdoće (signature)                                             */
/* -------------------------------------------------------------------------- */

export type BefarHardnessStep = {
  id: string;
  colorName: string;
  /** Befarova zvanična ocena iz kataloga, osnovna (Core) linija. */
  stars: 1 | 2 | 3 | 4 | 5;
  /** UI aproksimacija — NIJE zvanična Befar boja. */
  swatch: string;
  /** Da li swatch treba obrub (svetle boje na svetloj podlozi). */
  swatchNeedsOutline?: boolean;
  purpose: string;
  applyWith: string;
  image: { src: string; alt: string; width: number; height: number };
  /** Šifre koje Carsystem stvarno nosi, po sistemu montaže. */
  codes: Array<{
    code: string;
    size: string;
    attachment: BefarAttachment;
    stockEvidence: BefarStockEvidence;
  }>;
  /** Kratka, iskrena napomena o dostupnosti u našem programu. */
  note?: string;
  /** Slug proizvoda na našem sajtu, ako postoji PDP. */
  productSlug?: string;
  /**
   * Optički offset u procentima kadra, ako se proizvod na fotografiji ne
   * poklapa sa ostalima. Postoji kao data polje da korekcije nikada ne idu kroz
   * `nth-child` hakove u CSS-u.
   *
   * Trenutno je svih pet na nuli: kompozicija je merena (detekcija belog
   * „befar“ štampa na tamnom licu pene) i nije dala pouzdan signal odstupanja,
   * pa se offseti ne izmišljaju. Pozadine su normalizovane pri pripremi asseta
   * (raspon sivog spao sa 64 na 26 nivoa) jer je to bio merljiv problem.
   */
  offset?: { x?: number; y?: number };
};

export const befarHardnessSteps: BefarHardnessStep[] = [
  {
    id: "crna",
    colorName: "Crna",
    stars: 1,
    swatch: "#1B1E22",
    purpose: "Najmekša pena. Završna obrada, podizanje sjaja i kontrola holograma.",
    applyWith: "Politura ili zaštita laka",
    image: {
      src: "/brands/befar/hardness/befar-foam-04403-black.webp",
      alt: "Befar crna čičak pena za poliranje 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    codes: [
      { code: "04403", size: "150 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "03403", size: "150 × 45 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "02403", size: "150 × 45 mm", attachment: "m14", stockEvidence: "recent" },
      { code: "44803", size: "80 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "06403", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
    ],
    productSlug: "befar-sundjer-crni-25x150",
  },
  {
    id: "plava",
    colorName: "Plava",
    stars: 2,
    swatch: "#2F7FD1",
    purpose: "Rafiniranje pre finiša. Uklanja trag prethodnog, tvrđeg koraka.",
    applyWith: "Tečna ili kremasta pasta",
    image: {
      src: "/brands/befar/hardness/befar-foam-04405-blue.webp",
      alt: "Befar plava čičak pena za poliranje 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    codes: [
      { code: "04405", size: "150 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "03405", size: "150 × 50 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "02405", size: "150 × 50 mm", attachment: "m14", stockEvidence: "recent" },
      { code: "06405", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "20105", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
    ],
    productSlug: "befar-sundjer-plavi-25x150",
  },
  {
    id: "bela",
    colorName: "Bela",
    stars: 3,
    swatch: "#F2F1ED",
    swatchNeedsOutline: true,
    purpose: "Kontrolisana korekcija na pripremljenom laku.",
    applyWith: "Tečna ili kremasta pasta",
    image: {
      src: "/brands/befar/hardness/befar-foam-04401-white.webp",
      alt: "Befar bela čičak pena za poliranje 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    codes: [
      { code: "04401", size: "150 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "03401", size: "150 × 50 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "02401", size: "150 × 50 mm", attachment: "m14", stockEvidence: "recent" },
      { code: "06401", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "54401", size: "150 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
    ],
    productSlug: "befar-sundjer-beli-25x150",
  },
  {
    id: "zuta",
    colorName: "Žuta",
    stars: 3,
    swatch: "#E8C21C",
    purpose: "Kontrolisana korekcija, ista klasa tvrdoće kao bela.",
    applyWith: "Tečna ili kremasta pasta",
    image: {
      src: "/brands/befar/hardness/befar-foam-04404-yellow.webp",
      alt: "Befar žuta čičak pena za poliranje",
      width: 1600,
      height: 1067,
    },
    codes: [
      { code: "06404", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "20104", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "448041", size: "80 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "02404", size: "150 × 50 mm", attachment: "m14", stockEvidence: "recent-zero" },
    ],
    note:
      "Žuta postoji u našem programu u izvedbama 180 × 35 mm i 80 × 25 mm. U porodici 150 × 25 mm čičak nije deo naše ponude.",
  },
  {
    id: "narandzasta",
    colorName: "Narandžasta",
    stars: 5,
    swatch: "#E2621B",
    purpose: "Najtvrđa pena u osnovnoj liniji. Najagresivnija korekcija.",
    applyWith: "Tečna ili kremasta pasta",
    image: {
      src: "/brands/befar/hardness/befar-foam-04402-orange.webp",
      alt: "Befar narandžasta čičak pena za poliranje 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    codes: [
      { code: "04402", size: "150 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "03402", size: "150 × 50 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "02402", size: "150 × 50 mm", attachment: "m14", stockEvidence: "recent" },
      { code: "06402", size: "180 × 35 mm", attachment: "cicak", stockEvidence: "recent" },
      { code: "44802", size: "80 × 25 mm", attachment: "cicak", stockEvidence: "recent" },
    ],
    productSlug: "befar-sundjer-narandzasti-25x150",
  },
];

export const befarHardnessMeta = {
  title: "Boja nije dekoracija. Boja je tvrdoća.",
  lead:
    "Befar svakoj peni dodeljuje ocenu tvrdoće i preporučuje čime se radi. To je odštampano na skoro svakoj strani njihovog kataloga.",
  /** Ova napomena je obavezna — mapiranje se razlikuje po liniji. */
  lineNote:
    "Skala prikazuje osnovnu (Core) liniju. Linije Plus i Opencell imaju sopstveno mapiranje boja i tvrdoća — crna je najmekša u osnovnoj liniji, dok Plus liniju zatvara krem, a Opencell crna.",
  scaleLabel: "Tvrdoća",
};

/* -------------------------------------------------------------------------- */
/* 04 — Geometrija i perforacija                                              */
/* -------------------------------------------------------------------------- */

export type BefarPerforation = {
  id: string;
  holes: number;
  label: string;
  purpose: string;
  /**
   * Prstenovi rupa: [poluprečnik u % od poluprečnika diska, broj rupa, veličina].
   * Shema, ne CAD replika — zbir rupa je tačan, tačan raspored zavisi od serije.
   */
  rings: Array<{ r: number; count: number; size: number }>;
  codes: Array<{ code: string; label: string; stockEvidence: BefarStockEvidence }>;
};

export const befarPerforations: BefarPerforation[] = [
  {
    id: "7",
    holes: 7,
    label: "7 rupa",
    purpose:
      "Klasična konfiguracija za 150 mm brusne diskove sa šest perifernih otvora i centralnim odvodom.",
    rings: [
      { r: 0, count: 1, size: 7 },
      { r: 62, count: 6, size: 7 },
    ],
    codes: [
      { code: "93007", label: "meka", stockEvidence: "recent" },
      { code: "93107", label: "tvrda", stockEvidence: "recent" },
      { code: "93207", label: "zaštita", stockEvidence: "recent" },
    ],
  },
  {
    id: "15",
    holes: 15,
    label: "15 rupa",
    purpose:
      "Najčešća konfiguracija u radionici. Gušći odvod prašine bez gubitka površine za brušenje.",
    rings: [
      { r: 0, count: 1, size: 6 },
      { r: 42, count: 6, size: 6 },
      { r: 76, count: 8, size: 6 },
    ],
    codes: [
      { code: "93015", label: "meka", stockEvidence: "recent" },
      { code: "93115", label: "tvrda", stockEvidence: "recent" },
      { code: "93215", label: "zaštita", stockEvidence: "recent" },
    ],
  },
  {
    id: "62",
    holes: 62,
    label: "62 rupe",
    purpose:
      "Multi-hole raspored: odvod prašine praktično po celoj površini, za mašine sa gustom perforacijom.",
    rings: [
      { r: 0, count: 1, size: 5 },
      { r: 26, count: 7, size: 4 },
      { r: 45, count: 12, size: 4.5 },
      { r: 62, count: 14, size: 4 },
      { r: 78, count: 14, size: 4.5 },
      { r: 90, count: 14, size: 3.5 },
    ],
    codes: [
      { code: "93062", label: "meka", stockEvidence: "recent-zero" },
      { code: "93162", label: "tvrda", stockEvidence: "recent" },
      { code: "93262", label: "zaštita", stockEvidence: "recent" },
    ],
  },
];

export const befarOrbitalPerforation = {
  holes: 16,
  label: "16 rupa · orbital",
  purpose:
    "Pena sa 16 otvora i kanalima za vazduh, za orbitalne (DA) mašine — hladi penu i lak pri dužem radu.",
  codes: ["56401", "56402", "56403", "56405", "56407"],
};

export const befarGeometryMeta = {
  title: "Rupe nisu ukras. One su odvod.",
  lead:
    "Broj i raspored otvora na međupodlošci prati mašinu i disk. Pogrešan raspored zatvara odvod prašine i menja rezultat brušenja.",
  profilesTitle: "Profil pene menja kontakt",
  anchorImage: {
    src: "/brands/befar/details/befar-interface-pad-6hole-angled.webp",
    alt: "Befar međupodloška sa narandžastom ivicom, vidljiv raspored otvora",
    width: 2000,
    height: 1300,
  },
};

/** Profili pene — svaki menja površinu kontakta i ponašanje pod pritiskom. */
export const befarFoamProfiles = [
  {
    id: "ravan",
    label: "Ravan",
    body: "Pun kontakt. Najviše reza po obrtu.",
    codes: "0240x · 0340x · 0440x",
  },
  {
    id: "waffle",
    label: "Waffle",
    body: "Isprekidan kontakt. Manje toplote, ravnomernija pasta.",
    codes: "448011 – 448041",
  },
  {
    id: "elips",
    label: "Elips",
    body: "Elipsasti izrezi. Fleksibilniji rub na zakrivljenim panelima.",
    codes: "2010x",
  },
  {
    id: "konus",
    label: "Konus",
    body: "Sužen profil za male površine i ivice.",
    codes: "131011 · 131021",
  },
  {
    id: "orbital",
    label: "Orbital / air lines",
    body: "Kanali za vazduh i 16 otvora za DA mašine.",
    codes: "0564xx",
  },
];

/* -------------------------------------------------------------------------- */
/* 05 — Pravilo uparivanja                                                    */
/* -------------------------------------------------------------------------- */

export type BefarPairing = {
  foam: number;
  plate: number;
  foamLabel: string;
  plateCodes: Array<{ code: string; hardness: string; stockEvidence: BefarStockEvidence }>;
  /** Da li je pravilo odštampano u Befarovom katalogu. */
  confirmed: boolean;
};

export const befarPairings: BefarPairing[] = [
  {
    foam: 150,
    plate: 125,
    foamLabel: "150 mm pena",
    plateCodes: [
      { code: "08401", hardness: "meka", stockEvidence: "recent" },
      { code: "09401", hardness: "tvrda", stockEvidence: "recent" },
    ],
    confirmed: true,
  },
  {
    foam: 180,
    plate: 150,
    foamLabel: "180 mm pena",
    plateCodes: [
      { code: "08402", hardness: "meka", stockEvidence: "recent" },
      { code: "09402", hardness: "tvrda", stockEvidence: "recent" },
    ],
    confirmed: true,
  },
  {
    foam: 220,
    plate: 170,
    foamLabel: "220 mm pena",
    plateCodes: [],
    confirmed: true,
  },
];

export const befarPairingMeta = {
  title: "Pena je uvek veća od podloške.",
  lead:
    "Befar u katalogu štampa odnos prečnika: podloška je manja od pene da rub pene ostane elastičan. Čičak pena bez odgovarajuće podloške nije kompletan sistem.",
  note:
    "Podloška od 170 mm trenutno nije deo našeg programa. Za pene od 80 mm nosimo podlošku od 75 mm (08400 meka, 09450 tvrda).",
  m14Note:
    "Pene sa M14 navojem (0240x) ne koriste podlošku — navrću se direktno na mašinu.",
};

/* -------------------------------------------------------------------------- */
/* 06 — Porodice                                                              */
/* -------------------------------------------------------------------------- */

export type BefarFamily = {
  id: string;
  name: string;
  kicker: string;
  body: string;
  /** Vizuelna težina u editorial mreži — razlika ide kroz površinu i skalu, ne kroz pet stilova kartica. */
  weight: "dominant" | "major" | "minor";
  image: { src: string; alt: string; width: number; height: number };
  specs: Array<{ label: string; value: string }>;
  catalogHref?: string;
  /** Podlinija sa sopstvenim identitetom (trenutno samo Leo). */
  accent?: string;
  logo?: { src: string; alt: string; width: number; height: number };
};

export const befarFamilies: BefarFamily[] = [
  {
    id: "pene",
    name: "Pene za poliranje",
    kicker: "Osnovna linija · Plus · ručne",
    body:
      "Najveća porodica u programu: čičak i M14 izvedbe od 80 do 220 mm, ravne, waffle, elips i orbital, plus ručne pene i konusi za vosak.",
    weight: "dominant",
    image: {
      src: "/brands/befar/products/befar-plus-pad-pair.webp",
      alt: "Befar Plus plava pena za poliranje sa oznakom ROTARY SYSTEM na čičak strani",
      width: 2000,
      height: 1920,
    },
    specs: [
      { label: "Prečnici", value: "80 · 145 · 150 · 180 mm" },
      { label: "Montaža", value: "Čičak · M14 · ručno" },
      { label: "Boje", value: "bela · narandžasta · crna · žuta · plava · višnja" },
    ],
    catalogHref: "/katalog?brend=befar",
  },
  {
    id: "nosaci",
    name: "Podloške i međupodloške",
    kicker: "Nosači · međupodloške · zaštita",
    body:
      "Deo programa koji pripada pripremi, ne detailingu. Podloške 75–150 mm u mekoj i tvrdoj izvedbi, međupodloške sa 7, 15 i 62 otvora, i zaštita podloške.",
    weight: "major",
    image: {
      src: "/brands/befar/products/befar-backing-plate-diameters.webp",
      alt: "Tri Befar podloške različitih prečnika jedna uz drugu",
      width: 2000,
      height: 1333,
    },
    specs: [
      { label: "Podloške", value: "75 · 125 · 150 mm" },
      { label: "Međupodloške", value: "7 · 15 · 62 otvora" },
      { label: "Tvrdoća", value: "meka · tvrda" },
    ],
  },
  {
    id: "leo",
    name: "Leo",
    /* Leo je jedina Befar podlinija sa sopstvenim vizuelnim identitetom u našem
       programu (žuta + antracit, pas kao marka). Ostaje unutar porodica —
       zaseban chapter se ne pravi dok V2 ne bude pregledana. */
    kicker: "Detailing linija · sopstveni identitet",
    body:
      "Jedina Befar podlinija sa sopstvenim identitetom u našem programu: aplikatori za keramiku u četiri boje, krpe, detailing podloške 125 i 145 mm, 3-u-1 podloška, setovi i magični sunđer.",
    weight: "major",
    accent: "#E8C21C",
    logo: {
      src: "/brands/befar/brand/befar-logo-leo.png",
      alt: "Leo",
      width: 449,
      height: 143,
    },
    image: {
      src: "/brands/befar/details/befar-leo-yellow-pad-face.webp",
      alt: "Leo žuta pena za poliranje sa oznakom ORBITAL SYSTEM",
      width: 2000,
      height: 1818,
    },
    specs: [
      { label: "Podloške", value: "125 · 145 · 3-u-1" },
      { label: "Keramika", value: "aplikatori · krpe · set" },
      { label: "Setovi", value: "poliranje · mini detailing" },
    ],
  },
  {
    id: "hemija",
    name: "Hemija",
    kicker: "75 → 80 → 85 → 90",
    body:
      "Lestvica u kojoj broj na pakovanju jeste redosled rada: pasta, politura, uklanjanje holograma, zaštita laka. Pakovanja 250 g i 1000 g.",
    weight: "minor",
    image: {
      src: "/brands/befar/workflow/befar-chemicals-row-dark.webp",
      alt: "Niz Befar boca sa hemijom na tamnoj podlozi",
      width: 2000,
      height: 1164,
    },
    specs: [
      { label: "75", value: "Likit pasta" },
      { label: "80", value: "Auto politura" },
      { label: "85", value: "Anti hologram" },
      { label: "90", value: "Zaštita laka" },
    ],
  },
  {
    id: "abraziv",
    name: "Brusni program",
    kicker: "Blokovi · netkani abraziv",
    body:
      "Brusni blokovi u tri veličine i dve tvrdoće — narandžasti meki, crveni tvrdi — i netkani abrazivni tabaci za matiranje pre lakiranja.",
    weight: "minor",
    image: {
      src: "/brands/befar/products/befar-sanding-blocks-orange-soft.webp",
      alt: "Befar brusni blokovi, meka narandžasta izvedba u tri veličine",
      width: 1600,
      height: 1067,
    },
    specs: [
      { label: "Blokovi", value: "mali · srednji · veliki" },
      { label: "Tvrdoća", value: "meka (88010) · tvrda (89010)" },
      { label: "Netkani", value: "91025 · 91030" },
    ],
  },
  {
    id: "potrosno",
    name: "Potrošni materijal",
    kicker: "Krpe · folija · vuneni diskovi",
    body:
      "Mikrofiber i medene krpe, tack cloth, poluantistatik folija, vuneni diskovi 150 mm i specijalni sunđeri za farove i felne.",
    weight: "minor",
    image: {
      src: "/brands/befar/products/befar-nonwoven-abrasive-grey.webp",
      alt: "Befar netkani abrazivni tabaci",
      width: 1600,
      height: 1067,
    },
    specs: [
      { label: "Krpe", value: "01407 · 34510 · 34515" },
      { label: "Folija", value: "79150 · 4 × 150 m" },
      { label: "Vuna", value: "07404 · 07604" },
    ],
  },
];

export const befarFamiliesMeta = {
  title: "Program, ne jedna polica.",
  lead:
    "Befarov asortiman kod nas pokriva šest celina — od pene i nosača do hemije, abraziva i potrošnog materijala.",
};

/* -------------------------------------------------------------------------- */
/* 07 — Opencell (kapacitet proizvođača, nije u našoj ponudi)                  */
/* -------------------------------------------------------------------------- */

export const befarOpencell = {
  /** Bez zvaničnog logotipa — koristi se neutralan tekstualni label. */
  label: "Opencell",
  kicker: "Najnovija Befar linija · nije u našoj ponudi",
  title: "Otvorena struktura pene.",
  body:
    "Opencell je Befarova najnovija linija pene, sa sopstvenim mapiranjem boja i tvrdoća. Proizvođač za nju navodi duži radni vek zahvaljujući sopstvenoj tehnologiji proizvodnje.",
  /** Befarova tvrdnja — atribuirana, ne naša. */
  claim: {
    text: "Befar'a özgü üretim teknikleriyle, kullanım ömrü çok daha uzun.",
    translation:
      "„Uz proizvodne tehnike specifične za Befar, radni vek je znatno duži.“",
    source: "befar.com.tr",
  },
  scale: [
    { colorName: "Crna", stars: 1, swatch: "#1B1E22", applyWith: "Politura ili anti hologram" },
    { colorName: "Zelena", stars: 2, swatch: "#4F9E45", applyWith: "Kremasta ili tečna pasta" },
    { colorName: "Žuta", stars: 3, swatch: "#E8C21C", applyWith: "Kremasta ili tečna pasta" },
    { colorName: "Crvena", stars: 4, swatch: "#D2342B", applyWith: "Kremasta ili tečna pasta" },
  ],
  image: {
    src: "/brands/befar/hero/befar-opencell-stack-dark.webp",
    alt: "Opencell pene za poliranje na crnoj podlozi, crna, crvena, zelena i žuta",
    width: 1920,
    height: 804,
  },
  cta: { label: "Pitajte za Opencell", href: "/kontakt" },
  disclaimer:
    "Opencell nije deo Carsystem programa. Prikazan je kao deo Befarove proizvodne ponude.",
};

/* -------------------------------------------------------------------------- */
/* 08 — Detalj objekta                                                        */
/* -------------------------------------------------------------------------- */

export const befarObjectDetail = {
  title: "Materijal iz blizine",
  frames: [
    {
      id: "cicak",
      caption: "Čičak površina · sistem prihvata",
      image: {
        src: "/brands/befar/details/befar-velcro-hook-edge-macro.webp",
        alt: "Makro snimak čičak površine Befar podloške",
        width: 2000,
        height: 1221,
      },
    },
    {
      id: "profil",
      caption: "Profil · debljina pene i stopa nosača",
      image: {
        src: "/brands/befar/details/befar-pad-profile-stem.webp",
        alt: "Befar pena i nosač u strogom profilu",
        width: 2000,
        height: 1368,
      },
    },
    {
      id: "spoj",
      caption: "Spoj nosača i pene",
      image: {
        src: "/brands/befar/details/befar-hub-foam-macro.webp",
        alt: "Makro snimak spoja plastičnog nosača i pene",
        width: 2000,
        height: 1296,
      },
    },
    {
      id: "sifra",
      caption: "Šifra štampana na nosaču",
      image: {
        src: "/brands/befar/details/befar-backing-plate-printed-label.webp",
        alt: "Befar nosač sa štampanom šifrom 93",
        width: 1333,
        height: 2000,
      },
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* 09 — U radu                                                                */
/* -------------------------------------------------------------------------- */

export const befarInUse = {
  title: "Gde Befar ulazi u posao",
  lead:
    "Program pokriva korak posle brušenja i lakiranja — korekciju, sjaj i zaštitu površine.",
  steps: [
    {
      id: "korekcija",
      index: "01",
      label: "Korekcija",
      body: "Tvrđa pena i pasta uklanjaju trag brušenja i pripremaju površinu.",
      image: {
        src: "/brands/befar/hero/befar-red-panel-swirls.webp",
        alt: "Crveni panel automobila sa vidljivim tragovima poliranja",
        width: 2560,
        height: 1067,
      },
    },
    {
      id: "sjaj",
      index: "02",
      label: "Sjaj",
      body: "Mekša pena i politura ujednačavaju površinu i podižu sjaj.",
      image: {
        src: "/brands/befar/hero/befar-porsche-headlight-detail.webp",
        alt: "Ruka u rukavici mikrofiber krpom obrađuje površinu oko fara crvenog automobila",
        width: 2560,
        height: 1707,
      },
      /*
       * TODO(provenance): NIJE PRODUCTION-CLEARED.
       *
       * Kadar je sa befar.com.tr (6720 × 4480), ali nije potvrđeno da li je
       * naručeno snimanje ili licencirani stock. Ne objavljivati dok Befar ili
       * Carsystem ne potvrde pravo korišćenja. Alternative sa sigurnijom
       * provenijencijom trenutno nemamo — jedini drugi „u radu“ kadar je iz
       * istog seta. Vidi docs/BEFAR_ASSET_INVENTORY.md §2.1.
       */
      provenance: "unverified-not-production-cleared" as const,
    },
    {
      id: "zastita",
      index: "03",
      label: "Zaštita",
      body: "Zaštita laka ili keramička zaštita zatvaraju proces.",
      image: {
        src: "/brands/befar/workflow/befar-gloved-hand-leo-bottle.webp",
        alt: "Ruka u rukavici drži Leo Nano bocu za zaštitu laka",
        width: 2010,
        height: 2400,
      },
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* 10 — Otkrivanje proizvoda                                                  */
/* -------------------------------------------------------------------------- */

export const befarDiscoveryMeta = {
  title: "Befar u našem katalogu",
  lead:
    "Prikazani su proizvodi koji već imaju stranicu na sajtu. Ostale porodice vode u filtriran katalog.",
  catalogHref: "/katalog?brend=befar",
  catalogLabel: "Ceo Befar program u katalogu",
};

/**
 * Otkrivanje proizvoda grupisano po boji, ne po SKU.
 *
 * Razlog: prava fotografija postoji za četiri šifre iz porodice 150 × 25 mm
 * čičak (`04401`–`04405`, snimljene u jednom setu i identifikovane po šifri).
 * Za izvedbe 150 × 50 mm nemamo fotografiju vezanu za konkretan SKU, a
 * generički SVG render ne sme predstavljati konkretan artikal. Zato je kartica
 * grupisana po boji: nosi stvarnu fotografiju te boje i vodi na oba naša SKU-a.
 * Nijedna fotografija se ne prikazuje kao da je snimak druge dimenzije.
 */
export const befarDiscoveryGroups = [
  {
    id: "narandzasta",
    colorName: "Narandžasta",
    stars: 5 as const,
    swatch: "#E2621B",
    photoCode: "04402",
    image: {
      src: "/brands/befar/hardness/befar-foam-04402-orange.webp",
      alt: "Befar narandžasta čičak pena za poliranje, šifra 04402, 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    role: "Najagresivnija korekcija",
    variants: [
      { slug: "befar-sundjer-narandzasti-25x150", label: "25 × 150 mm" },
      { slug: "befar-sundjer-narandzasti-50x150", label: "50 × 150 mm" },
    ],
  },
  {
    id: "bela",
    colorName: "Bela",
    stars: 3 as const,
    swatch: "#F2F1ED",
    swatchNeedsOutline: true,
    photoCode: "04401",
    image: {
      src: "/brands/befar/hardness/befar-foam-04401-white.webp",
      alt: "Befar bela čičak pena za poliranje, šifra 04401, 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    role: "Kontrolisana korekcija",
    variants: [
      { slug: "befar-sundjer-beli-25x150", label: "25 × 150 mm" },
      { slug: "befar-sundjer-beli-50x150", label: "50 × 150 mm" },
    ],
  },
  {
    id: "plava",
    colorName: "Plava",
    stars: 2 as const,
    swatch: "#2F7FD1",
    photoCode: "04405",
    image: {
      src: "/brands/befar/hardness/befar-foam-04405-blue.webp",
      alt: "Befar plava čičak pena za poliranje, šifra 04405, 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    role: "Rafiniranje pre finiša",
    variants: [
      { slug: "befar-sundjer-plavi-25x150", label: "25 × 150 mm" },
      { slug: "befar-sundjer-plavi-50x150", label: "50 × 150 mm" },
    ],
  },
  {
    id: "crna",
    colorName: "Crna",
    stars: 1 as const,
    swatch: "#1B1E22",
    photoCode: "04403",
    image: {
      src: "/brands/befar/hardness/befar-foam-04403-black.webp",
      alt: "Befar crna čičak pena za poliranje, šifra 04403, 150 × 25 mm",
      width: 1600,
      height: 1067,
    },
    role: "Završna obrada i sjaj",
    variants: [
      { slug: "befar-sundjer-crni-25x150", label: "25 × 150 mm" },
      { slug: "befar-sundjer-crni-50x150", label: "50 × 150 mm" },
    ],
  },
];

/** Porodice bez PDP-a — vode u katalog, nikada u mrtav link. */
export const befarDiscoveryFamilies = [
  { label: "Podloške i međupodloške", detail: "75 – 150 mm · 7 / 15 / 62 otvora" },
  { label: "Hemija 75 – 90", detail: "250 g i 1000 g" },
  { label: "Brusni blokovi", detail: "meki i tvrdi, tri veličine" },
  { label: "Leo detailing", detail: "keramika, podloške, setovi" },
];

/* -------------------------------------------------------------------------- */
/* 11 — Proizvođač i CTA                                                      */
/* -------------------------------------------------------------------------- */

export const befarManufacturer = {
  title: "Proizvođač",
  /** Samo proverene činjenice iz zvaničnih izvora. Bez superlativa i bez broja zemalja. */
  facts: [
    { label: "Kompanija", value: "Befar Otomotiv San. Tic. Ltd. Şti." },
    { label: "Sedište", value: "Bursa, Turska" },
    { label: "Proizvodi od", value: "2002." },
    { label: "Tip", value: "Porodična firma" },
  ],
  body:
    "Befar proizvodi pene za poliranje, aparate za poliranje, mikrofiber krpe i međupodloške za industriju brušenja. Isti program koristi se i u vazduhoplovstvu, železničkom saobraćaju, brodogradnji i industriji mebla.",
  quote: {
    text: "Kalite Keyif Verir…",
    translation: "„Kvalitet donosi zadovoljstvo.“",
    source: "Befar, zvanični katalog",
  },
  disclaimer:
    "Befar program je deo naše ponude. Podaci o proizvođaču preuzeti su iz zvaničnih Befar izvora.",
};

export const befarCta = {
  title: "Dalje kroz Carsystem program",
  actions: [
    { label: "Pronađi najbližu prodavnicu", href: "/prodavnice", tone: "primary" as const },
    { label: "Pogledaj Befar proizvode", href: "/katalog?brend=befar", tone: "secondary" as const },
    { label: "Kontakt i tehnički savet", href: "/kontakt", tone: "tertiary" as const },
  ],
};
