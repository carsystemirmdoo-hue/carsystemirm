/**
 * Čitanje zvaničnog baslac tehničkog lista (PDF → činjenice).
 *
 * List ima stabilan raspored: podnožje se izvlači pre sadržaja, pa se zaglavlje strane
 * prepoznaje po „echnical Information" (pypdf razdvaja prvo slovo reda), zatim šifra,
 * pa naziv u više redova do „JSON created". Sadržaj strane počinje posle „page N of M".
 *
 * Vadi se SAMO ono što list izričito piše. Nijedna vrednost se ne izvodi računom.
 */

/** Šifre u redu odnosa mešanja: „50-20, -30" → 50-20, 50-30. */
export function codesInRatio(line) {
  const out = [];
  let prefix = null;
  for (const match of String(line).matchAll(/(?:\b(\d{2})-([A-Z]?\d{2,3})\b|-(\d{2,3})\b)/g)) {
    if (match[1]) {
      prefix = match[1];
      out.push(`${match[1]}-${match[2]}`);
    } else if (prefix) out.push(`${prefix}-${match[3]}`);
  }
  return [...new Set(out)];
}

const BULLET = /^[•▪�§-]$/;
const isNoise = (line) =>
  BULLET.test(line) ||
  line === "." ||
  /^(Safety advice:|The (data|products|EU limit|VOC content)|It cannot be ruled out|our products,|properties, nor|Any descriptions|general information|specification\)\.|Please note:|sensor technology|, must always|fect processing|BASF Coatings|Automotive Refinish|, Germany|,$|\d{2}\/\d{4}$|JSON created|page \d+ of \d+|2004\/42)/.test(line);

/** Etikete koje u listu stoje same u redu, a vrednost je sledeći red. */
const LABELS = [
  ["mixingRatio", /^Mixing Ratio$/i],
  ["sprayViscosity", /^Spray viscosity/i],
  ["potLife", /^Potlife/i],
  ["nozzle", /^Nozzle size$/i],
  ["sprayCoats", /^Number of spray coats$/i],
  ["filmThickness", /^Film thickness$/i],
  ["flashOff", /^Flash off/i],
  ["sanding", /^(Orbital sanding|Sanding, dry|Dry sanding)/i],
];

/**
 * pypdf prelama red na kerningu, pa reč ostaje presečena („2K W" + „ash primer",
 * „T" + „echnical Information"). Nastavak se prepoznaje po tome što počinje malim
 * slovom ili zarezom, a prethodni red se završava slovom — spaja se BEZ razmaka.
 */
const UNIT_TOKEN = /^(min|h|s|mm|cm|bar|ml|kg|g|l|μm|%)$/i;
/** Kratke ENGLESKE reči na kraju reda su cela reč, ne odsečen početak sledeće. */
const SHORT_WORD = new Set(["is", "in", "of", "to", "the", "be", "by", "at", "on", "or", "and", "for", "as", "it", "no", "up", "we", "a", "an", "if", "so", "do", "use", "its", "may", "are", "can", "not", "all", "our", "per", "max", "min"]);
function mendLines(lines) {
  const out = [];
  for (const line of lines) {
    const previous = out[out.length - 1];
    if (!previous || !/[A-Za-z]$/.test(previous) || !/^[a-z,]/.test(line)) { out.push(line); continue; }
    const tail = previous.split(/\s+/).pop();
    // Presečena reč se spaja bez razmaka; prelomljena rečenica ostaje sa razmakom.
    const broken =
      line.startsWith(",") ||
      /^[A-Z]$/.test(tail) ||
      // Nastavak koji počinje samostalnim slovom je ostatak presečene reči („of" + „f time").
      /^[a-z]\s/.test(line) ||
      (tail.length <= 3 && /^[a-z]+$/.test(tail) && !UNIT_TOKEN.test(tail) && !SHORT_WORD.has(tail.toLowerCase()));
    out[out.length - 1] = broken ? previous + line : `${previous} ${line}`;
  }
  return out;
}

export function parseTds(pages, code) {
  const lines = mendLines(pages.flatMap((page) => page.split("\n").map((line) => line.trim()).filter(Boolean)));

  // Zaglavlje: naziv i revizija.
  let officialName = null;
  let revision = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^T?echnical Information$/.test(lines[index])) continue;
    if (lines[index + 1] !== code) continue;
    const nameParts = [];
    for (let cursor = index + 2; cursor < lines.length && !/^JSON created/.test(lines[cursor]); cursor += 1) nameParts.push(lines[cursor]);
    /*
     * Naziv u zaglavlju je prelomljen: „2" + „K Universal Clear" je JEDNA reč (2K), a
     * „3" + „Stage" + „Additive and Blending Clear" su TRI reči (3 Stage Additive…).
     * Razlikuje ih sledeći deo: usamljeno veliko slovo, cifra ili crtica su ostatak iste
     * reči („3" + „0- Topcoat" → „30- Topcoat"); cela reč se spaja razmakom.
     */
    officialName ??=
      nameParts
        .reduce((text, part) => (!text ? part : /^([A-Z](?![a-z])|[\d-])/.test(part) ? text + part : `${text} ${part}`), "")
        .replace(/\s+/g, " ")
        .trim() || null;
    const stamp = lines.slice(index, index + 14).find((line) => /^\d{2}\/\d{4}$/.test(line));
    revision ??= stamp ?? null;
  }

  // Sadržaj: sve posle „page N of M", bez pravnog podnožja.
  const content = [];
  let inContent = false;
  for (const line of lines) {
    if (/^page \d+ of \d+$/.test(line)) { inContent = true; continue; }
    if (/^Safety advice:$/.test(line)) { inContent = false; continue; }
    if (inContent && !isNoise(line)) content.push(line);
  }

  const facts = {};
  const mixing = [];
  const drying = [];
  for (let index = 0; index < content.length; index += 1) {
    const line = content[index];
    const next = content[index + 1] ?? "";
    for (const [key, pattern] of LABELS) {
      if (!pattern.test(line) || facts[key]) continue;
      // „Spray viscosity at 20°C" / „DIN 4:" / „18-20 s" — vrednost je tek iza dvotačke.
      const value = next.endsWith(":") ? `${next} ${content[index + 2] ?? ""}`.trim() : next;
      // Etiketa na kraju odeljka: sledeći red je naslov novog odeljka, ne vrednost.
      if (!/^(Drying|Application|Sanding|Mixing Ratio|Safety advice)$/i.test(value)) facts[key] = value;
    }
    if (/^\d[\d\s.,:+/-]*\s*%?\s*by (volume|weight)$/i.test(line) || /^\d+(\.\d+)?\s*%\s*by (volume|weight)$/i.test(line)) mixing.push({ share: line, codes: codesInRatio(next), label: next });
    if (/^(Drying at|Infrared|Air drying|Forced drying)/i.test(line) && /\b(min|h)\b/.test(next)) drying.push(`${line}: ${next}`);
  }
  // „Mixing Ratio" ume da stoji i nad tabelom udela; odnos je samo zapis oblika 2:1(+10 %).
  if (facts.mixingRatio && !/\d\s*:\s*\d/.test(facts.mixingRatio)) delete facts.mixingRatio;

  const text = lines.join(" ");
  /*
   * VOC se čita kao BLOK, ne po celom dokumentu.
   *
   * List ume da nosi dva bezbednosna bloka (81-30 kao tinted primerfiller i kao DTM), sa
   * različitom kategorijom i granicom. Traženje po celom tekstu je mešalo granicu jednog
   * bloka sa sadržajem drugog — zato se svaki blok čita zasebno, a uzima se prvi potpun.
   */
  const vocBlocks = text
    .split("2004/42/")
    .slice(1)
    .map((segment) => {
      const block = segment.slice(0, 400);
      const content = /VOC content of this product is ([\d.,]+)\s*g\/(?:l|litre)/.exec(block);
      if (!content) return null;
      const limit = /form is\s*max\.?\s*([\d.,]+)\s*g\/(?:l|litre)/.exec(block);
      const category = /product category:\s*(I{1,2}B\s?\.?\s?[a-z](?:\s?I{1,3})?)/i.exec(block);
      return {
        content: Number(content[1].replace(",", ".")),
        limit: limit ? Number(limit[1].replace(",", ".")) : null,
        category: category?.[1]?.replace(/\s+/g, "") ?? null,
      };
    })
    .filter(Boolean);
  const voc = vocBlocks[0] ?? null;

  /*
   * Uvod i osobine: redovi sadržaja pre prve etikete („Application").
   * List komponente (učvršćivač, razređivač, aditiv) nema nijednu etiketu — ceo sadržaj je
   * jedna zvanična rečenica o tome u kojim se proizvodima koristi, i ona je uvod.
   */
  const firstLabel = content.findIndex((line) => /^(Application|Drying|Sanding|Mixing Ratio)$/i.test(line));
  const introSource = firstLabel === -1 ? content : content.slice(0, firstLabel);
  const intro = introSource.filter((line) => line.length > 3 && !/^[.\d]/.test(line));

  return {
    code,
    officialName,
    revision,
    intro: [...new Set(intro)].slice(0, 8),
    mixing,
    drying: [...new Set(drying)],
    facts: Object.fromEntries(Object.entries(facts).filter(([, value]) => value)),
    // Podkategorija ume da bude pisana sa razmakom („IIB.c II") — normalizuje se bez razmaka.
    voc,
    vocBlocks: vocBlocks.length,
    relatedCodes: [...new Set(mixing.flatMap((entry) => entry.codes))].filter((entry) => entry !== code),
  };
}
