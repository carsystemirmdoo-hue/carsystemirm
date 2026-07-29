import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artRoot = path.join(projectRoot, "public/art/paint-takeover");
const phase3bHeroPath = path.join(
  artRoot,
  "paint-takeover-hero-strokes.svg",
);
const referenceProofPath = path.join(
  artRoot,
  "paint-takeover-hero-strokes-reference-proof.svg",
);
const finalHeroPath = path.join(
  artRoot,
  "paint-takeover-hero-strokes-final.svg",
);
const finalManifestPath = path.join(
  artRoot,
  "paint-takeover-final-manifest.json",
);

const schedules = [
  ["01", "entry-brush", 0.105, 0.24, "path-mask", "A_DIRECT_SHAPE"],
  ["02", "primary-collision", 0.23, 0.39, "path-mask-reverse", "A_DIRECT_SHAPE"],
  ["03", "primary-collision", 0.27, 0.43, "curve-mask", "A_DIRECT_SHAPE"],
  ["04", "primary-collision", 0.31, 0.45, "path-mask", "A_DIRECT_SHAPE"],
  ["05", "entry-companion", 0.14, 0.27, "directional-clip", "B_REUSABLE_MASK"],
  ["06", "primary-response", 0.35, 0.48, "directional-clip", "B_REUSABLE_MASK"],
  ["07", "secondary-energy", 0.44, 0.6, "dry-fragment-wave", "A_DIRECT_SHAPE"],
  ["08", "secondary-energy", 0.48, 0.62, "dry-fragment-wave", "B_REUSABLE_MASK"],
  ["09", "secondary-energy", 0.52, 0.65, "dry-fragment-wave", "B_REUSABLE_MASK"],
  ["10", "secondary-energy", 0.55, 0.67, "dry-fragment-wave", "B_REUSABLE_MASK"],
  ["11", "secondary-energy", 0.57, 0.69, "dry-fragment-wave", "B_REUSABLE_MASK"],
  ["12", "secondary-energy", 0.52, 0.67, "path-draw-particles", "A_DIRECT_SHAPE"],
  ["13", "secondary-energy", 0.58, 0.71, "path-draw-particles", "C_BRISTLE_OVERSPRAY"],
  ["14", "secondary-energy", 0.61, 0.73, "path-draw-particles", "C_BRISTLE_OVERSPRAY"],
  ["15", "secondary-energy", 0.64, 0.76, "path-draw-particles", "C_BRISTLE_OVERSPRAY"],
  ["16", "secondary-energy", 0.65, 0.77, "path-draw-particles", "C_BRISTLE_OVERSPRAY"],
  ["17", "secondary-energy", 0.47, 0.61, "path-draw", "B_REUSABLE_MASK"],
  ["18", "secondary-energy", 0.5, 0.64, "path-draw", "B_REUSABLE_MASK"],
  ["19", "secondary-energy", 0.56, 0.69, "path-draw", "B_REUSABLE_MASK"],
  ["20", "secondary-energy", 0.59, 0.72, "path-draw", "B_REUSABLE_MASK"],
  ["21", "spray-detail", 0.67, 0.77, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["22", "spray-detail", 0.7, 0.8, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["23", "spray-detail", 0.72, 0.82, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["24", "spray-detail", 0.74, 0.84, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["25", "spray-detail", 0.7, 0.82, "path-draw", "D_KEEP_CURRENT"],
  ["26", "spray-detail", 0.73, 0.84, "path-draw", "D_KEEP_CURRENT"],
  ["27", "spray-detail", 0.76, 0.87, "path-draw", "D_KEEP_CURRENT"],
  ["28", "spray-detail", 0.72, 0.84, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["29", "spray-detail", 0.76, 0.87, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["30", "controlled-hold-detail", 0.79, 0.9, "particle-stage", "C_BRISTLE_OVERSPRAY"],
  ["31", "background-depth", 0.34, 0.72, "global-fade", "D_KEEP_CURRENT"],
  ["32", "background-depth", 0.5, 0.82, "global-fade", "D_KEEP_CURRENT"],
].map(([suffix, wave, start, end, revealMode, adaptationType]) => ({
  id: `hero-stroke-${suffix}`,
  proofId: `reference-stroke-${suffix}`,
  wave,
  start,
  end,
  revealMode,
  adaptationType,
}));

const directIds = new Set(
  schedules
    .filter((entry) => entry.adaptationType === "A_DIRECT_SHAPE")
    .map((entry) => entry.id),
);
const reusableMaskIds = new Set(
  schedules
    .filter((entry) => entry.adaptationType === "B_REUSABLE_MASK")
    .map((entry) => entry.id),
);
const overlayIds = new Set(
  schedules
    .filter((entry) => entry.adaptationType === "C_BRISTLE_OVERSPRAY")
    .map((entry) => entry.id),
);

function extractBalancedElement(source, tagName, startAt = 0) {
  const startExpression = new RegExp(`<${tagName}\\b`, "g");
  startExpression.lastIndex = startAt;
  const startMatch = startExpression.exec(source);
  if (!startMatch) throw new Error(`Could not find <${tagName}>.`);

  const expression = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "g");
  expression.lastIndex = startMatch.index;
  let depth = 0;

  for (
    let match = expression.exec(source);
    match;
    match = expression.exec(source)
  ) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return source.slice(startMatch.index, expression.lastIndex);
    }
  }

  throw new Error(`Unbalanced <${tagName}> element.`);
}

function extractGroup(source, id) {
  const idIndex = source.indexOf(`id="${id}"`);
  if (idIndex < 0) throw new Error(`Missing group ${id}.`);
  const start = source.lastIndexOf("<g", idIndex);
  return extractBalancedElement(source, "g", start);
}

function extractMask(source, id) {
  const idIndex = source.indexOf(`id="${id}"`);
  if (idIndex < 0) throw new Error(`Missing mask ${id}.`);
  const start = source.lastIndexOf("<mask", idIndex);
  return extractBalancedElement(source, "mask", start);
}

function innerMarkup(element) {
  return element.slice(element.indexOf(">") + 1, element.lastIndexOf("</"));
}

function removeDataPartGroup(source, partName) {
  const markerIndex = source.indexOf(`data-part="${partName}"`);
  if (markerIndex < 0) return source;
  const start = source.lastIndexOf("<g", markerIndex);
  const group = extractBalancedElement(source, "g", start);
  return source.slice(0, start) + source.slice(start + group.length);
}

function elementAttribute(element, name) {
  return (
    element.match(
      new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"),
    )?.[1] ?? null
  );
}

function directPaintElements(group) {
  return [...group.matchAll(/<(?:path|circle|ellipse)\b[^>]*\/>/gi)].map(
    (match) => match[0],
  );
}

function withPathLength(element) {
  if (!element.startsWith("<path") || element.includes("pathLength=")) {
    return element;
  }
  return element.replace("<path", '<path pathLength="1"');
}

function wrapTopLevelGroup(originalGroup, schedule, content) {
  const openingEnd = originalGroup.indexOf(">");
  const opening = originalGroup.slice(0, openingEnd);
  return `${opening}
    data-wave="${schedule.wave}"
    data-start="${Number(schedule.start).toFixed(3)}"
    data-end="${Number(schedule.end).toFixed(3)}"
    data-reveal-mode="${schedule.revealMode}"
    data-adaptation-type="${schedule.adaptationType}"
  >
${content}
  </g>`;
}

function adaptBroadOrDry(group, schedule) {
  const elements = directPaintElements(group);
  const filled = elements.filter(
    (element) =>
      element.startsWith("<path") &&
      elementAttribute(element, "fill") !== "none",
  );
  const stroked = elements.filter(
    (element) =>
      element.startsWith("<path") &&
      elementAttribute(element, "fill") === "none",
  );
  const isDry = schedule.id >= "hero-stroke-08" &&
    schedule.id <= "hero-stroke-11";

  if (isDry) {
    const primaryCount = Math.max(1, Math.ceil(filled.length / 2));
    return `    <g data-part="primary-fragments">
      ${filled.slice(0, primaryCount).join("\n      ")}
    </g>
    <g data-part="secondary-fragments">
      ${filled.slice(primaryCount).join("\n      ")}
    </g>
    <g data-part="fine-bristles">
      ${stroked.slice(0, Math.max(1, stroked.length - 1)).join("\n      ")}
    </g>
    <g data-part="detached-fragments">
      ${stroked.slice(-1).join("\n      ")}
    </g>`;
  }

  return `    <g data-part="core">
      ${filled.join("\n      ")}
    </g>
    <g data-part="bristles">
      ${stroked.slice(0, Math.max(1, Math.ceil(stroked.length * 0.62))).join("\n      ")}
    </g>
    <g data-part="fragments">
      ${stroked.slice(Math.max(1, Math.ceil(stroked.length * 0.62))).join("\n      ")}
    </g>
    <g data-part="release">
      ${stroked.slice(-1).join("\n      ")}
    </g>`;
}

function adaptCurved(group, schedule, index) {
  const elements = directPaintElements(group).map(withPathLength);
  const dryMask = ["hero-dry-a", "hero-dry-b", "hero-dry-c"][index % 3];
  return `    <g data-part="core" mask="url(#${dryMask})">
      ${elements[0] ?? ""}
    </g>
    <g data-part="bristles">
      ${elements.slice(1, -1).join("\n      ")}
    </g>
    <g data-part="fragments">
      ${elements.slice(-1).join("\n      ")}
    </g>
    <g data-part="release">
      ${elements.slice(-1).join("\n      ")}
    </g>`;
}

function adaptSprayDrag(group) {
  const elements = directPaintElements(group);
  const paths = elements.filter((element) => element.startsWith("<path"));
  const particles = elements.filter(
    (element) =>
      element.startsWith("<circle") || element.startsWith("<ellipse"),
  );
  const split = Math.max(1, Math.ceil(particles.length * 0.45));
  return `    <g data-part="core">
      ${paths.slice(0, 1).map(withPathLength).join("\n      ")}
    </g>
    <g data-part="near-overspray">
      ${paths.slice(1).map(withPathLength).join("\n      ")}
      ${particles.slice(0, split).join("\n      ")}
    </g>
    <g data-part="far-particles">
      ${particles.slice(split).join("\n      ")}
    </g>
    <g data-part="drips"></g>`;
}

function adaptSprayBurst(group, schedule) {
  const elements = directPaintElements(group);
  const paths = elements.filter((element) => element.startsWith("<path"));
  const particles = elements.filter(
    (element) =>
      element.startsWith("<circle") || element.startsWith("<ellipse"),
  );
  const split = Math.max(1, Math.ceil(particles.length * 0.42));
  const drip =
    schedule.id === "hero-stroke-21"
      ? '<path d="M324 651 C326 666 325 678 328 690 C330 696 336 696 338 689 C337 677 333 664 333 652Z" fill="#b80924" opacity=".56"/>'
      : schedule.id === "hero-stroke-22"
        ? '<path d="M1624 493 C1622 508 1624 522 1621 536 C1619 543 1613 542 1611 535 C1612 521 1616 508 1616 494Z" fill="#00c8e8" opacity=".52"/>'
        : "";
  return `    <g data-part="core">
      ${paths.slice(0, 1).join("\n      ")}
    </g>
    <g data-part="near-overspray">
      ${paths.slice(1).map(withPathLength).join("\n      ")}
      ${particles.slice(0, split).join("\n      ")}
    </g>
    <g data-part="far-particles">
      ${particles.slice(split).join("\n      ")}
    </g>
    <g data-part="drips">
      ${drip}
    </g>`;
}

function adaptSplatter(group) {
  const elements = directPaintElements(group);
  const paths = elements.filter((element) => element.startsWith("<path"));
  const particles = elements.filter(
    (element) =>
      element.startsWith("<circle") || element.startsWith("<ellipse"),
  );
  const split = Math.max(1, Math.ceil(particles.length * 0.45));
  return `    <g data-part="core">
      ${paths.join("\n      ")}
    </g>
    <g data-part="near-overspray">
      ${particles.slice(0, split).join("\n      ")}
    </g>
    <g data-part="far-particles">
      ${particles.slice(split).join("\n      ")}
    </g>
    <g data-part="drips"></g>`;
}

function readMetadata(group) {
  const opening = group.slice(0, group.indexOf(">"));
  const read = (name) => elementAttribute(opening, name);
  return {
    family: read("data-family"),
    origin: read("data-origin"),
    direction: read("data-direction"),
    depth: read("data-depth"),
    mobile: read("data-mobile"),
  };
}

function countElements(source) {
  const count = (expression) => [...source.matchAll(expression)].length;
  return {
    paths: count(/<path\b/gi),
    circles: count(/<circle\b/gi),
    ellipses: count(/<ellipse\b/gi),
    groups: count(/<g\b/gi),
    masks: count(/<mask\b/gi),
    filters: count(/<filter\b/gi),
    totalSvgDomElements: count(
      /<(?:svg|style|defs|linearGradient|radialGradient|stop|mask|rect|path|circle|ellipse|filter|feGaussianBlur|feTurbulence|feDisplacementMap|g)\b/gi,
    ),
  };
}

const [phase3bHero, referenceProof] = await Promise.all([
  readFile(phase3bHeroPath, "utf8"),
  readFile(referenceProofPath, "utf8"),
]);
const phase3bDefs = extractBalancedElement(phase3bHero, "defs");
const finalMasks = schedules
  .filter((schedule) => directIds.has(schedule.id))
  .map((schedule) => {
    const suffix = schedule.id.slice(-2);
    return extractMask(
      referenceProof,
      `${schedule.proofId}-mask`,
    ).replace(
      'class="reference-reveal-path"',
      `class="final-reveal-path" style="stroke-dasharray:1;stroke-dashoffset:var(--hero-mask-offset-${suffix},0)"`,
    );
  })
  .join("\n    ");

const finalGroups = [];
const manifestGroups = [];

for (const [index, schedule] of schedules.entries()) {
  const originalGroup = extractGroup(phase3bHero, schedule.id);
  const metadata = readMetadata(originalGroup);
  let content;

  if (directIds.has(schedule.id)) {
    const proofGroup = extractGroup(referenceProof, schedule.proofId);
    content = removeDataPartGroup(
      innerMarkup(proofGroup),
      "mask-debug",
    ).trim();
  } else if (reusableMaskIds.has(schedule.id)) {
    if (metadata.family === "curved-sweep") {
      content = adaptCurved(originalGroup, schedule, index);
    } else {
      content = adaptBroadOrDry(originalGroup, schedule);
    }
  } else if (overlayIds.has(schedule.id)) {
    if (metadata.family === "spray-drag") {
      content = adaptSprayDrag(originalGroup);
    } else if (metadata.family === "spray-burst") {
      content = adaptSprayBurst(originalGroup, schedule);
    } else {
      content = adaptSplatter(originalGroup);
    }
  } else {
    const currentContent = innerMarkup(originalGroup).trim();
    content =
      metadata.family === "thin-flick"
        ? currentContent.replace(
            /<path\b[^>]*\/>/gi,
            (element) => withPathLength(element),
          )
        : currentContent;
  }

  const finalGroup = wrapTopLevelGroup(originalGroup, schedule, content);
  finalGroups.push(finalGroup);
  manifestGroups.push({
    id: schedule.id,
    ...metadata,
    wave: schedule.wave,
    start: schedule.start,
    end: schedule.end,
    revealMode: schedule.revealMode,
    adaptationType: schedule.adaptationType,
  });
}

const motionStyle = `<style>
      .final-reveal-path {
        stroke-dasharray: 1;
      }
    </style>`;
const finalDefs = phase3bDefs.replace(
  "</defs>",
  `${motionStyle}
    ${finalMasks}
  </defs>`,
);
const finalHero = `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1920 1080"
  preserveAspectRatio="xMidYMid slice"
  role="img"
  aria-label="Finalni Carsystem painterly hero sa 32 scroll-animabilne grupe"
>
  <style>
    .paint-stroke { transform-box: fill-box; transform-origin: center; }
    @media (max-width: 520px) {
      .paint-stroke[data-mobile="hide"] { display: none; }
    }
  </style>
  ${finalDefs}
  ${finalGroups.join("\n  ")}
</svg>
`;

await writeFile(finalHeroPath, finalHero);

const currentStats = countElements(phase3bHero);
const finalStats = countElements(finalHero);
const manifest = {
  generatedAt: new Date().toISOString(),
  source: path.relative(projectRoot, phase3bHeroPath),
  referenceProof: path.relative(projectRoot, referenceProofPath),
  finalAsset: path.relative(projectRoot, finalHeroPath),
  topLevelGroups: finalGroups.length,
  mobileKeep: manifestGroups.filter((group) => group.mobile === "keep").length,
  mobileHide: manifestGroups.filter((group) => group.mobile === "hide").length,
  groups: manifestGroups,
  categories: {
    directShapeAdaptation: manifestGroups
      .filter((group) => group.adaptationType === "A_DIRECT_SHAPE")
      .map((group) => group.id),
    reusableMask: manifestGroups
      .filter((group) => group.adaptationType === "B_REUSABLE_MASK")
      .map((group) => group.id),
    bristleOversprayOverlay: manifestGroups
      .filter((group) => group.adaptationType === "C_BRISTLE_OVERSPRAY")
      .map((group) => group.id),
    keepCurrent: manifestGroups
      .filter((group) => group.adaptationType === "D_KEEP_CURRENT")
      .map((group) => group.id),
  },
  currentStats: {
    bytes: Buffer.byteLength(phase3bHero),
    ...currentStats,
  },
  finalStats: {
    bytes: Buffer.byteLength(finalHero),
    ...finalStats,
  },
  delta: {
    bytes: Buffer.byteLength(finalHero) - Buffer.byteLength(phase3bHero),
    paths: finalStats.paths - currentStats.paths,
    circles: finalStats.circles - currentStats.circles,
    ellipses: finalStats.ellipses - currentStats.ellipses,
    groups: finalStats.groups - currentStats.groups,
    masks: finalStats.masks - currentStats.masks,
    filters: finalStats.filters - currentStats.filters,
    totalSvgDomElements:
      finalStats.totalSvgDomElements - currentStats.totalSvgDomElements,
  },
};

await writeFile(finalManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${path.relative(projectRoot, finalHeroPath)}`);
console.log(`Wrote ${path.relative(projectRoot, finalManifestPath)}`);
console.log(
  `${finalGroups.length} top-level groups, ${finalStats.totalSvgDomElements} total SVG DOM elements, ${Buffer.byteLength(finalHero)} bytes`,
);
