import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function readAttribute(attributes, name) {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? null;
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function localName(name) {
  return name.split(":").at(-1)?.toLowerCase() ?? name.toLowerCase();
}

function topLevelGroups(source) {
  const groups = [];
  const stack = [];
  const tags = source.matchAll(
    /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g,
  );

  for (const match of tags) {
    const [, closing, rawName, attributes, selfClosing] = match;
    const name = localName(rawName);

    if (closing) {
      const expected = stack.lastIndexOf(name);
      if (expected >= 0) {
        stack.length = expected;
      }
      continue;
    }

    if (name === "g" && stack.at(-1) === "svg") {
      groups.push({
        id: readAttribute(attributes, "id"),
        label:
          readAttribute(attributes, "data-part") ??
          readAttribute(attributes, "inkscape:label") ??
          readAttribute(attributes, "class"),
      });
    }

    if (!selfClosing && !["path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "use", "image", "stop"].includes(name)) {
      stack.push(name);
    }
  }

  return groups;
}

function groupInventory(source) {
  return [...source.matchAll(/<g\b([^>]*)>/gi)].map((match) => ({
    id: readAttribute(match[1], "id"),
    dataPart: readAttribute(match[1], "data-part"),
    className: readAttribute(match[1], "class"),
    label: readAttribute(match[1], "inkscape:label"),
  }));
}

function duplicateIds(source) {
  const ids = new Map();
  for (const match of source.matchAll(/\sid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    const id = match[1] ?? match[2];
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }

  return [...ids.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
}

function hrefAudit(source) {
  const hrefs = [];
  for (const match of source.matchAll(
    /\s(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    hrefs.push(match[1] ?? match[2]);
  }

  return {
    total: hrefs.length,
    internal: hrefs.filter((href) => href.startsWith("#")).length,
    data: hrefs.filter((href) => href.startsWith("data:")).length,
    external: hrefs.filter(
      (href) => !href.startsWith("#") && !href.startsWith("data:"),
    ),
  };
}

function pathComplexity(source) {
  let pathCount = 0;
  let totalCommands = 0;
  let totalNumbers = 0;
  let pathDataBytes = 0;
  let maxCommands = 0;
  let maxNumbers = 0;

  for (const match of source.matchAll(/<path\b([^>]*)>/gi)) {
    pathCount += 1;
    const data = readAttribute(match[1], "d") ?? "";
    const commands = countMatches(data, /[AaCcHhLlMmQqSsTtVvZz]/g);
    const numbers = countMatches(
      data,
      /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g,
    );
    totalCommands += commands;
    totalNumbers += numbers;
    pathDataBytes += Buffer.byteLength(data);
    maxCommands = Math.max(maxCommands, commands);
    maxNumbers = Math.max(maxNumbers, numbers);
  }

  return {
    pathCount,
    totalCommands,
    approximateAnchorPairs: Math.round(totalNumbers / 2),
    pathDataBytes,
    maxCommandsPerPath: maxCommands,
    maxCoordinateNumbersPerPath: maxNumbers,
  };
}

function classifyFamily(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("six-pass") || lower.includes("reference-sheet")) {
    return "full composition / reference sheet";
  }
  if (lower.includes("jedna linija")) return "isolated broad spray-brush pass";
  if (lower.includes("broad")) return "broad brush";
  if (lower.includes("dry-brush")) return "dry brush";
  if (lower.includes("curved")) return "curved sweep";
  if (lower.includes("bristle")) return "bristle overlay";
  if (lower.includes("spray-drag")) return "spray drag";
  if (lower.includes("spray-burst")) return "spray burst";
  if (lower.includes("splatter")) return "splatter";
  if (lower.includes("drip")) return "drip";
  if (lower.includes("scratch")) return "scratch";
  if (lower.includes("thin-flick")) return "thin flick";
  return "unclassified";
}

function recommendation(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("spray-six-pass")) {
    return "Quality, structure and full-composition reference only";
  }
  if (lower.includes("jedna linija")) {
    return "Primary isolated model for one hero stroke; clean and decompose before use";
  }
  if (lower.includes("reference-sheet")) {
    return "Visual catalogue only; do not place directly in the runtime DOM";
  }
  if (lower.includes("brush-broad") || lower.includes("curved-sweep")) {
    return "Direct-shape adaptation candidate";
  }
  if (lower.includes("dry-brush") || lower.includes("scratch")) {
    return "Reusable mask candidate";
  }
  if (lower.includes("bristle")) {
    return "Bristle/fragment overlay candidate";
  }
  if (lower.includes("spray-drag") || lower.includes("spray-burst")) {
    return "Spray/overspray source candidate";
  }
  if (lower.includes("splatter") || lower.includes("drip")) {
    return "Sparse accent source; use selectively";
  }
  if (lower.includes("thin-flick")) {
    return "Low-cost directional companion stroke";
  }
  return "Audit manually before use";
}

async function auditSvg(filePath) {
  const [source, fileStat] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath),
  ]);
  const rootMatch = source.match(/<svg\b([^>]*)>/i);
  const rootAttributes = rootMatch?.[1] ?? "";
  const hrefs = hrefAudit(source);
  const duplicates = duplicateIds(source);
  const pathStats = pathComplexity(source);
  const illustratorMarkers = [
    ...new Set(
      [...source.matchAll(
        /(?:xmlns:|<|<\/|\s)(i|x|a|ai|adobe|inkscape|sodipodi):/gi,
      )].map((match) => match[1].toLowerCase()),
    ),
  ];
  const generatorComments = [
    ...source.matchAll(/<!--\s*Generator:\s*([^]*?)-->/gi),
  ].map((match) => match[1].trim());
  const hasDoctype = /<!DOCTYPE\b/i.test(source);
  const hasEntities = /<!ENTITY\b/i.test(source);
  const hasScript = /<script\b/i.test(source);
  const hasForeignObject = /<foreignObject\b/i.test(source);
  const imageCount = countMatches(source, /<image\b/gi);
  const base64Count = countMatches(source, /base64,/gi);
  const externalUrlCount = countMatches(
    source,
    /(?:https?:)?\/\/[^\s"'<>]+/gi,
  );
  const browserSafe =
    duplicates.length === 0 &&
    hrefs.external.length === 0 &&
    imageCount === 0 &&
    base64Count === 0 &&
    !hasScript &&
    !hasForeignObject &&
    !(hasDoctype && hasEntities);

  return {
    fileName: path.basename(filePath),
    filePath,
    bytes: fileStat.size,
    root: {
      viewBox: readAttribute(rootAttributes, "viewBox"),
      width: readAttribute(rootAttributes, "width"),
      height: readAttribute(rootAttributes, "height"),
    },
    topLevelGroups: topLevelGroups(source),
    groupInventory: groupInventory(source),
    elements: {
      groups: countMatches(source, /<g\b/gi),
      paths: pathStats.pathCount,
      circles: countMatches(source, /<circle\b/gi),
      ellipses: countMatches(source, /<ellipse\b/gi),
      masks: countMatches(source, /<mask\b/gi),
      clipPaths: countMatches(source, /<clipPath\b/gi),
      filters: countMatches(source, /<filter\b/gi),
      images: imageCount,
      uses: countMatches(source, /<use\b/gi),
    },
    embeddedOrExternal: {
      base64Payloads: base64Count,
      hrefs,
      externalUrlOccurrences: externalUrlCount,
    },
    authoringMarkers: {
      illustratorOrEditorNamespaces: illustratorMarkers,
      generatorComments,
      hasDoctype,
      hasEntities,
    },
    ids: {
      total: countMatches(source, /\sid\s*=/gi),
      duplicates,
    },
    anchorComplexity: pathStats,
    browserSafe,
    family: classifyFamily(path.basename(filePath)),
    recommendedUse: recommendation(path.basename(filePath)),
  };
}

const args = process.argv.slice(2);
const outputFlagIndex = args.indexOf("--output");
let outputPath = null;

if (outputFlagIndex >= 0) {
  outputPath = args[outputFlagIndex + 1];
  args.splice(outputFlagIndex, 2);
}

if (args.length === 0) {
  throw new Error("Pass one or more SVG paths to audit.");
}

const results = [];
for (const filePath of args) {
  results.push(await auditSvg(path.resolve(filePath)));
}

const json = `${JSON.stringify(
  {
    generatedAt: new Date().toISOString(),
    files: results,
  },
  null,
  2,
)}\n`;

if (outputPath) {
  await writeFile(path.resolve(outputPath), json);
}

process.stdout.write(json);
