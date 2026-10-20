/*
 * SATA — predlog nove brend stranice (2026-10-20), samo lokalni pregled.
 *
 * Sadržaj je iz istraživanja `radno/istrazivanje-2026-10-20/sata/SATA_PREDLOG.md`
 * (izvori S1–S15, pristup 2026-10-20). Svaki izabrani proizvod je vidljiv u
 * našem katalogu (proveren slug); proizvodi van našeg programa (zaštita disanja,
 * filteri, automatski pištolji) se ne pominju. Tekst je originalan, na latinici.
 *
 * Fotografije: nijedna SATA fotografija nema potvrđeno pravo korišćenja. Stranica
 * ih prikazuje samo na lokalnom pregledu (`SATA_PREVIEW_MEDIA=1`), iz foldera
 * `public/_lokalno/` koji je u .gitignore i nikad ne ide u repo ni na Vercel.
 * Bez te promenljive svaka sekcija ima rezervni prikaz bez fotografije.
 */

export type SataPreviewMedia = {
  /** Putanja u lokalnom (gitignored) folderu. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Zvanični izvor, za tabelu izvora u predlogu. */
  source: string;
};

const LOCAL = "/_lokalno/sata-kandidati";

export const sataPreviewMedia = {
  hero: {
    src: `${LOCAL}/01_jetx-highlight-01.webp`,
    width: 1640,
    height: 2912,
    alt: "SATA jet X pištolj za lakiranje u ruci lakirera, tamna scena",
    source:
      "https://www.sata.com/media/df/6d/8c/1787319056/jetx-highlight-01_019b46f3e0fc71698262f3ed4a0d8516.webp",
  },
  heroMobile: {
    src: `${LOCAL}/02_jetx-highlight-02.webp`,
    width: 1640,
    height: 2912,
    alt: "SATA jet X u ruci lakirera, detalj",
    source:
      "https://www.sata.com/media/f1/a0/5e/1787319056/jetx-highlight-02_019b46f5ad807a90a76afc46b39077d4.webp",
  },
  band: {
    src: `${LOCAL}/03_banner-pdp-jetX.png`,
    width: 1920,
    height: 420,
    alt: "SATA jet X na tamnoj podlozi sa crvenim svetlosnim linijama",
    source: "https://www.sata.com/media/09/3a/12/1784289980/banner-pdp-jetX.png",
  },
  "sata-jet-x": {
    src: `${LOCAL}/04_jet-x_1200394_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA jet X",
    source: "https://www.sata.com/media/99/89/71/1791809354/1200394_MAIN.WEBP.WEBP?ts=1791809354",
  },
  "satajet-x-5500": {
    src: `${LOCAL}/05_satajet-x-5500_1061697_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATAjet X 5500",
    source: "https://www.sata.com/media/1c/06/79/1791809354/1061697_MAIN.WEBP.WEBP?ts=1791809354",
  },
  "sataminijet-4400-b": {
    src: `${LOCAL}/06_sataminijet-4400-b_198226_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATAminijet 4400 B",
    source: "https://www.sata.com/media/ae/35/af/1791809356/198226_MAIN.WEBP.WEBP?ts=1791809356",
  },
  "satajet-100-b": {
    src: `${LOCAL}/07_satajet-100-b_145193_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATAjet 100 B F",
    source: "https://www.sata.com/media/e7/7b/9c/1791809355/145193_MAIN.WEBP.WEBP?ts=1791809355",
  },
  "sata-jet-k": {
    src: `${LOCAL}/08_jet-k_1238874_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA jet K",
    source: "https://www.sata.com/media/3a/9a/02/1791809357/1238874_MAIN.WEBP.WEBP?ts=1791809357",
  },
  "sata-rps-the-original": {
    src: `${LOCAL}/09_rps_1202100_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA RPS čaša 0,6 l",
    source: "https://www.sata.com/media/21/cb/ae/1791809358/1202100_MAIN.WEBP.WEBP?ts=1791809358",
  },
  "sata-lcs-the-liner": {
    src: `${LOCAL}/10_lcs_1195834_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA LCS čaša 0,65 l",
    source: "https://www.sata.com/media/48/1e/7e/1791809358/1195834_MAIN.WEBP.WEBP?ts=1791809358",
  },
  "sata-multi-clean-2": {
    src: `${LOCAL}/11_multi-clean-2_38257_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA multi clean 2 mašina za pranje pištolja",
    source: "https://www.sata.com/media/10/a8/3b/1791809360/38257_MAIN.WEBP.WEBP?ts=1791809360",
  },
  "sata-clean-rcs": {
    src: `${LOCAL}/12_clean-rcs_145581_MAIN.webp`,
    width: 2000,
    height: 2000,
    alt: "SATA clean RCS uređaj za brzo čišćenje",
    source: "https://www.sata.com/media/e3/18/ae/1791809360/145581_MAIN.WEBP.WEBP?ts=1791809360",
  },
} satisfies Record<string, SataPreviewMedia>;

export type SataPreviewMediaKey = keyof typeof sataPreviewMedia;

/** Pištolji po poslu — svaki slug je vidljiv u katalogu (provereno 2026-10-20). */
export const sataGunGroups = [
  {
    id: "zavrsni-sloj",
    title: "Završni sloj",
    kicker: "Bazna boja i lak",
    body:
      "jet X je danas SATA-in premium pištolj za reparaturu. X 5500 je i dalje u programu. Oba nude izbor mlaza: I za kontrolu, O za brže nanošenje.",
    lead: "sata-jet-x",
    slugs: ["sata-jet-x", "satajet-x-5500", "sata-jet-x-clearcoat-edition"],
  },
  {
    id: "podloga",
    title: "Podloga",
    kicker: "Prajmer, punilo, špric-kit",
    body:
      "Za gušći materijal i deblji sloj. Izvedba F je za prajmer i punilo, izvedba P za špric-kit.",
    lead: "satajet-100-b",
    slugs: ["satajet-100-b"],
  },
  {
    id: "spot",
    title: "Spot reparatura",
    kicker: "Mala oštećenja",
    body:
      "Mali pištolj za sitna oštećenja i teško dostupna mesta. SR dizne su pravljene za prelaz bez vidljivog ruba.",
    lead: "sataminijet-4400-b",
    slugs: ["sataminijet-4400-b"],
  },
  {
    id: "velike-povrsine",
    title: "Velike površine",
    kicker: "Materijal pod pritiskom",
    body:
      "Kad čaša nije dovoljna: materijal dolazi iz posude pod pritiskom, a pištolj ostaje lak u ruci.",
    lead: "sata-jet-k",
    slugs: ["sata-jet-k", "satajet-1000-k"],
  },
  {
    id: "univerzalni",
    title: "Univerzalni rad",
    kicker: "Radionica koja lakira i drugo",
    body: "Za radionice koje pored automobila lakiraju i druge površine. Najširi izbor dizni u programu.",
    lead: null,
    slugs: ["satajet-1000-b"],
  },
] as const;

/** RP / HVLP na istom modelu i dizni — SATAjet X 5500 1,3 I (S8, S9). */
export const sataTechnologyRows = [
  { label: "Potrošnja vazduha", rp: "290 l/min", hvlp: "430 l/min" },
  { label: "Rastojanje od površine", rp: "17–21 cm", hvlp: "10–15 cm" },
  { label: "Preporučen ulazni pritisak", rp: "2,0 bar", hvlp: "2,0 bar" },
] as const;

export const sataSetupSteps = [
  { title: "Oblik mlaza", body: "Prvo širina i oblik mlaza." },
  { title: "Količina materijala", body: "Zatim protok materijala na regulatoru." },
  { title: "Ulazni pritisak", body: "Na kraju pritisak na mikrometru vazduha, uz pištolj." },
] as const;

/** Izvod iz SATA tablice primene za R-M (S10). Samo materijali iz naše ponude. */
export const sataRmNozzles = [
  { slug: "rm-onyx-hd", name: "ONYX HD", rp: "1.4 I / 1.4 O · 2,0 bar", hvlp: "1.4–1.5 I/O · 2,0 bar", spot: "1.0 SR / 1.2 SR · 1,0–2,0 bar" },
  { slug: "rm-diamont", name: "DIAMONT", rp: "1.2–1.3 I/O · 2,0 bar", hvlp: "1.3–1.5 I/O · 2,0 bar", spot: "1.0 SR / 1.2 SR · 1,0–2,0 bar" },
  { slug: "rm-uno-hd", name: "UNO HD", rp: "1.2–1.4 I/O · 2,0 bar", hvlp: "1.2–1.4 I/O · 2,0 bar", spot: "0.8–1.2 SR (RP) · 1,0–2,0 bar" },
  { slug: "rm-c-1450-startop-hs", name: "STARTOP HS (lak)", rp: "1.2–1.4 I/O · 2,0 bar", hvlp: "1.2–1.4 I/O · 2,0 bar", spot: "—" },
] as const;

export const sataMeasurementSlugs = [
  "sata-adam-x-pro",
  "sata-adam-x",
  "sata-adam-2",
  "sata-qmr-quick-material-regulator",
] as const;

export const sataCupSlugs = [
  "sata-rps-the-original",
  "sata-lcs-the-liner",
  "sata-rps-adapter-with-qcc-and-connection",
  "sata-reusable-plastic-flow-cup",
] as const;

export const sataCleaningSlugs = [
  "sata-multi-clean-2",
  "sata-clean-rcs",
  "sata-care-set-spray-gun-care-bag-containing-1-large",
  "sata-nozzle-cleaning-needles",
  "sata-high-performance-grease-silicone-and-acid-free-100",
] as const;

export const sataWorkshopSlugs = [
  "sata-universal-spray-gun-and-hose-holder",
  "sata-triple-spray-gun-holder",
  "sata-air-hose",
  "sata-quick-coupling",
  "sata-dry-jet-2",
  "sata-truesun",
  "sata-lackierpistolenkoffer",
  "sata-viscosity-cup",
  "sata-suit-race",
  "sata-suit-basic",
] as const;

/** Zvanični dokumenti — samo linkovi, ništa se ne hostuje kod nas. */
export const sataDocuments = [
  {
    title: "Tablica primene za R-M (metrički)",
    note: "Dizne i pritisci za R-M materijale, PDF 3 str.",
    href: "https://www.sata.com/media/42/93/a8/1772450421/Hersteller_R-M_metrisch_en.pdf?ts=1772453900",
  },
  {
    title: "Brošura: pištolji",
    note: "Program pištolja za reparaturu (izdanje 2022)",
    href: "https://www.sata.com/media/83/7b/84/1771494668/EN-SATA-Brochure-Spray-Guns-3890-220829-9.pdf?ts=1772187791",
  },
  {
    title: "Brošura: sistemi čaša",
    note: "RPS i LCS, veličine i sita",
    href: "https://www.sata.com/media/58/53/f7/1772185942/EN-SATA-Brochure-Cup-System-3901-220829-6.pdf?ts=1772187571",
  },
  {
    title: "Brošura: čišćenje",
    note: "clean RCS i multi clean 2",
    href: "https://www.sata.com/media/e5/e1/71/1772186609/EN-SATA-Brochure-Cleaning-Systems-3911-220829-3.pdf?ts=1772187894",
  },
  {
    title: "SATA centar za preuzimanje",
    note: "Sve tablice primene, katalozi i uputstva",
    href: "https://www.sata.com/en/service/downloads/",
  },
] as const;
