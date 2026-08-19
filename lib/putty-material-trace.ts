/**
 * Trag kita iza proizvoda — konfiguracija po proizvodu (Faze 2G–2I).
 *
 * Geometrija, maska i animacija su ZAJEDNIČKE. Po proizvodu se menjaju samo
 * potvrđeni materijalni parametri, kroz mapu ispod. Nema komponente po
 * proizvodu i nema provere po kategoriji: kategorija `kitovi` sadrži i smole
 * koje se ne nanose špahtlom, i vlaknaste gitove kojima ovaj gladak trag ne
 * odgovara, i materijale bez potvrđene boje. Blanket primena bi tvrdila
 * stvari koje nisu potvrđene.
 */

export type PuttyMaterialFamily =
  | "fine-light"
  | "fine-colored"
  | "fiber"
  | "uv-special"
  | "resin-excluded";

export type PuttyRolloutStatus =
  | "IMPLEMENTED"
  | "PENDING COMPOSITION"
  | "PENDING DEDICATED FIBER MATERIAL"
  | "PENDING MATERIAL VERIFICATION"
  | "EXCLUDED — NOT PUTTY SMEAR";

export type PuttyColorPresetId = "original" | "multi-green";

/**
 * Boja se menja SVG filterom nad `<image>` slojem materijala, nikad nad
 * senkom. Postupak je duotone preko luminanse: `saturate 0` daje svetlinu
 * materijala, a linearni prenos je preslikava na rampu ka ciljnoj nijansi.
 * Time ostaju sačuvani brazde, vrhovi i doline. Nema `hue-rotate` i nema
 * novih rastera.
 */
export const PUTTY_COLOR_PRESETS: Record<
  PuttyColorPresetId,
  { label: string; note: string; target: [number, number, number] | null }
> = {
  original: {
    label: "Fine White — original",
    note: "Boja iz fotografskog mastera, bez filtera.",
    target: null,
  },
  "multi-green": {
    label: "Multi Green",
    note: "CONFIRMED COLOR FAMILY / PROVISIONAL DIGITAL SHADE",
    target: [118, 143, 92],
  },
};

/** Srednja luminansa neprovidne mase u masteru; referenca za duotone rampu. */
const MASTER_REFERENCE_LUMA = 0.804;

/** Nagib i odsečak linearnog prenosa po kanalu, za dati ciljni ton. */
export function puttyDuotoneTransfer(target: [number, number, number]) {
  return target.map((channel) => {
    const top = channel / 255;
    const intercept = top * 0.1;
    return { intercept, slope: (top - intercept) / MASTER_REFERENCE_LUMA };
  });
}

export type PuttyMaterialTraceConfig = {
  slug: string;
  name: string;
  family: PuttyMaterialFamily;
  status: PuttyRolloutStatus;
  colorPreset: PuttyColorPresetId;
  reason: string;
};

/**
 * Mapa svih osam proizvoda kategorije `kitovi`. Slug je stabilan ključ; naziv
 * se nikad ne koristi za poklapanje.
 */
export const PUTTY_MATERIAL_TRACE_MAP: readonly PuttyMaterialTraceConfig[] = [
  {
    slug: "carsystem-git-elastic-weiss",
    name: "Carsystem Git Elastic Weiss",
    family: "fine-light",
    status: "IMPLEMENTED",
    colorPreset: "original",
    reason:
      "TDS: polyester fine putty, Shade: white. Boja i geometrija potvrđene; " +
      "silueta 1,76 staje u zaključanih 39 % i ostavlja materijal vidljiv sa " +
      "sve četiri strane.",
  },
  {
    slug: "cosmos-lac-putties-acrylic-putty-water-based",
    name: "Cosmos Lac Acrylic Putty Water Based",
    family: "fine-light",
    status: "PENDING COMPOSITION",
    colorPreset: "original",
    reason:
      "TDS: COLOR RANGE WHITE, nanosi se špahtlom — materijalno odgovara. Ali " +
      "silueta je odnosa 1,10, pa na 39 % širine zauzima 47,2 % visine panela, " +
      "iznad trake materijala od 39,0 %. Materijal ne bi bio vidljiv iznad i " +
      "ispod, a kompozicija je zaključana.",
  },
  {
    slug: "carsystem-git-multi-green",
    name: "Carsystem Git Multi Green",
    family: "fiber",
    status: "PENDING DEDICATED FIBER MATERIAL",
    colorPreset: "multi-green",
    reason:
      "Boja potvrđena TDS-om (green). Ali asset proizvoda prikazuje MULTI " +
      "GREEN GLAS, Art.-Nr. 146.707, Polyester Glasfaserspachtel — vlaknasti " +
      "git, dok je TDS u repou za obični multifunkcionalni Multi Green. " +
      "Nerazrešen identitet; zeleni pravac je zaustavljen do ispravnog asseta.",
  },
  {
    slug: "b-2p93-uv-bodyfill-r",
    name: "B 2P93 UV Bodyfill-R",
    family: "uv-special",
    status: "PENDING MATERIAL VERIFICATION",
    colorPreset: "original",
    reason:
      "R-M TDS 07/2026 pročitan u celosti — polje boje ne postoji. Ne sme se " +
      "pretpostaviti bela, niti izvesti siva iz srodnog UV Fill-R Grey.",
  },
  {
    slug: "rm-body-filler-white-b-2e11",
    name: "R-M Body Filler White B 2E11",
    family: "uv-special",
    status: "PENDING MATERIAL VERIFICATION",
    colorPreset: "original",
    reason:
      "Nema ni TDS ni SDS; „White“ postoji samo u nazivu i internom spec polju. " +
      "Boja provisional, geometrija nepotvrđena.",
  },
  {
    slug: "carsystem-soft-plus-git",
    name: "Carsystem Soft Plus git",
    family: "uv-special",
    status: "PENDING MATERIAL VERIFICATION",
    colorPreset: "original",
    reason:
      "Nijedan Carsystem dokument; uparivanje sa zvaničnim katalogom je " +
      "ambiguous i nije primenjeno. Slika proizvoda je placeholder.",
  },
  {
    slug: "cosmos-lac-putties-1-kg-fiberglass-premium-thixotropic-resin-1kg",
    name: "Cosmos Lac Fiberglass Premium Thixotropic Resin 1 kg",
    family: "resin-excluded",
    status: "EXCLUDED — NOT PUTTY SMEAR",
    colorPreset: "original",
    reason:
      "TDS: 2K tiksotropna poliesterska smola, nanošenje četkom ili valjkom, " +
      "COLOR RANGE TRANSPARENT BLUE. Nije git za špahtlu.",
  },
  {
    slug: "cosmos-lac-putties-5-kg-fiberglass-premium-thixotropic-resin-5kg",
    name: "Cosmos Lac Fiberglass Premium Thixotropic Resin 5 kg",
    family: "resin-excluded",
    status: "EXCLUDED — NOT PUTTY SMEAR",
    colorPreset: "original",
    reason: "Isto kao pakovanje od 1 kg.",
  },
];

const BY_SLUG = new Map(PUTTY_MATERIAL_TRACE_MAP.map((item) => [item.slug, item]));

/** Konfiguracija traga za proizvod, ili `undefined` ako nije implementiran. */
export function getPuttyMaterialTrace(
  slug: string,
): PuttyMaterialTraceConfig | undefined {
  const config = BY_SLUG.get(slug);
  return config?.status === "IMPLEMENTED" ? config : undefined;
}

export function hasPuttyMaterialTrace(slug: string): boolean {
  return getPuttyMaterialTrace(slug) !== undefined;
}

/** Slojevi se nižu senka → materijal; oba dele isti canvas i poravnanje. */
export const PUTTY_MATERIAL_TRACE_ASSETS = {
  shadow: "/products/carsystem/putty-smear-fine-shadow.png",
  material: "/products/carsystem/putty-smear-fine-material-v2.png",
} as const;

/** Canvas oba asseta. Ujedno je i user space SVG-a u kome se autoriše maska. */
export const PUTTY_MATERIAL_TRACE_CANVAS = { width: 1413, height: 1086 } as const;

/** Sloj zadržava odnos canvas-a. */
export const PUTTY_MATERIAL_TRACE_ASPECT = "1413 / 1086";

/** Širina canvas-a traga u odnosu na panel. */
export const PUTTY_MATERIAL_TRACE_WIDTH = "78%";

/**
 * Envelope proizvoda za panel sa tragom kita.
 *
 * `--product-envelope-w` ograničava VIDLJIVI, neprovidni sadržaj proizvoda
 * (`.heroProductObject` deli širinu elementa sa `--product-content-fill-x`),
 * pa je 39cqw tačno 39 % širine panela mereno po silueti, a ne po PNG canvasu
 * koji oko limenke nosi providnu marginu.
 */
export const PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE = "39cqw";

/** Panel zadržava 4:3 i na mobilnom, gde je podrazumevani format 1:1. */
export const PUTTY_MATERIAL_TRACE_STAGE_ASPECT = "4 / 3";

/**
 * Optička vertikala proizvoda za panel sa tragom kita.
 *
 * Panel podrazumevano diže proizvod na 48 %, što je dobro kad iza njega nema
 * ničega. Trag je centriran na 50 %, pa bi ta razlika pojela gornju marginu
 * materijala (mereno: 3,0 % iznad naspram 6,7 % ispod). Izjednačavanje vraća
 * odobrenu kompoziciju u kojoj je materijal vidljiv sa sve četiri strane.
 */
export const PUTTY_MATERIAL_TRACE_OPTICAL_Y = "50%";

/**
 * Vodeća ivica maske za otkrivanje, u koordinatama asseta (1413 × 1086).
 *
 * Oblik pokriva sve levo od ivice i proteže se daleko van kadra, pa se
 * prevlačenjem po X otkriva postojeća fotografska tekstura — bez pravougaonog
 * wipe-a, bez gradijenta i bez blura.
 *
 * Ivica ide od x≈78 na vrhu do x≈21 na dnu: nagib od približno 3°, pa gornji
 * deo prolazi neznatno ranije od donjeg. Duž nje su tri mekane lobe od oko
 * ±22 jedinice — na panelu je to 6–7 px, dovoljno da se ne čita kao prava
 * linija, a premalo da bi se videlo kao talasanje.
 */
export const PUTTY_MATERIAL_TRACE_REVEAL_PATH = [
  "M -1600 -60",
  "L -1600 1146",
  "L 21 1146",
  "C 30 1090, 56 1050, 70 1000",
  "C 84 950, 58 880, 42 820",
  "C 26 760, 74 700, 88 640",
  "C 102 580, 68 520, 58 470",
  "C 48 420, 76 350, 90 300",
  "C 104 250, 60 190, 52 140",
  "C 44 90, 66 30, 78 -60",
  "Z",
].join(" ");

/**
 * Krajnje pozicije maske, u koordinatama asseta (0–1413 po X).
 *
 * Start drži ivicu levo od kadra, pa ništa nije otkriveno. Kraj je gura 42 px
 * izvan desne ivice: dovoljno da ni najtanja završna nit ne ostane pod maskom,
 * a da se poslednji deo trajanja ne potroši na prazan hod.
 */
export const PUTTY_MATERIAL_TRACE_REVEAL_START = -70;
export const PUTTY_MATERIAL_TRACE_REVEAL_END = 1455;

/**
 * Krivа povlačenja. Blag ulazak, gotovo ravnomerna sredina, mek završetak —
 * jedan miran potez. Kontrolne tačke moraju rasti po X; obrnut redosled pravi
 * prestrmu sredinu i otkrivanje se završi pre kraja trajanja.
 */
export const PUTTY_MATERIAL_TRACE_REVEAL_SPLINE = "0.25 0.1 0.35 1";

/** Trajanje povlačenja. Jednom, bez loopa i bez povratka. */
export const PUTTY_MATERIAL_TRACE_REVEAL_DURATION_MS = 1180;

/**
 * Čekanje pre početka povlačenja, mereno od trenutka kada su OBA rastera u
 * kešu — to je jedini signal spremnosti koji panel ima. Glavni stage nema
 * pojam „aktivnog slajda": `activeIndex` u `ProductStickyStage` bira sliku u
 * galeriji, a sam panel je uvek aktivan, pa nova slider logika nije uvedena.
 */
export const PUTTY_MATERIAL_TRACE_REVEAL_DELAY_MS = 600;
