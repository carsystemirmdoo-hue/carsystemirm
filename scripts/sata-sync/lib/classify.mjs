/**
 * Uloga SATA porodice i samostalnog artikla.
 *
 * Porodica uzima ulogu iz ZVANIČNE kategorije u kojoj je SATA listira — to je činjenica izvora.
 * Samostalan artikal (bez Shopware parenta) nema kategoriju na stranici, pa se uloga čita iz
 * naziva. To je pomoćna podela za brojanje u reviziji: ne određuje identitet, ne pravi karticu, i
 * sve što pravila ne prepoznaju ostaje `UNCLASSIFIED`.
 */

export const FAMILY_SCOPE = {
  "spray-guns/gravity-flow-cup-spray-guns": "COMPLETE_DEVICE",
  "spray-guns/pressure-fed-spray-guns": "COMPLETE_DEVICE",
  "spray-guns/suction-cup-spray-guns": "COMPLETE_DEVICE",
  "spray-guns/airbrush-guns": "COMPLETE_DEVICE",
  // Automatski/robotski/laboratorijski pištolji su industrijski program, ne auto-reparatura.
  "spray-guns/automatic-paint-spray-guns": "COMPLETE_DEVICE_INDUSTRIAL",
  "spray-guns/accessories-for-spray-guns": "ACCESSORY",
  "cup-systems/rps-cups": "CONSUMABLE",
  "cup-systems/lcs-cups": "CONSUMABLE",
  "cup-systems/gravity-flow-cups": "ACCESSORY",
  "cup-systems/suspended-cups": "ACCESSORY",
  "filter-technology": "COMPLETE_DEVICE",
  "respiratory-protection/full-face-respirator": "COMPLETE_DEVICE",
  "respiratory-protection/half-mask-respirator": "COMPLETE_DEVICE",
  "all-products/additional-products": "COMPLETE_DEVICE",
  "all-products/accessories": "ACCESSORY",
  "all-products/spare-parts": "SPARE_PART",
  "all-products/merchandising-items": "MERCHANDISE",
};

const RULES = [
  // „cap” namerno nije ovde: „Air cap” i „Test air cap” su delovi pištolja, ne kačketi.
  ["MERCHANDISE", /\b(t-?shirt|hoodie|polo shirt|beanie|jersey|gym bag|makeup bag|compartment bag|backpack|key ring|poster|sticker|calendar|coffee cup|jumbo cup|porcelain|lanyard|umbrella|towel)\b/i],
  ["CONSUMABLE", /\b(rps\b.*\bcups?\b|multi-purpose cups?|lcs\b|liners?|hard cups?|sieves?|filter cartridge|fine filter cartridge|sinter(ed)? filter|activated charcoal|prefilters?|pre-filters?|filter mat|visor foil|tear-off|paint strainer|cleaning (fluid|agent)|gun oil|grease|lubricant|test (paper|sheets?)|blotting|comfort (head)?band|hygiene|sweat ?band|replacement filter|filter insert|cartridge)\b/i],
  ["SPARE_PART", /\b(nozzle set|paint nozzle|fluid tip|air cap|paint needle|needle\b|repair kit|sealing (kit|ring)|seal\b|gasket|o-ring|spring|screw|nut\b|trigger|control knob|knob|air piston|piston|spindle|air distribution|locking|sleeve|bolt|washer|disc\b|valve|packing|spare|replacement|circlip|pin\b|bushing|housing|cover\b|lid\b|membrane|diaphragm|cable|battery|display|digital unit|body\b|casing|plug\b|stopper|clip\b|ring\b|cc-?clip|colou?r code)\b/i],
  ["ACCESSORY", /\b(adam|hoses?|coupling|nipple|quick coupling|adapter|adaptor|gun holder|holder|stand\b|tripod|case\b|tool kit|tool case|cleaning (kit|set|brush|needles?)|brush|wand|extension|pressure gauge|manometer|micrometer|air cooler|air warmer|air humidifier|humidifier|belt unit|belt\b|carrying|wall (mount|bracket)|bracket|mounting|agitator|pressure tank|material (tube|hose)|test air cap|swivel|joint|regulator|charger|lamp|light|connection)\b/i],
];

/**
 * Porodica kojoj zvanična kategorija ne govori ulogu. SATA „edition” pištolje listira SAMO na
 * stranici LCS čaša (isporučuju se sa LCS-om), a jedan komplet mlaznica stoji među automatskim
 * pištoljima — uloga se tada čita iz osa i zvaničnog naziva, nikad iz pretpostavke.
 */
export function familyScope(family) {
  if (/^(Düsensatz|Nozzle set)\b/i.test(family.officialName ?? "")) return "SPARE_PART";
  const category = family.primaryCategory ?? "";
  const axes = Object.keys(family.axes ?? {});
  if (category.startsWith("cup-systems/") && axes.includes("Nozzle Technology")) return "COMPLETE_DEVICE";
  return FAMILY_SCOPE[category] ?? "UNCERTAIN";
}

export function classifyStandalone(name) {
  const text = String(name ?? "");
  // „… for SATAjet X” je skoro uvek deo ili pribor, nikad ceo uređaj; prvo potrošni i delovi.
  for (const [role, pattern] of RULES) if (pattern.test(text)) return role;
  // Ceo uređaj samo kada naziv POČINJE proizvodom i ne kaže čemu pripada („for …”, „f. …”).
  const belongsTo = /\b(for|f\.)\s/i.test(text);
  if (!belongsTo && /^(SATA ?(suit|air check|air tester|dosenboy|RPS depot|viscosity cup|mini filter)|SATAclean)\b/i.test(text)) return "COMPLETE_DEVICE";
  // „… for SATA vision 2000” — deo ili pribor nekog uređaja; pravila iznad nisu znala koji od ta dva.
  if (belongsTo) return "PART_OR_ACCESSORY";
  return "UNCLASSIFIED";
}
