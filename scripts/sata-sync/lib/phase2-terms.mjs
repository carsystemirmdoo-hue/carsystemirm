/**
 * SATA faza 2 — srpske oznake atributa reda. Standardni tehnički prevodi fiksnih fraza; BROJEVI, navoji, mere i
 * oznake proizvođača (G 1/4", M 16 x 1.5, No. 10, RP, DIN 8541) prolaze doslovno. Ništa se ne dodaje što zvanični
 * naziv ne sadrži; `check-localization` to proverava (svaki broj iz oznake mora postojati u zvaničnom nazivu).
 */
const RULES = [
  [/\(\s*female\s*thread\s*\)/gi, "unutrašnji navoj"], [/\(\s*male\s*thread\s*\)/gi, "spoljašnji navoj"], [/^thread\s+/i, "navoj "],
  [/\((?:packing unit|pack of|packaging unit)\s*(\d+)\s*pieces?,\s*packed to (\d+) pieces each\)/gi, (_, p1, p2) => `pakovanje ${p1} kom. (po ${p2})`],
  [/\(?(?:packing unit|pack of|packaging unit)\s*(\d+)\s*(?:pieces?|pcs\.?)\)?/gi, (_, p1) => `pakovanje ${p1} kom.`], [/\(each (\d+) pieces\)/gi, (_, p1) => `po ${p1} kom.`],
  [/with quick coupling,? red and nipple/gi, "sa brzom spojkom (crvena) i niplom"], [/with quick coupling and nipple/gi, "sa brzom spojkom i niplom"],
  [/with covering fabric netting/gi, "sa zaštitnim tekstilnim omotačem"], [/\(material and air\)/gi, "materijal i vazduh"], [/\(material\)/gi, "materijal"], [/\(air\)/gi, "vazduh"],
  [/connections stainless steel/gi, "priključci od nerđajućeg čelika"], [/\(?(?:mat\.|material),? stainless steel\)?/gi, "materijal: nerđajući čelik"],
  [/with rotary (?:spray )?nozzle 360°/gi, "rotaciona mlaznica 360°"], [/,?\s*diagonally spraying forward and backward|\s*and spraying diagonal forward and backward/gi, ", koso prskanje napred i nazad"], [/\s*rotary fan and spraying forward/gi, ", rotacioni mlaz i prskanje napred"], [/\s*and spraying forward/gi, ", prskanje napred"],
  [/with nozzle set ([\d.]+ RP)/gi, (_, p1) => `set dizni ${p1}`], [/angular head nozzle/gi, "ugaona mlaznica"], [/diagonal spray nozzle/gi, "kosa mlaznica"], [/rotary nozzle/gi, "rotaciona mlaznica"], [/standard nozzle/gi, "standardna mlaznica"],
  [/\((\d+°)\),\s*swivelling/gi, (_, p1) => `${p1}, zakretna`], [/\((\d+°)\)/g, (_, p1) => `${p1}`],
  [/size (XXL|XL|S|M|L) (\(\d+\/\d+\))/g, (_, p1, p2) => `${p1} ${p2}`], [/100% polyester/gi, "100% poliester"],
  [/flow time tolerance (< [\d.]+) sec\.?/gi, (_, p1) => `tolerancija vremena isticanja ${p1} s`], [/\bNo\.\s*(\d+)/g, (_, p1) => `br. ${p1}`],
  [/on a roll of (\d+ m)|(\d+ m) (?:on rolls|per roll)/gi, (_, p1, p2) => `rolna ${p1 ?? p2}`], [/(?:net\s+)?price\s+(?:net\s+)?per\s+meter/gi, "prodaje se na metar"],
  [/Please observe: The supplied product has a limited use-by date!/gi, "ograničen rok upotrebe"], [/Important: Always order with (\d+) and (\d+)\s*!/gi, (_, p1, p2) => `poručuje se uz ${p1} i ${p2}`],
  [/prolonged by (\d+ cm)/gi, (_, p1) => `produženo za ${p1}`], [/in (\d+ mm) length/gi, (_, p1) => `${p1}`], [/(\d+ mm) work length/gi, (_, p1) => `radna dužina ${p1}`], [/^length\s+/i, ""], [/\s+long$/i, ""],
  [/\binside diameter\b|\bID\b/g, "unutrašnji prečnik"], [/\bblue\b/gi, "plavo"], [/\bred\b/gi, "crveno"], [/\bblack\b/gi, "crno"], [/\btransparent\b/gi, "providno"],
];
/** Reči koje posle prevoda NE smeju ostati u oznaci reda — znak da pravilo nedostaje. */
export const UNTRANSLATED_MARKERS = /\b(thread|pieces?|packing|with|nozzle|long|length|spraying|material|price|size|swivelling|roll)\b/i;

export function translateAttribute(value) {
  let text = String(value).replace(/(\d)\s*x\s*(\d)/g, (_, p1, p2) => `${p1} x ${p2}`);
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

/** Redosled osa u oznaci reda: od onoga po čemu kupac prvo bira. */
export const AXIS_ORDER = ["number", "nozzleType", "angle", "size", "bore", "colour", "length", "rollLength", "thread", "hoseEnds", "steel", "sprayPattern", "nozzleSet", "pack", "tolerance", "composition", "compatibility"];
export const AXIS_LABELS = { number: "Broj", nozzleType: "Tip mlaznice", angle: "Ugao", size: "Veličina", bore: "Prečnik", colour: "Boja", length: "Dužina", rollLength: "Rolna", thread: "Navoj / priključak", hoseEnds: "Završeci", steel: "Materijal", sprayPattern: "Prskanje", nozzleSet: "Set dizni", pack: "Pakovanje", tolerance: "Tolerancija", composition: "Sastav", compatibility: "Za" };
