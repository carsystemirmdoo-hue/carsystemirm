import type { CSSProperties, ReactNode } from "react";

/**
 * Candidate decorative scenes — INTERNAL, non-production.
 *
 * Each scene is a static, deterministic SVG drawn from the product's own seed,
 * so the same product always produces the same artwork on the server and in the
 * browser. Nothing here reads as a measurement: no scene prints a number, a
 * unit, a grade or a dimension, because a decorative line that looks like a
 * specification is a fabricated product claim.
 *
 * Every scene is `aria-hidden`; the product image beside it carries the meaning.
 *
 * The icon rain / pile direction is deliberately NOT here. It was two static
 * frames pretending to be an animation; the real, animated implementation lives
 * in `IconRainPileScene.tsx`, which needs client state and a viewport trigger
 * that a pure SVG function cannot provide.
 */

export type LabSceneKind =
  | "pigment-field"
  | "controlled-graffiti"
  | "material-layers"
  | "blueprint"
  | "material-trace"
  | "exploded-halo"
  | "silhouette-field"
  | "cross-section"
  | "swatch-ladder"
  | "grain-arc"
  | "neutral";

/** Mulberry32 — small, deterministic, seeded from the product slug. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SceneProps = {
  accent: string;
  accent2?: string;
  seed: number;
  /** Muted tone used when the product itself is dark or very light. */
  neutral?: string;
};

function PigmentField({ accent, accent2, seed }: SceneProps) {
  const random = rng(seed);
  const blobs = Array.from({ length: 5 }, (_, index) => ({
    cx: 22 + random() * 56,
    cy: 20 + random() * 60,
    rx: 14 + random() * 22,
    ry: 10 + random() * 18,
    rotate: random() * 180,
    fill: index % 2 === 0 ? accent : accent2 ?? accent,
    opacity: 0.1 + random() * 0.16,
  }));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {blobs.map((blob, index) => (
        <ellipse
          key={index}
          cx={blob.cx}
          cy={blob.cy}
          rx={blob.rx}
          ry={blob.ry}
          fill={blob.fill}
          opacity={blob.opacity}
          transform={`rotate(${blob.rotate} ${blob.cx} ${blob.cy})`}
        />
      ))}
    </svg>
  );
}

function ControlledGraffiti({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const y1 = 30 + random() * 12;
  const y2 = 58 + random() * 14;
  const maskId = `spray-soft-${seed}`;

  // A spray pass is a soft-edged band with overspray speckle along it, not a
  // solid stroke. The gradient mask thins the ends the way a moving can does,
  // and the speckle only appears where the band actually is.
  const speckle = Array.from({ length: 26 }, () => {
    const t = random();
    const along = -4 + t * 108;
    const band = random() < 0.5 ? y1 : y2;
    return {
      cx: along,
      cy: band + (random() - 0.5) * 26,
      r: 0.5 + random() * 1.5,
      o: 0.05 + random() * 0.12,
    };
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${maskId}-fade`} x1="0" x2="1">
          <stop offset="0%" stopColor="#000" />
          <stop offset="14%" stopColor="#fff" />
          <stop offset="86%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id={maskId}>
          <rect x="-10" y="0" width="120" height="100" fill={`url(#${maskId}-fade)`} />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        <path
          d={`M -6 ${y1} C 24 ${y1 - 10}, 58 ${y1 + 12}, 106 ${y1 - 4}`}
          stroke={accent}
          strokeWidth={21}
          strokeLinecap="round"
          fill="none"
          opacity={0.2}
        />
        <path
          d={`M -6 ${y1} C 24 ${y1 - 10}, 58 ${y1 + 12}, 106 ${y1 - 4}`}
          stroke={accent}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={0.14}
        />
        <path
          d={`M 108 ${y2} C 74 ${y2 + 9}, 38 ${y2 - 11}, -8 ${y2 + 3}`}
          stroke={accent}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
          opacity={0.13}
        />
      </g>

      {speckle.map((dot, index) => (
        <circle
          key={index}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill={accent}
          opacity={dot.o}
        />
      ))}
    </svg>
  );
}

function MaterialLayers({ accent, accent2, seed }: SceneProps) {
  const random = rng(seed);

  /*
   * A refinish build read as strata: substrate, filler, primer, colour, clear.
   * The stepped right edge is the point — it is what a sanded-through repair
   * actually looks like in section, which is why this scene belongs to
   * abrasives and masking rather than to a colour group. The bands carry no
   * thickness, grade or measurement; they describe an order of work, not a spec.
   */
  const bands = [
    { y: 46, height: 15, opacity: 0.07, inset: 0 },
    { y: 61, height: 11, opacity: 0.11, inset: 8 },
    { y: 72, height: 8, opacity: 0.15, inset: 17 },
    { y: 80, height: 6, opacity: 0.2, inset: 27 },
    { y: 86, height: 14, opacity: 0.09, inset: 38 },
  ];

  const grain = Array.from({ length: 34 }, () => ({
    cx: random() * 100,
    cy: 44 + random() * 20,
    r: 0.35 + random() * 0.7,
    o: 0.1 + random() * 0.16,
  }));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {bands.map((band, index) => (
        <path
          key={index}
          d={`M -2 ${band.y} H ${102 - band.inset} L ${102 - band.inset - 6} ${band.y + band.height} H -2 Z`}
          fill={index % 2 === 0 ? accent : accent2 ?? accent}
          opacity={band.opacity}
        />
      ))}

      <g stroke={accent} opacity={0.26} fill="none">
        {bands.map((band, index) => (
          <path
            key={`edge-${index}`}
            d={`M -2 ${band.y} H ${102 - band.inset}`}
            strokeWidth={0.4}
          />
        ))}
      </g>

      {/* Abrasion texture, only across the exposed steps. */}
      {grain.map((dot, index) => (
        <circle
          key={`grain-${index}`}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill={accent}
          opacity={dot.o}
        />
      ))}
    </svg>
  );
}

function Blueprint({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const axis = 40 + random() * 8;

  /*
   * Construction geometry, not a dashboard. Grid, centre axes, a section circle
   * with radial construction rays and corner registration marks — the language
   * of a technical drawing in progress.
   *
   * There are deliberately no tick scales and no leader lines: a row of ticks
   * reads as a measurement, and these products publish none.
   */
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 + random() * 0.04;
    return {
      x1: 50 + Math.cos(angle) * 17,
      y1: axis + Math.sin(angle) * 17,
      x2: 50 + Math.cos(angle) * 30,
      y2: axis + Math.sin(angle) * 30,
    };
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <g stroke={accent} fill="none" opacity={0.13}>
        {Array.from({ length: 21 }, (_, index) => (
          <line
            key={`v${index}`}
            x1={index * 5}
            y1={0}
            x2={index * 5}
            y2={100}
            strokeWidth={index % 4 === 0 ? 0.35 : 0.18}
          />
        ))}
        {Array.from({ length: 21 }, (_, index) => (
          <line
            key={`h${index}`}
            x1={0}
            y1={index * 5}
            x2={100}
            y2={index * 5}
            strokeWidth={index % 4 === 0 ? 0.35 : 0.18}
          />
        ))}
      </g>

      <g stroke={accent} fill="none" opacity={0.3}>
        <circle cx={50} cy={axis} r={26} strokeWidth={0.6} />
        <circle cx={50} cy={axis} r={17} strokeWidth={0.4} strokeDasharray="2 2" />
        {rays.map((ray, index) => (
          <line key={`r${index}`} {...ray} strokeWidth={0.3} />
        ))}
        <line x1={8} y1={axis} x2={92} y2={axis} strokeWidth={0.4} strokeDasharray="6 2 1 2" />
        <line x1={50} y1={axis - 36} x2={50} y2={axis + 36} strokeWidth={0.4} strokeDasharray="6 2 1 2" />
      </g>

      {/* Registration marks — a drawing sheet's own furniture. */}
      <g stroke={accent} fill="none" opacity={0.34} strokeWidth={0.5}>
        <path d="M4 10V4h6M90 4h6v6M96 90v6h-6M10 96H4v-6" />
      </g>
    </svg>
  );
}

function MaterialTrace({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const start = 60 + random() * 10;
  const gradientId = `trace-taper-${seed}`;

  /*
   * A trace pulled with a blade: it starts loaded and thick, thins as the tool
   * runs out of material, and leaves ridge lines where the blade edge dragged.
   * That is what filler, adhesive and sealant actually leave behind, which is
   * why this scene belongs to `kitovi`, `lepkovi` and `zastita` rather than to
   * a colour group. No texture here implies a coverage figure or a thickness.
   */
  const path = `M -6 ${start} C 20 ${start - 15}, 44 ${start + 9}, 68 ${start - 7} S 94 ${start - 19}, 108 ${start - 11}`;
  const ridges = [0, 1, 2, 3, 4];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
          <stop offset="58%" stopColor={accent} stopOpacity={0.13} />
          <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      <path
        d={path}
        stroke={`url(#${gradientId})`}
        strokeWidth={23}
        strokeLinecap="round"
        fill="none"
      />

      {/* Ridge lines left by the blade edge, fading with the trace. */}
      <g fill="none" stroke={accent}>
        {ridges.map((index) => (
          <path
            key={index}
            d={path}
            strokeWidth={0.5}
            opacity={0.22 - index * 0.03}
            transform={`translate(0 ${(index - 2) * 4.2})`}
          />
        ))}
      </g>

      {/* Where the blade lifted off. */}
      <path
        d={`M 78 ${start - 20} C 86 ${start - 24}, 96 ${start - 22}, 104 ${start - 26}`}
        stroke={accent}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.12}
      />
    </svg>
  );
}

function ExplodedHalo({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const count = 10;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <circle cx={50} cy={48} r={34} stroke={accent} strokeWidth={0.5} fill="none" opacity={0.24} />
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + random() * 0.1;
        const radius = 34;
        return (
          <rect
            key={index}
            x={50 + Math.cos(angle) * radius - 3}
            y={48 + Math.sin(angle) * radius - 3}
            width={6}
            height={6}
            fill={accent}
            opacity={0.2}
            transform={`rotate(${(angle * 180) / Math.PI} ${50 + Math.cos(angle) * radius} ${48 + Math.sin(angle) * radius})`}
          />
        );
      })}
    </svg>
  );
}

function SilhouetteField({ accent, seed, silhouette }: SceneProps & { silhouette: number }) {
  const random = rng(seed);
  const copies = Array.from({ length: 6 }, (_, index) => ({
    x: 6 + index * 16 + random() * 5,
    y: 26 + (index % 2) * 16,
    height: 44 + random() * 12,
  }));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {copies.map((copy, index) => (
        <rect
          key={index}
          x={copy.x}
          y={copy.y}
          width={copy.height * silhouette}
          height={copy.height}
          rx={1.6}
          fill={accent}
          opacity={0.09}
        />
      ))}
    </svg>
  );
}

/** ORIGINAL A — refinish build-up read as horizontal strata. */
function CrossSection({ accent, accent2, seed }: SceneProps) {
  const random = rng(seed);
  const bands = [
    { y: 58, height: 16, opacity: 0.08 },
    { y: 74, height: 10, opacity: 0.12 },
    { y: 84, height: 6, opacity: 0.18 },
    { y: 90, height: 12, opacity: 0.06 },
  ];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {bands.map((band, index) => (
        <rect
          key={index}
          x={-2}
          y={band.y + random() * 1.5}
          width={104}
          height={band.height}
          fill={index % 2 === 0 ? accent : accent2 ?? accent}
          opacity={band.opacity}
        />
      ))}
      <g stroke={accent} opacity={0.22}>
        {bands.map((band, index) => (
          <line
            key={`edge-${index}`}
            x1={-2}
            y1={band.y}
            x2={102}
            y2={band.y}
            strokeWidth={0.4}
          />
        ))}
      </g>
    </svg>
  );
}

/** ORIGINAL B — the confirmed shade stepped as a value ladder. */
function SwatchLadder({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const steps = 7;
  const offset = random() * 4;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: steps }, (_, index) => (
        <rect
          key={index}
          x={78}
          y={8 + offset + index * 12}
          width={20}
          height={9}
          fill={accent}
          opacity={0.08 + index * 0.035}
        />
      ))}
      <rect x={0} y={0} width={6} height={100} fill={accent} opacity={0.1} />
    </svg>
  );
}

/** ORIGINAL C — density gradient standing in for grit progression. */
function GrainArc({ accent, seed }: SceneProps) {
  const random = rng(seed);
  const dots: { x: number; y: number; r: number }[] = [];
  for (let ring = 0; ring < 7; ring += 1) {
    const radius = 16 + ring * 7;
    const count = 6 + ring * 5;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + ring * 0.3 + random() * 0.05;
      dots.push({
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius * 0.86,
        r: 1.6 - ring * 0.16,
      });
    }
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {dots.map((dot, index) => (
        <circle
          key={index}
          cx={dot.x}
          cy={dot.y}
          r={Math.max(dot.r, 0.4)}
          fill={accent}
          opacity={0.2}
        />
      ))}
    </svg>
  );
}

export function LabScene({
  kind,
  accent,
  accent2,
  seed,
  silhouette = 0.4,
}: {
  kind: LabSceneKind;
  accent: string;
  accent2?: string;
  seed: number;
  silhouette?: number;
}) {
  const props: SceneProps = { accent, accent2, seed };

  switch (kind) {
    case "pigment-field":
      return <PigmentField {...props} />;
    case "controlled-graffiti":
      return <ControlledGraffiti {...props} />;
    case "material-layers":
      return <MaterialLayers {...props} />;
    case "blueprint":
      return <Blueprint {...props} />;
    case "material-trace":
      return <MaterialTrace {...props} />;
    case "exploded-halo":
      return <ExplodedHalo {...props} />;
    case "silhouette-field":
      return <SilhouetteField {...props} silhouette={silhouette} />;
    case "cross-section":
      return <CrossSection {...props} />;
    case "swatch-ladder":
      return <SwatchLadder {...props} />;
    case "grain-arc":
      return <GrainArc {...props} />;
    case "neutral":
    default:
      return null;
  }
}

export function LabSceneFrame({
  children,
  halo,
  style,
}: {
  children: ReactNode;
  halo?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...style, ...(halo ? ({ "--lab-halo": halo } as CSSProperties) : {}) }}>
      {children}
    </div>
  );
}
