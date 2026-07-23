export type PaintStrokeFamily =
  | "broad-brush"
  | "dry-brush"
  | "curved-sweep"
  | "thin-flick"
  | "scratch"
  | "spray-cloud"
  | "spray-burst"
  | "splatter"
  | "mist";

export type StrokeRevealMode =
  | "mask-ltr"
  | "mask-rtl"
  | "mask-path"
  | "line"
  | "cloud"
  | "particles"
  | "mist";

export type StrokeEasing = "quart-out" | "quint-out" | "smoothstep";

export type PaintStrokeConfig = {
  id: `proof-stroke-${string}`;
  family: PaintStrokeFamily;
  start: number;
  end: number;
  easing: StrokeEasing;
  translateX: number;
  translateY: number;
  rotateFrom: number;
  scaleFrom: number;
  revealMode: StrokeRevealMode;
};

export const paintStrokeConfig: readonly PaintStrokeConfig[] = [
  {
    id: "proof-stroke-01",
    family: "broad-brush",
    start: 0.08,
    end: 0.31,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-ltr",
  },
  {
    id: "proof-stroke-02",
    family: "broad-brush",
    start: 0.14,
    end: 0.38,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-rtl",
  },
  {
    id: "proof-stroke-03",
    family: "broad-brush",
    start: 0.22,
    end: 0.5,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-path",
  },
  {
    id: "proof-stroke-04",
    family: "dry-brush",
    start: 0.28,
    end: 0.54,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-ltr",
  },
  {
    id: "proof-stroke-05",
    family: "dry-brush",
    start: 0.32,
    end: 0.58,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-rtl",
  },
  {
    id: "proof-stroke-06",
    family: "curved-sweep",
    start: 0.4,
    end: 0.68,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-path",
  },
  {
    id: "proof-stroke-07",
    family: "curved-sweep",
    start: 0.47,
    end: 0.75,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "mask-path",
  },
  {
    id: "proof-stroke-08",
    family: "thin-flick",
    start: 0.44,
    end: 0.66,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "line",
  },
  {
    id: "proof-stroke-09",
    family: "thin-flick",
    start: 0.58,
    end: 0.78,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "line",
  },
  {
    id: "proof-stroke-10",
    family: "scratch",
    start: 0.5,
    end: 0.72,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "line",
  },
  {
    id: "proof-stroke-11",
    family: "scratch",
    start: 0.54,
    end: 0.76,
    easing: "quint-out",
    translateX: 0,
    translateY: 0,
    rotateFrom: 0,
    scaleFrom: 1,
    revealMode: "line",
  },
  {
    id: "proof-stroke-12",
    family: "spray-cloud",
    start: 0.12,
    end: 0.44,
    easing: "quint-out",
    translateX: -18,
    translateY: 10,
    rotateFrom: -0.25,
    scaleFrom: 0.94,
    revealMode: "cloud",
  },
  {
    id: "proof-stroke-13",
    family: "spray-cloud",
    start: 0.2,
    end: 0.52,
    easing: "quint-out",
    translateX: 18,
    translateY: -10,
    rotateFrom: 0.25,
    scaleFrom: 0.94,
    revealMode: "cloud",
  },
  {
    id: "proof-stroke-14",
    family: "spray-burst",
    start: 0.48,
    end: 0.72,
    easing: "quint-out",
    translateX: -12,
    translateY: 12,
    rotateFrom: -0.3,
    scaleFrom: 0.84,
    revealMode: "particles",
  },
  {
    id: "proof-stroke-15",
    family: "spray-burst",
    start: 0.56,
    end: 0.8,
    easing: "quint-out",
    translateX: 12,
    translateY: -10,
    rotateFrom: 0.3,
    scaleFrom: 0.84,
    revealMode: "particles",
  },
  {
    id: "proof-stroke-16",
    family: "splatter",
    start: 0.62,
    end: 0.84,
    easing: "quint-out",
    translateX: -10,
    translateY: 10,
    rotateFrom: -0.3,
    scaleFrom: 0.82,
    revealMode: "particles",
  },
  {
    id: "proof-stroke-17",
    family: "splatter",
    start: 0.68,
    end: 0.9,
    easing: "quint-out",
    translateX: 10,
    translateY: -8,
    rotateFrom: 0.3,
    scaleFrom: 0.82,
    revealMode: "particles",
  },
  {
    id: "proof-stroke-18",
    family: "mist",
    start: 0.06,
    end: 0.86,
    easing: "quint-out",
    translateX: -8,
    translateY: 6,
    rotateFrom: 0,
    scaleFrom: 0.99,
    revealMode: "mist",
  },
] as const;

export function getPaintTakeoverPhase(progress: number) {
  if (progress < 0.1) return "Mirno stanje";
  if (progress < 0.3) return "Noseći potezi";
  if (progress < 0.55) return "Centralni sudar";
  if (progress < 0.78) return "Sekundarni haos";
  if (progress < 0.92) return "Stabilizacija";
  return "Završni kadar";
}
