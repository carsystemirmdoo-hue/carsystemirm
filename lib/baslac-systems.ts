/**
 * Strukturirani izvor podataka o Baslac sistemima boja.
 *
 * Ovo NIJE marketinški tekst nego podatak koji aplikacija stvarno čita
 * (`BaslacSystemsSection`, base selektor, pretraga varijanti).
 *
 * Redosled autoriteta:
 *   1. interni product master / poslovni program  → `rangeStatus`, dostupnost
 *   2. postojeći Carsystem katalog                → `catalogSlug`
 *   3. zvanični Baslac dokumenti                  → `documents`
 *   4. Baslac Germany (KLW) katalog               → naziv, pakovanje, `PHASE_OUT`
 *
 * Dostupnost se NIKADA ne upisuje ovde. Povlači se iz poslovnog programa preko
 * `inventoryKey`; dok mapiranje ne postoji, javni prikaz kaže
 * „Dostupnost se potvrđuje".
 */

/**
 * Swatch provera (2026-09-11): Line 45 upoređena sa zvaničnim
 * „baslac Tinting Chart basecoat 45" (BASF Coatings, 09/2019, PDF sa
 * virtualtry.tech/baslac_emea). Za 43 tona hue-familija piktograma grupe boje
 * odgovara našem swatch-u; 10 tonova je zamenjeno bojom grupe iz chart-a
 * (efekat/biserni tonovi čiji je naziv sugerisao drugu boju); 13 tonova nije u
 * chart-u iz 2019. Line 35 upoređena sa „baslac Tinting Chart basecoat 35"
 * (2024, mirror carus.lt): 42 verifikovana, 11 zamenjeno bojom grupe piktograma
 * (gornja polovina), 1 nije u chart-u.
 * Line 30 upoređena sa „baslac Tinting Chart topcoat 30" (mirror
 * rsbautoandindustrial.co.za, 2022): 16 verifikovanih, 3 zamenjena grupom boje.
 * Spisak po kodu:
 * `BASLAC_SWATCH_VERIFICATION` u `lib/productNamedColors.mjs`.
 */

/** Status kod proizvođača. */
export type BaslacProductionStatus =
  | "ACTIVE_CONFIRMED"
  | "PHASE_OUT"
  | "DISCONTINUED"
  | "UNVERIFIED";

/** Status u našem asortimanu. Dolazi iz internog product mastera. */
export type BaslacRangeStatus =
  | "IN_OUR_RANGE"
  | "NOT_IN_OUR_RANGE"
  | "UNVERIFIED";

export type BaslacFinish =
  | "solid"
  | "transparent"
  | "metallic"
  | "pearl"
  | "xirallic"
  | "converter"
  | "additive"
  | "technical";

export type BaslacSystemId = "line-45" | "line-35" | "line-30" | "line-30-cv";

export type BaslacBase = {
  system: BaslacSystemId;
  /** Oznaka artikla, npr. `35-M214`. */
  code: string;
  name: string;
  /** Zapremina u litrima; `null` kada nije potvrđena. */
  volumeL: number | null;
  finish: BaslacFinish;
  /**
   * Orijentaciona boja za UI swatch. Nije tehnička vrednost nijanse i ne služi
   * kao color match — samo za navigaciju i razlikovanje varijanti.
   */
  swatch: string;
  /** Article number iz KLW kataloga, kada je pronađen. */
  supplierArticle?: string;
  /** Stabilan ključ za spajanje sa poslovnim programom. */
  inventoryKey: string;
  productionStatus: BaslacProductionStatus;
  rangeStatus: BaslacRangeStatus;
  /** Slug u našem katalogu, ako proizvod već ima javnu stranicu. */
  catalogSlug?: string;
  /** Izvor na osnovu kog je status određen. */
  statusSource: string;
  note?: string;
};

function key(code: string, volumeL: number | null) {
  const volume = volumeL === null ? "na" : String(volumeL).replace(".", "-");
  return `baslac:${code.toLowerCase()}:${volume}l`;
}

function base(
  system: BaslacSystemId,
  code: string,
  name: string,
  volumeL: number | null,
  finish: BaslacFinish,
  swatch: string,
  extra: Partial<BaslacBase> = {},
): BaslacBase {
  return {
    system,
    code,
    name,
    volumeL,
    finish,
    swatch,
    inventoryKey: key(code, volumeL),
    productionStatus: "ACTIVE_CONFIRMED",
    rangeStatus: "NOT_IN_OUR_RANGE",
    statusSource: "baslac.de (KLW) katalog, 2026-08-22",
    ...extra,
  };
}

/* -------------------------------------------------------------------------
 * Line 35 — konvencionalni bazni sistem (62 artikla u KLW katalogu)
 * ---------------------------------------------------------------------- */
export const baslacLine35Bases: BaslacBase[] = [
  base("line-35", "35-M01", "Basecoat converter", 3.5, "converter", "#c9ccd1", { supplierArticle: "50669237" }),
  base("line-35", "35-M1010", "White", 3.5, "solid", "#f2f3f4", { supplierArticle: "53220892" }),
  base("line-35", "35-M1021", "White blue flip", 1, "pearl", "#dfe6ef", { supplierArticle: "50612436" }),
  base("line-35", "35-M1110", "Yellow Gold", 1, "solid", "#d1a12a", { supplierArticle: "53221104" }),
  base("line-35", "35-M1120", "Yellow Ochre", 0.5, "solid", "#c08a2e", { supplierArticle: "53377349" }),
  base("line-35", "35-M1130", "Yellow Green", 0.5, "solid", "#a8b02c", { supplierArticle: "50529321" }),
  base("line-35", "35-M1140", "Yellow Light", 0.5, "solid", "#e8d24a", { supplierArticle: "53378091" }),
  base("line-35", "35-M1150", "Yellow", 0.5, "solid", "#e3bd1f", { supplierArticle: "53378462" }),
  base("line-35", "35-M1160", "Orange", 0.5, "solid", "#d96a1c", { supplierArticle: "50514418" }),
  base("line-35", "35-M1170", "Yellow shine", 0.5, "pearl", "#eccf5c", { supplierArticle: "50445585" }),
  base("line-35", "35-M1220", "Orange light", 0.5, "solid", "#e4894a", { supplierArticle: "53387790" }),
  base("line-35", "35-M1230", "Orange Transparent", 0.5, "transparent", "#d2762a", { supplierArticle: "50744127" }),
  base("line-35", "35-M1310", "Red transparent", 0.5, "transparent", "#D37E41", { supplierArticle: "53389698" }),
  base("line-35", "35-M1320", "Red", 0.5, "solid", "#b81f28", { supplierArticle: "53389910" }),
  base("line-35", "35-M1330", "Red Orange", 0.5, "solid", "#c8452a", { supplierArticle: "53389592" }),
  base("line-35", "35-M1340", "Red bright", 0.5, "solid", "#cf2b32", { supplierArticle: "53390069" }),
  base("line-35", "35-M1350", "Red dark", 1, "solid", "#8c1c25", { supplierArticle: "53222270" }),
  base("line-35", "35-M1360", "Red light", 0.5, "solid", "#d4555c", { supplierArticle: "53390175" }),
  base("line-35", "35-M1370", "Red Blue", 0.5, "solid", "#a02744", { supplierArticle: "53402895" }),
  base("line-35", "35-M1390", "Pure Red", 0.5, "solid", "#c11a22", { supplierArticle: "50654257" }),
  base("line-35", "35-M1411", "Bluish violett", 1, "solid", "#772D6A", { supplierArticle: "50352431" }),
  base("line-35", "35-M1420", "Purple Red", 1, "solid", "#7d2b56", { supplierArticle: "53222800" }),
  base("line-35", "35-M1430", "Red Purple", 1, "solid", "#94285f", { supplierArticle: "53222588" }),
  base("line-35", "35-M1511", "Blue", 1, "solid", "#1f4f9c", { supplierArticle: "52335846" }),
  base("line-35", "35-M1516", "Blue light", 0.5, "solid", "#4a80c4", { supplierArticle: "53404008" }),
  base("line-35", "35-M1521", "Blue Green", 1, "solid", "#1c6f83", { supplierArticle: "50385877" }),
  base("line-35", "35-M1530", "Blue transparent", 1, "transparent", "#2a5fa8", { supplierArticle: "53223224" }),
  base("line-35", "35-M1541", "Blue Red", 3.5, "solid", "#3b3f8f", {
    supplierArticle: "50471272",
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel, ausverkauft",
  }),
  base("line-35", "35-M1610", "Green Blue", 1, "solid", "#17715f", { supplierArticle: "53223436" }),
  base("line-35", "35-M1621", "Green Yellow", 1, "solid", "#5c8f26", {
    supplierArticle: "50471220",
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-35", "35-M1910", "Black Yellow", 3.5, "solid", "#0A0B09", { supplierArticle: "53223648" }),
  base("line-35", "35-M1920", "Black Blue", 1, "solid", "#121211", { supplierArticle: "53223754" }),
  base("line-35", "35-M1990", "Black Graphite", 0.5, "solid", "#2b2d30", { supplierArticle: "53404485" }),
  base("line-35", "35-M211", "Silver Alu fine extra", 0.5, "metallic", "#c3c7cb", { supplierArticle: "53404697" }),
  base("line-35", "35-M212", "Silver Alu fine", 3.5, "metallic", "#bcc0c5", { supplierArticle: "53224125" }),
  base("line-35", "35-M213", "Silver Alu", 3.5, "metallic", "#b4b9bf", { supplierArticle: "53224231" }),
  base("line-35", "35-M214", "Silver dollar bright", 3.5, "metallic", "#c9ced3", {
    supplierArticle: "53224337",
    rangeStatus: "IN_OUR_RANGE",
    catalogSlug: "baslac-35-m214",
    statusSource: "interni katalog + baslac.de listing",
  }),
  base("line-35", "35-M215", "Silver Crystal fine", 1, "metallic", "#cdd2d7", { supplierArticle: "53224443" }),
  base("line-35", "35-M216", "Silver Alu coarse", 1, "metallic", "#aeb3b9", { supplierArticle: "53224549" }),
  base("line-35", "35-M217", "Silver Crystal coarse", 0.5, "metallic", "#c6cbd1", { supplierArticle: "53405227" }),
  base("line-35", "35-M218", "Silver Dollar fine", 1, "metallic", "#c1c6cc", { supplierArticle: "50445765" }),
  base("line-35", "35-M300", "Fine Pearl White", 0.5, "pearl", "#eceef0", { supplierArticle: "50345493" }),
  base("line-35", "35-M302", "Pearl White coarse", 1, "pearl", "#e5e8eb", { supplierArticle: "53224867" }),
  base("line-35", "35-M311", "Pearl Yellow", 1, "pearl", "#FCF9C7", { supplierArticle: "50487095" }),
  base("line-35", "35-M312", "Pearl Green Red", 0.5, "pearl", "#A7D4B6", { supplierArticle: "53434960" }),
  base("line-35", "35-M313", "Pearl Gold", 0.5, "pearl", "#cbab6a", {}),
  base("line-35", "35-M314", "Pearl Gold Brown", 0.5, "pearl", "#a98a5c", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-35", "35-M331", "Red Xirallic", 0.5, "xirallic", "#a8203a", {
    rangeStatus: "IN_OUR_RANGE",
    catalogSlug: "baslac-35-m331-pasta",
    statusSource: "interni katalog + baslac.de listing",
  }),
  base("line-35", "35-M332", "Pearl Red", 0.5, "pearl", "#F19EA7", {}),
  base("line-35", "35-M341", "Pearl Purple", 0.5, "pearl", "#CB7FAF", {}),
  base("line-35", "35-M343", "Pearl Red Brown", 0.5, "pearl", "#8f5348", {}),
  base("line-35", "35-M352", "Pearl Blue Fine", 0.5, "pearl", "#B1E0F6", {}),
  base("line-35", "35-M353", "Pearl Green Blue", 0.5, "pearl", "#3E854A", {}),
  base("line-35", "35-M381", "Pearl Copper", 0.5, "pearl", "#BE3633", {}),
  base("line-35", "35-M382", "Pearl Red fine", 0.5, "pearl", "#ad4450", {}),
  base("line-35", "35-M383", "Pearl Brown", 0.5, "pearl", "#7c5a45", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-35", "35-M391", "Pearl Silver Xirallic", 0.5, "xirallic", "#B1E0F6", {}),
  base("line-35", "35-M590", "Pure Black", 1, "solid", "#17181a", {}),
  base("line-35", "35-M599", "Chrome", 0.5, "metallic", "#d8dcdf", {}),
];

/* -------------------------------------------------------------------------
 * Line 30 — 2K završna boja (24 artikla u KLW katalogu)
 * ---------------------------------------------------------------------- */
export const baslacLine30Bases: BaslacBase[] = [
  base("line-30", "30-S00", "Mixing Clear", 3.5, "transparent", "#dfe2e5"),
  base("line-30-cv", "30-S01", "Converter CV", 3.5, "converter", "#c9ccd1"),
  base("line-30", "30-S010", "White", 3.5, "solid", "#f2f3f4"),
  base("line-30", "30-S110", "Yellow Green", 1, "solid", "#a8b02c"),
  base("line-30", "30-S120", "Yellow bright", 1, "solid", "#e6c634"),
  base("line-30", "30-S150", "Orange light", 1, "solid", "#e4894a"),
  base("line-30", "30-S160", "Yellow dark", 1, "solid", "#c69a1e"),
  base("line-30", "30-S220", "Orange", 1, "solid", "#d96a1c"),
  base("line-30", "30-S230", "Red light", 1, "solid", "#DC8441"),
  base("line-30", "30-S310", "Red Brown", 1, "solid", "#8f4a3a"),
  base("line-30", "30-S320", "Red bright", 1, "solid", "#cf2b32"),
  base("line-30", "30-S330", "Red Purple", 1, "solid", "#C63A3B"),
  base("line-30", "30-S340", "Red dark", 1, "solid", "#8c1c25", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-30", "30-S411", "Purple", 1, "solid", "#3D3575"),
  base("line-30", "30-S420", "Red", 1, "solid", "#b81f28"),
  base("line-30", "30-S510", "Nepotvrđena oznaka", 1, "solid", "#4a5b7a", {
    rangeStatus: "IN_OUR_RANGE",
    catalogSlug: "baslac-30-s510-s-serija",
    productionStatus: "UNVERIFIED",
    statusSource:
      "Oznaka postoji u internom katalogu, ali nije pronađena u KLW katalogu (najbliže: 30-S511 Blue Red, 30-S530 Blue). Ne pretpostavljamo naziv.",
    note: "Traži potvrdu tačne oznake i naziva iz product mastera.",
  }),
  base("line-30", "30-S511", "Blue Red", 1, "solid", "#3b3f8f"),
  base("line-30", "30-S520", "Blue Green", 1, "solid", "#1c6f83"),
  base("line-30", "30-S530", "Blue", 1, "solid", "#1f4f9c"),
  base("line-30", "30-S610", "Green Blue", 1, "solid", "#17715f"),
  base("line-30", "30-S621", "Green Yellow", 1, "solid", "#5c8f26"),
  base("line-30", "30-S910", "Black", 1, "solid", "#1b1c1e"),
  base("line-30", "30-S920", "Black deep", 3.5, "solid", "#141517"),
];

/* -------------------------------------------------------------------------
 * Line 45 — vodeni bazni sistem. Obe strane paginacije su prošle:
 * 48 (strana 1) + 25 (strana 2) = 73, koliko katalog i prijavljuje.
 * `Ausverkauft` nije ukidanje — samo `Auslaufartikel`. Odsustvo sa jedne
 * strane nije dokaz ukidanja.
 * ---------------------------------------------------------------------- */
export const baslacLine45Bases: BaslacBase[] = [
  base("line-45", "45-R45", "Dilutant AU reducer", 5, "technical", "#dfe2e5"),
  base("line-45", "45-W00", "Converter Water", 5, "converter", "#c9ccd1"),
  base("line-45", "45-W05", "Effect Additive", 1, "additive", "#d5d8dc"),
  base("line-45", "45-W10", "3-Coat Additive", 0.5, "additive", "#d5d8dc"),
  base("line-45", "45-W1010", "Basecoat AU White", 1, "solid", "#f2f3f4"),
  base("line-45", "45-W1011", "Basecoat AU White Frost", 1, "pearl", "#eceff2"),
  base("line-45", "45-W1012", "Basecoat", 0.5, "solid", "#eef0f2"),
  base("line-45", "45-W1019", "Basecoat AU White Light", 0.5, "solid", "#f4f5f6"),
  base("line-45", "45-W1020", "Basecoat AU White blue flip", 0.5, "pearl", "#C1E4F8"),
  base("line-45", "45-W1110", "Basecoat AU Yellow Gold", 0.5, "solid", "#d1a12a"),
  base("line-45", "45-W1120", "Basecoat Yellow Ocre", 0.5, "solid", "#c08a2e"),
  base("line-45", "45-W1130", "Basecoat AU Yellow Green", 0.5, "solid", "#a8b02c"),
  base("line-45", "45-W1140", "Basecoat AU Yellow light", 0.5, "solid", "#e8d24a"),
  base("line-45", "45-W1147", "Basecoat Yellow Lime", 0.5, "solid", "#c9d43a"),
  base("line-45", "45-W1150", "Basecoat AU Yellow", 0.5, "solid", "#e3bd1f"),
  base("line-45", "45-W1160", "Basecoat AU Orange", 0.5, "solid", "#d96a1c"),
  base("line-45", "45-W1220", "Basecoat AU Orange light", 0.5, "solid", "#e4894a"),
  base("line-45", "45-W1310", "Basecoat AU Red transparent", 0.5, "transparent", "#D37E41"),
  base("line-45", "45-W1320", "Basecoat Red", 0.5, "solid", "#b81f28"),
  base("line-45", "45-W1340", "Basecoat AU Red bright", 0.5, "solid", "#cf2b32"),
  base("line-45", "45-W1350", "Basecoat AU Red dark", 0.5, "solid", "#8c1c25"),
  base("line-45", "45-W1360", "Basecoat AU Red light", 0.5, "solid", "#d4555c"),
  base("line-45", "45-W1371", "Basecoat Red Blue", 0.5, "solid", "#a02744"),
  base("line-45", "45-W1390", "Basecoat Red Shining", 0.1, "pearl", "#c8303e"),
  base("line-45", "45-W1411", "Basecoat AU Bluish violett", 0.5, "solid", "#5b3f8f"),
  base("line-45", "45-W1420", "Basecoat AU Purple Red", 0.5, "solid", "#7d2b56"),
  base("line-45", "45-W1430", "Basecoat Red Purple", 0.5, "solid", "#94285f"),
  base("line-45", "45-W1510", "Basecoat Blue Light", 0.5, "solid", "#4a80c4"),
  base("line-45", "45-W1520", "Basecoat AU Blue Green", 1, "solid", "#1c6f83"),
  base("line-45", "45-W1530", "Basecoat AU Blue transparent", 0.5, "transparent", "#2a5fa8"),
  base("line-45", "45-W1610", "Basecoat Green Blue", 1, "solid", "#17715f"),
  base("line-45", "45-W1621", "Basecoat AU Green Yellow", 0.5, "solid", "#5c8f26"),
  base("line-45", "45-W1910", "Basecoat Black Yellow", 0.5, "solid", "#1B1E22"),
  base("line-45", "45-W1920", "Basecoat AU Black", 1, "solid", "#1b1c1e"),
  base("line-45", "45-W1921", "Basecoat AU Black Light", 0.5, "solid", "#2e3134"),
  base("line-45", "45-W1930", "Basecoat Black Blue", 0.5, "solid", "#26303f"),
  base("line-45", "45-W1990", "Basecoat Black Graphite", 0.5, "solid", "#2b2d30"),
  base("line-45", "45-W210", "Basecoat AU Silver Alu Perfect", 0.5, "metallic", "#c9ced3"),
  base("line-45", "45-W211", "Basecoat AU Silver Alu fine extra", 0.5, "metallic", "#c3c7cb"),
  base("line-45", "45-W212", "Basecoat AU Silver Alu fine", 0.5, "metallic", "#bcc0c5"),
  base("line-45", "45-W213", "Basecoat AU Silver Alu", 0.5, "metallic", "#b4b9bf"),
  base("line-45", "45-W214", "Basecoat Silver dollar bright", 0.5, "metallic", "#c9ced3"),
  base("line-45", "45-W220", "Basecoat Silver Crystal fine", 0.5, "metallic", "#cdd2d7"),
  base("line-45", "45-W221", "Basecoat Silver Crystal coarse", 0.5, "metallic", "#c6cbd1"),
  base("line-45", "45-W301", "Basecoat AU Pearl White", 0.5, "pearl", "#eceef0"),
  base("line-45", "45-W302", "Basecoat AU Pearl White coarse", 0.5, "pearl", "#e5e8eb"),
  base("line-45", "45-W1330", "Basecoat Red Orange", 0.5, "solid", "#c8452a", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-45", "45-W1380", "Basecoat AU Red Rose", 0.5, "solid", "#c9647d", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de: Auslaufartikel",
  }),
  base("line-45", "45-W311", "Basecoat AU Pearl Yellow", 0.5, "pearl", "#FEF9CE", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W331", "Basecoat Pearl Red Xirallic", 0.5, "xirallic", "#a8203a", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W343", "Basecoat AU Pearl Red Brown", 0.5, "pearl", "#8f5348", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W351", "Basecoat Pearl Blue", 0.5, "pearl", "#5f7fae", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W352", "Basecoat AU Pearl Blue fine", 0.5, "pearl", "#6b89b8", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W382", "Basecoat AU Pearl Red fine", 0.5, "pearl", "#ad4450", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W391", "Basecoat Pearl Silver Xirallic", 0.5, "xirallic", "#d3d7db", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W400", "Basecoat AU Pearl Fine White", 0.5, "pearl", "#eceef0", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W435", "Basecoat AU Pearl Red Shine", 0.5, "pearl", "#c04a58", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W446", "Basecoat AU Pearl Purple", 0.5, "pearl", "#8a5a97", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W485", "Basecoat AU Pearl Copper", 0.5, "pearl", "#a9682f", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W490", "Basecoat AU Pearl Gold", 0.5, "pearl", "#F9EB56", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W590", "Basecoat", 1, "solid", "#2b2d30", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W599", "Basecoat AU Chrome", 0.1, "metallic", "#d8dcdf", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22",
  }),
  base("line-45", "45-W495", "Basecoat AU Pearl Gold Brown", 0.5, "pearl", "#a98a5c", {
    productionStatus: "PHASE_OUT",
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22: Auslaufartikel",
  }),
  // `49-W` je zasebna serija pearl/effect koncentrata od 0,1 L koja se
  // prodaje unutar Line 45 kategorije.
  base("line-45", "49-W408", "Basecoat Transparent Sparkle", 0.1, "transparent", "#dfe3e8", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W410", "Basecoat AU Pearl Gold", 0.1, "pearl", "#FEF9CE", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W420", "Basecoat AU Pearl Bronze", 0.1, "pearl", "#a97a45", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W425", "Basecoat AU Pearl Mandarin", 0.1, "pearl", "#FEF9CE", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W436", "Basecoat AU Pearl Green Red", 0.1, "pearl", "#7D2A29", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W441", "Basecoat AU Pearl Violet White", 0.1, "pearl", "#E3B0B5", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W443", "Basecoat AU Pearl Violet", 0.1, "pearl", "#DC9B9E", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W448", "Basecoat AU Pearl Purple Red", 0.1, "pearl", "#A32E44", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W469", "Basecoat AU Pearl Green Blue", 0.1, "pearl", "#3F8570", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
  base("line-45", "49-W488", "Basecoat AU Pearl Copper Coarse", 0.1, "pearl", "#a06a38", {
    statusSource: "baslac.de (KLW) katalog, strana 2/2, 2026-08-22 — 49-W serija koncentrata",
  }),
];

export const baslacAllBases: BaslacBase[] = [
  ...baslacLine45Bases,
  ...baslacLine35Bases,
  ...baslacLine30Bases,
];

/**
 * Baze koje se prikazuju u javnom selektoru, katalogu, pretrazi i Quick Add-u.
 *
 * Samo `ACTIVE_CONFIRMED`. `PHASE_OUT`, `DISCONTINUED` i `UNVERIFIED` ostaju u
 * evidenciji ali se javno ne nude — `30-S510` je takav slučaj dok ga poslovni
 * program ne potvrdi.
 */
export function baslacPublicBases(system: BaslacSystemId): BaslacBase[] {
  return baslacAllBases.filter(
    (item) =>
      item.system === system && item.productionStatus === "ACTIVE_CONFIRMED",
  );
}

/** Evidencija se čuva i za povučene baze — samo se ne nudi u selektoru. */
export function baslacRetiredBases(system: BaslacSystemId): BaslacBase[] {
  return baslacAllBases.filter(
    (item) =>
      item.system === system &&
      (item.productionStatus === "PHASE_OUT" ||
        item.productionStatus === "DISCONTINUED"),
  );
}

/** Pretraga po šifri (sa i bez crtica), nazivu, završnici i zapremini. */
export function baslacSearchAliases(item: BaslacBase): string[] {
  const volume = item.volumeL === null ? [] : [
    `${item.volumeL} l`,
    `${item.volumeL}l`,
    `${String(item.volumeL).replace(".", ",")} l`,
  ];
  return [
    item.code,
    item.code.replace(/-/g, ""),
    item.code.replace(/-/g, " "),
    item.name,
    `${item.code} ${item.name}`,
    item.finish,
    item.system.replace("-", " "),
    ...volume,
  ].map((value) => value.toLowerCase());
}

export function baslacMatchesQuery(item: BaslacBase, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return baslacSearchAliases(item).some((alias) => alias.includes(needle));
}

export const baslacFinishLabels: Record<BaslacFinish, string> = {
  solid: "Solid",
  transparent: "Transparent",
  metallic: "Metallic",
  pearl: "Pearl",
  xirallic: "Xirallic",
  converter: "Converter",
  additive: "Aditiv",
  technical: "Tehnički",
};

export const baslacSystemLabels: Record<BaslacSystemId, string> = {
  "line-45": "Line 45 — vodeni bazni sistem",
  "line-35": "Line 35 — konvencionalni bazni sistem",
  "line-30": "Line 30 — 2K završne boje",
  "line-30-cv": "Line 30 CV — komercijalna vozila",
};

/**
 * Family packshot po sistemu. Zajednička limenka se koristi za sve varijante
 * iste porodice — pojedinačne baze se razlikuju šifrom, nazivom i swatchem,
 * ne izmišljenom fotografijom.
 *
 * `null` znači da odobren packshot još ne postoji; UI tada prikazuje
 * kontrolisan system placeholder, nikada limenku druge linije.
 */
export const baslacFamilyPackshots: Record<
  BaslacSystemId,
  { src: string | null; alt: string; expectedFilename?: string }
> = {
  "line-45": {
    src: null,
    alt: "Baslac Line 45 ambalaža",
    expectedFilename: "baslac--line-45-family-packshot.png",
  },
  "line-35": {
    src: "/products/baslac/baslac--line-35-3.5l-family-packshot.webp",
    alt: "Baslac Line 35 Basecoat ambalaža",
  },
  "line-30": {
    src: "/products/baslac/baslac--line-30-3.5l-family-packshot.webp",
    alt: "Baslac Line 30 Topcoat ambalaža",
  },
  "line-30-cv": {
    src: "/products/baslac/baslac--line-30-3.5l-family-packshot.webp",
    alt: "Baslac Line 30 Topcoat ambalaža",
  },
};


/**
 * Family packshot slot po sistemu i STVARNOJ zapremini varijante.
 *
 * Limenka od 3,5 L ne sme predstavljati bazu od 1 L, pa ovde nema fallbacka na
 * „bilo koju sliku sistema". Kada odobrena slika za tu zapreminu ne postoji,
 * vraća se `null` i UI prikazuje placeholder te zapremine.
 */
export type BaslacAssetSlot = {
  /** Stabilan ključ slota, npr. `line-30:3.5l`. */
  slotId: string;
  system: BaslacSystemId;
  volumeL: number | null;
  /** Odobrena slika ili `null` kada je slot još prazan. */
  src: string | null;
  /** Očekivani naziv fajla kada slot bude popunjen. */
  expectedFilename: string;
};

const ASSET_SLOTS: BaslacAssetSlot[] = [
  { slotId: "line-30:3.5l", system: "line-30", volumeL: 3.5, src: "/products/baslac/baslac--line-30-3.5l-family-packshot.webp", expectedFilename: "baslac--line-30-3.5l-family-packshot.png" },
  { slotId: "line-30:1l", system: "line-30", volumeL: 1, src: null, expectedFilename: "baslac--line-30-1l-family-packshot.png" },
  { slotId: "line-30-cv:3.5l", system: "line-30-cv", volumeL: 3.5, src: "/products/baslac/baslac--line-30-3.5l-family-packshot.webp", expectedFilename: "baslac--line-30-3.5l-family-packshot.png" },
  { slotId: "line-35:3.5l", system: "line-35", volumeL: 3.5, src: "/products/baslac/baslac--line-35-3.5l-family-packshot.webp", expectedFilename: "baslac--line-35-3.5l-family-packshot.png" },
  { slotId: "line-35:1l", system: "line-35", volumeL: 1, src: null, expectedFilename: "baslac--line-35-1l-family-packshot.png" },
  { slotId: "line-35:0.5l", system: "line-35", volumeL: 0.5, src: null, expectedFilename: "baslac--line-35-0.5l-family-packshot.png" },
  { slotId: "line-45:5l", system: "line-45", volumeL: 5, src: null, expectedFilename: "baslac--line-45-5l-family-packshot.png" },
  { slotId: "line-45:1l", system: "line-45", volumeL: 1, src: null, expectedFilename: "baslac--line-45-1l-family-packshot.png" },
  { slotId: "line-45:0.5l", system: "line-45", volumeL: 0.5, src: null, expectedFilename: "baslac--line-45-0.5l-family-packshot.png" },
  { slotId: "line-45:0.1l", system: "line-45", volumeL: 0.1, src: null, expectedFilename: "baslac--line-45-0.1l-concentrate-packshot.png" },
];

export function baslacAssetSlot(
  system: BaslacSystemId,
  volumeL: number | null,
): BaslacAssetSlot | null {
  return (
    ASSET_SLOTS.find(
      (slot) => slot.system === system && slot.volumeL === volumeL,
    ) ?? null
  );
}

export function baslacAssetSlots(): BaslacAssetSlot[] {
  return [...ASSET_SLOTS];
}
