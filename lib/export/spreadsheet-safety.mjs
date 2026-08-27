/**
 * Zaštita ćelija tabelarnog izvoza od izvršavanja formula.
 *
 * Napad (OWASP „CSV Injection" / Formula Injection): naziv artikla ili kupca
 * uvezen iz spoljnog izvora glasi `=cmd|'/c calc'!A1`. Podatak sam po sebi ništa
 * ne radi — ali kada zaposleni otvori izveštaj u Excelu ili LibreOffice-u,
 * program prvi znak `=` čita kao početak formule i izvršava je.
 *
 * https://owasp.org/www-community/attacks/CSV_Injection
 *
 * Zašto ovo ne rešava navođenje pod navodnike
 * -------------------------------------------
 * Navodnici u CSV-u su ugovor CSV parsera, ne tabelarnog programa. Excel prvo
 * raščlani `"=1+1"` u ćeliju `=1+1`, pa tek onda odlučuje da je to formula.
 * Ispravan i jedini pouzdan potez je da vrednost prestane da počinje markerom —
 * odatle prefiks apostrofom.
 *
 * Šta se NAMERNO ne dira
 * ----------------------
 * Stvaran broj ostaje broj. `-1250.40` prosleđen kao `number` je iznos i mora
 * ostati sabirljiv u tabeli. Isti taj zapis kao **tekst** (`"-2+3"`) je
 * nepouzdan ulaz i dobija zaštitu — jer za tekst ne postoji nijedna garancija
 * odakle je došao.
 */

/**
 * Znaci kojima tabelarni program počinje formulu.
 *
 * `-` je tu jer je `-1+1` validna formula, a ne broj. Zato razlika između
 * broja i teksta mora biti odlučena PRE ove provere, po tipu vrednosti.
 */
const FORMULA_MARKERS = ["=", "+", "-", "@"];

/**
 * Znaci koji sami po sebi otvaraju napad ako stoje na početku.
 *
 * Tab i prelom reda pomeraju sadržaj u susednu ćeliju ili red, pa se ono što je
 * bilo bezopasan nastavak teksta može naći na početku nove ćelije — tamo gde ga
 * program ponovo čita kao mogući početak formule.
 */
const LEADING_CONTROL = ["\t", "\r", "\n"];

/**
 * Beline koje tabelarni program preskače pre nego što protumači sadržaj.
 *
 * Obuhvata i one koje se u praksi provuku kroz izvoz: nedeljivi razmak,
 * tipografske razmake, oznake smera pisanja i BOM. Bez njih bi `" =1+1"`
 * prošlo kao bezopasno.
 */
const SKIPPABLE = new RegExp(
  "^[" +
    "\\s" + // razmak, tab, prelom reda, vertikalni tab, form feed
    "\\u00a0" + // nedeljivi razmak
    "\\u1680" + // ogham space mark
    "\\u2000-\\u200f" + // tipografske beline + oznake smera pisanja
    "\\u2028\\u2029" + // line/paragraph separator
    "\\u202f\\u205f\\u3000" + // uski nedeljivi, matematički, idеografski razmak
    "\\ufeff" + // BOM
    "]+",
);

/** Prefiks kojim se vrednost prestaje čitati kao formula. */
export const FORMULA_GUARD = "'";

/**
 * Da li tekst tabelarni program može protumačiti kao formulu.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeFormula(text) {
  if (typeof text !== "string" || text === "") return false;

  // Vodeći tab ili prelom reda je opasan i pre nego što se stigne do markera.
  if (LEADING_CONTROL.includes(text[0])) return true;

  const meaningful = text.replace(SKIPPABLE, "");
  if (meaningful === "") return false;

  return FORMULA_MARKERS.includes(meaningful[0]);
}

/**
 * Vrednost ćelije, neutralizovana ako je potrebno.
 *
 * Vraća **istu vrednost** kada je bezbedna, pa se izveštaji ne menjaju bez
 * razloga. Poziva se tačno jednom po ćeliji, pre serijalizacije — ni CSV ni
 * SpreadsheetML ne smeju videti sirov marker.
 *
 * @param {unknown} value
 * @returns {unknown} broj ostaje broj; tekst se po potrebi prefiksuje
 */
export function guardSpreadsheetValue(value) {
  // Broj je već tipiziran kao broj i ne može postati formula. Ovo je i jedini
  // razlog zašto negativan iznos ostaje sabirljiv u tabeli.
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return value;

  return looksLikeFormula(value) ? `${FORMULA_GUARD}${value}` : value;
}

/**
 * Ceo red, ćeliju po ćeliju.
 *
 * @param {readonly unknown[]} row
 * @returns {unknown[]}
 */
export function guardSpreadsheetRow(row) {
  return (row ?? []).map(guardSpreadsheetValue);
}
