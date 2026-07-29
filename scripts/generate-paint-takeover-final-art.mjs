import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(
  projectRoot,
  "public/art/paint-takeover/paint-takeover.svg",
);

const palette = {
  black: "#09090b",
  charcoal: "#15151a",
  red: "#e51b2a",
  crimson: "#b80924",
  burgundy: "#541128",
  magenta: "#f50087",
  pink: "#ff3ba7",
  violet: "#6c28ff",
  deepViolet: "#2e1558",
  indigo: "#3325d7",
  deepIndigo: "#181b53",
  blue: "#0878ff",
  inkBlue: "#10284f",
  cyan: "#00c8e8",
  lime: "#9eea20",
  white: "#f4f1eb",
  warmWhite: "#d9d2c7",
};

const familyMobilePlan = {
  "broad-brush": { keep: 14, optional: 0 },
  "dry-brush": { keep: 10, optional: 3 },
  "curved-sweep": { keep: 8, optional: 4 },
  "spray-drag": { keep: 5, optional: 5 },
  "spray-cloud": { keep: 4, optional: 4 },
  "spray-burst": { keep: 3, optional: 4 },
  "paint-block": { keep: 2, optional: 4 },
  "thin-flick": { keep: 0, optional: 3 },
  scratch: { keep: 0, optional: 3 },
  splatter: { keep: 0, optional: 2 },
  mist: { keep: 4, optional: 0 },
};

const groups = [];
const familyCounts = new Map();
let optionalCount = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
    x: 2 * (1 - t) * (config.cx - config.x1) + 2 * t * (config.x2 - config.cx),
    y: 2 * (1 - t) * (config.cy - config.y1) + 2 * t * (config.y2 - config.cy),
  };
}

function brushPolygonSegment(
  config,
  start = 0,
  end = 1,
  widthScale = 1,
  offset = 0,
  seedOffset = 0,
) {
  const upper = [];
  const lower = [];
  const steps = Math.max(
    9,
    Math.round((config.steps ?? 34) * Math.max(0.28, end - start)),
  );

  for (let step = 0; step <= steps; step += 1) {
    const localT = step / steps;
    const t = start + (end - start) * localT;
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / length;
    const normalY = tangent.x / length;
    const taper =
      0.42 + Math.pow(Math.sin(Math.PI * localT), 0.72) * 0.58;
    const widthPulse =
      0.88 +
      noise(config.seed + 71 + seedOffset, step) * 0.14 +
      Math.sin((localT * 3.2 + noise(config.seed + seedOffset, 90)) * Math.PI) *
        0.05;
    const smoothEdgeNoise =
      (noise(config.seed + seedOffset, Math.max(0, step - 1)) +
        noise(config.seed + seedOffset, step) * 2 +
        noise(config.seed + seedOffset, step + 1)) /
        4 -
      0.5;
    const smoothOppositeNoise =
      (noise(config.seed + 17 + seedOffset, Math.max(0, step - 1)) +
        noise(config.seed + 17 + seedOffset, step) * 2 +
        noise(config.seed + 17 + seedOffset, step + 1)) /
        4 -
      0.5;
    const endFray =
      localT < 0.16 || localT > 0.84
        ? (noise(config.seed + 39 + seedOffset, step) - 0.44) *
          config.width *
          0.14
        : 0;
    const edgeNoise =
      smoothEdgeNoise * config.width * 0.3 + endFray;
    const oppositeNoise =
      smoothOppositeNoise * config.width * 0.27 -
      endFray * 0.56;
    const halfWidth =
      (config.width * widthScale * taper * widthPulse) / 2;
    const minimumEdge = config.width * widthScale * 0.07;
    const upperDistance = Math.max(minimumEdge, halfWidth + edgeNoise);
    const lowerDistance = Math.max(minimumEdge, halfWidth + oppositeNoise);

    upper.push({
      x: point.x + normalX * (upperDistance + offset),
      y: point.y + normalY * (upperDistance + offset),
    });
    lower.push({
      x: point.x - normalX * (lowerDistance - offset),
      y: point.y - normalY * (lowerDistance - offset),
    });
  }

  const points = [...upper, ...lower.reverse()];
  return `${points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ")}Z`;
}

function varyCurve(config, seedOffset, bendScale = 1) {
  const bend = config.width * bendScale;
  return {
    ...config,
    cx:
      config.cx +
      (noise(config.seed + seedOffset, 1) - 0.5) * bend * 1.8,
    cy:
      config.cy +
      (noise(config.seed + seedOffset, 2) - 0.5) * bend * 2.2,
    x2:
      config.x2 +
      (noise(config.seed + seedOffset, 3) - 0.5) * bend * 0.42,
    y2:
      config.y2 +
      (noise(config.seed + seedOffset, 4) - 0.5) * bend * 0.72,
    seed: config.seed + seedOffset * 13,
  };
}

function bristleTailPath(
  config,
  t,
  spread,
  seed,
  count,
  reverse = false,
) {
  const point = pointOnQuadratic(config, t);
  const tangent = tangentOnQuadratic(config, t);
  const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
  const direction = reverse ? -1 : 1;
  const tangentX = (tangent.x / tangentLength) * direction;
  const tangentY = (tangent.y / tangentLength) * direction;
  const normalX = -tangentY;
  const normalY = tangentX;

  return Array.from({ length: count }, (_, bristleIndex) => {
    const lane =
      count === 1 ? 0 : bristleIndex / (count - 1) - 0.5;
    const offset =
      lane * spread * 0.88 +
      (noise(seed, bristleIndex) - 0.5) * spread * 0.18;
    const reach =
      spread *
      (0.26 + Math.pow(noise(seed + 11, bristleIndex), 1.4) * 0.74);
    const startX =
      point.x -
      tangentX * reach * (0.62 + noise(seed + 19, bristleIndex) * 0.26) +
      normalX * offset;
    const startY =
      point.y -
      tangentY * reach * (0.62 + noise(seed + 19, bristleIndex) * 0.26) +
      normalY * offset;
    const endX =
      point.x +
      tangentX * reach * (0.08 + noise(seed + 27, bristleIndex) * 0.18) +
      normalX * offset * 0.82;
    const endY =
      point.y +
      tangentY * reach * (0.08 + noise(seed + 27, bristleIndex) * 0.18) +
      normalY * offset * 0.82;
    const controlX =
      (startX + endX) / 2 +
      normalX * (noise(seed + 35, bristleIndex) - 0.5) * spread * 0.12;
    const controlY =
      (startY + endY) / 2 +
      normalY * (noise(seed + 35, bristleIndex) - 0.5) * spread * 0.12;
    return `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }).join(" ");
}

function fragmentedCurve(config, offset, ranges) {
  return ranges
    .map(([start, end]) => {
      const points = [];
      const segmentSteps = Math.max(3, Math.round((end - start) * 16));

      for (let step = 0; step <= segmentSteps; step += 1) {
        const t = start + ((end - start) * step) / segmentSteps;
        const point = pointOnQuadratic(config, t);
        const tangent = tangentOnQuadratic(config, t);
        const length = Math.hypot(tangent.x, tangent.y) || 1;
        const normalX = -tangent.y / length;
        const normalY = tangent.x / length;
        const localJitter =
          (noise(
            config.seed + 503 + Math.round(Math.abs(offset) * 3),
            step + Math.round(start * 100),
          ) -
            0.5) *
          Math.max(1.4, config.width * 0.065);
        points.push({
          x: point.x + normalX * (offset + localJitter),
          y: point.y + normalY * (offset + localJitter),
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

function irregularBlob(cx, cy, radius, seed, points = 12) {
  const result = [];
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points;
    const localRadius = radius * (0.68 + noise(seed, index) * 0.52);
    result.push({
      x: cx + Math.cos(angle) * localRadius,
      y: cy + Math.sin(angle) * localRadius,
    });
  }
  return `${result
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ")}Z`;
}

function mobileModeFor(family, familyIndex) {
  const plan = familyMobilePlan[family];
  if (familyIndex <= plan.keep) return "keep";
  if (familyIndex <= plan.keep + plan.optional) return "optional";
  return "hide";
}

function addGroup({
  family,
  depth,
  direction,
  textZone,
  content,
  opacity = 1,
  mixBlendMode,
  mobileOverride,
  extraClass,
}) {
  const familyIndex = (familyCounts.get(family) ?? 0) + 1;
  familyCounts.set(family, familyIndex);

  const mobile = mobileOverride ?? mobileModeFor(family, familyIndex);
  const isSecondaryOptional = mobile === "optional" && optionalCount++ >= 16;
  const index = groups.length + 1;
  const id = `paint-stroke-${String(index).padStart(3, "0")}`;
  const classes = [
    "paint-stroke",
    `paint-stroke--${family}`,
    extraClass,
    isSecondaryOptional ? "paint-stroke--mobile-secondary" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = [
    opacity !== 1 ? `opacity:${opacity}` : "",
    mixBlendMode ? `mix-blend-mode:${mixBlendMode}` : "",
  ]
    .filter(Boolean)
    .join(";");

  groups.push(`<g
    id="${id}"
    class="${classes}"
    data-index="${index}"
    data-family="${family}"
    data-depth="${depth}"
    data-direction="${direction}"
    data-mobile="${mobile}"
    data-text-zone="${textZone}"${style ? ` style="${style}"` : ""}
  >
${content}
  </g>`);
}

function broadBrushContent(config, index) {
  const bodyFragments = [
    [0, 0.68, 0.9, 0, 11, 0.92],
    [0.12, 0.88, 0.72, -0.03, 23, 0.84],
    [0.38, 1, 0.54, 0.045, 37, 0.76],
  ]
    .map(([start, end, widthScale, offsetRatio, seedOffset, opacity], partIndex) => {
      const mask = `paint-dry-mask-${String.fromCharCode(
        97 + ((index + partIndex) % 3),
      )}`;
      return `    <path d="${brushPolygonSegment(
        varyCurve(config, seedOffset, 0.34),
        start,
        end,
        widthScale,
        config.width * offsetRatio,
        seedOffset,
      )}" fill="${config.fill}" opacity="${opacity}" mask="url(#${mask})"${partIndex === 0 ? ` filter="url(#paint-grain)"` : ""} />`;
    })
    .join("\n");

  const fiberOffsets = [0.5, 0.34, 0.18, -0.16, -0.34, -0.5];
  const fibers = fiberOffsets
    .map((offsetRatio, fiberIndex) => {
      const fiberConfig = varyCurve(config, 70 + fiberIndex * 7, 0.5);
      const ranges =
        fiberIndex % 3 === 0
          ? [
              [0.01, 0.2],
              [0.28, 0.47],
              [0.59, 0.76],
              [0.86, 0.99],
            ]
          : fiberIndex % 3 === 1
            ? [
                [0.07, 0.32],
                [0.39, 0.64],
                [0.72, 0.91],
              ]
            : [
                [0.02, 0.14],
                [0.22, 0.56],
                [0.66, 0.82],
                [0.9, 0.98],
              ];
      const color =
        fiberIndex === 2 || fiberIndex === 6
          ? config.highlight
          : config.fiber;
      const width = Math.max(
        1.2,
        config.width * (0.036 - fiberIndex * 0.0024),
      );
      return `    <path d="${fragmentedCurve(
        fiberConfig,
        config.width * offsetRatio,
        ranges,
      )}" fill="none" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="${(0.5 - fiberIndex * 0.035).toFixed(2)}" />`;
    })
    .join("\n");
  const bristleEnds = [
    bristleTailPath(config, 0, config.width * 0.78, config.seed + 610, 5, true),
    bristleTailPath(config, 0.68, config.width * 0.72, config.seed + 640, 6),
    bristleTailPath(config, 1, config.width * 0.58, config.seed + 670, 7),
  ].join(" ");

  return `${bodyFragments}
${fibers}
    <path d="${bristleEnds}" fill="none" stroke="${config.fiber}" stroke-width="${Math.max(1.2, config.width * 0.014).toFixed(1)}" stroke-linecap="round" opacity="0.42" />`;
}

function entryBrushContent(config) {
  const bodyRanges = [
    [0, 0.27, 0.86, -0.06, 100, 0.9],
    [0.33, 0.59, 1, 0.02, 117, 0.96],
    [0.65, 0.84, 0.8, -0.04, 139, 0.86],
    [0.9, 1, 0.58, 0.08, 157, 0.76],
  ];
  const body = bodyRanges
    .map(
      ([start, end, widthScale, offsetRatio, seedOffset, opacity], index) =>
        `    <path d="${brushPolygonSegment(
          varyCurve(config, seedOffset, 0.32),
          start,
          end,
          widthScale,
          config.width * offsetRatio,
          seedOffset,
        )}" fill="${config.fill}" opacity="${opacity}" mask="url(#paint-dry-mask-${["b", "a", "c", "b"][index]})"${index === 1 ? ` filter="url(#paint-grain)"` : ""} />`,
    )
    .join("\n");

  const fiberRanges = [
    [
      [0.01, 0.22],
      [0.35, 0.55],
      [0.67, 0.81],
      [0.92, 0.995],
    ],
    [
      [0.06, 0.25],
      [0.36, 0.58],
      [0.69, 0.86],
    ],
    [
      [0.02, 0.18],
      [0.4, 0.56],
      [0.65, 0.78],
      [0.91, 0.98],
    ],
  ];
  const fibers = [-0.46, -0.3, -0.14, 0.12, 0.28, 0.46]
    .map((offsetRatio, index) => {
      const width = Math.max(1.4, config.width * (0.032 - index * 0.0028));
      return `    <path d="${fragmentedCurve(
        varyCurve(config, 220 + index * 13, 0.44),
        config.width * offsetRatio,
        fiberRanges[index % fiberRanges.length],
      )}" fill="none" stroke="${
        index === 1 || index === 4 ? config.highlight : config.fiber
      }" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="${(
        0.62 -
        index * 0.055
      ).toFixed(2)}" />`;
    })
    .join("\n");

  const bristles = [
    bristleTailPath(config, 0, config.width * 0.94, config.seed + 710, 9, true),
    bristleTailPath(config, 0.58, config.width * 0.72, config.seed + 740, 7),
    bristleTailPath(config, 0.84, config.width * 0.64, config.seed + 760, 7),
    bristleTailPath(config, 1, config.width * 0.76, config.seed + 790, 10),
  ].join(" ");

  const overspray = Array.from({ length: 22 }, (_, index) => {
    const t = clamp(
      0.02 + index * 0.047 + (noise(config.seed + 820, index) - 0.5) * 0.036,
      0,
      1,
    );
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / tangentLength;
    const normalY = tangent.x / tangentLength;
    const offset =
      (noise(config.seed + 850, index) - 0.5) * config.width * 2.4;
    const radius = 1.2 + Math.pow(noise(config.seed + 880, index), 1.7) * 5.8;
    const x = point.x + normalX * offset;
    const y = point.y + normalY * offset;
    const opacity = (0.3 + noise(config.seed + 910, index) * 0.48).toFixed(2);
    return index % 5 === 0
      ? `    <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(
          radius * 2.8
        ).toFixed(1)}" ry="${Math.max(0.8, radius * 0.34).toFixed(
          1,
        )}" fill="${index % 10 === 0 ? config.highlight : config.fiber}" opacity="${opacity}" transform="rotate(-14 ${x.toFixed(1)} ${y.toFixed(1)})" />`
      : `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(
          1,
        )}" r="${radius.toFixed(1)}" fill="${
          index % 4 === 0 ? config.highlight : config.fiber
        }" opacity="${opacity}" />`;
  }).join("\n");

  return `${body}
${fibers}
    <path d="${bristles}" fill="none" stroke="${config.fiber}" stroke-width="${Math.max(
      1.4,
      config.width * 0.015,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.58" />
${overspray}`;
}

function dryAccentContent(config, maskOffset = 0) {
  const fragments = [
    [0, 0.31, 0.64, -0.14, 13, 0.72],
    [0.37, 0.65, 0.82, 0.05, 29, 0.66],
    [0.72, 1, 0.48, -0.2, 47, 0.54],
  ]
    .map(
      ([start, end, widthScale, offsetRatio, seedOffset, opacity], index) =>
        `    <path d="${brushPolygonSegment(
          varyCurve(config, seedOffset, 0.5),
          start,
          end,
          widthScale,
          config.width * offsetRatio,
          seedOffset,
        )}" fill="${config.fill}" opacity="${opacity}" mask="url(#paint-dry-mask-${
          ["a", "b", "c"][(maskOffset + index) % 3]
        })" />`,
    )
    .join("\n");
  const ranges = [
    [0.02, 0.24],
    [0.38, 0.62],
    [0.74, 0.96],
  ];
  const fibers = [-0.48, -0.27, -0.08, 0.16, 0.39]
    .map(
      (offset, index) =>
        `    <path d="${fragmentedCurve(
          varyCurve(config, 80 + index * 11, 0.5),
          config.width * offset,
          ranges,
        )}" fill="none" stroke="${
          index === 2 ? config.fiber : config.fill
        }" stroke-width="${Math.max(
          1,
          config.width * (0.055 - index * 0.006),
        ).toFixed(1)}" stroke-linecap="round" opacity="${(
          0.54 -
          index * 0.055
        ).toFixed(2)}" />`,
    )
    .join("\n");
  return `${fragments}
${fibers}`;
}

function sprayDragAccentContent(config) {
  const drag = fragmentedCurve(config, 0, [
    [0, 0.24],
    [0.31, 0.57],
    [0.64, 0.84],
    [0.91, 1],
  ]);
  const particles = Array.from({ length: 12 }, (_, index) => {
    const t = clamp(
      0.04 + index * 0.083 + (noise(config.seed + 13, index) - 0.5) * 0.04,
      0,
      1,
    );
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / tangentLength;
    const normalY = tangent.x / tangentLength;
    const offset =
      (noise(config.seed + 31, index) - 0.5) * config.width * 5.8;
    const radius = 1.1 + noise(config.seed + 47, index) * 4.6;
    return `    <circle cx="${(point.x + normalX * offset).toFixed(
      1,
    )}" cy="${(point.y + normalY * offset).toFixed(1)}" r="${radius.toFixed(
      1,
    )}" fill="${config.color}" opacity="${(
      0.28 +
      noise(config.seed + 61, index) * 0.44
    ).toFixed(2)}" />`;
  }).join("\n");

  return `    <path d="${drag}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" opacity="0.66" />
    <path d="${fragmentedCurve(
      varyCurve(config, 73, 0.46),
      config.width * 0.82,
      [
        [0.06, 0.21],
        [0.39, 0.55],
        [0.7, 0.9],
      ],
    )}" fill="none" stroke="${config.companion ?? config.color}" stroke-width="${Math.max(
      1.2,
      config.width * 0.17,
    ).toFixed(1)}" stroke-linecap="round" opacity="0.54" />
${particles}`;
}

const mistConfigs = [
  { cx: 920, cy: 300, rx: 980, ry: 340, fill: "url(#paint-mist-violet)", opacity: 0.46 },
  { cx: 980, cy: 760, rx: 980, ry: 320, fill: "url(#paint-mist-magenta)", opacity: 0.38 },
  { cx: 1540, cy: 710, rx: 760, ry: 260, fill: "url(#paint-mist-blue)", opacity: 0.44 },
  { cx: 420, cy: 900, rx: 820, ry: 280, fill: "url(#paint-mist-crimson)", opacity: 0.4 },
];

mistConfigs.forEach((config, index) => {
  addGroup({
    family: "mist",
    depth: "background",
    direction: index % 2 === 0 ? "left-to-right" : "right-to-left",
    textZone: index === 0 || index === 3 ? "low-contrast" : "avoid",
    opacity: config.opacity,
    mixBlendMode: "screen",
    content: `    <ellipse cx="${config.cx}" cy="${config.cy}" rx="${config.rx}" ry="${config.ry}" fill="${config.fill}" filter="url(#paint-soft-blur)" />`,
  });
});

const cloudConfigs = [
  [180, 570, 430, 190, "violet", 0.42, "low-contrast"],
  [560, 760, 470, 210, "crimson", 0.4, "low-contrast"],
  [1080, 590, 390, 200, "blue", 0.48, "avoid"],
  [1620, 700, 410, 230, "cyan", 0.46, "avoid"],
  [1810, 430, 280, 160, "magenta", 0.54, "avoid"],
  [1450, 890, 350, 140, "crimson", 0.42, "avoid"],
  [720, 360, 330, 150, "violet", 0.34, "low-contrast"],
  [1990, 820, 330, 180, "blue", 0.44, "avoid"],
  [540, 980, 320, 150, "crimson", 0.34, "low-contrast"],
  [1760, 190, 250, 120, "cyan", 0.34, "avoid"],
];

cloudConfigs.forEach(([cx, cy, rx, ry, color, opacity, textZone], cloudIndex) => {
  const particles = Array.from({ length: 9 }, (_, particleIndex) => {
    const angle = noise(cloudIndex + 21, particleIndex) * Math.PI * 2;
    const radialNoise = noise(cloudIndex + 31, particleIndex);
    const distance =
      (0.08 + Math.pow(radialNoise, 1.75) * 1.16) * rx;
    const particleX = cx + Math.cos(angle) * distance;
    const particleY = cy + Math.sin(angle) * distance * 0.58;
    const radius =
      1.4 + Math.pow(noise(cloudIndex + 41, particleIndex), 1.35) * 8.6;
    const particleOpacity = (
      0.2 +
      noise(cloudIndex + 51, particleIndex) * 0.42
    ).toFixed(2);

    if (particleIndex % 4 === 0) {
      return `    <ellipse cx="${particleX.toFixed(1)}" cy="${particleY.toFixed(1)}" rx="${(radius * 2.2).toFixed(1)}" ry="${(radius * 0.38).toFixed(1)}" fill="${palette[color]}" opacity="${particleOpacity}" transform="rotate(${Math.round((angle * 180) / Math.PI + 22)} ${particleX.toFixed(1)} ${particleY.toFixed(1)})" />`;
    }
    if (particleIndex % 5 === 0) {
      return `    <path d="${irregularBlob(
        particleX,
        particleY,
        radius * 1.25,
        cloudIndex * 100 + particleIndex,
        9,
      )}" fill="${palette[color]}" opacity="${particleOpacity}" />`;
    }
    return `    <circle cx="${particleX.toFixed(1)}" cy="${particleY.toFixed(1)}" r="${radius.toFixed(1)}" fill="${palette[color]}" opacity="${particleOpacity}" />`;
  }).join("\n");

  addGroup({
    family: "spray-cloud",
    depth: cloudIndex < 5 ? "background" : "midground",
    direction: cloudIndex % 2 === 0 ? "edge-in" : "radial-drift",
    textZone,
    content: `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#paint-cloud-${color})" opacity="${opacity}" filter="url(#paint-soft-blur)" mask="url(#paint-spray-mask-${cloudIndex % 2 === 0 ? "a" : "b"})" />
${particles}`,
  });
});

const broadConfigs = [
  [-220, 700, 470, 590, 1420, 650, 190, palette.deepViolet, palette.violet, palette.magenta, 101, 0.12, 0.72],
  [590, 850, 1320, 520, 2080, 168, 122, "url(#paint-gradient-magenta)", palette.pink, palette.white, 102, 0.22],
  [-220, 930, 600, 810, 1660, 820, 170, palette.burgundy, palette.crimson, palette.magenta, 103, 0.12, 0.68],
  [750, 1040, 1430, 790, 2100, 612, 82, "url(#paint-gradient-cream)", palette.white, palette.warmWhite, 104, 0.16, 0.5],
  [760, 500, 1400, 300, 2120, 112, 118, "url(#paint-gradient-blue)", palette.blue, palette.cyan, 105, 0.22],
  [-220, 420, 320, 360, 1120, 440, 140, palette.deepIndigo, palette.indigo, palette.blue, 106, 0.11, 0.72],
  [720, 790, 1410, 660, 2140, 492, 78, palette.pink, palette.magenta, palette.white, 107, 0.24],
  [-180, 190, 820, 130, 2120, 220, 86, palette.deepIndigo, palette.indigo, palette.blue, 108, 0.12, 0.66],
  [940, 1000, 1480, 930, 2120, 832, 58, palette.cyan, palette.blue, palette.white, 109, 0.2],
  [-220, 1070, 450, 930, 1280, 1040, 120, palette.crimson, palette.red, palette.pink, 110, 0.12, 0.64],
  [630, 1110, 1240, 990, 2070, 900, 94, palette.violet, palette.indigo, palette.pink, 111, 0.24],
  [880, 690, 1510, 346, 2110, 286, 56, palette.white, palette.warmWhite, palette.pink, 112, 0.16, 0.58],
  [-220, 560, 400, 520, 1260, 610, 105, palette.burgundy, palette.deepViolet, palette.violet, 113, 0.1, 0.62],
  [1040, 990, 1630, 810, 2120, 716, 66, palette.magenta, palette.crimson, palette.pink, 114, 0.26],
].map(
  ([
    x1,
    y1,
    cx,
    cy,
    x2,
    y2,
    width,
    fill,
    highlight,
    fiber,
    seed,
    highlightOpacity,
    groupOpacity,
  ]) => ({
    x1,
    y1,
    cx,
    cy,
    x2,
    y2,
    width,
    fill,
    highlight,
    fiber,
    seed,
    highlightOpacity,
    groupOpacity,
  }),
);

broadConfigs.forEach((config, index) => {
  addGroup({
    family: "broad-brush",
    depth: index < 6 ? "background" : index < 11 ? "midground" : "foreground",
    direction:
      Math.abs(config.x2 - config.x1) > Math.abs(config.y2 - config.y1)
        ? config.x2 > config.x1
          ? "left-to-right"
          : "right-to-left"
        : config.y2 > config.y1
          ? "top-to-bottom"
          : "bottom-to-top",
    textZone: index === 0 || index === 5 || index === 9 || index === 12 ? "low-contrast" : "avoid",
    opacity: config.groupOpacity ?? 0.84,
    content: broadBrushContent(config, index),
  });
});

const blockConfigs = [
  [300, 610, 520, 156, -8, palette.burgundy, 0.52],
  [760, 760, 560, 156, -16, palette.deepIndigo, 0.58],
  [620, 410, 440, 118, -18, palette.deepViolet, 0.54],
  [1540, 540, 470, 142, -12, palette.white, 0.6],
  [930, 870, 360, 104, 7, palette.red, 0.62],
  [1690, 820, 390, 126, -8, palette.blue, 0.72],
  [1450, 220, 330, 84, -20, palette.violet, 0.62],
  [1880, 620, 340, 100, -24, palette.pink, 0.68],
];

blockConfigs.forEach(([cx, cy, width, height, rotation, fill, opacity], index) => {
  const angle = (rotation * Math.PI) / 180;
  const tangentX = Math.cos(angle);
  const tangentY = Math.sin(angle);
  const normalX = -tangentY;
  const normalY = tangentX;
  const halfWidth = width / 2;
  const shortPull = {
    x1: cx - tangentX * halfWidth,
    y1: cy - tangentY * halfWidth,
    cx:
      cx +
      normalX *
        height *
        (0.12 + (noise(220, index) - 0.5) * 0.22),
    cy:
      cy +
      normalY *
        height *
        (0.12 + (noise(221, index) - 0.5) * 0.22),
    x2: cx + tangentX * halfWidth,
    y2: cy + tangentY * halfWidth,
    width: height,
    seed: 230 + index * 17,
  };
  const pullParts = [
    [0, 0.7, 1, -0.08, 3, 0.9],
    [0.2, 1, 0.72, 0.14, 9, 0.78],
    [0.06, 0.48, 0.4, -0.32, 15, 0.56],
  ]
    .map(([start, end, widthScale, offsetRatio, seedOffset, partOpacity], partIndex) => {
      const mask = `paint-dry-mask-${String.fromCharCode(
        97 + ((index + partIndex) % 3),
      )}`;
      return `    <path d="${brushPolygonSegment(
        varyCurve(shortPull, seedOffset, 0.28),
        start,
        end,
        widthScale,
        height * offsetRatio,
        seedOffset,
      )}" fill="${fill}" opacity="${partOpacity}" mask="url(#${mask})"${partIndex === 0 ? ` filter="url(#paint-grain)"` : ""} />`;
    })
    .join("\n");
  const pullFibers = [-0.42, 0.36]
    .map((offsetRatio, fiberIndex) => {
      const fiberConfig = varyCurve(shortPull, 30 + fiberIndex * 11, 0.38);
      return `    <path d="${fragmentedCurve(
        fiberConfig,
        height * offsetRatio,
        fiberIndex % 2 === 0
          ? [
              [0.04, 0.3],
              [0.39, 0.62],
              [0.74, 0.94],
            ]
          : [
              [0.12, 0.44],
              [0.54, 0.82],
            ],
      )}" fill="none" stroke="${fill === palette.white ? palette.warmWhite : fill}" stroke-width="${Math.max(1.5, height * (0.034 - fiberIndex * 0.004)).toFixed(1)}" stroke-linecap="round" opacity="${(0.52 - fiberIndex * 0.07).toFixed(2)}" />`;
    })
    .join("\n");
  const blockBristles = [
    bristleTailPath(
      shortPull,
      0,
      height * 0.74,
      shortPull.seed + 80,
      4,
      true,
    ),
    bristleTailPath(
      shortPull,
      1,
      height * 0.62,
      shortPull.seed + 110,
      6,
    ),
  ].join(" ");

  addGroup({
    family: "paint-block",
    depth: index < 3 ? "background" : "midground",
    direction: rotation < 0 ? "right-to-left" : "left-to-right",
    textZone: index < 3 ? "low-contrast" : "avoid",
    opacity,
    content: `${pullParts}
${pullFibers}
    <path d="${blockBristles}" fill="none" stroke="${fill === palette.white ? palette.warmWhite : fill}" stroke-width="${Math.max(1.2, height * 0.014).toFixed(1)}" stroke-linecap="round" opacity="0.42" />`,
  });
});

const dryConfigs = [
  [-180, 650, 420, 520, 1280, 560, 80, palette.deepViolet, palette.violet, 301],
  [-120, 820, 520, 700, 1450, 760, 58, palette.burgundy, palette.crimson, 302],
  [-100, 460, 500, 380, 1250, 450, 44, palette.inkBlue, palette.indigo, 303],
  [520, 750, 1440, 570, 2110, 420, 48, palette.blue, palette.cyan, 304],
  [610, 930, 1260, 850, 1980, 810, 50, palette.crimson, palette.red, 305],
  [980, 980, 1540, 830, 2110, 690, 42, palette.white, palette.warmWhite, 306],
  [1180, 170, 1610, 290, 2080, 520, 46, palette.violet, palette.indigo, 307],
  [860, 450, 1380, 420, 1940, 500, 32, palette.cyan, palette.blue, 308],
  [1260, 1100, 1570, 770, 1740, -80, 34, palette.magenta, palette.pink, 309],
  [1440, -90, 1580, 420, 2060, 900, 30, palette.blue, palette.cyan, 310],
  [280, 1040, 760, 930, 1280, 900, 28, palette.violet, palette.indigo, 311],
  [1420, 460, 1780, 310, 2110, 290, 26, palette.white, palette.warmWhite, 312],
  [1160, 830, 1600, 720, 2020, 610, 24, palette.red, palette.pink, 313],
].map(([x1, y1, cx, cy, x2, y2, width, fill, fiber, seed]) => ({
  x1,
  y1,
  cx,
  cy,
  x2,
  y2,
  width,
  fill,
  fiber,
  seed,
}));

dryConfigs.forEach((config, index) => {
  const ranges = [
    [0, 0.18],
    [0.22, 0.48],
    [0.53, 0.76],
    [0.81, 1],
  ];
  const dryFragments = [
    [0, 0.42, 0.58, -0.12, 5, 0.74],
    [0.24, 0.78, 0.76, 0.08, 17, 0.68],
    [0.61, 1, 0.44, -0.2, 29, 0.58],
  ]
    .map(([start, end, widthScale, offsetRatio, seedOffset, opacity], partIndex) => {
      const mask = `paint-dry-mask-${String.fromCharCode(
        97 + ((index + partIndex) % 3),
      )}`;
      return `    <path d="${brushPolygonSegment(
        varyCurve(config, seedOffset, 0.42),
        start,
        end,
        widthScale,
        config.width * offsetRatio,
        seedOffset,
      )}" fill="${config.fill}" opacity="${opacity}" mask="url(#${mask})" />`;
    })
    .join("\n");
  const fibers = [0.5, 0.34, 0.18, 0.03, -0.17, -0.34, -0.5]
    .map((ratio, fiberIndex) => {
      const fiberRanges = ranges.filter(
        (_, rangeIndex) =>
          (rangeIndex + fiberIndex) % 3 !== 1 || fiberIndex % 4 === 0,
      );
      const fiberConfig = varyCurve(config, 50 + fiberIndex * 9, 0.58);
      return `    <path d="${fragmentedCurve(fiberConfig, config.width * ratio, fiberRanges)}" fill="none" stroke="${fiberIndex % 3 === 0 ? config.fiber : config.fill}" stroke-width="${Math.max(1.1, config.width * (0.058 - fiberIndex * 0.0042)).toFixed(1)}" stroke-linecap="round" opacity="${Math.max(0.22, 0.6 - fiberIndex * 0.045).toFixed(2)}" />`;
    })
    .join("\n");

  addGroup({
    family: "dry-brush",
    depth: index < 4 ? "background" : index < 10 ? "midground" : "foreground",
    direction:
      Math.abs(config.x2 - config.x1) > Math.abs(config.y2 - config.y1)
        ? "diagonal-pull"
        : config.y2 > config.y1
          ? "top-to-bottom"
          : "bottom-to-top",
    textZone: index <= 2 || index === 10 ? "low-contrast" : "avoid",
    opacity:
      index === 0
        ? 0.62
        : index === 1
          ? 0.58
          : index === 2
            ? 0.52
            : index === 10
              ? 0.38
              : index === 5 || index === 11
                ? 0.66
              : 0.76,
    content: `${dryFragments}
${fibers}`,
  });
});

const curvedConfigs = [
  [-120, 1010, 720, 700, 2080, 660, 54, palette.deepViolet, 0.5],
  [220, -110, 610, 500, 390, 1180, 42, palette.inkBlue, 0.38],
  [-100, 860, 820, 470, 2020, 430, 34, palette.crimson, 0.52],
  [640, 1080, 1240, 920, 2050, 892, 28, palette.violet, 0.54],
  [1440, 1040, 1740, 790, 2070, 610, 13, palette.lime, 0.72],
  [1710, 890, 1910, 690, 2120, 618, 7, palette.lime, 0.58],
  [-120, 520, 720, 760, 1940, 820, 24, palette.red, 0.42],
  [980, 124, 1480, 170, 2080, 338, 18, palette.cyan, 0.42],
  [920, 1060, 1380, 600, 2110, 430, 18, palette.pink, 0.62],
  [1300, 258, 1680, 188, 2130, 236, 14, palette.white, 0.54],
  [-100, 300, 720, 150, 1570, 260, 14, palette.indigo, 0.3],
  [1480, 1090, 1810, 800, 2100, 780, 12, palette.cyan, 0.52],
].map(([x1, y1, cx, cy, x2, y2, width, color, opacity], index) => ({
  x1,
  y1,
  cx,
  cy,
  x2,
  y2,
  width,
  color,
  opacity,
  seed: 410 + index,
}));

curvedConfigs.forEach((config, index) => {
  const core = fragmentedCurve(config, 0, [
    [0, 0.44],
    [0.48, 0.76],
    [0.8, 1],
  ]);
  const fiber = fragmentedCurve(config, config.width * 0.46, [
    [0.03, 0.31],
    [0.38, 0.66],
    [0.74, 0.94],
  ]);
  const fiberTwo = fragmentedCurve(config, -config.width * 0.5, [
    [0.12, 0.4],
    [0.47, 0.83],
  ]);

  addGroup({
    family: "curved-sweep",
    depth: index < 4 ? "background" : index < 9 ? "midground" : "foreground",
    direction:
      config.y2 < config.y1 - 300
        ? "bottom-to-top"
        : config.y2 > config.y1 + 300
          ? "top-to-bottom"
          : "edge-to-edge",
    textZone: index <= 2 || index === 10 ? "low-contrast" : "avoid",
    opacity: config.opacity,
    content: `    <path d="${core}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" stroke-linejoin="round" />
    <path d="${fiber}" fill="none" stroke="${config.color}" stroke-width="${Math.max(2, config.width * 0.16).toFixed(1)}" stroke-linecap="butt" opacity="0.72" />
    <path d="${fiberTwo}" fill="none" stroke="${config.color}" stroke-width="${Math.max(1.5, config.width * 0.08).toFixed(1)}" stroke-linecap="butt" opacity="0.48" />`,
  });
});

const sprayDragConfigs = [
  [-100, 720, 720, 580, 1460, 500, 24, palette.deepViolet],
  [820, 830, 1480, 650, 2080, 470, 18, palette.white],
  [990, 650, 1540, 450, 2100, 330, 14, palette.cyan],
  [1180, 1010, 1540, 740, 1870, 180, 16, palette.violet],
  [1810, -70, 1960, 360, 2080, 820, 12, palette.blue],
  [450, 930, 1080, 840, 1760, 870, 12, palette.red],
  [1200, 440, 1640, 320, 2070, 210, 10, palette.pink],
  [1050, 900, 1510, 760, 2080, 660, 9, palette.cyan],
  [1900, 1100, 2010, 760, 2090, 460, 7, palette.white],
  [860, 390, 1280, 360, 1710, 440, 7, palette.magenta],
].map(([x1, y1, cx, cy, x2, y2, width, color], index) => ({
  x1,
  y1,
  cx,
  cy,
  x2,
  y2,
  width,
  color,
  seed: 510 + index,
}));

sprayDragConfigs.forEach((config, index) => {
  const drag = fragmentedCurve(config, 0, [
    [0, 0.27],
    [0.32, 0.62],
    [0.68, 0.86],
    [0.9, 1],
  ]);
  const particles = Array.from({ length: 7 }, (_, particleIndex) => {
    const t = clamp(
      0.12 + particleIndex * 0.13 + (noise(config.seed, particleIndex) - 0.5) * 0.08,
      0,
      1,
    );
    const point = pointOnQuadratic(config, t);
    const tangent = tangentOnQuadratic(config, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normalX = -tangent.y / length;
    const normalY = tangent.x / length;
    const offset = (noise(config.seed + 9, particleIndex) - 0.5) * config.width * 6;
    const radius = 1.5 + noise(config.seed + 19, particleIndex) * 4.5;
    return `    <circle cx="${(point.x + normalX * offset).toFixed(1)}" cy="${(point.y + normalY * offset).toFixed(1)}" r="${radius.toFixed(1)}" fill="${config.color}" opacity="${(0.34 + noise(config.seed + 29, particleIndex) * 0.44).toFixed(2)}" />`;
  }).join("\n");

  addGroup({
    family: "spray-drag",
    depth: index < 4 ? "midground" : "foreground",
    direction: Math.abs(config.y2 - config.y1) > 500 ? "vertical-drag" : "diagonal-pull",
    textZone: index === 0 || index === 5 ? "low-contrast" : "avoid",
    opacity: index === 0 ? 0.5 : index === 5 ? 0.34 : 0.62,
    content: `    <path d="${drag}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" opacity="0.62" />
    <path d="${fragmentedCurve(config, config.width * 0.85, [[0.08, 0.24], [0.4, 0.57], [0.73, 0.94]])}" fill="none" stroke="${config.color}" stroke-width="${Math.max(1.5, config.width * 0.16).toFixed(1)}" stroke-linecap="butt" opacity="0.48" />
${particles}`,
  });
});

const burstConfigs = [
  [1470, 520, 120, palette.magenta, 601],
  [1770, 610, 150, palette.cyan, 602],
  [1900, 330, 110, palette.white, 603],
  [1310, 790, 100, palette.red, 604],
  [1640, 860, 140, palette.violet, 605],
  [2040, 760, 130, palette.pink, 606],
  [1180, 420, 84, palette.blue, 607],
  [1840, 940, 96, palette.crimson, 608],
  [1530, 190, 82, palette.cyan, 609],
];

burstConfigs.forEach(([cx, cy, radius, color, seed], index) => {
  const particles = Array.from({ length: 11 }, (_, particleIndex) => {
    const angle = noise(seed, particleIndex) * Math.PI * 2;
    const radialNoise = noise(seed + 10, particleIndex);
    const distance =
      radius * (0.08 + Math.pow(radialNoise, 1.8) * 1.58);
    const particleX = cx + Math.cos(angle) * distance;
    const particleY = cy + Math.sin(angle) * distance;
    const particleRadius =
      1.2 + Math.pow(noise(seed + 20, particleIndex), 1.5) * 10.4;
    const particleOpacity = (
      0.36 +
      noise(seed + 30, particleIndex) * 0.5
    ).toFixed(2);
    if (particleIndex % 4 === 0) {
      return `    <ellipse cx="${particleX.toFixed(1)}" cy="${particleY.toFixed(1)}" rx="${(particleRadius * 2.35).toFixed(1)}" ry="${(particleRadius * 0.34).toFixed(1)}" fill="${color}" opacity="${particleOpacity}" transform="rotate(${Math.round((angle * 180) / Math.PI + 18)} ${particleX.toFixed(1)} ${particleY.toFixed(1)})" />`;
    }
    if (particleIndex % 5 === 0) {
      return `    <path d="${irregularBlob(
        particleX,
        particleY,
        particleRadius * 1.18,
        seed + particleIndex * 7,
        9,
      )}" fill="${color}" opacity="${particleOpacity}" />`;
    }
    return `    <circle cx="${particleX.toFixed(1)}" cy="${particleY.toFixed(1)}" r="${particleRadius.toFixed(1)}" fill="${color}" opacity="${particleOpacity}" />`;
  }).join("\n");
  const dripLength = 26 + noise(seed, 20) * 86;
  const coreOffsetX = (noise(seed, 30) - 0.5) * radius * 0.22;
  const coreOffsetY = (noise(seed, 31) - 0.5) * radius * 0.2;
  const drip =
    index % 3 === 2
      ? ""
      : `
    <path d="M${(cx + coreOffsetX * 0.4).toFixed(1)} ${(cy + radius * 0.12).toFixed(1)} C${(cx - 7 + coreOffsetX).toFixed(1)} ${(cy + radius * 0.42).toFixed(1)} ${(cx + 8 - coreOffsetX * 0.5).toFixed(1)} ${(cy + dripLength * 0.74).toFixed(1)} ${(cx + 1).toFixed(1)} ${(cy + dripLength).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${Math.max(2.5, radius * 0.045).toFixed(1)}" stroke-linecap="round" opacity="0.64" />`;

  addGroup({
    family: "spray-burst",
    depth: index < 3 ? "midground" : "foreground",
    direction: index % 2 === 0 ? "edge-in" : "radial-burst",
    textZone: "avoid",
    content: `    <path d="${irregularBlob(cx, cy, radius * 0.24, seed)}" fill="${color}" opacity="0.88" />
    <path d="${irregularBlob(cx + coreOffsetX, cy + coreOffsetY, radius * 0.15, seed + 17, 10)}" fill="${color}" opacity="0.66" />
${particles}
${drip}`,
  });
});

const flickConfigs = [
  [760, 690, 1250, 510, 1700, 330, palette.white, 5],
  [980, 790, 1450, 640, 1940, 540, palette.cyan, 4],
  [1240, 460, 1620, 330, 2020, 230, palette.pink, 4],
  [1580, 920, 1840, 720, 2080, 610, palette.lime, 3],
  [1120, 880, 1480, 760, 1880, 720, palette.blue, 3],
  [1320, 240, 1610, 360, 1930, 550, palette.white, 3],
  [620, 940, 980, 880, 1320, 900, palette.magenta, 3],
  [1780, 1040, 1840, 680, 1900, 280, palette.cyan, 2],
].map(([x1, y1, cx, cy, x2, y2, color, width], index) => ({
  x1,
  y1,
  cx,
  cy,
  x2,
  y2,
  color,
  width,
  seed: 710 + index,
}));

flickConfigs.forEach((config, index) => {
  addGroup({
    family: "thin-flick",
    depth: "foreground",
    direction: Math.abs(config.y2 - config.y1) > 400 ? "vertical-flick" : "diagonal-flick",
    textZone: index === 6 ? "low-contrast" : "avoid",
    opacity: index === 6 ? 0.28 : 0.56,
    content: `    <path d="${fragmentedCurve(config, 0, [[0, 0.32], [0.39, 0.69], [0.78, 1]])}" fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="butt" />
    <path d="${fragmentedCurve(config, config.width * 2.4, [[0.1, 0.28], [0.48, 0.64], [0.84, 0.96]])}" fill="none" stroke="${config.color}" stroke-width="${Math.max(1, config.width * 0.32).toFixed(1)}" stroke-linecap="butt" opacity="0.52" />`,
  });
});

const scratchConfigs = [
  [730, 650, 1320, 470, 2050, 300, palette.white],
  [980, 770, 1490, 640, 2040, 520, palette.pink],
  [1160, 900, 1540, 780, 1970, 690, palette.cyan],
  [1350, 320, 1660, 360, 2020, 450, palette.magenta],
  [870, 980, 1260, 900, 1670, 890, palette.white],
  [1540, 1050, 1720, 720, 1810, 360, palette.blue],
].map(([x1, y1, cx, cy, x2, y2, color], index) => ({
  x1,
  y1,
  cx,
  cy,
  x2,
  y2,
  color,
  width: 2.6 - index * 0.18,
  seed: 810 + index,
}));

scratchConfigs.forEach((config, index) => {
  const strokes = [-9, 0, 11]
    .map(
      (offset, strokeIndex) =>
        `    <path d="${fragmentedCurve(config, offset, strokeIndex === 1 ? [[0, 0.19], [0.25, 0.47], [0.55, 0.78], [0.85, 1]] : [[0.08, 0.32], [0.42, 0.65], [0.74, 0.92]])}" fill="none" stroke="${config.color}" stroke-width="${Math.max(0.8, config.width - strokeIndex * 0.45).toFixed(1)}" stroke-linecap="butt" opacity="${(0.7 - strokeIndex * 0.14).toFixed(2)}" />`,
    )
    .join("\n");

  addGroup({
    family: "scratch",
    depth: "foreground",
    direction: index === 5 ? "vertical-scratch" : "diagonal-scratch",
    textZone: "avoid",
    content: strokes,
  });
});

const splatterConfigs = [
  [1250, 610, 150, palette.magenta, 901],
  [1560, 520, 180, palette.cyan, 902],
  [1810, 690, 190, palette.white, 903],
  [1430, 880, 160, palette.violet, 904],
  [1980, 430, 150, palette.red, 905],
  [1690, 230, 120, palette.pink, 906],
];

splatterConfigs.forEach(([cx, cy, radius, color, seed]) => {
  const dots = Array.from({ length: 15 }, (_, dotIndex) => {
    const angle = noise(seed, dotIndex) * Math.PI * 2;
    const radialNoise = noise(seed + 10, dotIndex);
    const distance =
      radius * (0.06 + Math.pow(radialNoise, 1.9) * 1.7);
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const dotRadius =
      1.1 + Math.pow(noise(seed + 20, dotIndex), 1.4) * 9.2;
    const dotOpacity = (
      0.38 +
      noise(seed + 30, dotIndex) * 0.5
    ).toFixed(2);
    if (dotIndex % 5 === 0) {
      return `    <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(dotRadius * 2.4).toFixed(1)}" ry="${(dotRadius * 0.34).toFixed(1)}" fill="${color}" opacity="${dotOpacity}" transform="rotate(${Math.round((angle * 180) / Math.PI + 34)} ${x.toFixed(1)} ${y.toFixed(1)})" />`;
    }
    if (dotIndex % 7 === 0) {
      return `    <path d="${irregularBlob(
        x,
        y,
        dotRadius * 1.12,
        seed + dotIndex * 5,
        8,
      )}" fill="${color}" opacity="${dotOpacity}" />`;
    }
    return `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius.toFixed(1)}" fill="${color}" opacity="${dotOpacity}" />`;
  }).join("\n");

  addGroup({
    family: "splatter",
    depth: "foreground",
    direction: "radial-splatter",
    textZone: "avoid",
    content: `    <path d="${irregularBlob(cx, cy, radius * 0.22, seed, 14)}" fill="${color}" opacity="0.88" />
    <path d="${irregularBlob(cx + radius * 0.44, cy - radius * 0.28, radius * 0.1, seed + 5, 10)}" fill="${color}" opacity="0.72" />
${dots}`,
  });
});

const entryBrushConfig = {
  x1: -280,
  y1: 820,
  cx: 840,
  cy: 748,
  x2: 2180,
  y2: 206,
  width: 136,
  fill: "url(#paint-gradient-magenta)",
  highlight: palette.pink,
  fiber: palette.crimson,
  seed: 1001,
};

addGroup({
  family: "broad-brush",
  depth: "foreground",
  direction: "left-to-right",
  textZone: "low-contrast",
  opacity: 0.92,
  mobileOverride: "keep",
  extraClass: "paint-stroke--entry-hero",
  content: entryBrushContent(entryBrushConfig),
});

[
  {
    x1: -250,
    y1: 786,
    cx: 610,
    cy: 680,
    x2: 1630,
    y2: 570,
    width: 48,
    fill: palette.deepViolet,
    fiber: palette.violet,
    seed: 1011,
    mobile: "keep",
    depth: "background",
    opacity: 0.52,
  },
  {
    x1: -220,
    y1: 1010,
    cx: 680,
    cy: 900,
    x2: 1710,
    y2: 842,
    width: 38,
    fill: palette.burgundy,
    fiber: palette.crimson,
    seed: 1012,
    mobile: "optional",
    depth: "midground",
    opacity: 0.48,
  },
].forEach((config, index) => {
  addGroup({
    family: "dry-brush",
    depth: config.depth,
    direction: "diagonal-pull",
    textZone: "low-contrast",
    opacity: config.opacity,
    mobileOverride: config.mobile,
    content: dryAccentContent(config, index),
  });
});

[
  {
    x1: -210,
    y1: 650,
    cx: 830,
    cy: 610,
    x2: 2050,
    y2: 398,
    width: 19,
    color: palette.violet,
    companion: palette.pink,
    seed: 1021,
    mobile: "keep",
    opacity: 0.58,
  },
  {
    x1: -190,
    y1: 932,
    cx: 760,
    cy: 820,
    x2: 1880,
    y2: 692,
    width: 13,
    color: palette.indigo,
    companion: palette.cyan,
    seed: 1022,
    mobile: "optional",
    opacity: 0.46,
  },
].forEach((config) => {
  addGroup({
    family: "spray-drag",
    depth: "midground",
    direction: "diagonal-pull",
    textZone: "low-contrast",
    opacity: config.opacity,
    mobileOverride: config.mobile,
    content: sprayDragAccentContent(config),
  });
});

const leftCounterSweep = {
  x1: -190,
  y1: 1050,
  cx: 830,
  cy: 456,
  x2: 2140,
  y2: 352,
  width: 21,
  color: palette.crimson,
  seed: 1031,
};
addGroup({
  family: "curved-sweep",
  depth: "midground",
  direction: "bottom-to-top",
  textZone: "low-contrast",
  opacity: 0.54,
  mobileOverride: "keep",
  content: `    <path d="${fragmentedCurve(leftCounterSweep, 0, [
    [0, 0.28],
    [0.35, 0.64],
    [0.71, 0.88],
    [0.93, 1],
  ])}" fill="none" stroke="${leftCounterSweep.color}" stroke-width="${leftCounterSweep.width}" stroke-linecap="butt" />
    <path d="${fragmentedCurve(
      varyCurve(leftCounterSweep, 41, 0.5),
      -22,
      [
        [0.08, 0.3],
        [0.44, 0.61],
        [0.78, 0.94],
      ],
    )}" fill="none" stroke="${palette.pink}" stroke-width="3.2" stroke-linecap="round" opacity="0.58" />`,
});

const leftMagentaGesture = {
  x1: -180,
  y1: 540,
  cx: 720,
  cy: 420,
  x2: 1760,
  y2: 278,
  width: 5,
  color: palette.magenta,
  seed: 1041,
};
addGroup({
  family: "thin-flick",
  depth: "foreground",
  direction: "diagonal-flick",
  textZone: "low-contrast",
  opacity: 0.48,
  mobileOverride: "optional",
  content: `    <path d="${fragmentedCurve(leftMagentaGesture, 0, [
    [0, 0.22],
    [0.31, 0.58],
    [0.66, 0.82],
    [0.9, 1],
  ])}" fill="none" stroke="${leftMagentaGesture.color}" stroke-width="${leftMagentaGesture.width}" stroke-linecap="butt" />
    <path d="${bristleTailPath(
      leftMagentaGesture,
      0,
      34,
      1049,
      5,
      true,
    )} ${bristleTailPath(leftMagentaGesture, 1, 28, 1051, 5)}" fill="none" stroke="${palette.pink}" stroke-width="1.2" stroke-linecap="round" opacity="0.5" />`,
});

const leftDarkCompanion = {
  x1: -230,
  y1: 728,
  cx: 770,
  cy: 570,
  x2: 2040,
  y2: 302,
  width: 29,
  fill: palette.inkBlue,
  fiber: palette.deepIndigo,
  seed: 1051,
};
addGroup({
  family: "dry-brush",
  depth: "background",
  direction: "diagonal-pull",
  textZone: "low-contrast",
  opacity: 0.42,
  mobileOverride: "keep",
  content: dryAccentContent(leftDarkCompanion, 2),
});

const leftEdgeAccent = {
  x1: 70,
  y1: 820,
  cx: 270,
  cy: 730,
  x2: 520,
  y2: 650,
  width: 17,
  color: palette.magenta,
  seed: 1061,
};
addGroup({
  family: "spray-burst",
  depth: "foreground",
  direction: "edge-in",
  textZone: "low-contrast",
  opacity: 0.42,
  mobileOverride: "keep",
  content: `${sprayDragAccentContent(leftEdgeAccent)}
    <path d="${irregularBlob(286, 728, 22, 1067, 13)}" fill="${palette.crimson}" opacity="0.62" />
    <circle cx="252" cy="764" r="4.2" fill="${palette.pink}" opacity="0.7" />
    <circle cx="326" cy="698" r="2.4" fill="${palette.magenta}" opacity="0.62" />`,
});

const expectedDistribution = {
  "broad-brush": 15,
  "dry-brush": 16,
  "curved-sweep": 13,
  "spray-drag": 12,
  "spray-cloud": 10,
  "spray-burst": 10,
  "paint-block": 8,
  "thin-flick": 9,
  scratch: 6,
  splatter: 6,
  mist: 4,
};

for (const [family, expected] of Object.entries(expectedDistribution)) {
  const actual = familyCounts.get(family) ?? 0;
  if (actual !== expected) {
    throw new Error(`Expected ${expected} ${family} groups, received ${actual}.`);
  }
}

if (groups.length !== 109) {
  throw new Error(`Expected 109 paint groups, received ${groups.length}.`);
}

const svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1920 1080"
  preserveAspectRatio="xMidYMid slice"
  role="img"
  aria-label="Slojevita painterly kompozicija za Carsystem final art preview"
>
  <style>
    .paint-stroke { transform-box: fill-box; transform-origin: center; }
    @media (max-width: 900px) {
      .paint-stroke[data-mobile="hide"] { display: none; }
    }
    @media (max-width: 520px) {
      .paint-stroke--mobile-secondary { display: none; }
    }
  </style>
  <defs>
    <linearGradient id="paint-gradient-magenta" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0" stop-color="${palette.crimson}" />
      <stop offset="0.48" stop-color="${palette.magenta}" />
      <stop offset="1" stop-color="${palette.pink}" />
    </linearGradient>
    <linearGradient id="paint-gradient-red" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${palette.crimson}" />
      <stop offset="0.58" stop-color="${palette.red}" />
      <stop offset="1" stop-color="${palette.magenta}" />
    </linearGradient>
    <linearGradient id="paint-gradient-blue" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0" stop-color="${palette.indigo}" />
      <stop offset="0.52" stop-color="${palette.blue}" />
      <stop offset="1" stop-color="${palette.cyan}" />
    </linearGradient>
    <linearGradient id="paint-gradient-cream" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${palette.warmWhite}" />
      <stop offset="0.55" stop-color="${palette.white}" />
      <stop offset="1" stop-color="#fffaf2" />
    </linearGradient>
    <radialGradient id="paint-mist-violet">
      <stop offset="0" stop-color="${palette.violet}" stop-opacity="0.56" />
      <stop offset="0.56" stop-color="${palette.violet}" stop-opacity="0.18" />
      <stop offset="1" stop-color="${palette.violet}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="paint-mist-magenta">
      <stop offset="0" stop-color="${palette.magenta}" stop-opacity="0.52" />
      <stop offset="0.58" stop-color="${palette.magenta}" stop-opacity="0.16" />
      <stop offset="1" stop-color="${palette.magenta}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="paint-mist-blue">
      <stop offset="0" stop-color="${palette.blue}" stop-opacity="0.52" />
      <stop offset="0.58" stop-color="${palette.indigo}" stop-opacity="0.16" />
      <stop offset="1" stop-color="${palette.indigo}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="paint-mist-crimson">
      <stop offset="0" stop-color="${palette.crimson}" stop-opacity="0.46" />
      <stop offset="0.58" stop-color="${palette.crimson}" stop-opacity="0.13" />
      <stop offset="1" stop-color="${palette.crimson}" stop-opacity="0" />
    </radialGradient>
    ${["magenta", "violet", "blue", "cyan", "crimson"]
      .map(
        (color) => `<radialGradient id="paint-cloud-${color}">
      <stop offset="0" stop-color="${palette[color]}" stop-opacity="0.72" />
      <stop offset="0.5" stop-color="${palette[color]}" stop-opacity="0.24" />
      <stop offset="1" stop-color="${palette[color]}" stop-opacity="0" />
    </radialGradient>`,
      )
      .join("\n    ")}
    <mask id="paint-dry-mask-a" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .18 C.24 .12 .58 .28 1 .14 M0 .44 C.34 .54 .66 .34 1 .48 M0 .76 C.3 .68 .74 .84 1 .7" fill="none" stroke="black" stroke-width=".058" stroke-linecap="butt" />
      <path d="M0 .31 C.16 .26 .34 .38 .52 .3 M.62 .6 C.76 .54 .88 .64 1 .56" fill="none" stroke="black" stroke-width=".026" stroke-linecap="butt" />
      <circle cx=".13" cy=".62" r=".035" fill="black" />
      <circle cx=".73" cy=".34" r=".024" fill="black" />
    </mask>
    <mask id="paint-dry-mask-b" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .12 C.22 .28 .54 .08 1 .22 M0 .36 C.3 .22 .72 .48 1 .3 M0 .68 C.4 .82 .7 .58 1 .74 M0 .9 C.28 .78 .72 .96 1 .84" fill="none" stroke="black" stroke-width=".046" stroke-linecap="butt" />
      <path d="M.04 .55 C.18 .48 .38 .6 .58 .51 M.7 .46 C.82 .4 .92 .48 1 .42" fill="none" stroke="black" stroke-width=".028" stroke-linecap="butt" />
      <circle cx=".28" cy=".18" r=".026" fill="black" />
      <circle cx=".84" cy=".62" r=".036" fill="black" />
    </mask>
    <mask id="paint-dry-mask-c" maskContentUnits="objectBoundingBox">
      <rect width="1" height="1" fill="white" />
      <path d="M0 .24 C.3 .08 .66 .38 1 .18 M0 .52 C.18 .66 .54 .38 1 .58 M0 .82 C.36 .7 .68 .92 1 .76" fill="none" stroke="black" stroke-width=".068" stroke-linecap="butt" />
      <path d="M0 .66 C.18 .58 .3 .74 .48 .64 M.56 .36 C.72 .28 .86 .4 1 .31" fill="none" stroke="black" stroke-width=".024" stroke-linecap="butt" />
      <circle cx=".42" cy=".28" r=".032" fill="black" />
      <circle cx=".9" cy=".55" r=".022" fill="black" />
    </mask>
    <mask id="paint-spray-mask-a" maskContentUnits="objectBoundingBox">
      <ellipse cx=".5" cy=".5" rx=".5" ry=".46" fill="white" />
      <circle cx=".16" cy=".25" r=".08" fill="#b8b8b8" />
      <circle cx=".82" cy=".7" r=".1" fill="#a2a2a2" />
    </mask>
    <mask id="paint-spray-mask-b" maskContentUnits="objectBoundingBox">
      <ellipse cx=".52" cy=".48" rx=".48" ry=".5" fill="white" />
      <circle cx=".72" cy=".18" r=".09" fill="#a8a8a8" />
      <circle cx=".22" cy=".76" r=".11" fill="#b4b4b4" />
    </mask>
    <mask id="paint-soft-edge-mask" maskContentUnits="objectBoundingBox">
      <radialGradient id="paint-soft-edge-gradient">
        <stop offset="0" stop-color="white" />
        <stop offset=".74" stop-color="white" stop-opacity=".9" />
        <stop offset="1" stop-color="black" />
      </radialGradient>
      <rect width="1" height="1" fill="url(#paint-soft-edge-gradient)" />
    </mask>
    <mask id="paint-grain-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
      <rect width="1920" height="1080" fill="white" />
      <rect width="1920" height="1080" filter="url(#paint-grain)" opacity=".22" />
    </mask>
    <filter id="paint-soft-blur" x="-16%" y="-24%" width="132%" height="148%">
      <feGaussianBlur stdDeviation="12" />
    </filter>
    <filter id="paint-grain" x="-8%" y="-14%" width="116%" height="128%">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .11" numOctaves="2" seed="14" result="paint-noise" />
      <feDisplacementMap in="SourceGraphic" in2="paint-noise" scale="10" xChannelSelector="R" yChannelSelector="G" result="rough-paint" />
      <feColorMatrix in="paint-noise" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .34 .34 .34 0 -.14" result="dry-alpha" />
      <feComposite in="rough-paint" in2="dry-alpha" operator="in" />
    </filter>
  </defs>
${groups.join("\n")}
</svg>
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg);

console.log(
  JSON.stringify(
    {
      outputPath,
      groups: groups.length,
      distribution: Object.fromEntries(familyCounts),
      bytes: Buffer.byteLength(svg),
    },
    null,
    2,
  ),
);
