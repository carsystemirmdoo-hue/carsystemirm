import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artRoot = path.join(projectRoot, "public/art/paint-takeover");
const libraryRoot = path.join(artRoot, "brush-library");
const packRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
const originalHeroPath = path.join(
  artRoot,
  "paint-takeover-hero-strokes.svg",
);
const isolatedSourcePath = path.join(
  projectRoot,
  "public/product-hero-patterns/jedna linija.svg",
);
const proofPath = path.join(
  artRoot,
  "paint-takeover-hero-strokes-reference-proof.svg",
);
const manifestPath = path.join(libraryRoot, "manifest.json");

const directories = {
  direct: path.join(libraryRoot, "direct-shapes"),
  masks: path.join(libraryRoot, "masks"),
  bristles: path.join(libraryRoot, "bristles"),
  spray: path.join(libraryRoot, "spray"),
  splatter: path.join(libraryRoot, "splatter"),
};

const selectedLibraryFiles = [
  ["brush-broad-01.svg", "direct"],
  ["brush-broad-02.svg", "direct"],
  ["curved-sweep-01.svg", "direct"],
  ["dry-brush-01.svg", "masks"],
  ["dry-brush-02.svg", "masks"],
  ["bristle-overlay-01.svg", "bristles"],
  ["spray-drag-01.svg", "spray"],
  ["spray-burst-01.svg", "spray"],
  ["splatter-01.svg", "splatter"],
];

const strokeSpecs = [
  {
    proofId: "reference-stroke-01",
    originalId: "hero-stroke-01",
    label: "Magenta left-entry broad",
    family: "broad-brush",
    origin: "left",
    direction: "bottom-left-to-top-right",
    depth: "foreground",
    source:
      "/art/paint-takeover/brush-library/direct-shapes/carsystem-isolated-pass-clean.svg",
    sourceLabel: "Carsystem isolated pass",
    coreCount: 4,
    reveal:
      "M-320 880 C260 850 760 710 1230 500 C1600 342 1900 266 2220 120",
    maskWidth: 250,
    contact:
      '<path d="M-288 840 L-250 813 L-196 820 L-214 866 L-266 877Z" fill="#f50087" opacity=".92"/>',
    bristles: `
      <path d="M-278 882 C246 824 744 700 1212 501 S1864 286 2176 164 M-264 858 C260 807 756 674 1222 478 S1878 259 2158 141 M-226 905 C296 838 782 725 1242 526 S1854 311 2138 196" fill="none" stroke="#ff3ba7" stroke-width="3.2" stroke-linecap="round" opacity=".72"/>
      <path d="M-210 916 C302 844 792 736 1250 538 M1320 507 C1642 370 1902 302 2090 225" fill="none" stroke="#b80924" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`,
    fragments: `
      <path d="M118 823 l42 -18 34 4 -18 16 -45 10Z M468 742 l55 -24 30 5 -25 19 -44 11Z M910 608 l46 -24 38 2 -21 19 -51 13Z M1438 420 l51 -23 35 3 -24 18 -45 12Z" fill="#f50087" opacity=".7"/>
      <path d="M358 790 l18 -12 25 2 -12 10 -24 7Z M1690 337 l28 -16 23 2 -13 12 -29 8Z" fill="#ff3ba7" opacity=".6"/>`,
    near: `
      <ellipse cx="72" cy="854" rx="7" ry="4" fill="#ff3ba7"/><ellipse cx="208" cy="816" rx="4" ry="2.5" fill="#f50087"/><ellipse cx="590" cy="714" rx="6" ry="3" fill="#f50087"/><ellipse cx="1040" cy="565" rx="5" ry="3" fill="#ff3ba7"/><ellipse cx="1492" cy="394" rx="6" ry="3.4" fill="#b80924"/>`,
    far: `
      <circle cx="-18" cy="921" r="2.6" fill="#ff3ba7"/><circle cx="300" cy="881" r="1.8" fill="#ff3ba7"/><circle cx="730" cy="757" r="2.1" fill="#f50087"/><circle cx="1184" cy="577" r="1.7" fill="#ff3ba7"/><circle cx="1578" cy="404" r="2.2" fill="#f50087"/>`,
    release: `
      <path d="M2112 177 l42 -25 30 -4 -22 20 -39 18Z M2162 139 l25 -19 20 1 -14 15 -24 10Z" fill="#ff3ba7" opacity=".72"/>
      <circle cx="2185" cy="184" r="4.2" fill="#f50087"/><circle cx="2205" cy="162" r="2.1" fill="#ff3ba7"/>`,
  },
  {
    proofId: "reference-stroke-02",
    originalId: "hero-stroke-02",
    label: "Blue / indigo right counter",
    family: "broad-brush",
    origin: "right",
    direction: "top-right-to-bottom-left",
    depth: "midground",
    source:
      "/art/paint-takeover/brush-library/direct-shapes/brush-broad-01.svg",
    sourceLabel: "brush-broad-01",
    coreCount: 3,
    reveal:
      "M2200 220 C1780 382 1370 462 930 590 C510 708 120 746 -300 790",
    maskWidth: 210,
    contact:
      '<path d="M2162 220 L2110 233 L2080 266 L2130 286 L2184 254Z" fill="#0878ff" opacity=".9"/>',
    bristles: `
      <path d="M2188 257 C1770 409 1364 489 920 612 S104 777 -274 813 M2164 228 C1768 370 1350 450 904 579 S118 738 -258 782 M2138 294 C1740 438 1332 520 900 638 S140 804 -230 835" fill="none" stroke="#00c8e8" stroke-width="2.8" stroke-linecap="round" opacity=".68"/>
      <path d="M2038 318 C1700 432 1360 510 1008 600 M874 644 C536 730 204 786 -138 817" fill="none" stroke="#3325d7" stroke-width="1.7" stroke-linecap="round" opacity=".62"/>`,
    fragments: `
      <path d="M1886 351 l-52 6 -24 17 42 6 51 -17Z M1508 464 l-46 5 -28 16 42 6 47 -16Z M1128 570 l-43 5 -31 17 44 5 45 -16Z M612 704 l-48 4 -26 15 40 6 49 -14Z" fill="#0878ff" opacity=".66"/>`,
    near: `
      <ellipse cx="2030" cy="315" rx="6" ry="3" fill="#00c8e8"/><ellipse cx="1710" cy="418" rx="4" ry="2.4" fill="#0878ff"/><ellipse cx="1284" cy="526" rx="6" ry="3" fill="#3325d7"/><ellipse cx="806" cy="656" rx="4" ry="2.2" fill="#00c8e8"/>`,
    far: `
      <circle cx="1962" cy="280" r="2.1" fill="#00c8e8"/><circle cx="1580" cy="413" r="1.7" fill="#0878ff"/><circle cx="1014" cy="608" r="2.2" fill="#00c8e8"/><circle cx="438" cy="768" r="1.8" fill="#0878ff"/>`,
    release: `
      <path d="M-256 782 l44 -7 31 8 -29 10 -43 1Z M-222 814 l34 -4 21 7 -25 8 -35 -2Z" fill="#00c8e8" opacity=".72"/>
      <circle cx="-190" cy="846" r="3.1" fill="#0878ff"/><circle cx="-226" cy="860" r="1.7" fill="#00c8e8"/>`,
  },
  {
    proofId: "reference-stroke-03",
    originalId: "hero-stroke-03",
    label: "Cream curved top sweep",
    family: "curved-sweep",
    origin: "top",
    direction: "curved-clockwise",
    depth: "foreground",
    source:
      "/art/paint-takeover/brush-library/direct-shapes/curved-sweep-01.svg",
    sourceLabel: "curved-sweep-01",
    coreCount: 3,
    reveal:
      "M850 -230 C1018 -92 1144 118 1280 312 C1420 514 1608 654 1810 770",
    maskWidth: 190,
    contact:
      '<path d="M828 -192 L865 -206 L898 -174 L874 -140 L838 -158Z" fill="#f4f1eb" opacity=".94"/>',
    bristles: `
      <path d="M862 -218 C1022 -76 1148 132 1284 326 C1425 528 1615 670 1792 762 M892 -224 C1046 -86 1170 116 1308 302 C1450 494 1630 626 1818 735 M838 -180 C994 -36 1118 164 1250 350 C1388 548 1574 696 1754 794" fill="none" stroke="#f4f1eb" stroke-width="2.8" stroke-linecap="round" opacity=".72"/>
      <path d="M925 -124 C1042 -4 1146 148 1254 304 M1322 408 C1438 558 1574 664 1708 746" fill="none" stroke="#d9d2c7" stroke-width="1.6" stroke-linecap="round" opacity=".62"/>`,
    fragments: `
      <path d="M1060 24 l22 33 2 29 -18 -19 -18 -35Z M1220 262 l25 31 3 28 -19 -17 -20 -34Z M1440 530 l31 24 6 25 -22 -13 -27 -27Z" fill="#f4f1eb" opacity=".68"/>`,
    near: `
      <ellipse cx="1006" cy="-16" rx="4" ry="7" fill="#d9d2c7"/><ellipse cx="1196" cy="260" rx="3" ry="5" fill="#f4f1eb"/><ellipse cx="1470" cy="552" rx="3" ry="5" fill="#d9d2c7"/><ellipse cx="1654" cy="704" rx="4" ry="2.4" fill="#f4f1eb"/>`,
    far: `
      <circle cx="972" cy="-68" r="2" fill="#f4f1eb"/><circle cx="1160" cy="188" r="1.6" fill="#d9d2c7"/><circle cx="1518" cy="612" r="2.1" fill="#f4f1eb"/>`,
    release: `
      <path d="M1742 746 l36 15 22 22 -29 -7 -35 -20Z M1784 774 l25 8 16 15 -23 -4 -23 -12Z" fill="#f4f1eb" opacity=".72"/>
      <circle cx="1820" cy="804" r="3.8" fill="#d9d2c7"/><circle cx="1840" cy="818" r="1.8" fill="#f4f1eb"/>`,
  },
  {
    proofId: "reference-stroke-04",
    originalId: "hero-stroke-04",
    label: "Red / violet bottom sweep",
    family: "broad-brush",
    origin: "bottom",
    direction: "bottom-left-to-top-right",
    depth: "midground",
    source:
      "/art/paint-takeover/brush-library/direct-shapes/brush-broad-02.svg",
    sourceLabel: "brush-broad-02",
    coreCount: 3,
    reveal:
      "M300 1280 C510 1040 720 720 968 446 C1088 314 1188 194 1320 94",
    maskWidth: 190,
    contact:
      '<path d="M328 1230 L348 1184 L388 1160 L400 1202 L366 1248Z" fill="#6c28ff" opacity=".9"/>',
    bristles: `
      <path d="M322 1242 C520 1014 726 704 970 430 C1088 296 1190 180 1308 88 M352 1262 C546 1032 748 728 990 458 C1112 322 1214 210 1334 114 M286 1218 C488 986 694 676 936 408 C1052 278 1152 164 1278 64" fill="none" stroke="#f50087" stroke-width="2.8" stroke-linecap="round" opacity=".7"/>
      <path d="M420 1134 C584 930 752 684 940 480 M1012 392 C1100 286 1178 198 1260 128" fill="none" stroke="#2e1558" stroke-width="1.7" stroke-linecap="round" opacity=".66"/>`,
    fragments: `
      <path d="M492 1048 l20 -43 22 -18 -5 31 -24 42Z M704 760 l25 -37 24 -16 -9 29 -28 36Z M948 480 l26 -34 24 -11 -12 26 -28 31Z M1168 230 l27 -28 20 -5 -13 22 -28 22Z" fill="#6c28ff" opacity=".68"/>`,
    near: `
      <ellipse cx="450" cy="1080" rx="3" ry="6" fill="#f50087"/><ellipse cx="650" cy="812" rx="3" ry="5" fill="#6c28ff"/><ellipse cx="892" cy="526" rx="4" ry="6" fill="#f50087"/><ellipse cx="1104" cy="286" rx="3" ry="5" fill="#6c28ff"/>`,
    far: `
      <circle cx="408" cy="1128" r="2" fill="#f50087"/><circle cx="768" cy="706" r="1.8" fill="#6c28ff"/><circle cx="1038" cy="382" r="2.2" fill="#f50087"/>`,
    release: `
      <path d="M1250 126 l30 -31 26 -9 -14 27 -31 26Z M1296 84 l23 -20 17 -3 -11 17 -24 15Z" fill="#f50087" opacity=".7"/>
      <circle cx="1332" cy="64" r="3.5" fill="#6c28ff"/><circle cx="1352" cy="52" r="1.7" fill="#f50087"/>`,
  },
  {
    proofId: "reference-stroke-07",
    originalId: "hero-stroke-07",
    label: "Burgundy dry-brush field",
    family: "dry-brush",
    origin: "left",
    direction: "left-to-right",
    depth: "background",
    source:
      "/art/paint-takeover/brush-library/masks/dry-brush-01.svg",
    sourceLabel: "dry-brush-01",
    coreCount: 3,
    reveal:
      "M-240 900 C300 852 860 824 1500 760",
    maskWidth: 100,
    contact:
      '<path d="M-190 876 L-126 866 L-96 881 L-154 899Z" fill="#541128" opacity=".78"/>',
    bristles: `
      <path d="M-180 846 C250 820 706 804 1170 770 M-160 862 C286 832 728 816 1210 782 M-146 888 C282 858 738 838 1260 798 M-126 916 C328 882 770 858 1340 812" fill="none" stroke="#b80924" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
      <path d="M-80 934 L202 904 M280 898 L586 870 M668 858 L996 824 M1072 814 L1398 776" fill="none" stroke="#541128" stroke-width="1.2" stroke-linecap="round" opacity=".58"/>`,
    fragments: `
      <path d="M30 882 l76 -9 34 8 -58 13 -63 0Z M244 862 l46 -8 31 5 -36 12 -49 2Z M520 842 l92 -11 36 7 -67 14 -72 1Z M782 820 l52 -9 38 5 -38 12 -60 4Z M1086 786 l78 -10 42 7 -61 13 -68 1Z" fill="#541128" opacity=".6"/>`,
    near: `
      <ellipse cx="170" cy="914" rx="9" ry="2.4" fill="#b80924"/><ellipse cx="438" cy="878" rx="7" ry="2" fill="#541128"/><ellipse cx="744" cy="844" rx="8" ry="2.2" fill="#b80924"/><ellipse cx="1030" cy="816" rx="6" ry="1.8" fill="#541128"/>`,
    far: `
      <circle cx="112" cy="940" r="1.7" fill="#b80924"/><circle cx="604" cy="886" r="1.5" fill="#541128"/><circle cx="940" cy="844" r="1.8" fill="#b80924"/>`,
    release: `
      <path d="M1348 772 l70 -10 38 5 -55 12 -62 2Z M1418 790 l42 -6 24 5 -34 8 -37 1Z" fill="#541128" opacity=".58"/>
      <circle cx="1476" cy="778" r="2.8" fill="#b80924"/><circle cx="1502" cy="790" r="1.5" fill="#541128"/>`,
  },
  {
    proofId: "reference-stroke-12",
    originalId: "hero-stroke-12",
    label: "Cyan spray drag",
    family: "spray-drag",
    origin: "right",
    direction: "curved-counter-clockwise",
    depth: "foreground",
    source:
      "/art/paint-takeover/brush-library/spray/spray-drag-01.svg",
    sourceLabel: "spray-drag-01",
    coreCount: 1,
    reveal:
      "M2160 790 C1780 388 1260 250 780 450",
    maskWidth: 92,
    contact:
      '<path d="M2112 748 L2070 704 L2038 700 L2064 740 L2100 772Z" fill="#00c8e8" opacity=".82"/>',
    bristles: `
      <path d="M2110 778 C1760 414 1266 286 816 458 M2078 804 C1738 442 1254 310 832 482 M2140 752 C1788 386 1284 262 806 432" fill="none" stroke="#00c8e8" stroke-width="2.4" stroke-linecap="round" opacity=".62"/>
      <path d="M2010 690 C1680 392 1286 312 932 418" fill="none" stroke="#0878ff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`,
    fragments: `
      <path d="M1908 606 l-36 -28 -28 -4 23 25 34 19Z M1610 428 l-42 -18 -27 3 29 17 38 10Z M1312 350 l-38 -3 -25 11 31 7 38 -5Z M1018 390 l-38 11 -20 16 32 -3 36 -15Z" fill="#00c8e8" opacity=".58"/>`,
    near: `
      <ellipse cx="1984" cy="650" rx="7" ry="4" fill="#00c8e8"/><ellipse cx="1770" cy="492" rx="5" ry="3" fill="#0878ff"/><ellipse cx="1512" cy="384" rx="6" ry="3" fill="#00c8e8"/><ellipse cx="1228" cy="356" rx="5" ry="2.7" fill="#0878ff"/><ellipse cx="974" cy="410" rx="5" ry="3" fill="#00c8e8"/>`,
    far: `
      <circle cx="2030" cy="594" r="2" fill="#00c8e8"/><circle cx="1832" cy="430" r="1.7" fill="#0878ff"/><circle cx="1440" cy="320" r="2.1" fill="#00c8e8"/><circle cx="1122" cy="332" r="1.6" fill="#0878ff"/><circle cx="860" cy="402" r="2" fill="#00c8e8"/>`,
    release: `
      <path d="M842 424 l-42 14 -24 19 34 -5 39 -17Z M804 454 l-28 10 -17 14 25 -4 27 -12Z" fill="#00c8e8" opacity=".7"/>
      <circle cx="770" cy="476" r="4" fill="#0878ff"/><circle cx="744" cy="492" r="2" fill="#00c8e8"/>`,
  },
];

function extractBalancedElement(source, tagName, startAt = 0) {
  const startExpression = new RegExp(`<${tagName}\\b`, "g");
  startExpression.lastIndex = startAt;
  const startMatch = startExpression.exec(source);
  if (!startMatch) throw new Error(`Could not find <${tagName}>.`);

  const expression = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "g");
  expression.lastIndex = startMatch.index;
  let depth = 0;

  for (let match = expression.exec(source); match; match = expression.exec(source)) {
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
  const groupStart = source.lastIndexOf("<g", idIndex);
  return extractBalancedElement(source, "g", groupStart);
}

function directPaintElements(group) {
  return [...group.matchAll(/<(?:path|circle|ellipse)\b[^>]*\/>/gi)].map(
    (match) => match[0],
  );
}

function countElements(source) {
  const count = (expression) => [...source.matchAll(expression)].length;
  const referenced = (attribute) =>
    new Set(
      [
        ...source.matchAll(
          new RegExp(`${attribute}="url\\(#([^)]+)\\)"`, "gi"),
        ),
      ].map((match) => match[1]),
    ).size;
  return {
    paths: count(/<path\b/gi),
    circles: count(/<circle\b/gi),
    ellipses: count(/<ellipse\b/gi),
    groups: count(/<g\b/gi),
    masks: referenced("mask"),
    filters: referenced("filter"),
  };
}

function cleanIsolatedPath(pathTag, id, opacity) {
  return pathTag
    .replace(/\s(?:id|class)="[^"]*"/gi, "")
    .replace(
      "<path",
      `<path id="${id}" fill="currentColor" opacity="${opacity}"`,
    );
}

async function buildCleanedIsolatedPass() {
  const source = await readFile(isolatedSourcePath, "utf8");
  const paths = [...source.matchAll(/<path\b[^>]*\/>/gi)].map(
    (match) => match[0],
  );

  if (paths.length !== 7) {
    throw new Error(`Expected seven isolated source paths, found ${paths.length}.`);
  }

  const cleaned = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" role="img" aria-labelledby="carsystem-isolated-title carsystem-isolated-desc">
  <title id="carsystem-isolated-title">Carsystem isolated spray-brush pass</title>
  <desc id="carsystem-isolated-desc">Cleaned currentColor reference separated into core, bristles, fragments, overspray and release layers.</desc>
  <g id="carsystem-isolated-pass" data-family="broad-spray-brush">
    <g id="carsystem-isolated-core" data-part="core">
      ${cleanIsolatedPath(paths[0], "carsystem-isolated-core-shape", "1")}
    </g>
    <g id="carsystem-isolated-bristles" data-part="bristles">
      ${cleanIsolatedPath(paths[1], "carsystem-isolated-bristle-field", ".85")}
    </g>
    <g id="carsystem-isolated-fragments" data-part="fragments">
      ${cleanIsolatedPath(paths[2], "carsystem-isolated-fragment-field", ".55")}
    </g>
    <g id="carsystem-isolated-overspray" data-part="overspray">
      ${cleanIsolatedPath(paths[3], "carsystem-isolated-overspray-near", ".32")}
      ${cleanIsolatedPath(paths[4], "carsystem-isolated-overspray-mid", ".22")}
      ${cleanIsolatedPath(paths[5], "carsystem-isolated-overspray-far", ".17")}
    </g>
    <g id="carsystem-isolated-release" data-part="release">
      ${cleanIsolatedPath(paths[6], "carsystem-isolated-release-particles", ".08")}
    </g>
  </g>
</svg>
`;

  const targetPath = path.join(
    directories.direct,
    "carsystem-isolated-pass-clean.svg",
  );
  await writeFile(targetPath, cleaned);
  return targetPath;
}

function proofMask(spec) {
  return `<mask id="${spec.proofId}-mask" maskUnits="userSpaceOnUse" x="-420" y="-320" width="2820" height="1900">
      <rect x="-420" y="-320" width="2820" height="1900" fill="black"/>
      <path class="reference-reveal-path" d="${spec.reveal}" pathLength="1" fill="none" stroke="white" stroke-width="${spec.maskWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>`;
}

function proofGroup(spec, originalGroup) {
  const elements = directPaintElements(originalGroup);
  const core = elements.slice(0, spec.coreCount).join("\n      ");
  const existingDetails = elements.slice(spec.coreCount).join("\n      ");

  return `<g
    id="${spec.proofId}"
    class="reference-stroke reference-stroke--${spec.family}"
    data-original-group="${spec.originalId}"
    data-family="${spec.family}"
    data-origin="${spec.origin}"
    data-direction="${spec.direction}"
    data-depth="${spec.depth}"
    data-source="${spec.sourceLabel}"
  >
    <g data-part="contact">
      ${spec.contact}
    </g>
    <g data-part="core" mask="url(#${spec.proofId}-mask)">
      ${core}
    </g>
    <g data-part="bristles">
      ${existingDetails}
      ${spec.bristles}
    </g>
    <g data-part="fragments">
      ${spec.fragments}
    </g>
    <g data-part="near-overspray">
      ${spec.near}
    </g>
    <g data-part="far-overspray">
      ${spec.far}
    </g>
    <g data-part="release">
      ${spec.release}
    </g>
    <g data-part="mask-debug" aria-hidden="true">
      <path d="${spec.reveal}" pathLength="1" fill="none" stroke="#f50087" stroke-width="${spec.maskWidth}" stroke-linecap="round" stroke-linejoin="round" opacity=".14"/>
      <path d="${spec.reveal}" pathLength="1" fill="none" stroke="#f4f1eb" stroke-width="3" stroke-linecap="round" stroke-dasharray=".018 .014" opacity=".96"/>
    </g>
  </g>`;
}

for (const directory of Object.values(directories)) {
  await mkdir(directory, { recursive: true });
}

for (const [fileName, directoryKey] of selectedLibraryFiles) {
  const targetPath = path.join(directories[directoryKey], fileName);
  if (packRoot) {
    await copyFile(path.join(packRoot, fileName), targetPath);
  } else {
    await stat(targetPath);
  }
}

const cleanedIsolatedPath = await buildCleanedIsolatedPass();
const originalHero = await readFile(originalHeroPath, "utf8");
const originalDefs = extractBalancedElement(originalHero, "defs");
const proofMasks = strokeSpecs.map(proofMask).join("\n    ");
const proofGroups = strokeSpecs.map((spec) =>
  proofGroup(spec, extractGroup(originalHero, spec.originalId)),
);
const proofSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true">
  ${originalDefs.replace(
    "</defs>",
    `<style>
      .reference-reveal-path {
        stroke-dasharray: 1;
        stroke-dashoffset: var(--proof-mask-offset, 0);
      }
    </style>
    ${proofMasks}
  </defs>`,
  )}
  ${proofGroups.join("\n  ")}
</svg>
`;

await writeFile(proofPath, proofSvg);

const strokeMetrics = strokeSpecs.map((spec, index) => {
  const originalGroup = extractGroup(originalHero, spec.originalId);
  const adaptedGroup = proofGroups[index];
  const originalElements = countElements(originalGroup);
  const adaptedElements = countElements(adaptedGroup);
  const originalDom =
    originalElements.paths +
    originalElements.circles +
    originalElements.ellipses +
    originalElements.groups;
  const adaptedDom =
    adaptedElements.paths +
    adaptedElements.circles +
    adaptedElements.ellipses +
    adaptedElements.groups +
    2;

  return {
    id: spec.proofId,
    originalId: spec.originalId,
    label: spec.label,
    source: spec.sourceLabel,
    current: {
      ...originalElements,
      bytes: Buffer.byteLength(originalGroup),
      runtimeDomNodes: originalDom,
    },
    adapted: {
      ...adaptedElements,
      bytes:
        Buffer.byteLength(adaptedGroup) +
        Buffer.byteLength(proofMask(spec)),
      runtimeDomNodes: adaptedDom,
    },
    runtimeDomIncrease: adaptedDom - originalDom,
  };
});

const libraryFiles = [];
for (const [fileName, directoryKey] of selectedLibraryFiles) {
  const filePath = path.join(directories[directoryKey], fileName);
  libraryFiles.push({
    file: path.relative(libraryRoot, filePath),
    bytes: (await stat(filePath)).size,
  });
}
libraryFiles.unshift({
  file: path.relative(libraryRoot, cleanedIsolatedPath),
  bytes: (await stat(cleanedIsolatedPath)).size,
});

const manifest = {
  generatedAt: new Date().toISOString(),
  proofAsset: path.relative(projectRoot, proofPath),
  immutableSourceAsset: path.relative(projectRoot, originalHeroPath),
  selectedGroups: strokeSpecs.map((spec) => ({
    proofId: spec.proofId,
    originalId: spec.originalId,
    label: spec.label,
    family: spec.family,
    origin: spec.origin,
    direction: spec.direction,
    source: spec.source,
    sourceLabel: spec.sourceLabel,
  })),
  selectedLibraryFiles: libraryFiles,
  perStrokeMetrics: strokeMetrics,
  remainingGroupRecommendation: {
    total: 26,
    directShapeAdaptation: {
      count: 6,
      groups: [
        "hero-stroke-05",
        "hero-stroke-06",
        "hero-stroke-17",
        "hero-stroke-18",
        "hero-stroke-19",
        "hero-stroke-20",
      ],
    },
    reusableMask: {
      count: 4,
      groups: [
        "hero-stroke-08",
        "hero-stroke-09",
        "hero-stroke-10",
        "hero-stroke-11",
      ],
    },
    bristleOrOversprayOverlay: {
      count: 11,
      groups: [
        "hero-stroke-13",
        "hero-stroke-14",
        "hero-stroke-15",
        "hero-stroke-16",
        "hero-stroke-21",
        "hero-stroke-22",
        "hero-stroke-23",
        "hero-stroke-24",
        "hero-stroke-28",
        "hero-stroke-29",
        "hero-stroke-30",
      ],
    },
    keepCurrent: {
      count: 5,
      groups: [
        "hero-stroke-25",
        "hero-stroke-26",
        "hero-stroke-27",
        "hero-stroke-31",
        "hero-stroke-32",
      ],
    },
  },
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${path.relative(projectRoot, proofPath)}`);
console.log(`Wrote ${path.relative(projectRoot, manifestPath)}`);
console.log(`Selected ${libraryFiles.length} cleaned reference assets`);
