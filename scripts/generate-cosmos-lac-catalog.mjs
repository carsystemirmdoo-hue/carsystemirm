#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(projectRoot, "tmp/cosmos-lac-assets/manifest.json");
const selectedRoot = path.join(projectRoot, "tmp/cosmos-lac-assets/selected-products");
const uncertainRoot = path.join(projectRoot, "tmp/cosmos-lac-assets/uncertain");
const colorChartPath = path.join(projectRoot, "data/cosmos-lac-color-chart.generated.json");
const outputDataPath = path.join(projectRoot, "data/cosmos-lac-products.generated.json");
const outputBlockedPath = path.join(projectRoot, "data/cosmos-lac-blocked.generated.json");
const outputSummaryPath = path.join(projectRoot, "data/cosmos-lac-summary.generated.json");
const publicRoot = path.join(projectRoot, "public/products/cosmos-lac");

sharp.concurrency(Math.max(2, Math.min(6, Number.parseInt(process.env.COSMOS_SHARP_THREADS ?? "2", 10))));

const blockedLines = new Map([
  ["Acrylic Paints", "Nema odgovarajućeg engleskog kataloškog ili TDS izvora za namenu proizvoda."],
  ["Plastic Paints", "Nema odgovarajućeg engleskog kataloškog ili TDS izvora za namenu proizvoda."],
  ["Sportpens", "Nema odgovarajućeg engleskog kataloškog ili TDS izvora za ovu liniju."],
  ["Wood Glue", "Nema odgovarajućeg engleskog kataloškog ili TDS izvora za potvrdu varijante."],
]);

const lineDefinitions = {
  RAL: {
    line: "RAL",
    volume: "400 ml / 500 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 12–17; Colourchart2023_LEAFLET-DIGITAL USE.pdf, str. 2",
  },
  "Fast Acrylic": {
    line: "Fast Acrylic",
    volume: "400 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 18–23; Fast-Acrylic-Color-Index-ENG-digital.pdf",
  },
  "Easy Max": {
    line: "Easy Max",
    volume: "400 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 24–31; Colourchart2023_LEAFLET-DIGITAL USE.pdf, str. 2",
  },
  "Chalk Effect": {
    line: "Chalk Effect",
    volume: "400 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 32–35; Colourchart2023_LEAFLET-DIGITAL USE.pdf, str. 2",
  },
  "Flame Blue": {
    line: "Flame Blue",
    volume: "400 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 36–41; FLAME_Colourchart2023_LEAFLET_DIGITAL USE.pdf, str. 2",
  },
  "Flame Orange": {
    line: "Flame Orange",
    volume: "400 ml",
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 36–41; FLAME_Colourchart2023_LEAFLET_DIGITAL USE.pdf, str. 2",
  },
  "Flame Booster": {
    line: "Flame Booster",
    volume: "500 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 40–41; ENG_TDS_FLAME_BOOSTER.pdf",
  },
  "Spray.Bike": {
    line: "Spray.Bike",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 42–45; engleski Spray.Bike TDS dokumenti",
  },
  "Molotow Premium": {
    line: "Molotow Premium",
    volume: "400 ml",
    sourceReference: "EN-TDS-Molotow-Premium-V01.pdf i EN-TDS-Molotow-Premium-Metallics-V02.pdf",
  },
  "Molotow Burner": {
    line: "Molotow Burner",
    volume: null,
    sourceReference: "Zvanični engleski Molotow Burner TDS dokumenti",
  },
  "Master Mechanic": {
    line: "Master Mechanic",
    volume: "500 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 50–51; engleski Master Mechanic TDS dokumenti",
  },
  "High Heat": {
    line: "High Heat 700°C",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 52–53; en-high-heat-V02.pdf",
  },
  Primers: {
    line: "Primers",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 54–55; engleski primer TDS dokumenti",
  },
  Varnishes: {
    line: "Varnishes",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 56–57; engleski varnish TDS dokumenti",
  },
  "W Wood Care": {
    line: "W Wood Care",
    volume: null,
    sourceReference: "ENG-TDS-W-VARNISH-V02.pdf i EN_TDS-W-CONTAINER.pdf",
  },
  Zinc: {
    line: "Zinc",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 58–59; engleski Zinc TDS dokumenti",
  },
  Automotive: {
    line: "Automotive",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 60–63; engleski Automotive TDS dokumenti",
  },
  "Wheel Rim": {
    line: "Wheel Rim",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 64–65; engleski Wheel Rim TDS dokumenti",
  },
  Sealer: {
    line: "Sealer",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 66–67; en-sealer-V03.pdf",
  },
  Home: {
    line: "Home",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 68–69; engleski Home TDS dokumenti",
  },
  Cleaners: {
    line: "Cleaners",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 70–72; engleski cleaner TDS dokumenti",
  },
  Effect: {
    line: "Effect",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 73; EN-TDS-EFFECT-V02.pdf",
  },
  "Fluo Marking": {
    line: "Fluorescent & Marking",
    volume: null,
    sourceReference:
      "CL-Catalogue-English-Digital.pdf, str. 74–75; engleski Fluorescent & Marking TDS dokumenti",
  },
  Lubricants: {
    line: "Lubricants",
    volume: "400 ml",
    sourceReference: "CL-Catalogue-English-Digital.pdf, str. 76–79; engleski lubricant TDS dokumenti",
  },
  Metallic: {
    line: "Metallic",
    volume: "400 ml",
    sourceReference: "ENG-TDS-Metallic-V02.pdf; Colourchart2023_LEAFLET-DIGITAL USE.pdf, str. 2",
  },
  Putties: {
    line: "Putties",
    volume: null,
    sourceReference: "Zvanični engleski TDS dokumenti za akrilne, poliesterske i fiberglass kitove",
  },
  "Wood Putties": {
    line: "Wood Putties",
    volume: null,
    sourceReference: "ENG_TDS-Wood-Putties-V02.pdf; Woodputties-colors-ENG-V02.pdf",
  },
};

const familyRules = [
  ["sticker-&-glue-remover", "Sticker & Glue Remover", "cleaner"],
  ["brake-cleaner", "Brake Cleaner", "cleaner"],
  ["carburetor-cleaner", "Carburetor Cleaner", "cleaner"],
  ["contact-cleaner", "Contact Cleaner", "cleaner"],
  ["textile-cleaner", "Textile Cleaner", "cleaner"],
  ["air-duster", "Air Duster", "cleaner"],
  ["paint-remover", "Paint Remover", "cleaner"],
  ["acrylic-primer-&-filler", "Acrylic Primer & Filler", "filler-primer"],
  ["special-metal-primer", "Special Metal Primer", "primer"],
  ["metal-primer", "Metal Primer", "primer"],
  ["plastic-primer", "Plastic Primer", "plastic-primer"],
  ["epoxy-primer", "Epoxy Primer", "primer"],
  ["wash-primer", "Wash Primer", "primer"],
  ["primer", "Primer", "primer"],
  ["filler", "Filler", "filler-primer"],
  ["antigravel", "Antigravel Paintable", "antichip"],
  ["antichip", "Antichip", "antichip"],
  ["bumper-paint", "Bumper Paint", "bumper-paint"],
  ["bumber-paint", "Bumper Paint", "bumper-paint"],
  ["brake-caliper-&-engine-paint", "Brake Caliper & Engine Paint", "brake-caliper-paint"],
  ["brake-caliper-paint", "Brake Caliper Paint", "brake-caliper-paint"],
  ["backlight", "Backlight Paint", "automotive-paint"],
  ["vinyl-&-fabric", "Vinyl & Fabric", "automotive-paint"],
  ["prefilled-spray", "Prefilled Spray", "automotive-paint"],
  ["prefilled-", "Prefilled Spray", "automotive-paint"],
  ["quick-start", "Quick Start", "automotive-maintenance"],
  ["control-guide", "Control Guide", "automotive-paint"],
  ["wheel-paint", "Wheel Paint", "wheel-rim"],
  ["wheel-rim", "Wheel Rim", "wheel-rim"],
  ["high-heat", "High Heat 700°C", "high-heat"],
  ["heat-resistant", "Heat Resistant Paint", "high-heat"],
  ["zinc", "Zinc", "zinc"],
  ["clear-coat", "Clear Coat", "clearcoat"],
  ["varnish", "Varnish", "varnish"],
  ["sealer", "Sealer", "sealer"],
  ["fluorescent", "Fluorescent Paint", "fluorescent"],
  ["forest-&-trail-marking", "Forest & Trail Marking", "marking"],
  ["road-&-construction-marking", "Road & Construction Marking", "marking"],
  ["metallic-effect", "Metallic Effect", "metallic"],
  ["chrome-effect", "Chrome Effect", "effect"],
  ["gold-effect", "Gold Effect", "effect"],
  ["lubric", "Lubricant", "lubricant"],
  ["grease", "Grease", "lubricant"],
  ["oil", "Oil", "lubricant"],
  ["multimax", "Multimax 1000", "lubricant"],
  ["anti-spatter", "Anti-Spatter", "lubricant"],
  ["leak-detector", "Leak Detector", "automotive-maintenance"],
  ["paint-for-aluminums", "Paint for Aluminiums", "home-paint"],
  ["porcelain-paint", "Porcelain Paint", "home-paint"],
  ["radiator-lacquer", "Radiator Lacquer", "home-paint"],
  ["white-smalto", "White Smalto", "home-paint"],
  ["power-glue", "Power Glue", "adhesive"],
  ["wood-putty", "Water-Based Wood Putty", "wood-care"],
  ["putty", "Putty", "putty"],
  ["fiberglass", "Fiberglass", "putty"],
  ["iron-filler", "Iron Filler", "putty"],
  ["marble-adhesive-filler", "Marble Adhesive Filler", "putty"],
  ["molotow", "Molotow", "art-and-graffiti"],
  ["spray-bike", "Spray.Bike", "bicycle-paint"],
  ["flame", "Flame", "art-and-graffiti"],
  ["chalk-effect", "Chalk Effect", "chalk-effect"],
  ["easy-max", "Easy Max", "acrylic-spray"],
  ["fast-acrylic", "Fast Acrylic", "acrylic-spray"],
  ["ral-", "RAL", "ral-spray"],
];

const technicalUseCases = {
  cleaner: "Čišćenje i priprema površine prema zvaničnom tehničkom listu.",
  "filler-primer": "Popunjavanje manjih nepravilnosti i priprema podloge pre bojenja.",
  primer: "Prajmer za prijanjanje i zaštitu odgovarajuće podloge pre završnog sloja.",
  "plastic-primer": "Priprema plastičnih površina pre nanošenja završne boje.",
  antichip: "Zaštita donjih delova karoserije od udaraca, vlage i soli.",
  "bumper-paint": "Obnova i bojenje tvrdih plastičnih automobilskih delova.",
  "brake-caliper-paint": "Bojenje kočionih čeljusti i odgovarajućih automobilskih delova.",
  "automotive-paint": "Aerosolna automobilska primena prema zvaničnom TDS-u.",
  "automotive-maintenance": "Servisna i radionička primena prema zvaničnom TDS-u.",
  "wheel-rim": "Bojenje i zaštita automobilskih felni.",
  "high-heat": "Bojenje metalnih površina izloženih temperaturama do 700°C.",
  zinc: "Antikorozivna zaštita metalnih površina.",
  clearcoat: "Providni završni sloj za zaštitu i ujednačavanje površine.",
  varnish: "Završna zaštita odgovarajuće površine prema zvaničnom TDS-u.",
  sealer: "Elastično zaptivanje i zaštita pukotina od vlage i korozije.",
  fluorescent: "Fluorescentno bojenje za visoku vidljivost.",
  marking: "Obeležavanje površina u skladu sa namenom konkretne varijante.",
  metallic: "Dekorativni metalik završni efekat.",
  effect: "Dekorativni završni efekat za odgovarajuće površine.",
  lubricant: "Podmazivanje i zaštita mehanizama prema zvaničnom TDS-u.",
  "home-paint": "Obnova kućnih i tehničkih površina prema nameni proizvoda.",
  adhesive: "Lepljenje odgovarajućih materijala prema zvaničnom TDS-u.",
  "wood-care": "Popravka, nijansiranje ili zaštita drvenih površina.",
  putty: "Popunjavanje i ravnanje odgovarajuće podloge pre završne obrade.",
  "art-and-graffiti": "Akrilno aerosolno bojenje za umetničke i dekorativne površine.",
  "bicycle-paint": "Bojenje i zaštita bicikala i njihovih komponenti.",
  "chalk-effect": "Dekorativni ultra-mat efekat za nameštaj i druge odgovarajuće površine.",
  "acrylic-spray": "Brzosušeće akrilno aerosolno bojenje za odgovarajuće površine.",
  "ral-spray": "Akrilno aerosolno bojenje u potvrđenoj RAL nijansi.",
};

const clNumberLines = new Set([
  "RAL",
  "Easy Max",
  "Chalk Effect",
  "High Heat",
  "Primers",
  "Varnishes",
  "W Wood Care",
  "Zinc",
  "Automotive",
  "Wheel Rim",
  "Sealer",
  "Home",
  "Cleaners",
  "Effect",
  "Fluo Marking",
  "Lubricants",
  "Metallic",
]);

const finishLabels = new Map([
  ["semigloss", "polusjaj"],
  ["semi-gloss", "polusjaj"],
  ["gloss", "sjaj"],
  ["matt", "mat"],
  ["matte", "mat"],
  ["satin", "saten"],
  ["transparent", "providna"],
]);

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[™®]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function titleCase(value) {
  const minor = new Set(["and", "for", "of", "with"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (/^(RAL|FB|FO|CL|MP|PTFE)$/i.test(word)) return word.toUpperCase();
      if (index > 0 && minor.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanedBase(filename) {
  return filename
    .replace(/\.png$/i, "")
    .replace(/[™®]/g, "")
    .replace(/-v\d+$/i, "")
    .replace(/[_]+/g, "-")
    .replace(/-+/g, "-");
}

function extractRalCode(base) {
  const match = base.match(/\bral-(\d{4})\b/i);
  return match ? match[1] : null;
}

function extractFinish(base, originalPath, lineName) {
  const combined = base.toLowerCase();
  for (const [token, label] of finishLabels) {
    if (combined.includes(token)) return label;
  }
  if (lineName === "Chalk Effect") return "mat";
  if (lineName === "RAL" && originalPath.includes("/RAL Gloss/")) return "sjaj";
  if (lineName === "Fast Acrylic" && originalPath.includes("/Fast Acrylic Gloss/")) return "sjaj";
  return null;
}

function extractExplicitVolume(base) {
  const match = base.match(/(?:^|-)(\d+(?:[.,]\d+)?)\s*(ml|kg|gr)(?:-|$)/i);
  if (!match) return null;
  return `${match[1].replace(",", ".")} ${match[2].toLowerCase()}`;
}

function numericTokens(base) {
  return [...base.matchAll(/(?:^|-)(\d{1,4})(?=-|$)/g)].map((match) => match[1]);
}

function extractCosmosCode(item, base, lineName, chartEntries, ralCode) {
  if (item.suspectedProductCode) return item.suspectedProductCode.toUpperCase().replace(/\s+/g, "-");
  if (lineName === "Molotow Burner") return null;
  if (lineName === "RAL" && ralCode) {
    const code = chartEntries[`RAL:${ralCode}`]?.cosmosCode;
    return code ? `CL-${code}` : null;
  }
  if (lineName === "RAL") {
    const metallic = base.match(/-r(\d{3})-/i);
    if (metallic) return `CL-${metallic[1]}`;
  }
  const flame = base.match(/\b(FB|FO|B)-(\d{3,4})\b/i);
  if (flame) return `${flame[1].toUpperCase()}-${flame[2]}`;
  const molotow = base.match(/^MP-(\d{3})-/i);
  if (molotow) return `MP-${molotow[1]}`;
  const masterMechanic = base.match(/^master-mechanic-.*?-(\d{2}s?)(?:-|$)/i);
  if (masterMechanic) return masterMechanic[1].toUpperCase();
  const chalk = base.match(/chalk-effect-(n\d{2})-/i);
  if (chalk) return `CL-${chalk[1].toUpperCase()}`;
  if (lineName === "Easy Max") {
    const tokens = numericTokens(base);
    const internal = tokens.findLast((token) => token.length === 3);
    return internal ? `CL-${internal}` : null;
  }
  if (lineName === "Fast Acrylic") {
    const metallic = base.match(/fast-acrylic-r(\d{3})-/i);
    return metallic ? `R${metallic[1]}` : null;
  }
  if (lineName === "Spray.Bike") {
    const tokens = numericTokens(base);
    return tokens.find((token) => token.length === 3) ?? null;
  }
  if (lineName === "Wood Putties") {
    const shade = base.match(/wood-putty-(\d{1,2})-/i);
    return shade ? shade[1] : null;
  }
  const tokens = numericTokens(base);
  const candidate = tokens.find((token) => token.length === 3 || token.length === 2);
  if (!candidate) return null;
  return clNumberLines.has(lineName) ? `CL-${candidate}` : candidate;
}

function identifyFamily(base, lineName) {
  if (lineName === "RAL") return { family: "RAL", technicalCategory: "ral-spray" };
  if (lineName === "Fast Acrylic") {
    return { family: "Fast Acrylic", technicalCategory: "acrylic-spray" };
  }
  if (lineName === "Chalk Effect") {
    return { family: "Chalk Effect", technicalCategory: "chalk-effect" };
  }
  if (["Flame Blue", "Flame Orange", "Flame Booster"].includes(lineName)) {
    return { family: lineName, technicalCategory: "art-and-graffiti" };
  }
  if (lineName === "Spray.Bike") {
    return { family: "Spray.Bike", technicalCategory: "bicycle-paint" };
  }
  if (["Molotow Premium", "Molotow Burner"].includes(lineName)) {
    return { family: lineName, technicalCategory: "art-and-graffiti" };
  }
  const lowered = base.toLowerCase();
  for (const [needle, family, category] of familyRules) {
    if (lowered.includes(needle)) return { family, technicalCategory: category };
  }
  const fallbackCategory =
    lineName === "Wood Putties" ? "wood-care" : lineName === "Putties" ? "putty" : "acrylic-spray";
  return { family: lineName, technicalCategory: fallbackCategory };
}

function extractColorName(item, base, lineName, cosmosCode, ralCode, family) {
  if (/^prefilled-/i.test(base)) return null;
  if (lineName === "Molotow Burner") {
    const burnerColor = base
      .replace(/^MB-\d+ml-/i, "")
      .replace(/^MB-/i, "")
      .replace(/^\d+-years-/i, "");
    return titleCase(burnerColor.replace(/-/g, " "));
  }
  if (item.suspectedColorName) {
    const suspectedColor = item.suspectedColorName
      .replace(/[-_]+/g, " ")
      .replace(/\bv\d+\b/gi, "")
      .replace(/\b(?:gloss|matt|matte|satin|semigloss)\b/gi, "")
      .trim();
    return suspectedColor ? titleCase(suspectedColor) : null;
  }
  let value = base;
  const prefixPatterns = [
    /^flame-(?:blue|orange|booster)-(?:fb|fo|b)-\d+-/i,
    /^chalk-effect-n\d{2}-/i,
    /^MP-\d{3}-/i,
    /^fast-acrylic-(?:ral-\d{4}|r\d{3})-/i,
    /^ral-\d{4}-/i,
  ];
  for (const pattern of prefixPatterns) value = value.replace(pattern, "");
  if (lineName === "Easy Max") {
    value = value.replace(/^easy-max-/, "").replace(/^ral-\d{4}-/, "");
    value = value.replace(/^.*?-\d{3}-/, "");
  }
  if (lineName === "Spray.Bike") {
    value = value.replace(/^spray-bike-/, "").replace(/^.*?-\d{3}-/, "");
    value = value.replace(/^cobweb-/, "");
  }
  if (lineName === "Molotow Burner") {
    value = value.replace(/^MB-\d+ml-/i, "").replace(/^MB-/i, "").replace(/^\d+-years-/i, "");
  }
  if (lineName === "W Wood Care") {
    value = value.replace(/^w-(?:water-based-varnish|wood-impregnating-varnish)-/i, "");
  }
  if (!["Easy Max", "Spray.Bike", "Molotow Burner"].includes(lineName)) {
    const familySlug = slugify(family);
    value = value.replace(new RegExp(`^${familySlug}-`, "i"), "");
    if (cosmosCode) {
      const sourceCode = cosmosCode.replace(/^CL-/, "");
      const escaped = sourceCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("-", "[- ]?");
      value = value.replace(new RegExp(`^.*?${escaped}-`, "i"), "");
    }
  }
  value = value
    .replace(/\b(?:gloss|matt|matte|satin|semigloss|transparent)\b/gi, "")
    .replace(/(?:^|-)\d+(?:[.,]\d+)?(?:ml|kg|gr)(?:-|$)/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!value || value.toLowerCase() === slugify(family)) return null;
  if (ralCode && value.toLowerCase() === `ral-${ralCode}`) return null;
  return titleCase(value.replace(/-/g, " "));
}

function primaryCategoryFor(technicalCategory) {
  if (["putty", "cleaner", "lubricant", "adhesive", "automotive-maintenance"].includes(technicalCategory)) {
    return "priprema";
  }
  if (["primer", "plastic-primer", "filler-primer", "antichip", "zinc", "sealer"].includes(technicalCategory)) {
    return "podloga";
  }
  if (["clearcoat", "varnish"].includes(technicalCategory)) return "lak";
  return "boja";
}

function programFor(lineName, primaryCategory) {
  if (["Putties", "Wood Putties"].includes(lineName)) return "priprema-povrsine";
  if (["Varnishes", "W Wood Care"].includes(lineName)) return "boje-i-lakovi";
  if (lineName === "Lubricants") return "potrosni-materijal";
  if (primaryCategory === "priprema" && lineName === "Putties") return "priprema-povrsine";
  return "aerosoli";
}

function variantCode(base, lineName, cosmosCode, ralCode, finish, volume) {
  return slugify([lineName, cosmosCode, ralCode ? `ral-${ralCode}` : "", finish, volume, base].filter(Boolean).join("-"));
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function sampleOfficialCapColor(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .resize(160, 160, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const opaque = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] > 230) opaque.push([x, y]);
    }
  }
  if (opaque.length === 0) return "#66717E";
  const xs = opaque.map(([x]) => x);
  const ys = opaque.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const region = {
    minX: minX + (maxX - minX) * 0.3,
    maxX: minX + (maxX - minX) * 0.7,
    minY: minY + (maxY - minY) * 0.04,
    maxY: minY + (maxY - minY) * 0.34,
  };
  const buckets = new Map();
  for (let y = Math.floor(region.minY); y <= Math.ceil(region.maxY); y += 1) {
    for (let x = Math.floor(region.minX); x <= Math.ceil(region.maxX); x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] <= 230) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 248 && minimum > 240) continue;
      const key = [red, green, blue].map((channel) => Math.round(channel / 16) * 16).join(",");
      const existing = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
      existing.count += 1;
      existing.red += red;
      existing.green += green;
      existing.blue += blue;
      buckets.set(key, existing);
    }
  }
  const winner = [...buckets.values()].sort((first, second) => second.count - first.count)[0];
  if (!winner) return "#66717E";
  const rgb = [winner.red, winner.green, winner.blue].map((total) => Math.round(total / winner.count));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function neutralColor(technicalCategory, colorName) {
  const value = `${technicalCategory} ${colorName ?? ""}`.toLowerCase();
  if (value.includes("transparent") || value.includes("clear") || value.includes("varnish")) return "#CBD2D7";
  if (value.includes("zinc") || value.includes("silver") || value.includes("metal")) return "#8A9299";
  if (value.includes("primer") || value.includes("filler") || value.includes("putty")) return "#858B90";
  if (value.includes("lubric")) return "#687984";
  if (value.includes("cleaner")) return "#71818A";
  return "#747D84";
}

const ralApproximation = new Map([
  ["3002", "#A2231D"],
  ["4006", "#903373"],
  ["4010", "#C02F7D"],
  ["5005", "#154889"],
  ["5015", "#2874B2"],
  ["6011", "#66825B"],
  ["7015", "#51565C"],
  ["7033", "#7D8471"],
  ["7040", "#9DA3A6"],
  ["8014", "#4A3526"],
  ["9010", "#F1EDE1"],
]);

const exactNameColors = new Map(
  Object.entries({
    "dirty lilac": "#A58AA8",
    "pure white": "#F1F0EA",
    "cloudy white": "#E2E2DD",
    charcoal: "#34383C",
    "dolphin grey": "#788288",
    "english manor": "#8A7563",
    "duck egg blue": "#A8C7C7",
    "scottish green": "#486B58",
    "moroccan turquoise": "#2C8C91",
    "budapest pink": "#C98294",
    bubblegum: "#E58CAA",
    vanilla: "#E6D4A8",
    "greek blue": "#356FA3",
    "royal blue": "#244E9B",
    "aegean blue": "#397F94",
    "tuscan sunset": "#CF764D",
    "indian green": "#607B55",
    "dark sangria": "#5A2535",
    "shadow grey": "#64696D",
    "coral blush": "#D78476",
    bloodstone: "#843B42",
    "khaki brown": "#74664D",
    latte: "#B49B7C",
    "versailles gold": "#B79A52",
    "cream linen": "#D8CDB1",
    "nordic olive": "#747A55",
    "velvet citrus": "#C39B39",
    "imperial violet": "#5F476F",
    "ashen lavender": "#9B91A5",
    "salmon di venezia": "#C8786D",
    "smoked fig": "#66505E",
    "british biscuit": "#B7A17D",
    "goldhawk road": "#C7A12F",
    "blackfriars": "#282B2D",
    whitechapel: "#E4E3DC",
    "chalk farm": "#D8D0BC",
    "primrose hill": "#D7B940",
    "sands end": "#C9B795",
    whetstone: "#777C7E",
    "royal oak": "#795C3D",
    "bethnal green": "#497458",
    limehouse: "#6E8D45",
    "parsons green": "#4E7655",
    greenwich: "#3F6D58",
    "coldharbour lane": "#466A82",
    bayswater: "#557C9D",
    battersea: "#6A718D",
    plumstead: "#73566F",
    "salmon lane": "#C97970",
    "strawberry hill": "#B8444F",
    redbridge: "#9E3233",
    "brick lane": "#9D4A3B",
    marylebone: "#B97583",
    "clay hill": "#9A775D",
    silvertown: "#A3A8AA",
    "gray’s inn": "#777C81",
    "grays inn": "#777C81",
    "chicago yellow": "#E4B62E",
    "milan celadon 1": "#8EB9A5",
    "milan celadon 2": "#6F9F8C",
    "coventry red": "#A33C38",
    "meise orange": "#D66B32",
    "milan blue": "#3D6D93",
    elderberry: "#654B67",
    moorland: "#59634A",
    storm: "#586572",
    "black cherry": "#542C38",
    peacock: "#216F76",
    "raven grey": "#4E555A",
    "carmine red": "#A2231D",
    "traffic purple": "#903373",
    "sky blue": "#2874B2",
    "slate grey": "#51565C",
    "sepia brown": "#4A3526",
    "zinc yellow": "#E1B82F",
    candy: "#D9658D",
    "taste riviera middle": "#437A91",
    cherry: "#98504B",
    "cherry light": "#B96D67",
  }),
);

const nameColorRules = [
  [/\b(?:outline|signal|tar|deep|thick)\s+black\b/, "#181A1C"],
  [/\bblack\b/, "#242628"],
  [/\b(?:anthracite|charcoal)\b/, "#3D4246"],
  [/\b(?:nature|signal|pure)\s+white\b/, "#F0EFE9"],
  [/\bwhite\b/, "#E5E4DE"],
  [/\b(?:chrome|aluminium|aluminum|bright silver|deluxe silver|pewter silver|silver)\b/, "#A8ADB0"],
  [/\b(?:zinc)\b/, "#969FA3"],
  [/\b(?:bright gold|gold dollar|gold)\b/, "#B38A32"],
  [/\b(?:brass)\b/, "#AA843D"],
  [/\b(?:copper)\b/, "#A9603B"],
  [/\b(?:bronze)\b/, "#80613F"],
  [/\b(?:light|pebble|silver)\s+grey\b/, "#A9ACAA"],
  [/\b(?:blue grey|grey blue)\b/, "#62717C"],
  [/\b(?:cement|stone|slate)\s+grey\b/, "#73787A"],
  [/\b(?:iron|middle|traffic)\s+grey\b/, "#676B6D"],
  [/\b(?:dark|raven)\s+grey\b/, "#4D5255"],
  [/\bgrey\b|\bgray\b|\bgranite\b|\bmarble\b/, "#7D8285"],
  [/\b(?:burgundy|sangria|black cherry)\b/, "#642C3B"],
  [/\b(?:ruby|carmine|traffic|signal|fire|tornado|flame)\s+red\b/, "#B52F2B"],
  [/\b(?:brick|oxide|brown)\s+red\b/, "#934A3B"],
  [/\b(?:red|crazy cherry)\b/, "#B9413B"],
  [/\b(?:salmon|coral)\b/, "#CF756B"],
  [/\b(?:bubblegum|piglet|pastel|light)\s+pink\b/, "#DC8EA7"],
  [/\b(?:fuchsia|telemagenta|magenta|pink)\b/, "#C33D7B"],
  [/\b(?:blackberry|currant|elderberry|fig)\b/, "#60405B"],
  [/\b(?:aubergine|deep violet|viola dark)\b/, "#50345F"],
  [/\b(?:traffic purple|purple|violet|viola|grape|crocus)\b/, "#75508E"],
  [/\b(?:lilac|lavender|erica)\b/, "#A487B0"],
  [/\b(?:neon|fluo|fluorescent)\s+orange\b/, "#FF641F"],
  [/\b(?:signal|dare|red|light|pastel)?\s*orange\b/, "#D96D2F"],
  [/\b(?:terracotta|terraccota|rust)\b/, "#A65E43"],
  [/\b(?:neon|fluo|fluorescent)\s+yellow\b/, "#D9F128"],
  [/\b(?:zinc|cadmium|signal|melon|daffodil|jasmine|golden|traffic|light)\s+yellow\b/, "#E1B82F"],
  [/\b(?:yellow|curry|saffron|mustard|citrus)\b/, "#CDAA36"],
  [/\b(?:neon|fluo|fluorescent)\s+green\b/, "#64D83D"],
  [/\b(?:emerald|scottish|indian|forest|fir|leaf|moss|mr)\s+green\b/, "#3F784E"],
  [/\b(?:reseda|sage|olive|khaki|camo|moorland)\b/, "#697251"],
  [/\b(?:lime|kiwi|pear|pistachio|juice|grass|primavera)\b/, "#79A44B"],
  [/\b(?:celadon|mint|menthol)\b/, "#7FB9A5"],
  [/\bgreen\b/, "#4D8252"],
  [/\b(?:turquoise|aqua|lagoon|verdigris|peacock)\b/, "#2C9292"],
  [/\b(?:prussian|navy|sapphire|dark blue)\b/, "#24466E"],
  [/\b(?:royal|cobalt|gentian|ultramarine|signal|traffic|true)\s+blue\b/, "#2B5791"],
  [/\b(?:sky|azure|light|cream|cosmos|denim|shock|tulip|rivier|ocean|milan)\w*\s+blue\b/, "#3C78A5"],
  [/\bblue\b/, "#3F6F98"],
  [/\b(?:mahogany|rosewood)\b/, "#6E4032"],
  [/\b(?:walnut|nut|chocolate|cocoa|dark brown|sepia)\b/, "#654A36"],
  [/\b(?:oak|teak|chestnut|beech|maple|pine)\b/, "#9B7449"],
  [/\b(?:sahara|sand|beige|biscuit|cookie dough|macadamia|latte|milk coffee)\b/, "#B59D78"],
  [/\b(?:cream|ivory|vanilla|linen|natural)\b/, "#D8CAA6"],
  [/\b(?:clay)\b/, "#A7775D"],
];

function normalizedColorLabel(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deriveColorFromLabel(value) {
  const label = normalizedColorLabel(value);
  if (!label || /\b(?:transparent|clear coat|clearcoat|varnish|finish|top wax)\b/.test(label)) {
    return null;
  }
  const exact = exactNameColors.get(label);
  if (exact) return exact;
  for (const [pattern, hex] of nameColorRules) {
    if (pattern.test(label)) return hex;
  }
  return null;
}

function deriveColorFromName(colorName, family) {
  const normalizedName = normalizedColorLabel(colorName ?? "");
  if (/\b(?:transparent|clear coat|clearcoat|varnish|finish|top wax)\b/.test(normalizedName)) {
    return null;
  }
  return deriveColorFromLabel(normalizedName) ?? deriveColorFromLabel(family ?? "");
}

function colorDistance(firstHex, secondHex) {
  return Math.sqrt(
    [1, 3, 5].reduce((sum, index) => {
      const delta =
        Number.parseInt(firstHex.slice(index, index + 2), 16) -
        Number.parseInt(secondHex.slice(index, index + 2), 16);
      return sum + delta ** 2;
    }, 0),
  );
}

function chartKeyFor(lineName, cosmosCode, ralCode) {
  if (["Flame Blue", "Flame Orange"].includes(lineName) && cosmosCode) {
    const [prefix, code] = cosmosCode.split("-");
    return `${prefix}:${code}`;
  }
  if (ralCode) return `RAL:${ralCode}`;
  if (
    cosmosCode &&
    [
      "Easy Max",
      "Chalk Effect",
      "High Heat",
      "Metallic",
      "Effect",
      "Automotive",
      "Wheel Rim",
      "Fluo Marking",
      "Primers",
      "Sealer",
      "Home",
      "Zinc",
    ].includes(lineName)
  ) {
    return `CL:${cosmosCode.replace(/^CL-/, "")}`;
  }
  return null;
}

function colorMapping({
  capHex,
  chartEntries,
  colorName,
  cosmosCode,
  family,
  lineName,
  ralCode,
  technicalCategory,
}) {
  const key = chartKeyFor(lineName, cosmosCode, ralCode);
  const chart = key ? chartEntries[key] : null;
  if (ralCode && ralApproximation.has(ralCode)) {
    return {
      backgroundColor: ralApproximation.get(ralCode),
      colorSource: "ral",
      confidence: "verified",
      sourceReference: `Potvrđen RAL ${ralCode}; fiksna interna sRGB aproksimacija.`,
    };
  }
  if (ralCode && chart) {
    return {
      backgroundColor: chart.hex,
      colorSource: "ral",
      confidence: "verified",
      sourceReference: chart.source,
    };
  }
  if (chart) {
    return {
      backgroundColor: chart.hex,
      colorSource: "official-chart",
      confidence: "verified",
      sourceReference: chart.source,
    };
  }

  const nameDerived = deriveColorFromName(colorName, family);
  if (nameDerived && colorDistance(nameDerived, capHex) <= 46) {
    return {
      backgroundColor: capHex,
      colorSource: "cap-sample",
      confidence: "derived",
      sourceReference:
        "Fiksan uzorak jasno obojenog dela zvaničnog PNG-a, prihvaćen samo uz slaganje sa nazivom nijanse.",
    };
  }
  if (nameDerived) {
    return {
      backgroundColor: nameDerived,
      colorSource: "name-derived",
      confidence: "derived",
      sourceReference: "Fiksna sRGB procena izvedena iz potvrđenog naziva nijanse.",
    };
  }
  return {
    backgroundColor: neutralColor(technicalCategory, colorName),
    colorSource: "manual-estimate",
    confidence: "provisional",
    sourceReference: "Fiksna ručna/provizorna procena prema potvrđenoj vrsti proizvoda.",
  };
}

function displayName(lineName, family, cosmosCode, ralCode, colorName, finish, volume) {
  const lineIncludesFamily = lineName.toLowerCase().includes(family.toLowerCase());
  const parts = [
    "Cosmos Lac",
    family === lineName || lineIncludesFamily ? lineName : `${lineName} ${family}`,
  ];
  const displayCode = cosmosCode?.replace(/^CL-/, "CL ");
  if (displayCode && !parts.join(" ").includes(displayCode)) parts.push(displayCode);
  if (ralCode && !parts.join(" ").includes(`RAL ${ralCode}`)) parts.push(`RAL ${ralCode}`);
  if (colorName && !parts.join(" ").toLowerCase().includes(colorName.toLowerCase())) parts.push(colorName);
  if (!cosmosCode && volume) parts.push(volume);
  if (finish) parts.push(`— ${finish}`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function shortDescription(lineName, technicalCategory, colorName, ralCode, cosmosCode) {
  const identity = [colorName, ralCode ? `RAL ${ralCode}` : "", cosmosCode ? `šifra ${cosmosCode}` : ""]
    .filter(Boolean)
    .join(", ");
  return `${lineName} proizvod iz zvaničnog Cosmos Lac programa${identity ? ` — ${identity}` : ""}.`;
}

function treatmentFor(technicalCategory, finish) {
  if (["clearcoat", "varnish"].includes(technicalCategory)) return "clearcoat";
  if (["putty", "primer", "filler-primer", "chalk-effect"].includes(technicalCategory) || finish === "mat") {
    return "matte";
  }
  return "paint";
}

async function hashFile(filePath) {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function countFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) count += await countFiles(path.join(root, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function ensureOptimizedImage(sourcePath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .webp({ quality: 92, alphaQuality: 100, effort: 4, smartSubsample: true })
    .toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== 800 || metadata.height !== 800 || !metadata.hasAlpha) {
    throw new Error(`Invalid optimized image: ${outputPath}`);
  }
}

async function forEachConcurrent(items, concurrency, worker) {
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

async function main() {
  const [manifest, colorChart] = await Promise.all([
    fs.readFile(manifestPath, "utf8").then(JSON.parse),
    fs.readFile(colorChartPath, "utf8").then(JSON.parse),
  ]);
  const chartEntries = colorChart.entries;
  const selected = manifest.filter((item) => item.classification === "product-images");
  const blocked = [];
  const records = [];
  const seenSlugs = new Set();
  const seenIds = new Set();

  await fs.rm(publicRoot, { recursive: true, force: true });

  await forEachConcurrent(selected, 6, async (item) => {
    const lineKey = item.suspectedProductName;
    if (blockedLines.has(lineKey)) {
      blocked.push({
        sourceAsset: item.extractedPath,
        sourceSha256: item.sha256,
        suspectedLine: lineKey,
        reason: blockedLines.get(lineKey),
      });
      return;
    }
    const definition = lineDefinitions[lineKey];
    if (!definition) {
      throw new Error(`Missing verified line definition for ${lineKey}: ${item.originalPath}`);
    }
    const lineName = definition.line;
    const base = cleanedBase(item.originalFilename);
    const ralCode = extractRalCode(base);
    const { family, technicalCategory } = identifyFamily(base, lineName);
    const finish = extractFinish(base, item.originalPath, lineKey);
    const cosmosCode = extractCosmosCode(item, base, lineKey, chartEntries, ralCode);
    const explicitVolume = extractExplicitVolume(base);
    let volume = explicitVolume ?? definition.volume;
    if (/quick-start/i.test(base)) volume = "200 ml";
    const colorName = extractColorName(item, base, lineKey, cosmosCode, ralCode, family);
    const primaryCategory = primaryCategoryFor(technicalCategory);
    const programSlug = programFor(lineKey, primaryCategory);
    const lineSlug = slugify(lineName);
    const stableVariant = variantCode(base, lineName, cosmosCode, ralCode, finish, volume);
    const slug = `cosmos-lac-${stableVariant}`;
    const id = `cl-${stableVariant}`;
    if (seenSlugs.has(slug)) throw new Error(`Duplicate generated slug: ${slug}`);
    if (seenIds.has(id)) throw new Error(`Duplicate generated id: ${id}`);
    seenSlugs.add(slug);
    seenIds.add(id);

    const sourcePath = path.join(projectRoot, item.extractedPath);
    if (!sourcePath.startsWith(selectedRoot)) throw new Error(`Source is outside selected-products: ${sourcePath}`);
    const publicFilename = `${slug}.webp`;
    const publicRelative = path.posix.join("/products/cosmos-lac", lineSlug, publicFilename);
    const publicPath = path.join(projectRoot, "public", publicRelative);
    await ensureOptimizedImage(sourcePath, publicPath);

    const capHex = await sampleOfficialCapColor(sourcePath);
    const mappedColor = colorMapping({
      capHex,
      chartEntries,
      colorName,
      cosmosCode,
      family,
      lineName: lineKey,
      ralCode,
      technicalCategory,
    });
    const backgroundColor = mappedColor.backgroundColor.toUpperCase();
    const officialName = displayName(lineName, family, cosmosCode, ralCode, colorName, finish, volume);
    const outputStat = await fs.stat(publicPath);
    const baseProductSlug = `cosmos-lac-${slugify(`${lineName}-${family}`)}`;
    const sourceReference = `${definition.sourceReference}; ${mappedColor.sourceReference}`;
    const seoIdentity = [cosmosCode, ralCode ? `RAL ${ralCode}` : "", colorName, finish].filter(Boolean).join(" ");

    records.push({
      id,
      slug,
      baseProductSlug,
      variantId: stableVariant,
      brand: "Cosmos Lac",
      brandSlug: "cosmos-lac",
      line: lineName,
      officialName,
      displayNameSr: officialName,
      cosmosCode,
      ralCode,
      colorName,
      finish,
      volume,
      programSlug,
      primaryCategory,
      technicalCategory,
      useCase: technicalUseCases[technicalCategory] ?? null,
      image: publicRelative,
      imageAlt: `${officialName}, zvanična Cosmos Lac ambalaža`,
      visualMode: "color-on-hover",
      backgroundColor,
      foregroundTone: relativeLuminance(backgroundColor) > 0.48 ? "dark" : "light",
      colorSource: mappedColor.colorSource,
      colorConfidence: mappedColor.confidence,
      verificationStatus: "verified-official-source",
      sourceReference,
      sourceAsset: item.extractedPath,
      sourceOriginalPath: item.originalPath,
      sourceSha256: item.sha256,
      productionSha256: await hashFile(publicPath),
      originalBytes: item.fileSizeBytes,
      productionBytes: outputStat.size,
      visualTreatment: treatmentFor(technicalCategory, finish),
      shortDescription: shortDescription(lineName, technicalCategory, colorName, ralCode, cosmosCode),
      seoTitle: `${officialName} | Carsystem i R-M`,
      seoDescription: `${lineName}${seoIdentity ? ` ${seoIdentity}` : ""} u Cosmos Lac katalogu. Proverite namenu i pošaljite upit Carsystem i R-M timu.`,
    });
  });

  records.sort((first, second) =>
    [first.line, first.cosmosCode ?? "", first.ralCode ?? "", first.colorName ?? "", first.slug]
      .join("|")
      .localeCompare(
        [second.line, second.cosmosCode ?? "", second.ralCode ?? "", second.colorName ?? "", second.slug].join("|"),
        "en",
        { numeric: true },
      ),
  );
  blocked.sort((first, second) => first.sourceAsset.localeCompare(second.sourceAsset));

  const productionHashGroups = new Map();
  for (const record of records) {
    const group = productionHashGroups.get(record.productionSha256) ?? [];
    group.push(record);
    productionHashGroups.set(record.productionSha256, group);
  }
  const pixelIdenticalGroups = [...productionHashGroups.values()]
    .filter((group) => group.length > 1)
    .sort((first, second) => first[0].productionSha256.localeCompare(second[0].productionSha256));
  pixelIdenticalGroups.forEach((group, index) => {
    const groupId = `pixel-identical-${String(index + 1).padStart(3, "0")}`;
    for (const record of group) {
      record.duplicateImageGroup = groupId;
      record.duplicateImageResolution =
        "Zasebni zvanični PNG izvori postaju piksel-identični kada se uklone PNG metapodaci; identitet obe varijante potvrđen je katalogom ili color chart dokumentom.";
    }
  });

  const lineCounts = Object.fromEntries(
    [...new Set(records.map((record) => record.line))]
      .sort()
      .map((line) => [line, records.filter((record) => record.line === line).length]),
  );
  const categoryCounts = Object.fromEntries(
    ["priprema", "podloga", "boja", "lak", "poliranje"].map((category) => [
      category,
      records.filter((record) => record.primaryCategory === category).length,
    ]),
  );
  const colorSourceCounts = Object.fromEntries(
    ["official-chart", "ral", "cap-sample", "name-derived", "manual-estimate"].map((source) => [
      source,
      records.filter((record) => record.colorSource === source).length,
    ]),
  );
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    publishedEntries: records.length,
    variants: records.length,
    baseProductGroups: new Set(records.map((record) => record.baseProductSlug)).size,
    sourceImagesUsed: records.length,
    optimizedImages: records.length,
    pixelIdenticalImageGroups: pixelIdenticalGroups.length,
    pixelIdenticalPublishedImages: pixelIdenticalGroups.reduce(
      (sum, group) => sum + group.length,
      0,
    ),
    blockedSelectedImages: blocked.length,
    excludedUncertainImages: await countFiles(uncertainRoot),
    lineCounts,
    categoryCounts,
    colorSourceCounts,
    originalBytes: records.reduce((sum, record) => sum + record.originalBytes, 0),
    productionBytes: records.reduce((sum, record) => sum + record.productionBytes, 0),
  };

  await Promise.all([
    fs.writeFile(outputDataPath, `${JSON.stringify(records, null, 2)}\n`),
    fs.writeFile(outputBlockedPath, `${JSON.stringify(blocked, null, 2)}\n`),
    fs.writeFile(outputSummaryPath, `${JSON.stringify(summary, null, 2)}\n`),
  ]);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
