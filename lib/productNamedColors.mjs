/**
 * Orijentacioni prikaz IMENOVANE boje proizvoda — treći stepen u izboru boje
 * kartice, posle pregledanih tokena (`visual`) i kuriranog preseta, a pre boje
 * brenda.
 *
 * Proizvođač za ove artikle potvrđuje boju rečima (White / Grey / Black …) u
 * zvaničnom nazivu i tehničkom listu, ali ne daje kolorimetrijsku vrednost.
 * Vrednosti ovde NISU izmerene nijanse i ne smeju se upisivati kao zvaničan
 * kolorimetrijski podatak — služe samo za prikaz kartice (`precision:
 * "orientation"`). Katalog, pretraga i izabrana varijanta čitaju isti rezultat
 * kroz `getProductShade` (`components/product/productMotion.ts`).
 *
 * Plain JS iz istog razloga kao `lib/productPaintRule.mjs`: isti podaci za
 * tipizirani kod i `node --test`.
 */

/**
 * Orijentacioni tokeni; usklađeni sa postojećim Befar/Carsystem presetima.
 * „white" je topla bela (L≈0.91), ne #FFFFFF: na svetloj podlozi kartice
 * (~#F0F0F2) čista bela roletna bi bila nevidljiva, a proizvod je i dalje
 * jasno „beo" u odnosu na sivu/crnu.
 */
export const NAMED_COLOR_TOKENS = Object.freeze({
  white: "#E6E3DD",
  "light-grey": "#C8CBCF",
  grey: "#9DA1A6",
  "dark-grey": "#5C6066",
  black: "#1B1E22",
  yellow: "#E3BD1F",
});

const RM_INFO = "info.rmpaint.com/products/<slug> — zvanični naziv proizvoda nosi boju";
const BASLAC_KLW = "baslac.de (KLW) katalog, 2026-08-22 — naziv artikla nosi boju";

const CARSYSTEM_RENDER =
  "carsystem.org zvanični packshot (identičan fajl u assets/manufacturer/carsystem/images), uzorak boje brusne površine";
const RM_DIAMONT_DISTRIBUTORS =
  "R-M DIAMONT toner lista: carross.eu (BC190 Dense white) i ds-color.com (BC 190 Bianco brillante)";

/**
 * Unos ima ili `token` (imenovana boja iz zvaničnog naziva/TDS-a) ili `color`
 * (uzorak boje sa zvaničnog materijala proizvođača). `series` označava da
 * boja važi za celu seriju/varijantu, ne po granulaciji.
 *
 * @type {Readonly<Record<string, { token?: keyof typeof NAMED_COLOR_TOKENS, color?: string, series?: string, source: string }>>}
 */
export const PRODUCT_NAMED_COLORS = Object.freeze({
  // Carsystem abrazivi — boja cele serije (ista za sve granulacije)
  "carsystem-p19-brusni-diskovi": {
    color: "#C7A24A",
    series: "Sanding Disc P.19, art. 156.357–156.371",
    source:
      "carsystem.org: Sanding Disc P.19 tehnički podaci „Color: Yellow”; vrednost = uzorak sa zvaničnog packshot-a (156357-372)",
  },
  "carsystem-f19-brusni-diskovi": {
    color: "#503F37",
    series: "Sanding Disc F.19, art. 156.046–156.059",
    source: CARSYSTEM_RENDER + " (156046-059); stranica i TDS ne navode boju rečima",
  },
  "carsystem-f23-brusni-diskovi": {
    color: "#1B0B69",
    series: "Sanding Disc F.23 Ceramic, art. 159.218–159.226",
    source: CARSYSTEM_RENDER + " (159218-226); stranica ne navodi boju rečima",
  },
  "carsystem-finish-serija": {
    color: "#27231F",
    series: "Sanding Disc F.19 Finish 152 mm, art. 156.899–156.902 (P1000–P2000)",
    source: CARSYSTEM_RENDER + " (156902 P2000); stranica ne navodi boju rečima",
  },
  // R-M DIAMONT toner: šifra 190 = BC 190 „Dense white" (potvrđeno kod dva distributera; fotografija nosi BC 190)
  "rm-pasta-190-1l": { token: "white", source: RM_DIAMONT_DISTRIBUTORS },
  // R-M prajmeri i punioci (uvezeni zvanični nazivi; spot-check 2026-09-10:
  // P 2A41 „PerformFILLER White", P 2P92 „UV Fill-R Light Grey")
  "p-2a41-performfiller-white": { token: "white", source: RM_INFO },
  "p-2a61-multiprotect-white": { token: "white", source: RM_INFO },
  "p-2a63-multiprotect-grey": { token: "grey", source: RM_INFO },
  "p-2a65-multiprotect-black": { token: "black", source: RM_INFO },
  "p-2e23-primer-filler-grey": { token: "grey", source: RM_INFO },
  "p-2p23-air-purpos-r-grey": { token: "grey", source: RM_INFO },
  "p-2p51-sanding-fill-r-white": { token: "white", source: RM_INFO },
  "p-2p55-sanding-fill-r-black": { token: "black", source: RM_INFO },
  "p-2p63-multi-purpos-r-grey": { token: "grey", source: RM_INFO },
  "p-2p81-race-wet-fill-r-white": { token: "white", source: RM_INFO },
  "p-2p85-race-wet-fill-r-black": { token: "black", source: RM_INFO },
  "p-2p92-uv-fill-r-light-grey": { token: "light-grey", source: RM_INFO },
  "p-2p94-uv-fill-r-dark-grey": { token: "dark-grey", source: RM_INFO },
  "pm-2e32-filler-light-grey": { token: "light-grey", source: RM_INFO },
  "pm-2e34-filler-dark-grey": { token: "dark-grey", source: RM_INFO },
  // Baslac 2K Primerfiller (grey / white / black), sve zapremine iste porodice
  "baslac-20-24-2k-primerfiller-grey-1l": { token: "grey", source: BASLAC_KLW },
  "baslac-20-24-2k-primerfiller-grey-4l": { token: "grey", source: BASLAC_KLW },
  "baslac-20-34-2k-primerfiller-white-1l": { token: "white", source: BASLAC_KLW },
  "baslac-20-34-2k-primerfiller-white-4l": { token: "white", source: BASLAC_KLW },
  "baslac-20-35-2k-primerfiller-wet-on-wet-white-3l": { token: "white", source: BASLAC_KLW },
  "baslac-20-94-2k-primerfiller-black-1l": { token: "black", source: BASLAC_KLW },
  "baslac-20-94-2k-primerfiller-black-4l": { token: "black", source: BASLAC_KLW },
  "baslac-20-95-2k-primerfiller-wet-on-wet-black-3l": { token: "black", source: BASLAC_KLW },
});

/**
 * @param {{slug: string}} product
 * @returns {{ color: string, token: string, source: string } | null}
 */
export function getProductNamedColor(product) {
  const entry = PRODUCT_NAMED_COLORS[product.slug];
  if (!entry) return null;
  return {
    color: entry.color ?? NAMED_COLOR_TOKENS[entry.token],
    token: entry.token ?? null,
    series: entry.series ?? null,
    source: entry.source,
  };
}

/**
 * Proizvodi kod kojih se NIJEDNA ranije upisana boja ne sme prikazati kao
 * nijansa — ostaje boja brenda, uz zabeležen razlog. Potvrđen podatak
 * proizvođača (ili njegovo odsustvo) ima prednost nad starim presetom.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const PRODUCT_SHADE_BLOCKLIST = Object.freeze({
  // Fotografija je BC 100 = „Adjust Varnish" (bezbojni regulator, carross.eu lista
  // DIAMONT tonera); crveni preset je bio dekorativan, ne boja proizvoda.
  "rm-diamont-bazna-boja": "BC 100 je bezbojni Adjust Varnish; stari crveni preset nije boja proizvoda",
  // Naziv/šifra kažu 190, fotografija nosi BC 605 „Opaque yellow" — identitet
  // artikla nije potvrđen, pa se ne dodeljuje ni bela ni žuta.
  "rm-pasta-190-5l": "sukob identiteta: naziv 190 (Dense white) vs. fotografija BC 605 (Opaque yellow)",
  // Serija P.23 ne postoji na carsystem.org (2026-09-11); nema izvora za boju.
  "carsystem-p23-brusni-diskovi":
    "serija P.23 ne postoji na carsystem.org (2026-09-15: kategorija Abrasives nudi P.19, F.19, F.19 Soft/Finish, F.23 Ceramic, P.25 Ceramic); ako je artikal zapravo P.25 Ceramic (Color: Red), identitet mora potvrditi vlasnik pre dodele boje",
});

export function getProductShadeBlockReason(product) {
  return PRODUCT_SHADE_BLOCKLIST[product.slug] ?? null;
}

/**
 * Provera Baslac swatch-eva prema zvaničnim tinting chart-ovima (ponovljena
 * 2026-09-15 nezavisnim uzorkovanjem piktograma iz PDF-a po poziciji šifre):
 * reprezentativna boja tonera = dominantna boja piktograma boje (gornji krug),
 * crni toneri = crna, aluminijumi = panel uzorak; metalik/biserni tonovi su
 * ORIJENTACIONI (jedan ugao, bez efekta). Hue-familija našeg swatch-a se poredi
 * sa chart-om: poklapanje → „verified", razlika → swatch ZAMENJEN bojom sa
 * chart-a („replaced"). Ranije provere:
 *   - basecoat 45: BASF Coatings 09/2019 (virtualtry.tech/baslac_emea);
 *   - basecoat 35: 2024 (mirror carus.lt);
 *   - topcoat 30: mirror rsbautoandindustrial.co.za (2022).
 * „…-verified” = hue-familija našeg swatch-a odgovara grupi boje piktograma;
 * „…-group” = swatch zamenjen bojom grupe piktograma (gornja polovina);
 * biserni tonovi su namerno prikazani grupom, ne jednom „preciznom" bojom.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const BASLAC_SWATCH_VERIFICATION = Object.freeze({
  "30-S00": "not-in-chart",
  "30-S010": "chart-2026-09-15-verified",
  "30-S110": "chart-2026-09-15-verified",
  "30-S120": "chart-2026-09-15-verified",
  "30-S150": "chart-2026-09-15-verified",
  "30-S160": "chart-2026-09-15-verified",
  "30-S220": "chart-2026-09-15-verified",
  "30-S230": "chart-2026-09-15-verified",
  "30-S310": "chart-2026-09-15-verified",
  "30-S320": "chart-2026-09-15-verified",
  "30-S330": "chart-2026-09-15-verified",
  "30-S340": "chart-2026-09-15-verified",
  "30-S411": "chart-2026-09-15-verified",
  "30-S420": "chart-2026-09-15-verified",
  "30-S510": "not-in-chart",
  "30-S511": "chart-2026-09-15-verified",
  "30-S520": "chart-2026-09-15-verified",
  "30-S530": "chart-2026-09-15-verified",
  "30-S610": "chart-2026-09-15-verified",
  "30-S621": "chart-2026-09-15-verified",
  "30-S910": "chart-2026-09-15-verified",
  "30-S920": "chart-2026-09-15-verified",
  "35-M1010": "chart-2026-09-15-verified",
  "35-M1021": "chart-2026-09-15-verified",
  "35-M1110": "chart-2026-09-15-verified",
  "35-M1120": "chart-2026-09-15-verified",
  "35-M1130": "chart-2026-09-15-verified",
  "35-M1140": "chart-2026-09-15-verified",
  "35-M1150": "chart-2026-09-15-verified",
  "35-M1160": "chart-2026-09-15-verified",
  "35-M1170": "chart-2026-09-15-verified",
  "35-M1220": "chart-2026-09-15-verified",
  "35-M1230": "chart-2026-09-15-verified",
  "35-M1310": "chart-2026-09-15-verified",
  "35-M1320": "chart-2026-09-15-verified",
  "35-M1330": "chart-2026-09-15-verified",
  "35-M1340": "chart-2026-09-15-verified",
  "35-M1350": "chart-2026-09-15-verified",
  "35-M1360": "chart-2026-09-15-verified",
  "35-M1370": "chart-2026-09-15-verified",
  "35-M1390": "chart-2026-09-15-verified",
  "35-M1411": "chart-2026-09-15-verified",
  "35-M1420": "chart-2026-09-15-verified",
  "35-M1430": "chart-2026-09-15-verified",
  "35-M1511": "chart-2026-09-15-verified",
  "35-M1516": "chart-2026-09-15-verified",
  "35-M1521": "chart-2026-09-15-verified",
  "35-M1530": "chart-2026-09-15-verified",
  "35-M1541": "not-in-chart",
  "35-M1610": "chart-2026-09-15-verified",
  "35-M1621": "chart-sample-unclear-kept-swatch",
  "35-M1910": "chart-2026-09-15-verified",
  "35-M1920": "chart-2026-09-15-verified",
  "35-M1990": "chart-2026-09-15-verified",
  "35-M211": "chart-2026-09-15-verified",
  "35-M212": "chart-2026-09-15-verified",
  "35-M213": "chart-2026-09-15-verified",
  "35-M214": "chart-2026-09-15-verified",
  "35-M215": "chart-2026-09-15-verified",
  "35-M216": "chart-2026-09-15-verified",
  "35-M217": "chart-2026-09-15-verified",
  "35-M218": "chart-2026-09-15-verified",
  "35-M300": "chart-2026-09-15-verified",
  "35-M302": "chart-2026-09-15-verified",
  "35-M311": "chart-2026-09-15-replaced",
  "35-M312": "chart-2026-09-15-replaced",
  "35-M313": "chart-2026-09-15-verified",
  "35-M314": "not-in-chart",
  "35-M331": "chart-2026-09-15-verified",
  "35-M332": "chart-2026-09-15-replaced",
  "35-M341": "chart-2026-09-15-replaced",
  "35-M343": "chart-2026-09-15-verified",
  "35-M352": "chart-2026-09-15-replaced",
  "35-M353": "chart-2026-09-15-verified",
  "35-M381": "chart-2026-09-15-verified",
  "35-M382": "chart-2026-09-15-verified",
  "35-M383": "not-in-chart",
  "35-M391": "chart-2026-09-15-replaced",
  "35-M590": "chart-2026-09-15-verified",
  "35-M599": "chart-2026-09-15-verified",
  "45-W1010": "chart-2026-09-15-verified",
  "45-W1011": "chart-2026-09-15-verified",
  "45-W1012": "chart-2026-09-15-verified",
  "45-W1019": "chart-2026-09-15-verified",
  "45-W1020": "chart-2026-09-15-replaced",
  "45-W1110": "chart-2026-09-15-verified",
  "45-W1120": "chart-2026-09-15-verified",
  "45-W1130": "chart-2026-09-15-verified",
  "45-W1140": "chart-2026-09-15-verified",
  "45-W1147": "chart-2026-09-15-verified",
  "45-W1150": "chart-2026-09-15-verified",
  "45-W1160": "chart-2026-09-15-verified",
  "45-W1220": "chart-2026-09-15-verified",
  "45-W1310": "chart-2026-09-15-verified",
  "45-W1320": "chart-2026-09-15-verified",
  "45-W1330": "chart-2026-09-15-verified",
  "45-W1340": "chart-2026-09-15-verified",
  "45-W1350": "chart-2026-09-15-verified",
  "45-W1360": "chart-2026-09-15-verified",
  "45-W1371": "chart-2026-09-15-verified",
  "45-W1380": "chart-2026-09-15-verified",
  "45-W1390": "chart-2026-09-15-verified",
  "45-W1411": "chart-2026-09-15-verified",
  "45-W1420": "chart-2026-09-15-verified",
  "45-W1430": "chart-2026-09-15-verified",
  "45-W1510": "chart-2026-09-15-verified",
  "45-W1520": "chart-2026-09-15-verified",
  "45-W1530": "chart-sample-unclear-kept-swatch",
  "45-W1610": "chart-2026-09-15-verified",
  "45-W1621": "chart-2026-09-15-verified",
  "45-W1910": "chart-2026-09-15-replaced",
  "45-W1920": "chart-2026-09-15-verified",
  "45-W1921": "chart-sample-unclear-kept-swatch",
  "45-W1930": "chart-2026-09-15-verified",
  "45-W1990": "chart-2026-09-15-verified",
  "45-W210": "chart-2026-09-15-verified",
  "45-W211": "chart-2026-09-15-verified",
  "45-W212": "chart-2026-09-15-verified",
  "45-W213": "chart-2026-09-15-verified",
  "45-W214": "chart-2026-09-15-verified",
  "45-W220": "chart-2026-09-15-verified",
  "45-W221": "chart-2026-09-15-verified",
  "45-W301": "chart-2026-09-15-verified",
  "45-W302": "chart-2026-09-15-verified",
  "45-W311": "chart-2026-09-15-replaced",
  "45-W331": "chart-2026-09-15-verified",
  "45-W343": "chart-2026-09-15-verified",
  "45-W351": "chart-2026-09-15-verified",
  "45-W352": "chart-2026-09-15-verified",
  "45-W382": "chart-2026-09-15-verified",
  "45-W391": "chart-2026-09-15-verified",
  "45-W400": "chart-2026-09-15-verified",
  "45-W435": "chart-2026-09-15-verified",
  "45-W446": "chart-2026-09-15-verified",
  "45-W485": "chart-2026-09-15-verified",
  "45-W490": "chart-2026-09-15-verified",
  "45-W495": "not-in-chart",
  "45-W590": "chart-2026-09-15-verified",
  "45-W599": "chart-2026-09-15-verified",
  "49-W408": "chart-2026-09-15-verified",
  "49-W410": "chart-2026-09-15-replaced",
  "49-W420": "chart-2026-09-15-verified",
  "49-W425": "chart-2026-09-15-replaced",
  "49-W436": "chart-2026-09-15-verified",
  "49-W441": "chart-2026-09-15-verified",
  "49-W443": "chart-2026-09-15-verified",
  "49-W448": "chart-2026-09-15-verified",
  "49-W469": "chart-2026-09-15-verified",
  "49-W488": "chart-2026-09-15-verified",
});
