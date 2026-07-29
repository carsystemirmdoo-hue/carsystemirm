import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artDirectory = path.join(
  projectRoot,
  "public/art/paint-takeover",
);
const checkpointSvgPath = path.join(
  projectRoot,
  "tmp/paint-takeover-phase3a-109-checkpoint/public/art/paint-takeover/paint-takeover.svg",
);
const heroSvgPath = path.join(
  artDirectory,
  "paint-takeover-hero-strokes.svg",
);
const avifPath = path.join(
  artDirectory,
  "paint-takeover-background.avif",
);
const webpPath = path.join(
  artDirectory,
  "paint-takeover-background.webp",
);

const rasterWidth = 2400;
const rasterHeight = 1350;

const palette = {
  canvas: "#070910",
  charcoal: "#13141b",
  burgundy: "#541128",
  crimson: "#b80924",
  red: "#e51b2a",
  magenta: "#f50087",
  pink: "#ff3ba7",
  deepViolet: "#2e1558",
  violet: "#6c28ff",
  deepIndigo: "#181b53",
  indigo: "#3325d7",
  blue: "#0878ff",
  inkBlue: "#10284f",
  cyan: "#00c8e8",
  cream: "#f4f1eb",
  warmCream: "#d9d2c7",
};

const groups = [];
const familyCounts = new Map();
const originCounts = new Map();
const directionCounts = new Map();

function noise(seed, step) {
  const value = Math.sin(seed * 91.731 + step * 47.193) * 43758.5453;
  return value - Math.floor(value);
}

function pointOnQuadratic(config, t) {
  const inverse = 1 - t;
  return {
    x:
      inverse * inverse * config.x1 +
      2 * inverse * t * config.cx +
      t * t * config.x2,
    y:
      inverse * inverse * config.y1 +
      2 * inverse * t * config.cy +
      t * t * config.y2,
  };
}

function tangentOnQuadratic(config, t) {
  return {
    x:
      2 * (1 - t) * (config.cx - config.x1) +
      2 * t * (config.x2 - config.cx),
    y:
      2 * (1 - t) * (config.cy - config.y1) +
      2 * t * (config.y2 - config.cy),
  };
}

function variedCurve(config, seedOffset, bendScale = 0.45) {
  const bend = config.width * bendScale;
  return {
    ...config,
    cx:
      config.cx +
      (noise(config.seed + seedOffset, 1) - 0.5) * bend * 1.7,
    cy:
      config.cy +
      (noise(config.seed + seedOffset, 2) - 0.5) * bend * 2,
    x2:
      config.x2 +
      (noise(config.seed + seedOffset, 3) - 0.5) * bend * 0.4,
    y2:
      config.y2 +
      (noise(config.seed + seedOffset, 4) - 0.5) * bend * 0.64,
    seed: config.seed + seedOffset * 17,
  };
}

function brushSegment(
  config,
  start,
  end,
  widthScale = 1,
  offset = 0,
  seedOffset = 0,
) {
  const upper = [];
  const lower = [];
  const steps = Math.max(8, Math.round((end - start) * 28));

  for (let step = 0; step <= steps; step += 1) {
    const localT = step / steps;
    const t = start + (end - start) * localT;
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / length;
    const normalY = tangent.x / length;
    const taper =
      0.34 + Math.pow(Math.sin(Math.PI * localT), 0.72) * 0.66;
    const pulse =
      0.86 +
      noise(config.seed + seedOffset + 13, step) * 0.2 +
      Math.sin(localT * Math.PI * 3.2) * 0.06;
    const fray =
      (localT < 0.18 || localT > 0.82
        ? noise(config.seed + seedOffset + 31, step) - 0.46
        : noise(config.seed + seedOffset + 31, step) * 0.32 - 0.16) *
      config.width *
      0.28;
    const halfWidth =
      Math.max(
        config.width * widthScale * 0.06,
        (config.width * widthScale * taper * pulse) / 2 + fray,
      );
    const opposite =
      Math.max(
        config.width * widthScale * 0.06,
        (config.width * widthScale * taper * (1.02 - (pulse - 0.86))) / 2 -
          fray * 0.46,
      );
    upper.push({
      x: point.x + normalX * (halfWidth + offset),
      y: point.y + normalY * (halfWidth + offset),
    });
    lower.push({
      x: point.x - normalX * (opposite - offset),
      y: point.y - normalY * (opposite - offset),
    });
  }

  return [...upper, ...lower.reverse()]
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ")
    .concat("Z");
}

function fragmentedCurve(config, offset, ranges) {
  return ranges
    .map(([start, end]) => {
      const points = [];
      const steps = Math.max(3, Math.round((end - start) * 15));
      for (let step = 0; step <= steps; step += 1) {
        const t = start + ((end - start) * step) / steps;
        const point = pointOnQuadratic(config, t);
        const tangent = tangentOnQuadratic(config, t);
        const length = Math.hypot(tangent.x, tangent.y) || 1;
        const normalX = -tangent.y / length;
        const normalY = tangent.x / length;
        const jitter =
          (noise(
            config.seed + 503 + Math.round(Math.abs(offset) * 2),
            step + Math.round(start * 100),
          ) -
            0.5) *
          Math.max(1.2, config.width * 0.06);
        points.push({
          x: point.x + normalX * (offset + jitter),
          y: point.y + normalY * (offset + jitter),
        });
      }
      return points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
        )
        .join(" ");
    })
    .join(" ");
}

function bristles(config, at, spread, seed, count, reverse = false) {
  const point = pointOnQuadratic(config, at);
  const tangent = tangentOnQuadratic(config, at);
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  const direction = reverse ? -1 : 1;
  const tangentX = (tangent.x / length) * direction;
  const tangentY = (tangent.y / length) * direction;
  const normalX = -tangentY;
  const normalY = tangentX;

  return Array.from({ length: count }, (_, index) => {
    const lane = count === 1 ? 0 : index / (count - 1) - 0.5;
    const offset =
      lane * spread + (noise(seed, index) - 0.5) * spread * 0.16;
    const reach = spread * (0.28 + noise(seed + 7, index) * 0.7);
    const startX = point.x - tangentX * reach + normalX * offset;
    const startY = point.y - tangentY * reach + normalY * offset;
    const endX =
      point.x + tangentX * reach * 0.18 + normalX * offset * 0.8;
    const endY =
      point.y + tangentY * reach * 0.18 + normalY * offset * 0.8;
    return `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${(
      (startX + endX) /
        2 +
      normalX * (noise(seed + 19, index) - 0.5) * spread * 0.12
    ).toFixed(1)} ${(
      (startY + endY) /
        2 +
      normalY * (noise(seed + 19, index) - 0.5) * spread * 0.12
    ).toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }).join(" ");
}

function irregularBlob(cx, cy, radius, seed, count = 11) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    const localRadius = radius * (0.65 + noise(seed, index) * 0.58);
    const x = cx + Math.cos(angle) * localRadius;
    const y = cy + Math.sin(angle) * localRadius;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  })
    .join(" ")
    .concat("Z");
}

function count(map, value) {
  map.set(value, (map.get(value) ?? 0) + 1);
}

function addGroup(config, content) {
  const index = groups.length + 1;
  const id = `hero-stroke-${String(index).padStart(2, "0")}`;
  count(familyCounts, config.family);
  count(originCounts, config.origin);
  count(directionCounts, config.direction);

  groups.push(`<g
    id="${id}"
    class="paint-stroke paint-stroke--${config.family}"
    data-index="${index}"
    data-family="${config.family}"
    data-origin="${config.origin}"
    data-direction="${config.direction}"
    data-depth="${config.depth}"
    data-mobile="${config.mobile}"
    style="--stroke-opacity:${config.opacity ?? 1};opacity:var(--stroke-opacity)"
  >
${content}
  </g>`);
}

function broadBrush(config, index) {
  const ranges = config.entry
    ? [
        [0, 0.27],
        [0.34, 0.58],
        [0.66, 0.84],
        [0.9, 1],
      ]
    : [
        [0, 0.38],
        [0.45, 0.72],
        [0.79, 1],
      ];
  const bodies = ranges
    .map(
      ([start, end], part) =>
        `    <path d="${brushSegment(
          variedCurve(config, 20 + part * 17),
          start,
          end,
          part === 1 ? 1 : 0.78 - part * 0.06,
          config.width * (part % 2 === 0 ? -0.04 : 0.06),
          part * 23,
        )}" fill="${config.fill}" mask="url(#hero-dry-${["a", "b", "c"][(index + part) % 3]})" opacity="${(
          0.94 -
          part * 0.08
        ).toFixed(2)}"${part === 0 ? ` filter="url(#hero-grain)"` : ""} />`,
    )
    .join("\n");
  const fibers = [-0.42, -0.18, 0.12, 0.38]
    .map(
      (offset, fiber) =>
        `    <path d="${fragmentedCurve(
          variedCurve(config, 90 + fiber * 13),
          config.width * offset,
          fiber % 2 === 0
            ? [
                [0.02, 0.22],
                [0.36, 0.57],
                [0.7, 0.86],
                [0.92, 0.99],
              ]
            : [
                [0.08, 0.3],
                [0.45, 0.68],
                [0.8, 0.96],
              ],
        )}" fill="none" stroke="${
          fiber === 1 ? config.highlight : config.fiber
        }" stroke-width="${Math.max(1.4, config.width * (0.032 - fiber * 0.004)).toFixed(
          1,
        )}" stroke-linecap="round" opacity="${(0.58 - fiber * 0.07).toFixed(
          2,
        )}" />`,
    )
    .join("\n");
  return `${bodies}
${fibers}
    <path d="${bristles(
      config,
      0,
      config.width * 0.9,
      config.seed + 300,
      8,
      true,
    )} ${bristles(
      config,
      1,
      config.width * 0.78,
      config.seed + 330,
      9,
    )}" fill="none" stroke="${config.fiber}" stroke-width="${Math.max(
      1.3,
      config.width * 0.015,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.54" />`;
}

function dryBrush(config, index) {
  const body = [
    [0, 0.29, 0.62, -0.12],
    [0.37, 0.64, 0.82, 0.08],
    [0.72, 1, 0.5, -0.18],
  ]
    .map(
      ([start, end, scale, offset], part) =>
        `    <path d="${brushSegment(
          variedCurve(config, 30 + part * 19, 0.52),
          start,
          end,
          scale,
          config.width * offset,
          part * 17,
        )}" fill="${config.fill}" mask="url(#hero-dry-${["a", "b", "c"][(index + part) % 3]})" opacity="${(
          0.74 -
          part * 0.08
        ).toFixed(2)}" />`,
    )
    .join("\n");
  const fibers = [-0.44, -0.12, 0.28]
    .map(
      (offset, fiber) =>
        `    <path d="${fragmentedCurve(
          variedCurve(config, 100 + fiber * 11),
          config.width * offset,
          [
            [0.02, 0.25],
            [0.39, 0.61],
            [0.75, 0.96],
          ],
        )}" fill="none" stroke="${fiber === 1 ? config.fiber : config.fill}" stroke-width="${Math.max(
          1.2,
          config.width * (0.05 - fiber * 0.008),
        ).toFixed(1)}" stroke-linecap="round" opacity="${(0.5 - fiber * 0.08).toFixed(
          2,
        )}" />`,
    )
    .join("\n");
  return `${body}
${fibers}`;
}

function sprayDrag(config) {
  const particles = Array.from({ length: 5 }, (_, index) => {
    const t = 0.12 + index * 0.18;
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / length;
    const normalY = tangent.x / length;
    const offset =
      (noise(config.seed + 31, index) - 0.5) * config.width * 6;
    const radius = 1.8 + noise(config.seed + 47, index) * 4.2;
    return `    <circle cx="${(point.x + normalX * offset).toFixed(
      1,
    )}" cy="${(point.y + normalY * offset).toFixed(1)}" r="${radius.toFixed(
      1,
    )}" fill="${config.color}" opacity="${(
      0.38 +
      noise(config.seed + 59, index) * 0.38
    ).toFixed(2)}" />`;
  }).join("\n");
  return `    <path d="${fragmentedCurve(config, 0, [
    [0, 0.26],
    [0.34, 0.59],
    [0.67, 0.84],
    [0.91, 1],
  ])}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" opacity="0.74" />
    <path d="${fragmentedCurve(
      variedCurve(config, 71),
      config.width * 0.82,
      [
        [0.08, 0.27],
        [0.43, 0.61],
        [0.76, 0.94],
      ],
    )}" fill="none" stroke="${config.companion}" stroke-width="${Math.max(
      1.3,
      config.width * 0.16,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.56" />
${particles}`;
}

function curvedSweep(config) {
  return `    <path d="${fragmentedCurve(config, 0, [
    [0, 0.31],
    [0.38, 0.67],
    [0.75, 1],
  ])}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" opacity="0.78" />
    <path d="${fragmentedCurve(
      variedCurve(config, 43),
      -config.width * 0.46,
      [
        [0.08, 0.27],
        [0.45, 0.62],
        [0.78, 0.94],
      ],
    )}" fill="none" stroke="${config.companion}" stroke-width="${Math.max(
      1.4,
      config.width * 0.12,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.58" />
    <path d="${bristles(
      config,
      config.endBristlesAt ?? 1,
      config.width * 0.72,
      config.seed + 170,
      6,
      config.endBristlesAt === 0,
    )}" fill="none" stroke="${config.color}" stroke-width="${Math.max(
      1.1,
      config.width * 0.035,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.44" />`;
}

function sprayBurst(config) {
  const tangent = tangentOnQuadratic(config, 0.5);
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  const tangentX = tangent.x / length;
  const tangentY = tangent.y / length;
  const particles = Array.from({ length: 5 }, (_, index) => {
    const distance = config.width * (1.4 + index * 0.62);
    const spread =
      (index - 2) * config.width * 0.48 +
      (noise(config.seed + 33, index) - 0.5) * config.width;
    const x = config.cx + tangentX * distance + -tangentY * spread;
    const y = config.cy + tangentY * distance + tangentX * spread;
    return `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(
      2 +
      noise(config.seed + 51, index) * 5
    ).toFixed(1)}" fill="${config.color}" opacity="${(
      0.4 +
      noise(config.seed + 67, index) * 0.42
    ).toFixed(2)}" />`;
  }).join("\n");
  return `    <path d="${brushSegment(config, 0, 0.72, 0.72, 0, 21)}" fill="${config.color}" mask="url(#hero-dry-b)" opacity="0.76" />
    <path d="${fragmentedCurve(config, -config.width * 0.72, [
      [0.06, 0.26],
      [0.38, 0.64],
      [0.76, 0.94],
    ])}" fill="none" stroke="${config.companion}" stroke-width="${Math.max(
      1.3,
      config.width * 0.12,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.62" />
    <path d="${bristles(
      config,
      0.72,
      config.width,
      config.seed + 220,
      7,
    )}" fill="none" stroke="${config.color}" stroke-width="${Math.max(
      1,
      config.width * 0.03,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.5" />
${particles}`;
}

function thinFlick(config) {
  return `    <path d="${fragmentedCurve(config, 0, [
    [0, 0.34],
    [0.43, 0.7],
    [0.79, 1],
  ])}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="round" />
    <path d="${fragmentedCurve(
      variedCurve(config, 39),
      config.width * 2.8,
      [
        [0.12, 0.3],
        [0.49, 0.66],
        [0.84, 0.97],
      ],
    )}" fill="none" stroke="${config.companion}" stroke-width="${Math.max(
      1,
      config.width * 0.34,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.56" />`;
}

function splatter(config) {
  const dots = Array.from({ length: 7 }, (_, index) => {
    const angle = noise(config.seed, index) * Math.PI * 2;
    const distance =
      config.radius * (0.34 + noise(config.seed + 11, index) * 1.18);
    const x = config.cx + Math.cos(angle) * distance;
    const y = config.cy + Math.sin(angle) * distance;
    return `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(
      1.8 +
      noise(config.seed + 21, index) * 6.2
    ).toFixed(1)}" fill="${config.color}" opacity="${(
      0.42 +
      noise(config.seed + 31, index) * 0.42
    ).toFixed(2)}" />`;
  }).join("\n");
  return `    <path d="${irregularBlob(
    config.cx,
    config.cy,
    config.radius * 0.24,
    config.seed,
    13,
  )}" fill="${config.color}" opacity="0.84" />
    <path d="${irregularBlob(
      config.cx + config.radius * 0.48,
      config.cy - config.radius * 0.24,
      config.radius * 0.12,
      config.seed + 5,
      9,
    )}" fill="${config.companion}" opacity="0.68" />
${dots}`;
}

const broadConfigs = [
  {
    family: "broad-brush",
    origin: "left",
    direction: "bottom-left-to-top-right",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.94,
    x1: -260,
    y1: 850,
    cx: 760,
    cy: 730,
    x2: 2160,
    y2: 218,
    width: 150,
    fill: "url(#hero-magenta)",
    highlight: palette.pink,
    fiber: palette.crimson,
    seed: 101,
    entry: true,
  },
  {
    family: "broad-brush",
    origin: "right",
    direction: "top-right-to-bottom-left",
    depth: "midground",
    mobile: "keep",
    opacity: 0.88,
    x1: 2140,
    y1: 250,
    cx: 1240,
    cy: 630,
    x2: -220,
    y2: 728,
    width: 124,
    fill: "url(#hero-blue)",
    highlight: palette.cyan,
    fiber: palette.indigo,
    seed: 102,
  },
  {
    family: "broad-brush",
    origin: "top",
    direction: "curved-clockwise",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.82,
    x1: 860,
    y1: -170,
    cx: 1250,
    cy: 250,
    x2: 1720,
    y2: 702,
    width: 98,
    fill: "url(#hero-cream)",
    highlight: palette.cream,
    fiber: palette.warmCream,
    seed: 103,
  },
  {
    family: "broad-brush",
    origin: "bottom",
    direction: "bottom-left-to-top-right",
    depth: "midground",
    mobile: "keep",
    opacity: 0.82,
    x1: 350,
    y1: 1210,
    cx: 810,
    cy: 650,
    x2: 1250,
    y2: 150,
    width: 112,
    fill: palette.violet,
    highlight: palette.magenta,
    fiber: palette.deepViolet,
    seed: 104,
  },
  {
    family: "broad-brush",
    origin: "left",
    direction: "horizontal",
    depth: "background",
    mobile: "keep",
    opacity: 0.7,
    x1: -250,
    y1: 620,
    cx: 640,
    cy: 528,
    x2: 1460,
    y2: 590,
    width: 126,
    fill: palette.charcoal,
    highlight: palette.burgundy,
    fiber: palette.deepIndigo,
    seed: 105,
  },
  {
    family: "broad-brush",
    origin: "center",
    direction: "short-counter-stroke",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.72,
    x1: 2040,
    y1: 924,
    cx: 1570,
    cy: 764,
    x2: 1120,
    y2: 680,
    width: 86,
    fill: palette.crimson,
    highlight: palette.pink,
    fiber: palette.burgundy,
    seed: 106,
  },
];

const dryConfigs = [
  {
    family: "dry-brush",
    origin: "left",
    direction: "left-to-right",
    depth: "background",
    mobile: "keep",
    opacity: 0.62,
    x1: -170,
    y1: 902,
    cx: 620,
    cy: 840,
    x2: 1440,
    y2: 784,
    width: 72,
    fill: palette.burgundy,
    fiber: palette.crimson,
    seed: 201,
  },
  {
    family: "dry-brush",
    origin: "right",
    direction: "right-to-left",
    depth: "midground",
    mobile: "keep",
    opacity: 0.7,
    x1: 2100,
    y1: 548,
    cx: 1450,
    cy: 500,
    x2: 690,
    y2: 382,
    width: 58,
    fill: palette.inkBlue,
    fiber: palette.cyan,
    seed: 202,
  },
  {
    family: "dry-brush",
    origin: "top",
    direction: "near-vertical",
    depth: "midground",
    mobile: "keep",
    opacity: 0.58,
    x1: 1480,
    y1: -130,
    cx: 1420,
    cy: 420,
    x2: 1370,
    y2: 980,
    width: 52,
    fill: palette.deepIndigo,
    fiber: palette.blue,
    seed: 203,
  },
  {
    family: "dry-brush",
    origin: "bottom",
    direction: "near-vertical",
    depth: "background",
    mobile: "keep",
    opacity: 0.56,
    x1: 680,
    y1: 1190,
    cx: 610,
    cy: 720,
    x2: 590,
    y2: 190,
    width: 50,
    fill: palette.deepViolet,
    fiber: palette.violet,
    seed: 204,
  },
  {
    family: "dry-brush",
    origin: "center",
    direction: "horizontal",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.58,
    x1: 430,
    y1: 360,
    cx: 980,
    cy: 405,
    x2: 1530,
    y2: 352,
    width: 44,
    fill: palette.magenta,
    fiber: palette.pink,
    seed: 205,
  },
];

const sprayDragConfigs = [
  {
    family: "spray-drag",
    origin: "right",
    direction: "curved-counter-clockwise",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.78,
    x1: 2100,
    y1: 760,
    cx: 1490,
    cy: 140,
    x2: 820,
    y2: 430,
    width: 22,
    color: palette.cyan,
    companion: palette.blue,
    seed: 301,
  },
  {
    family: "spray-drag",
    origin: "left",
    direction: "curved-clockwise",
    depth: "midground",
    mobile: "keep",
    opacity: 0.62,
    x1: -170,
    y1: 350,
    cx: 520,
    cy: 90,
    x2: 1100,
    y2: 340,
    width: 17,
    color: palette.magenta,
    companion: palette.violet,
    seed: 302,
  },
  {
    family: "spray-drag",
    origin: "top",
    direction: "top-right-to-bottom-left",
    depth: "midground",
    mobile: "keep",
    opacity: 0.62,
    x1: 1860,
    y1: -120,
    cx: 1420,
    cy: 440,
    x2: 900,
    y2: 920,
    width: 16,
    color: palette.blue,
    companion: palette.cyan,
    seed: 303,
  },
  {
    family: "spray-drag",
    origin: "bottom",
    direction: "bottom-left-to-top-right",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.62,
    x1: 980,
    y1: 1180,
    cx: 1320,
    cy: 720,
    x2: 1880,
    y2: 250,
    width: 14,
    color: palette.red,
    companion: palette.pink,
    seed: 304,
  },
  {
    family: "spray-drag",
    origin: "off-canvas",
    direction: "right-to-left",
    depth: "background",
    mobile: "hide",
    opacity: 0.5,
    x1: 2130,
    y1: 1010,
    cx: 1120,
    cy: 930,
    x2: -210,
    y2: 990,
    width: 13,
    color: palette.indigo,
    companion: palette.deepViolet,
    seed: 305,
  },
];

const curvedConfigs = [
  {
    family: "curved-sweep",
    origin: "top",
    direction: "curved-clockwise",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.76,
    x1: 430,
    y1: -130,
    cx: 260,
    cy: 460,
    x2: 780,
    y2: 810,
    width: 30,
    color: palette.cream,
    companion: palette.warmCream,
    seed: 401,
  },
  {
    family: "curved-sweep",
    origin: "right",
    direction: "curved-counter-clockwise",
    depth: "midground",
    mobile: "keep",
    opacity: 0.68,
    x1: 2110,
    y1: 160,
    cx: 1720,
    cy: 770,
    x2: 1180,
    y2: 920,
    width: 25,
    color: palette.blue,
    companion: palette.cyan,
    seed: 402,
  },
  {
    family: "curved-sweep",
    origin: "bottom",
    direction: "curved-counter-clockwise",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.68,
    x1: 1600,
    y1: 1180,
    cx: 1080,
    cy: 800,
    x2: 1160,
    y2: 300,
    width: 24,
    color: palette.magenta,
    companion: palette.violet,
    seed: 403,
  },
  {
    family: "curved-sweep",
    origin: "left",
    direction: "curved-clockwise",
    depth: "background",
    mobile: "hide",
    opacity: 0.48,
    x1: -140,
    y1: 520,
    cx: 480,
    cy: 920,
    x2: 960,
    y2: 760,
    width: 22,
    color: palette.deepViolet,
    companion: palette.burgundy,
    seed: 404,
  },
];

const burstConfigs = [
  {
    family: "spray-burst",
    origin: "left",
    direction: "left-to-right",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.7,
    x1: -90,
    y1: 720,
    cx: 210,
    cy: 670,
    x2: 470,
    y2: 610,
    width: 42,
    color: palette.crimson,
    companion: palette.magenta,
    seed: 501,
  },
  {
    family: "spray-burst",
    origin: "right",
    direction: "right-to-left",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.72,
    x1: 2010,
    y1: 430,
    cx: 1740,
    cy: 470,
    x2: 1480,
    y2: 520,
    width: 46,
    color: palette.cyan,
    companion: palette.blue,
    seed: 502,
  },
  {
    family: "spray-burst",
    origin: "top",
    direction: "near-vertical",
    depth: "midground",
    mobile: "hide",
    opacity: 0.62,
    x1: 1160,
    y1: -90,
    cx: 1140,
    cy: 180,
    x2: 1090,
    y2: 470,
    width: 38,
    color: palette.violet,
    companion: palette.magenta,
    seed: 503,
  },
  {
    family: "spray-burst",
    origin: "bottom",
    direction: "short-counter-stroke",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.66,
    x1: 1460,
    y1: 1150,
    cx: 1380,
    cy: 900,
    x2: 1280,
    y2: 690,
    width: 40,
    color: palette.red,
    companion: palette.pink,
    seed: 504,
  },
];

const thinConfigs = [
  {
    family: "thin-flick",
    origin: "left",
    direction: "left-to-right",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.64,
    x1: -120,
    y1: 430,
    cx: 700,
    cy: 520,
    x2: 1420,
    y2: 400,
    width: 6,
    color: palette.pink,
    companion: palette.magenta,
    seed: 601,
  },
  {
    family: "thin-flick",
    origin: "right",
    direction: "top-right-to-bottom-left",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.62,
    x1: 2060,
    y1: 160,
    cx: 1640,
    cy: 540,
    x2: 1180,
    y2: 820,
    width: 5,
    color: palette.cream,
    companion: palette.cyan,
    seed: 602,
  },
  {
    family: "thin-flick",
    origin: "center",
    direction: "horizontal",
    depth: "midground",
    mobile: "hide",
    opacity: 0.48,
    x1: 520,
    y1: 930,
    cx: 1050,
    cy: 880,
    x2: 1640,
    y2: 910,
    width: 4,
    color: palette.indigo,
    companion: palette.violet,
    seed: 603,
  },
];

const splatterConfigs = [
  {
    family: "splatter",
    origin: "left",
    direction: "left-to-right",
    depth: "foreground",
    mobile: "keep",
    opacity: 0.72,
    cx: 390,
    cy: 760,
    radius: 86,
    color: palette.magenta,
    companion: palette.crimson,
    seed: 701,
  },
  {
    family: "splatter",
    origin: "right",
    direction: "right-to-left",
    depth: "foreground",
    mobile: "hide",
    opacity: 0.72,
    cx: 1740,
    cy: 520,
    radius: 104,
    color: palette.cyan,
    companion: palette.blue,
    seed: 702,
  },
  {
    family: "splatter",
    origin: "off-canvas",
    direction: "top-right-to-bottom-left",
    depth: "midground",
    mobile: "hide",
    opacity: 0.58,
    cx: 1180,
    cy: 280,
    radius: 78,
    color: palette.violet,
    companion: palette.pink,
    seed: 703,
  },
];

const mistConfigs = [
  {
    family: "mist",
    origin: "center",
    direction: "curved-clockwise",
    depth: "background",
    mobile: "keep",
    opacity: 0.46,
    cx: 930,
    cy: 540,
    rx: 690,
    ry: 260,
    fill: "url(#hero-mist-violet)",
  },
  {
    family: "mist",
    origin: "off-canvas",
    direction: "bottom-left-to-top-right",
    depth: "background",
    mobile: "hide",
    opacity: 0.42,
    cx: 1510,
    cy: 790,
    rx: 620,
    ry: 230,
    fill: "url(#hero-mist-blue)",
  },
];

broadConfigs.forEach((config, index) =>
  addGroup(config, broadBrush(config, index)),
);
dryConfigs.forEach((config, index) =>
  addGroup(config, dryBrush(config, index)),
);
sprayDragConfigs.forEach((config) => addGroup(config, sprayDrag(config)));
curvedConfigs.forEach((config) => addGroup(config, curvedSweep(config)));
burstConfigs.forEach((config) => addGroup(config, sprayBurst(config)));
thinConfigs.forEach((config) => addGroup(config, thinFlick(config)));
splatterConfigs.forEach((config) => addGroup(config, splatter(config)));
mistConfigs.forEach((config) =>
  addGroup(
    config,
    `    <ellipse cx="${config.cx}" cy="${config.cy}" rx="${config.rx}" ry="${config.ry}" fill="${config.fill}" filter="url(#hero-soft-blur)" />`,
  ),
);

const expectedFamilies = {
  "broad-brush": 6,
  "dry-brush": 5,
  "spray-drag": 5,
  "curved-sweep": 4,
  "spray-burst": 4,
  "thin-flick": 3,
  splatter: 3,
  mist: 2,
};

const expectedOrigins = {
  left: 8,
  right: 7,
  top: 5,
  bottom: 5,
  center: 4,
  "off-canvas": 3,
};

const expectedDirections = {
  "left-to-right": 4,
  "right-to-left": 4,
  "bottom-left-to-top-right": 4,
  "top-right-to-bottom-left": 4,
  "curved-clockwise": 5,
  "curved-counter-clockwise": 3,
  horizontal: 3,
  "near-vertical": 3,
  "short-counter-stroke": 2,
};

for (const [family, expected] of Object.entries(expectedFamilies)) {
  if ((familyCounts.get(family) ?? 0) !== expected) {
    throw new Error(`Unexpected ${family} count.`);
  }
}
for (const [origin, expected] of Object.entries(expectedOrigins)) {
  if ((originCounts.get(origin) ?? 0) !== expected) {
    throw new Error(`Unexpected ${origin} origin count.`);
  }
}
for (const [direction, expected] of Object.entries(expectedDirections)) {
  if ((directionCounts.get(direction) ?? 0) !== expected) {
    throw new Error(`Unexpected ${direction} direction count.`);
  }
}
if (groups.length !== 32) {
  throw new Error(`Expected 32 hero groups, received ${groups.length}.`);
}

const heroSvg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1920 1080"
  preserveAspectRatio="xMidYMid slice"
  role="img"
  aria-label="Hibridni hero painterly potezi za Carsystem takeover"
>
  <style>
    .paint-stroke { transform-box: fill-box; transform-origin: center; }
    @media (max-width: 520px) {
      .paint-stroke[data-mobile="hide"] { display: none; }
    }
  </style>
  <defs>
    <linearGradient id="hero-magenta" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0" stop-color="${palette.crimson}" />
      <stop offset=".5" stop-color="${palette.magenta}" />
      <stop offset="1" stop-color="${palette.pink}" />
    </linearGradient>
    <linearGradient id="hero-blue" x1="1" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${palette.cyan}" />
      <stop offset=".46" stop-color="${palette.blue}" />
      <stop offset="1" stop-color="${palette.indigo}" />
    </linearGradient>
    <linearGradient id="hero-cream" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette.cream}" />
      <stop offset=".58" stop-color="${palette.warmCream}" />
      <stop offset="1" stop-color="${palette.pink}" />
    </linearGradient>
    <radialGradient id="hero-mist-violet">
      <stop offset="0" stop-color="${palette.violet}" stop-opacity=".52" />
      <stop offset=".58" stop-color="${palette.deepViolet}" stop-opacity=".16" />
      <stop offset="1" stop-color="${palette.deepViolet}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="hero-mist-blue">
      <stop offset="0" stop-color="${palette.blue}" stop-opacity=".48" />
      <stop offset=".58" stop-color="${palette.deepIndigo}" stop-opacity=".14" />
      <stop offset="1" stop-color="${palette.deepIndigo}" stop-opacity="0" />
    </radialGradient>
    <mask id="hero-dry-a" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .18 C.24 .08 .58 .31 1 .14 M0 .47 C.31 .58 .7 .32 1 .5 M0 .79 C.29 .67 .72 .9 1 .72" fill="none" stroke="black" stroke-width=".065" stroke-linecap="round" />
      <circle cx=".19" cy=".61" r=".04" fill="black" />
      <circle cx=".76" cy=".29" r=".025" fill="black" />
    </mask>
    <mask id="hero-dry-b" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .1 C.22 .3 .55 .06 1 .24 M0 .38 C.34 .18 .72 .52 1 .31 M0 .72 C.39 .87 .7 .55 1 .78" fill="none" stroke="black" stroke-width=".052" stroke-linecap="round" />
      <circle cx=".32" cy=".21" r=".03" fill="black" />
      <circle cx=".86" cy=".63" r=".04" fill="black" />
    </mask>
    <mask id="hero-dry-c" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .26 C.3 .06 .66 .4 1 .17 M0 .55 C.18 .7 .54 .35 1 .61 M0 .84 C.37 .68 .7 .95 1 .74" fill="none" stroke="black" stroke-width=".07" stroke-linecap="round" />
      <circle cx=".43" cy=".3" r=".035" fill="black" />
      <circle cx=".9" cy=".55" r=".024" fill="black" />
    </mask>
    <filter id="hero-soft-blur" x="-18%" y="-28%" width="136%" height="156%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
    <filter id="hero-grain" x="-8%" y="-12%" width="116%" height="124%">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .11" numOctaves="2" seed="17" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
${groups.join("\n")}
</svg>
`;

async function opacityLayer(input, opacity) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rasterWidth}" height="${rasterHeight}"><rect width="100%" height="100%" fill="white" fill-opacity="${opacity}" /></svg>`,
  );
  return sharp(input)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function buildPainterlyBackground() {
  const sourceSvg = await readFile(checkpointSvgPath);
  const baseArtwork = await sharp(sourceSvg, { density: 180 })
    .resize(rasterWidth, rasterHeight, { fit: "cover" })
    .png()
    .toBuffer();
  const counterArtwork = await sharp(baseArtwork)
    .flop()
    .modulate({ brightness: 0.78, saturation: 0.92 })
    .png()
    .toBuffer();
  const verticalArtwork = await sharp(baseArtwork)
    .rotate(78, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(rasterWidth, rasterHeight, { fit: "cover" })
    .modulate({ brightness: 0.68, saturation: 0.82 })
    .png()
    .toBuffer();
  const lowCounterArtwork = await sharp(baseArtwork)
    .rotate(-22, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(rasterWidth, rasterHeight, { fit: "cover" })
    .modulate({ brightness: 0.64, saturation: 1.04 })
    .png()
    .toBuffer();

  const contrastOverlay = Buffer.from(`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${rasterWidth}"
    height="${rasterHeight}"
    viewBox="0 0 ${rasterWidth} ${rasterHeight}"
  >
    <defs>
      <linearGradient id="left-shadow" x1="0" x2="1">
        <stop offset="0" stop-color="#05060b" stop-opacity=".64" />
        <stop offset=".27" stop-color="#080914" stop-opacity=".42" />
        <stop offset=".56" stop-color="#080914" stop-opacity=".08" />
        <stop offset="1" stop-color="#080914" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="center-depth" cx=".58" cy=".48" r=".72">
        <stop offset="0" stop-color="#6c28ff" stop-opacity=".08" />
        <stop offset=".55" stop-color="#17122f" stop-opacity=".04" />
        <stop offset="1" stop-color="#030409" stop-opacity=".36" />
      </radialGradient>
      <linearGradient id="vertical-depth" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#05060b" stop-opacity=".12" />
        <stop offset=".5" stop-color="#05060b" stop-opacity="0" />
        <stop offset="1" stop-color="#05060b" stop-opacity=".28" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#left-shadow)" />
    <rect width="100%" height="100%" fill="url(#center-depth)" />
    <rect width="100%" height="100%" fill="url(#vertical-depth)" />
  </svg>`);

  const flattened = await sharp({
    create: {
      width: rasterWidth,
      height: rasterHeight,
      channels: 4,
      background: palette.canvas,
    },
  })
    .composite([
      { input: await opacityLayer(baseArtwork, 0.56), blend: "screen" },
      {
        input: await opacityLayer(counterArtwork, 0.42),
        blend: "screen",
      },
      {
        input: await opacityLayer(verticalArtwork, 0.26),
        blend: "screen",
      },
      {
        input: await opacityLayer(lowCounterArtwork, 0.18),
        blend: "screen",
      },
      { input: contrastOverlay, blend: "over" },
    ])
    .removeAlpha()
    .png()
    .toBuffer();

  let avifQuality = 56;
  let avifBuffer = await sharp(flattened)
    .avif({ quality: avifQuality, effort: 7, chromaSubsampling: "4:2:0" })
    .toBuffer();
  while (avifBuffer.byteLength > 350_000 && avifQuality > 38) {
    avifQuality -= 4;
    avifBuffer = await sharp(flattened)
      .avif({ quality: avifQuality, effort: 7, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  let webpQuality = 76;
  let webpBuffer = await sharp(flattened)
    .webp({ quality: webpQuality, effort: 6, smartSubsample: true })
    .toBuffer();
  while (webpBuffer.byteLength > 600_000 && webpQuality > 58) {
    webpQuality -= 4;
    webpBuffer = await sharp(flattened)
      .webp({ quality: webpQuality, effort: 6, smartSubsample: true })
      .toBuffer();
  }

  await Promise.all([
    writeFile(avifPath, avifBuffer),
    writeFile(webpPath, webpBuffer),
  ]);

  return {
    avifBytes: avifBuffer.byteLength,
    avifQuality,
    webpBytes: webpBuffer.byteLength,
    webpQuality,
  };
}

await mkdir(artDirectory, { recursive: true });
await writeFile(heroSvgPath, heroSvg);
const backgroundStats = await buildPainterlyBackground();
const heroStats = await stat(heroSvgPath);

console.log(
  JSON.stringify(
    {
      heroSvgPath,
      heroBytes: heroStats.size,
      groups: groups.length,
      familyDistribution: Object.fromEntries(familyCounts),
      originDistribution: Object.fromEntries(originCounts),
      directionDistribution: Object.fromEntries(directionCounts),
      mobileKeep: groups.filter((group) =>
        group.includes('data-mobile="keep"'),
      ).length,
      background: {
        width: rasterWidth,
        height: rasterHeight,
        ...backgroundStats,
      },
    },
    null,
    2,
  ),
);
