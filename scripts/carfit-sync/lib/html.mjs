/**
 * Čitanje Elementor sadržaja stranice proizvoda sa carfitrepair.com.
 *
 * Gramatika (popisana nad svih 123 stranice, EN i DE):
 *
 *   h2 Description                → prozni opis; u njemu i šifre artikala
 *   h3 <komponenta>               → OPCIONI blok (Clearcoat, Hardener, Discs, Stripes, Lids…)
 *      Item no.: <šifra>, <opis>  → jedna po varijanti, vezana za SVOJ blok
 *   h2 Application                → namena
 *   h2 Features                   → osobine (bulleti)
 *   h2 Substrates                 → podloge
 *   h2 Downloads                  → TDS / SDS (i SDS komponente: „(hardener)”)
 *   h2 Additional informations    → dvokolonski redovi: naziv | vrednost
 *   h2 Technical data             → „Naziv:” pa vrednost
 *
 * Dve odluke koje bi spljošten tekst pogrešio (nasleđene iz
 * `scripts/acquire-carfit-catalog.mjs`, gde su prvi put utvrđene):
 *   1. Specifikacije se čitaju iz dvokolonske Elementor strukture, ne sparivanjem
 *      susednih linija — sparivanje se raspari čim stranica pomeša oblike.
 *   2. h3 je granica KOMPONENTE, ne veličina: šifre učvršćivača ne smeju da
 *      naslede gustinu laka.
 */

const ENTITIES = {
  "&amp;": "&", "&nbsp;": " ", "&quot;": '"', "&lt;": "<", "&gt;": ">",
  "&#8211;": "–", "&#8212;": "—", "&#8217;": "'", "&#8216;": "'", "&#8242;": "′", "&#8243;": "″",
  "&#8222;": "„", "&#8220;": "“", "&#8221;": "”", "&#039;": "'", "&#39;": "'", "&#215;": "×",
};

/**
 * Ćirilični dvojnici u proizvođačevom tekstu („140°С”, „4 m х 5 m”) cepaju
 * inače iste vrednosti. Svode se na latinicu, a svako svođenje se broji.
 */
const CONFUSABLES = {
  "С": "C", "х": "x", "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
  "Р": "P", "Т": "T", "Х": "X", "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
};

export const counters = { confusablesFolded: 0 };

export function decode(value) {
  let text = String(value ?? "");
  for (const [entity, replacement] of Object.entries(ENTITIES)) text = text.split(entity).join(replacement);
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function foldConfusables(text) {
  return text.replace(/[Ѐ-ӿ]/g, (char) => {
    if (!CONFUSABLES[char]) return char;
    counters.confusablesFolded += 1;
    return CONFUSABLES[char];
  });
}

export const clean = (value) => foldConfusables(decode(value)).replace(/[\s ]+/g, " ").trim();

/** Elementor ostavlja šablonski tekst koji nije sadržaj proizvoda. */
const TEMPLATE_NOISE = [/^gib hier deine überschrift ein$/i, /^enter your heading here$/i, /^add your heading text here$/i, /^lorem ipsum/i];
const isNoise = (line) => !line || TEMPLATE_NOISE.some((pattern) => pattern.test(line));

const stripNonContent = (html) =>
  String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ");

/** Vidljive linije: svaki tag je prelom (bold oko šifre se kasnije ponovo spaja). */
export function toLines(html) {
  return stripNonContent(html)
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map(clean)
    .filter((line) => !isNoise(line));
}

/** Pasusi: prelom samo na blok-elementima i <br>, inline tagovi se spajaju. */
export function toParagraphs(html) {
  return stripNonContent(html)
    .replace(/<br\s*\/?>|<\/(p|li|div|h[1-6]|tr|ul|ol)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .map(clean)
    .filter((line) => !isNoise(line));
}

export const SECTIONS = [
  { key: "description", re: /^(beschreibung|description)$/i },
  { key: "application", re: /^(zweckbestimmung|typische anwendung(en)?|application|typical applications?|intended use|purpose)$/i },
  { key: "features", re: /^(eigenschaften?|vorteile|properties|features|advantages|characteristics)$/i },
  { key: "substrates", re: /^(oberflächen|untergründe|surfaces|substrates)$/i },
  { key: "downloads", re: /^(downloads?|dateien)$/i },
  { key: "additionalInformation", re: /^(weitere produktinformation(en)?|additional informations?|further product information)$/i },
  { key: "technicalData", re: /^(technische daten|technical data)$/i },
  { key: "storage", re: /^(haltbarkeit und lagerbedingungen|lagerung|shelf life and storage conditions|storage)$/i },
  { key: "scopeOfDelivery", re: /^(lieferumfang|scope of delivery)$/i },
];

/** Deli sadržaj na blokove kod svakog h2/h3. h2 = sekcija, h3 = komponenta u njoj. */
export function splitBlocks(html) {
  const source = stripNonContent(html);
  const blocks = [];
  const unknownHeadings = [];
  const pattern = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let lastIndex = 0;
  let section = "(lead)";
  let component = null;
  let match;
  const push = (body) => {
    if (body.trim()) blocks.push({ section, component, html: body });
  };
  while ((match = pattern.exec(source))) {
    push(source.slice(lastIndex, match.index));
    const heading = clean(match[2].replace(/<[^>]*>/g, " "));
    if (match[1] === "2") {
      const known = SECTIONS.find((entry) => entry.re.test(heading));
      if (!known && !isNoise(heading)) unknownHeadings.push(heading);
      section = known?.key ?? (isNoise(heading) ? "(noise)" : `(other:${heading})`);
      component = null;
    } else if (!isNoise(heading)) {
      component = SECTIONS.some((entry) => entry.re.test(heading)) ? null : heading;
    }
    lastIndex = pattern.lastIndex;
  }
  push(source.slice(lastIndex));
  return { blocks, unknownHeadings };
}

/** Zvanična šifra artikla: `N-NNN-NNNN` (uz retke duže/kraće repove). */
export const ARTICLE_TOKEN = /\b\d-\d{3}-\d{3,5}[A-Za-z]?\b/g;
const ARTICLE_MARKER = /(?:item\s*no\.?|art\.?\s*-?\s*(?:nr|no)\.?)\s*:?[\s|]*(\d-\d{3}-\d{3,5}[A-Za-z]?)/gi;

/**
 * Šifre artikala u bloku. Marker se locira prvi, a opis je tekst IZMEĐU dva
 * markera — inače rep prvog „proguta” sve naredne šifre.
 */
export function parseVariants(blockHtml, component) {
  const joined = toLines(blockHtml).join(" | ");
  const found = [];
  let match;
  ARTICLE_MARKER.lastIndex = 0;
  while ((match = ARTICLE_MARKER.exec(joined))) {
    found.push({ articleNumber: match[1], start: match.index, end: ARTICLE_MARKER.lastIndex });
  }
  return found.flatMap((entry, index) => {
    const tail = joined
      .slice(entry.end, index + 1 < found.length ? found[index + 1].start : undefined)
      .split("|")
      .map((part) => part.replace(/^[,\s]+/, "").trim())
      .filter(Boolean);
    let descriptor = tail.join(", ").replace(/\s*,\s*$/, "").replace(/\s+,/g, ",") || null;

    // Proizvođačeva skraćenica: „3-225-0002/0200/0400/0850” = četiri šifre sa istim
    // prefiksom. Čita se doslovno; svaka proširena šifra nosi `shorthandOf`.
    const shorthand = /^((?:\/\s*\d{4})+)\s*,?\s*/.exec(descriptor ?? "");
    const suffixes = shorthand ? shorthand[1].match(/\d{4}/g) : [];
    if (shorthand) descriptor = descriptor.slice(shorthand[0].length).trim() || null;
    const prefix = entry.articleNumber.slice(0, entry.articleNumber.lastIndexOf("-") + 1);

    return [
      { articleNumber: entry.articleNumber, component: component ?? null, descriptor, shorthandOf: null },
      ...suffixes.map((suffix) => ({
        articleNumber: `${prefix}${suffix}`,
        component: component ?? null,
        descriptor,
        shorthandOf: `${entry.articleNumber}${shorthand[1].replace(/\s+/g, "")}`,
      })),
    ];
  });
}

/** Dvokolonski redovi: `elementor-inner-section` → [naziv, vrednost]. */
export function parseTwoColumnRows(blockHtml) {
  const rows = [];
  for (const chunk of blockHtml.split("elementor-inner-section").slice(1)) {
    const cells = [...chunk.matchAll(/elementor-widget-container">\s*((?:<p>[\s\S]*?<\/p>\s*)+)/g)].map((match) =>
      clean(match[1].replace(/<[^>]*>/g, " ")),
    );
    if (cells.length >= 2 && cells[0] && cells[1] && !isNoise(cells[0])) {
      rows.push({ label: cells[0].replace(/:$/, "").trim(), value: cells[1] });
    }
  }
  return rows;
}

/** „Naziv:” na jednoj liniji, vrednost na sledećoj (paste za poliranje). */
export function parseColonRows(blockHtml) {
  const lines = toParagraphs(blockHtml);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const inline = /^([A-ZÄÖÜ][^:]{1,60}):\s*(\S.*)$/.exec(lines[index]);
    if (inline) {
      rows.push({ label: inline[1].trim(), value: inline[2].trim() });
      continue;
    }
    const wrapped = /^([A-ZÄÖÜ][^:]{1,60}):\s*$/.exec(lines[index]);
    const next = lines[index + 1];
    if (wrapped && next && !/:$/.test(next)) {
      rows.push({ label: wrapped[1].trim(), value: next.trim() });
      index += 1;
    }
  }
  return rows;
}

/** Dokumenti: svaki PDF link sa natpisom; vrsta i komponenta se čitaju iz natpisa. */
export function parseDocuments(html) {
  const out = [];
  const seen = new Set();
  for (const match of stripNonContent(html).matchAll(/<a\b[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decode(match[1]).trim();
    const label = clean(match[2].replace(/<[^>]*>/g, " ")) || null;
    const key = `${href}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lower = (label ?? "").toLowerCase();
    const kind = /safety|sicherheit|sds|msds/.test(lower) ? "sds" : /technical|technisch|tds|merkblatt/.test(lower) ? "tds" : "other";
    const component = /\(([^)]+)\)/.exec(label ?? "")?.[1] ?? (/,\s*(.+)$/.exec(label ?? "")?.[1] ?? null);
    out.push({ kind, label, component: component ? component.trim() : null, href });
  }
  return out;
}

/** Slike u sadržaju; `wp-image-<id>` daje ID priloga kada ga Elementor upiše. */
export function parseImages(html) {
  const out = [];
  for (const match of stripNonContent(html).matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const srcset = /\bsrcset="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const largest = srcset
      .split(",")
      .map((item) => item.trim().split(/\s+/))
      .filter((pair) => pair[0])
      .sort((a, b) => parseInt(b[1] ?? "0", 10) - parseInt(a[1] ?? "0", 10))[0]?.[0];
    out.push({
      src: decode(src),
      largest: largest ? decode(largest) : null,
      attachmentId: Number(/wp-image-(\d+)/.exec(attrs)?.[1] ?? 0) || null,
      alt: clean(/\balt="([^"]*)"/.exec(attrs)?.[1] ?? "") || null,
    });
  }
  return out;
}

const NUMBER = "(\\d+(?:[.,]\\d+)?)";
const COLOR_WORDS = [
  "white", "black", "grey", "gray", "red", "blue", "green", "yellow", "orange", "gold", "beige", "brown",
  "pink", "purple", "violet", "anthracite", "transparent", "silver", "clear", "maroon",
];

/**
 * Strukturisani atributi iz opisa varijante („grit P40, 50 pcs.”, „1 l”,
 * „97 mm x 120 mm (15 Stk.), Brown. Fine”). Čita se samo ono što doslovno piše.
 */
export function parseDescriptor(descriptor) {
  const text = clean(descriptor ?? "");
  const out = {};
  if (!text) return out;

  const grit = /(?:^|[\s,(])(?:grit\s*)?P\s?(\d{2,5})\b/i.exec(text);
  if (grit) out.grit = `P${grit[1]}`;

  const pieces = new RegExp(`${NUMBER}\\s?(?:pcs\\.?|pc\\.?|pieces|stk\\.?|st\\.|stück|rolls?|sheets?|pairs?)(?=$|[\\s,).])`, "i").exec(text);
  if (pieces) out.pieces = pieces[1];

  const dimensions = new RegExp(
    `${NUMBER}\\s?(mm|cm|m)?\\s?[x×]\\s?${NUMBER}\\s?(mm|cm|m)(?:\\s?[x×]\\s?${NUMBER}\\s?(mm|cm|m))?`,
    "i",
  ).exec(text);
  if (dimensions) out.dimensions = clean(dimensions[0]).replace(/\s?[x×]\s?/g, " × ");

  if (!dimensions) {
    const length = new RegExp(`(?:^|[\\s,(Ø])${NUMBER}\\s?(mm|cm|m)(?=$|[\\s,).])`, "i").exec(text);
    if (length) out.length = `${length[1].replace(",", ".")} ${length[2].toLowerCase()}`;
  }

  const volume = new RegExp(`(?:^|[\\s,(])${NUMBER}\\s?(ml|l|ltr|litre|liter)(?=$|[\\s,).])`, "i").exec(text);
  if (volume) out.volume = `${volume[1].replace(",", ".")} ${/^m/i.test(volume[2]) ? "ml" : "L"}`;

  const weight = new RegExp(`(?:^|[\\s,(])${NUMBER}\\s?(kg|g)(?=$|[\\s,).])`, "i").exec(text);
  if (weight) out.weight = `${weight[1].replace(",", ".")} ${weight[2].toLowerCase()}`;

  const micron = new RegExp(`${NUMBER}\\s?(?:µm|μm|µ|my)(?=$|[\\s,).])`, "i").exec(text);
  if (micron) out.micron = `${micron[1].replace(",", ".")} µm`;

  const holes = /(\d+)\s?holes?\b/i.exec(text);
  if (holes) out.holes = holes[1];

  const color = COLOR_WORDS.find((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  if (color) out.color = color === "gray" ? "grey" : color;

  return out;
}

/** Ceo post → strukturisan zapis. Polje koje ne postoji ostaje `null` / prazan niz. */
export function parseProductContent(html) {
  const { blocks, unknownHeadings } = splitBlocks(html);
  const paragraphsOf = (key) => blocks.filter((block) => block.section === key).flatMap((block) => toParagraphs(block.html));

  const variants = blocks.flatMap((block) => parseVariants(block.html, block.component));
  const markerFree = (line) => !/(?:item\s*no\.?|art\.?\s*-?\s*(?:nr|no)\.?)\s*:?/i.test(line);

  // Opis bez linija sa šiframa i bez h3 blokova (oni nose samo šifre).
  const description = blocks
    .filter((block) => block.section === "description")
    .flatMap((block) => toParagraphs(block.html))
    .filter(markerFree);

  const additionalInformation = blocks
    .filter((block) => block.section === "additionalInformation")
    .flatMap((block) => parseTwoColumnRows(block.html).map((row) => ({ ...row, component: block.component })));
  const technicalData = blocks
    .filter((block) => block.section === "technicalData" || block.section === "storage")
    .flatMap((block) => parseColonRows(block.html).map((row) => ({ ...row, section: block.section })));

  const otherSections = blocks
    .filter((block) => block.section.startsWith("(other:"))
    .map((block) => ({ heading: block.section.slice(7, -1), lines: toParagraphs(block.html) }))
    .filter((entry) => entry.lines.length);

  const allTokens = [...new Set(toLines(html).join(" ").match(ARTICLE_TOKEN) ?? [])];
  const marked = new Set(variants.map((variant) => variant.articleNumber));

  return {
    description: description.length ? description : null,
    application: paragraphsOf("application").filter(markerFree),
    features: paragraphsOf("features").filter(markerFree),
    substrates: paragraphsOf("substrates").filter(markerFree),
    scopeOfDelivery: paragraphsOf("scopeOfDelivery"),
    additionalInformation,
    technicalData,
    otherSections,
    variants,
    componentBlocks: [...new Set(variants.map((variant) => variant.component).filter(Boolean))],
    /** Tokeni oblika šifre koji NISU uz marker „Item no.” — mora biti prazno ili objašnjeno. */
    unmarkedArticleTokens: allTokens.filter((token) => !marked.has(token)),
    unknownHeadings,
    documents: parseDocuments(html),
    images: parseImages(html),
  };
}
