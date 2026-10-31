/**
 * SATA dokumenti — identitet, klasifikacija i provera sadržaja PDF-a.
 *
 * SATA objavljuje fajl pod `/media/<heš>/<ts>/<FAJL>.PDF.PDF?ts=<ts>`; heš i `ts` se menjaju pri
 * objavljivanju njihovog sajta (2026-10-31: svih 66 adresa iz sync-a 2026-09-20 → 404). Stalni
 * identitet dokumenta je zato ime fajla bez `.PDF` nastavaka (`documentKey`), a adresa je samo
 * poslednja proverena lokacija tog fajla.
 */

/** Ime fajla iz adrese, bez putanje i `?ts=`. */
export function fileOf(href) {
  return decodeURIComponent(new URL(href).pathname.split("/").pop());
}

/** Stalni identitet: ime fajla bez `.PDF` nastavaka, velikim slovima. */
export function documentKeyOf(file) {
  return file.replace(/(\.pdf)+$/i, "").toUpperCase();
}

/** Sve adrese fajlova (PDF) koje stranica porodice nudi — isti izraz kao `acquire-families.mjs`. */
export function pdfLinksOf(html) {
  const decode = (value) => value.replaceAll("&amp;", "&");
  return [...new Set([...html.matchAll(/href="([^"]+\.pdf(?:\.pdf)?(?:\?[^"]*)?)"/gi)].map((match) => decode(match[1])))]
    .map((href) => (href.startsWith("/") ? `https://www.sata.com${href}` : href));
}

/*
 * Jezik se čita iz SADRŽAJA, ne iz imena fajla: `BETRIEBSANLEITUNG-…` je u imenu nemački,
 * a fajl je često višejezičan. Broje se česte reči svakog jezika; jezik „postoji“ u dokumentu
 * kada ima dovoljno pogodaka.
 */
const LANGUAGE_WORDS = {
  en: ["the", "and", "with", "for", "this", "must", "operating", "instructions", "declaration", "conformity"],
  de: ["und", "der", "die", "das", "mit", "nicht", "werden", "betriebsanleitung", "für", "konformitätserklärung"],
  fr: ["et", "les", "des", "pour", "avec", "doit", "être", "mode", "déclaration", "conformité"],
  it: ["e", "il", "della", "per", "con", "deve", "essere", "istruzioni", "dichiarazione", "conformità"],
  es: ["y", "los", "las", "para", "con", "debe", "instrucciones", "declaración", "conformidad", "según"],
  nl: ["en", "het", "van", "voor", "met", "moet", "worden", "gebruiksaanwijzing", "verklaring", "overeenstemming"],
  pl: ["i", "oraz", "dla", "się", "należy", "instrukcja", "obsługi", "deklaracja", "zgodności", "jest"],
  cs: ["a", "pro", "se", "je", "návod", "k", "obsluze", "prohlášení", "shodě", "musí"],
  ru: ["и", "для", "не", "в", "на", "инструкция", "эксплуатации", "декларация", "соответствия", "должны"],
};

/*
 * Naslov dokumenta na svakom jeziku. Izjave su često skoro bez teksta van naslova i tabele
 * (npr. SATA air vision 5000 n: ~2700 znakova), pa sam broj čestih reči ne vidi sve jezike.
 */
const TITLE_MARKERS = {
  en: /declaration of conformity|operating instructions|operating manual/i,
  de: /konformitätserklärung|betriebsanleitung/i,
  fr: /déclaration (?:ue |ce |de )?(?:de )?conformité|mode d.emploi/i,
  it: /dichiarazione (?:ue |ce )?di conformità|istruzioni d.(?:uso|impiego)/i,
  es: /declaración (?:ue |ce )?de conformidad|manual de instrucciones|instrucciones de servicio/i,
  nl: /conformiteitsverklaring|gebruiksaanwijzing/i,
  pl: /deklaracja zgodności|instrukcja obsługi/i,
  cs: /prohlášení o shodě|návod k použití|návod k obsluze/i,
  ru: /декларация соответствия|инструкция по эксплуатации|руководство по эксплуатации/i,
};

export function detectLanguages(text) {
  const byTitle = Object.entries(TITLE_MARKERS).filter(([, pattern]) => pattern.test(text)).map(([language]) => language);
  const byWords = detectLanguagesByWords(text);
  return [...new Set([...byWords, ...byTitle])];
}

function detectLanguagesByWords(text) {
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const counts = Object.fromEntries(Object.keys(LANGUAGE_WORDS).map((language) => [language, 0]));
  const sets = Object.fromEntries(Object.entries(LANGUAGE_WORDS).map(([language, list]) => [language, new Set(list)]));
  for (const word of words) for (const language of Object.keys(sets)) if (sets[language].has(word)) counts[language] += 1;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
  // Jezik je prisutan kada nosi bar 4 % pogodaka i bar 15 reči (jednoslovne reči jezika se preklapaju).
  return Object.entries(counts)
    .filter(([, count]) => count >= 15 && count / total >= 0.04)
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language);
}

/** Jezička oznaka dokumenta iz prisutnih jezika: više od dva → višejezičan. */
export function languageLabelOf(languages) {
  if (languages.length === 0) return null;
  if (languages.length > 2) return "multilingual";
  return languages.join("+");
}

/** Dokaz vrste dokumenta u tekstu. */
const KIND_EVIDENCE = {
  manual: /operating instructions|operating manual|betriebsanleitung|bedienungsanleitung|mode d.emploi|istruzioni d.uso|manual de instrucciones|gebruiksaanwijzing/i,
  declaration: /declaration of conformity|konformitätserklärung|déclaration (?:ue |ce )?de conformité|dichiarazione (?:ue |ce )?di conformità|declaración (?:ue |ce )?de conformidad|eu-konformit|ec declaration|eu declaration/i,
  brochure: /.+/s,
};

export function kindEvidenceOf(kind, text) {
  return KIND_EVIDENCE[kind].test(text);
}

/** Normalizacija za poređenje naziva modela: mala slova, samo slova i cifre, bez razmaka. */
const squash = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/*
 * Model: tekst PDF-a mora da imenuje porodicu. Prihvata se zvanični naziv porodice ili naziv
 * modela iz imena fajla (`…-SATA-ADAM-2` → „sataadam2“). Izdanja („basecoat edition“) dele
 * uputstvo osnovnog modela; tada se traži osnovni naziv bez reči izdanja.
 */
const EDITION = /\b(?:basecoat|clearcoat|clear coat|by stilbruch|lignum \d+|digital|edition|e|stativ|series)\b/gi;

export function modelEvidenceOf({ officialName, file }, text) {
  const haystack = squash(text);
  const candidates = new Set();
  candidates.add(officialName);
  candidates.add(officialName.replace(EDITION, " ").replace(/\s+/g, " ").trim());
  const fromFile = documentKeyOf(file)
    .replace(/^(MULTILINGUAL|EN|DE|IT|FR|ES)[-_]+/i, "")
    .replace(/^(BETRIEBSANLEITUNG(_MANUAL)?|BAL|EG-KONFORMITATSERKLARUNG|KONFORMIT_TSERKL_RUNG|DECLARATION-OF-CONFORMITY|SATA-OPERATING-MANUAL|SATA-DECLARATION-OF-CONFORMITY|OPERATING-MANUAL|LEAFLET|PROSPEKT)[-_]+/i, "")
    .replace(/[-_]\d{4}[-_]\d{6}([-_]\d+)?$/, "")
    .replace(/[-_]\d{4}$/, "");
  if (fromFile) candidates.add(fromFile.replace(/[-_]+/g, " "));
  for (const candidate of candidates) {
    const key = squash(candidate);
    if (key.length >= 4 && haystack.includes(key)) return candidate;
  }
  return null;
}
