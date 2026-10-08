/**
 * Jezička i urednička pravila za javni tekst rubrike „Saveti i vodiči“.
 *
 * Provera je namerno konzervativna: greška znači da je oblik u ovom domenu
 * gotovo sigurno pogrešan za standardni srpski (ekavica, latinica), a
 * upozorenje znači „pročitajte rečenicu“. Reč koja postoji u više jezika nije
 * automatski greška, pa ovde nema generičkih obrazaca tipa „ije → e“, koji bi
 * oborili i ispravne reči (npr. „nije“, „sjaj“, „projekat“).
 */

const L = "\\p{L}";

function stemRule(stems, replacement, note) {
  return { pattern: new RegExp(`(?<!${L})(?:${stems.join("|")})${L}*`, "giu"), replacement, note };
}

function wordRule(words, replacement, note, flags = "giu") {
  return { pattern: new RegExp(`(?<!${L})(?:${words.join("|")})(?!${L})`, flags), replacement, note };
}

/** Ijekavski, hrvatski, bosanski i slovenački oblici → standardni srpski. */
export const LEXICAL_ERRORS = [
  stemRule(["vrijem"], "vreme", "ijekavica"),
  wordRule(["prije", "poslije"], "pre / posle", "ijekavica"),
  stemRule(["mjest", "mjer", "mješ", "mjesec", "mjeh"], "mest-/mer-/meš-", "ijekavica"),
  wordRule(["dio", "dijela", "dijelu", "dijelom", "dijelovi", "dijelova", "dijelove"], "deo / delovi", "ijekavica"),
  stemRule(["cijel", "cijen", "cijev", "lijep", "lijev", "bijel", "rijeđ", "razrijeđ", "razrjeđ", "svjetl", "svjež", "snijeg", "vjerojatn", "zvjezd", "ljepil", "ljeplj", "slijed", "sljedeć", "uvjet", "obavijest", "provjer", "vjerov", "savjet", "djelov", "djelomič", "rješ", "pjen", "smjes", "smjer", "dvije", "lijek", "sjedin", "primjen", "primjer", "promjen", "zamjen", "izmjen", "razmjer", "usmjer", "namjen", "mjesovit", "vrijedn", "tjeran"], "ekavski oblik", "ijekavica"),
  wordRule(["tijekom"], "tokom", "hrvatski"),
  stemRule(["otopin"], "rastvor", "hrvatski"),
  stemRule(["otapal"], "rastvarač", "hrvatski"),
  wordRule(["tlak", "tlaka", "tlaku", "tlakom"], "pritisak", "hrvatski"),
  wordRule(["zrak", "zraka", "zraku", "zrakom"], "vazduh", "hrvatski"),
  stemRule(["tvrdil"], "učvršćivač", "hrvatski"),
  wordRule(["kist", "kista", "kistom"], "četka", "hrvatski"),
  stemRule(["spremnik"], "posuda / rezervoar", "hrvatski"),
  stemRule(["mlaznic"], "dizna", "hrvatski"),
  stemRule(["točk", "točn", "točan"], "tačka / tačno", "hrvatski"),
  stemRule(["kemij", "kemijsk"], "hemij-", "hrvatski"),
  stemRule(["tisuć"], "hiljada", "hrvatski"),
  stemRule(["općen", "općeg", "općih", "opća", "opće"], "opšt-", "hrvatski"),
  wordRule(["uputa", "upute", "uputama", "uputu"], "uputstvo", "hrvatski"),
  wordRule(["kut", "kuta", "kutu", "kutom"], "ugao", "hrvatski"),
  stemRule(["naočal"], "naočare", "hrvatski"),
  stemRule(["brtv"], "zaptivka", "hrvatski"),
  stemRule(["hrđ"], "rđa", "hrvatski"),
  stemRule(["postot"], "procenat", "hrvatski"),
  wordRule(["stupanj", "stupnja", "stupnju"], "stepen", "hrvatski"),
  stemRule(["tvornic", "tvornič"], "fabrika / fabrički", "hrvatski"),
  stemRule(["hlapljiv", "hlapiv"], "isparljiv", "hrvatski"),
  wordRule(["također"], "takođe", "hrvatski"),
  wordRule(["tko", "netko", "itko", "nitko"], "ko / neko / iko / niko", "hrvatski"),
  stemRule(["obrtnik"], "zanatlija", "hrvatski"),
  stemRule(["laštenj", "laštit"], "poliranje", "hrvatski"),
  stemRule(["sigurnosno-tehničk"], "bezbednosni", "hrvatski"),
  wordRule(["sigurnosni list", "sigurnosnog lista", "sigurnosnom listu"], "bezbednosni list", "hrvatski"),
  stemRule(["histori"], "istorij-", "bosanski"),
  wordRule(["hljeb", "lahko"], "hleb / lako", "bosanski"),
  stemRule(["razredčil", "zaščit", "barvn"], "srpski oblik", "slovenački"),
  wordRule(["tudi", "barva", "barve"], "srpski oblik", "slovenački"),
];

/** Najčešće reči napisane bez dijakritika. */
export const MISSING_DIACRITICS = wordRule(
  ["moze", "mozete", "cesto", "takodje", "izmedju", "medjutim", "jos", "vec", "sta", "zasto", "nacin", "nacina", "povrsina", "povrsine", "povrsinu", "susenje", "susenja", "brusenje", "brusenja", "ce", "ces", "cete", "ucvrscivac", "razredjivac", "sledeci", "odmascivanje", "zastita"],
  "dodati č, ć, š, ž, đ",
  "bez dijakritika",
  "gu",
);

/** Persiranje: zamenica obraćanja se piše velikim slovom (stil sajta). */
export const LOWERCASE_ADDRESS = wordRule(
  ["vi", "vas", "vam", "vama", "vaš", "vaša", "vaše", "vašeg", "vašem", "vašoj", "vašu", "vaši", "vašim", "vaših", "vašom"],
  "Vi / Vas / Vam / Vaš",
  "persiranje",
  "gu",
);

/** Tikanje u obraćanju posetiocu. */
export const INFORMAL_ADDRESS = wordRule(
  ["tvoj", "tvoja", "tvoje", "tvog", "tvojim", "tebi", "tebe", "možeš", "moraš", "trebaš", "imaš", "znaš", "radiš", "koristiš", "nanosiš", "pogledaj", "probaj"],
  "persiranje (možete, proverite…)",
  "tikanje",
);

/** Ćirilica u latiničnom tekstu. */
export const CYRILLIC = /\p{Script=Cyrillic}+/gu;

/** Brendovi koji nisu u aktivnom programu firme. */
export const EXCLUDED_BRANDS = wordRule(["3M", "sia", "Molotow"], "ne pominjati", "brend van programa");

/** Pravno rizične formulacije koje traže potvrdu firme. */
export const RISKY_CLAIMS = stemRule(
  ["zvaničn[ia] distribut", "ovlašćen[a-z]* (?:zastup|distribut|servis|partner)", "ekskluzivn[a-z]* (?:partner|zastup|distribut|uvoz)", "generaln[a-z]* zastup"],
  "bezbedna formulacija (npr. „brendovi u ponudi“)",
  "pravno rizično",
);

/** Tvrdnje o učestalosti koje traže dokaz. */
export const FREQUENCY_CLAIMS = stemRule(["najčešć", "najtraženij", "najpopularnij"], "dokaz ili urednička formulacija", "tvrdnja o učestalosti");

/**
 * Tehnička vrednost sa jedinicom. Takav podatak sme da stoji samo u bloku
 * (pasus, stavka, red tabele, okvir) koji ima citat izvora.
 */
export const TECHNICAL_VALUE =
  /(?<![\p{L}\d])\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?(?:°\s?C|°C|bar(?:a|u)?\b|psi\b|µm|μm|mikron\p{L}*|mikrometar\p{L}*|g\/l|minut\p{L}*|min\b|sat(?:a|i)?\b|časova\b|h\b|%|mm\b|ml\b|l\/min|kPa|MPa)|(?<![\p{L}\d])\d+\s?:\s?\d+(?:\s?:\s?\d+)?(?![\d:])/giu;

function findAll(rule, text) {
  const hits = [];
  rule.pattern.lastIndex = 0;
  let match;
  while ((match = rule.pattern.exec(text))) hits.push(match[0]);
  return hits;
}

/**
 * Provera jednog teksta. Vraća { errors, warnings } kao poruke.
 * `protectedNames` su nazivi proizvoda i dokumenata koji se ne menjaju (npr.
 * „Abdeckfolie“) — tekst unutar `kod` oznake se ne proverava.
 */
/**
 * @param {string} text
 * @param {{ protectedTerms?: string[] }} [options]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkSerbianText(text, { protectedTerms = [] } = {}) {
  let subject = text;
  for (const term of protectedTerms) {
    if (term) subject = subject.split(term).join(" ");
  }
  const errors = [];
  const warnings = [];
  for (const rule of LEXICAL_ERRORS) {
    for (const hit of findAll(rule, subject)) errors.push(`„${hit}“ (${rule.note}) → ${rule.replacement}`);
  }
  for (const hit of findAll(MISSING_DIACRITICS, subject)) {
    errors.push(`„${hit}“ (${MISSING_DIACRITICS.note}) → ${MISSING_DIACRITICS.replacement}`);
  }
  // Zamenica obraćanja: velikim slovom; ne proverava se početak rečenice jer je tamo ionako veliko.
  for (const hit of findAll(LOWERCASE_ADDRESS, subject)) {
    if (hit[0] === hit[0].toLowerCase()) errors.push(`„${hit}“ (${LOWERCASE_ADDRESS.note}) → ${LOWERCASE_ADDRESS.replacement}`);
  }
  for (const hit of findAll(INFORMAL_ADDRESS, subject)) {
    errors.push(`„${hit}“ (${INFORMAL_ADDRESS.note}) → ${INFORMAL_ADDRESS.replacement}`);
  }
  const cyrillic = subject.match(CYRILLIC);
  if (cyrillic) errors.push(`ćirilica u latiničnom tekstu: ${cyrillic.slice(0, 3).join(", ")}`);
  for (const hit of findAll(EXCLUDED_BRANDS, subject)) {
    // „sia“ malim slovima nije brend samo kada je deo drugog jezika; ovde je uvek greška.
    errors.push(`„${hit}“ (${EXCLUDED_BRANDS.note})`);
  }
  for (const hit of findAll(RISKY_CLAIMS, subject)) errors.push(`„${hit}“ (${RISKY_CLAIMS.note}) → ${RISKY_CLAIMS.replacement}`);
  for (const hit of findAll(FREQUENCY_CLAIMS, subject)) warnings.push(`„${hit}“ (${FREQUENCY_CLAIMS.note})`);
  if (/\s[,.;:!?]/.test(text.replace(/\s(?:\.\.\.|…)/g, ""))) warnings.push("razmak ispred interpunkcije");
  if (/ {2,}/.test(text)) warnings.push("dvostruki razmak");
  if (/"[^"]*"/.test(text)) warnings.push("prave navodnike zameniti srpskim „…“");
  return { errors, warnings };
}

/** @param {string} text @returns {string[]} */
export function technicalValues(text) {
  TECHNICAL_VALUE.lastIndex = 0;
  return text.match(TECHNICAL_VALUE) ?? [];
}
