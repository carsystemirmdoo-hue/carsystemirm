/**
 * SATA faza 2 — determinističko grupisanje samostalnog i vezanog pribora.
 *
 * Za ove artikle SATA ne daje NIKAKVO grupisanje (`parentId: null`, bez opcija konfiguratora, jedna kategorija
 * „Accessories”). Jedini dokaz je ZVANIČNI NAZIV, pa je pravilo gramatičko, ne semantičko:
 *
 *   nivo 1  posle uklanjanja PREPOZNATIH atributa ostatak naziva i klauzula „for …” moraju biti IDENTIČNI;
 *   nivo 2  isti ostatak, razlikuje se samo „for …” → kompatibilnost je osa. Pojedinačni artikal se pridružuje
 *           grupi istog ostatka; dve višečlane grupe se NIKAD ne spajaju.
 *
 * Nema sličnosti naziva ni pragova. Normalizuje se samo ZAPIS (`SOURCE_SPELLING`). Svaka višečlana grupa je
 * `LOCAL_CATALOG_GROUPING` — naša kataloška grupa, nikad zvanična SATA porodica. Zvanični naziv svakog artikla se čuva.
 */

/** Razlike u zapisu istog naziva u izvoru: razmaci oko jedinica, skraćenice, slovne greške. Ne menja značenje. */
export const SOURCE_SPELLING = [
  [/protecion/gi, "protection"], [/inside dia\./gi, "inside diameter"], [/\bswiveling\b/gi, "swivelling"], [/pressurised/gi, "pressurized"],
  [/RPS-Adapter/g, "RPS adapter"], [/guiding hose/g, "guide hose"], [/\)\s*(?=SATA FDG)/g, ") for "], [/\(female\)\s*for/g, "(female thread) for"],
  [/packing unit 2 pieces for/g, "packing unit 2 pieces) for"], [/with QCC, connection/g, "with QCC and connection"], [/RPS Adapter/g, "RPS adapter"],
  [/Shaking ring/g, "Shaker ring"], [/\bfolding\b/g, "foldable"], [/(\d)\s*x\s*(\d)/g, (_, a, b) => `${a} x ${b}`], [/(\d)(mm|cm|m)\b/g, (_, a, b) => `${a} ${b}`], [/Ø\s*/g, "Ø "],
  [/\s+,/g, ","], [/\bper metre\b/gi, "per meter"],
];

/** Redosled je deo pravila: opis prskanja pre tipa mlaznice, navoj sa `\b` da ne pojede „g” iz „coupling”. */
export const ATTRIBUTES = [
  ["notice", /\s*(?:Please observe|Important):.*$/gi],
  ["priceNote", /,?\s*(?:net\s+)?price\s+(?:net\s+)?per\s+meter/gi],
  ["pack", /\(\s*(?:packing unit|pack of|packaging unit)\s*\d+\s*(?:pieces?|pcs\.?)[^)]*\)|,\s*packaging unit \d+ pcs\.?|\(each \d+ pieces\)/gi],
  ["size", /,?\s*size (?:XXL|XL|S|M|L) \(\d+\/\d+\)/g],
  ["composition", /,\s*100% polyester/gi],
  ["sprayPattern", /,?\s*with rotary (?:spray )?nozzle 360°(?:[\s,]*(?:rotary fan|and|diagonally|diagonal|spraying|forward|backward))*/gi],
  ["nozzleSet", /with nozzle set \d\.\d RP/gi],
  ["nozzleType", /(?:standard|diagonal spray|rotary|angular head) nozzle/gi],
  ["steel", /,?\s*\(?(?:mat\.|material),? stainless steel\)?|connections stainless steel/gi],
  ["angle", /\(\d+°\)(?:,\s*swivelling)?/g],
  ["thread", /(?:\bG\s*)?\d+\/\d+"?\s*-?\s*(?:\d+\s*)?\((?:female|male)\s*thread\)|M\s*\d+\s*x\s*[\d.]+\s*\((?:female|male)\s*thread\)|\bthread \d+\/\d+"\s*-\s*\d+ UNC|\bG\s*\d\/\d"(?:-\d+)?(?:\s*\(\s*female thread\))?|\(female thread\)/gi],
  ["hoseEnds", /with quick coupling,? red and nipple|with quick coupling and nipple|with covering fabric netting|\((?:material and air|material|air)\)/gi],
  ["rollLength", /,?\s*(?:on a roll of \d+ m|\d+ m (?:on rolls|per roll))/gi],
  ["length", /,?\s*(?:length\s*)?\d+(?:[.,]\d+)?\s*(?:m|cm)\b(?:\s*long)?|,?\s*(?:in\s*)?\d{3,4}\s*mm(?:\s*(?:long|work length|length))?|prolonged by \d+ cm/gi],
  ["bore", /Ø\s*\d+(?:[.,]\d+)?\s*mm|\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*mm\b|(?<![\d.,])\d{1,2}(?:[.,]\d+)?\s*mm(?:\s*(?:ID|inside diameter))?\b/gi],
  ["tolerance", /,?\s*flow time tolerance < [\d.]+ sec\.?/gi],
  ["number", /\bNo\.\s*\d+\b/g],
  ["colour", /,?\s*\b(?:blue|red|black|transparent)\b/gi],
];

/** „for cavity…”, „for material connection” i sl. su deo naziva proizvoda, ne kompatibilnost. */
const COMPAT = /\s+for\s+(?!cavity|material connection|the use|application|spray guns$).*$/i;

export function parseOfficialName(name) {
  let text = name;
  for (const [pattern, replacement] of SOURCE_SPELLING) text = text.replace(pattern, replacement);
  const attrs = {};
  for (const [key, pattern] of ATTRIBUTES) {
    text = text.replace(pattern, (match) => { (attrs[key] ??= []).push(match.replace(/^[,\s]+|[,\s]+$/g, "")); return " "; });
  }
  // Atributi se vade PRE kompatibilnosti, da „for hose pair individual 10 m” zadrži dužinu kao osu.
  let compat = null;
  text = text.replace(COMPAT, (match) => { compat = match.replace(/^\s+for\s+/i, "").replace(/^e\.g\.\s*/i, "").replace(/[,\s]+$/g, "").trim(); return " "; });
  const stem = text.replace(/\bcpl\.?/gi, "cpl").replace(/\s+and\s*(?=$|[,;])|\s+and\s*$/gi, " ").replace(/[,;:\s]+/g, " ").replace(/\s+\(\s*\)/g, "").trim().toLowerCase();
  return { stem, attrs, compat };
}

/** Funkcionalna klasa — samo za taksonomiju i izveštaj; NE utiče na grupisanje. */
const CLASSES = [
  ["PROTECTIVE_CLOTHING", /\bsuit\b/i],
  ["AIR_CAP_QMR_PROTECTION", /air cap protector|\bQMR\b/i],
  ["PROBE_WAND_EXTENSION", /\bwand\b|^Extension with/i],
  ["RESPIRATOR_AIR_SUPPLY", /breathing|respirator|air warmer|air cooler|belt unit|plug-in nipples.*Vision|half mask/i],
  ["HOSE", /\bhose\b|protective sleeve/i],
  ["COUPLING_NIPPLE_ADAPTER", /coupling|nipple|ball tap|intermediate piece|adapter|mini filter/i],
  ["CLEANING_CARE", /clean|brush|needles|grease|care set|spray bottle|pump-spray|suction unit/i],
  ["GUN_HOLDER", /holder|holding tray|insertion drawer|insert for spray gun/i],
  ["TEST_MEASUREMENT", /viscosity cup|air check|air tester|\bcert\b|spray pattern|distance marker/i],
];
export const functionalClassOf = (name) => CLASSES.find(([, pattern]) => pattern.test(name))?.[0] ?? "OTHER";

/**
 * @param {{articleNumber:string,name:string,tiedFamily:string|null}[]} articles
 * @returns {{stem:string,tier:1|2|null,compatKey:string|null,axes:string[],duplicateRowLabels:boolean,rows:object[]}[]}
 */
export function groupPhase2(articles) {
  const parsed = articles.map((article) => ({ ...article, ...parseOfficialName(article.name), functionalClass: functionalClassOf(article.name) }));
  const keyOf = (row) => `${row.stem} ⟂ ${row.tiedFamily ?? row.compat?.toLowerCase() ?? "-"}`;
  const tier1 = new Map();
  for (const row of parsed) tier1.set(keyOf(row), [...(tier1.get(keyOf(row)) ?? []), row]);
  const byStem = new Map();
  for (const [key, rows] of tier1) { const stem = key.split(" ⟂ ")[0]; byStem.set(stem, [...(byStem.get(stem) ?? []), { compatKey: key.split(" ⟂ ")[1], rows }]); }

  const groups = [];
  for (const [stem, parts] of byStem) {
    const multi = parts.filter((part) => part.rows.length > 1);
    if (multi.length <= 1 && parts.length > 1) groups.push({ stem, tier: 2, compatKey: null, rows: parts.flatMap((part) => part.rows) });
    else for (const part of parts) groups.push({ stem, tier: part.rows.length > 1 ? 1 : null, compatKey: part.compatKey, rows: part.rows });
  }
  for (const group of groups) {
    group.rows.sort((a, b) => a.articleNumber.localeCompare(b.articleNumber, "en", { numeric: true }));
    const axes = [...new Set(group.rows.flatMap((row) => Object.keys(row.attrs)))].filter((axis) => new Set(group.rows.map((row) => JSON.stringify(row.attrs[axis] ?? null))).size > 1);
    if (new Set(group.rows.map((row) => (row.compat ?? "-").toLowerCase())).size > 1) axes.push("compatibility");
    group.axes = axes;
    const labels = group.rows.map((row) => JSON.stringify(axes.map((axis) => (axis === "compatibility" ? (row.compat ?? "-").toLowerCase() : row.attrs[axis]))));
    // Dva broja artikla sa istim nazivom i istim atributima: izvor ne kaže koji je noviji — oba ostaju kao redovi.
    group.duplicateRowLabels = labels.length !== new Set(labels).size;
  }
  return groups.sort((a, b) => a.stem.localeCompare(b.stem) || a.rows[0].articleNumber.localeCompare(b.rows[0].articleNumber, "en", { numeric: true }));
}
