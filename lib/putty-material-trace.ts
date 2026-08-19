/**
 * Statični trag kita iza proizvoda (Faza 2G).
 *
 * Namerno je vezan za eksplicitnu listu slugova, ne za kategoriju `kitovi`:
 * geometrija je odobrena za jedan konkretan proizvod, a ostali kitovi još
 * nemaju ni potvrđenu boju ni potvrđenu geometriju (vidi Fazu 1). Kategorijska
 * provera bi ih sve uključila i tvrdila nešto što nije potvrđeno.
 *
 * Asseti su fotografski master iz Faze 2E/2F, razdvojen na dva sloja:
 * materijal nosi svoju boju, senka je čista crna sa alfom (množenje), pa
 * ostaje neutralna nezavisno od podloge panela.
 */

/** Proizvodi kojima je odobren trag kita. Slug je stabilan ključ kataloga. */
const PUTTY_MATERIAL_TRACE_SLUGS = new Set<string>([
  "carsystem-git-elastic-weiss",
]);

export function hasPuttyMaterialTrace(slug: string): boolean {
  return PUTTY_MATERIAL_TRACE_SLUGS.has(slug);
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
