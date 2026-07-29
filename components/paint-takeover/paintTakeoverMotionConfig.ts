import type { FinalReviewMode } from "./paintTakeoverTypes";

export const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

export const LIGHT_COVER_PATH =
  "M-20 -20 H1940 L1940 -20 C1660 124 1320 212 970 286 C620 360 280 395 -20 330Z";

/**
 * Jedan kontinualni timeline za ceo prelaz poglavlja.
 *
 * Ranija verzija je vozila sve slojeve iz `progress` sekcije takeovera, koji
 * počinje tek kada se sekcija pinuje. Posledica: prethodni blok nije imao
 * nikakav signal, a prvih ~200px pinovanog kadra je bila prazna svetla ploča.
 *
 * Sada `timeline` počinje dok je korisnik još u bloku partnerske mreže
 * (approach faza, udeo ENTRY_SHARE) i nastavlja se kroz sticky kadar. Svi
 * slojevi — uključujući boju headera — su čiste funkcije tog jednog signala,
 * pa ni jedan prelaz ne može da "sevne" nezavisno od skrola.
 */
export const ENTRY_SHARE = 0.18;

/** Prozori slojeva, izraženi u `timeline` jedinicama (0..1). */
export const TIMELINE = {
  /** Painterly potezi u prethodnom bloku (iza mape i kartice). */
  entryBrush: [0.0, 0.17] as const,
  /** Tamna površina koja preuzima svetlu — kreće još u approach fazi. */
  surface: [0.06, 0.3] as const,
  /** Painterly background sloj, ide odmah iza površine da nema rupe. */
  background: [0.1, 0.4] as const,
  /** Leva tekst zona. */
  content: [0.26, 0.4] as const,
  contentMobile: [0.22, 0.36] as const,
  /** Kontrast ispod teksta. */
  contrast: [0.2, 0.4] as const,
  /** Chapter signal koji nose header i sekcije ispod. */
  chapter: [0.04, 0.28] as const,
  /** Hero potezi: ceo set staje ovde (ranije 0.105–0.90 u progress skali). */
  strokes: [0.19, 0.82] as const,
  /** Miran hold pre izlaska. */
  hold: [0.84, 1.0] as const,
} as const;

/**
 * Prebacuje `approach` (prethodni blok) i `progress` (sticky kadar) u jedan
 * monotoni timeline. `approach` ide 0→1 dok gornja ivica sekcije putuje od
 * dna viewporta do vrha; `progress` preuzima od trenutka pinovanja.
 */
export function toTimeline(approach: number, progress: number) {
  if (progress <= 0) return clamp(approach) * ENTRY_SHARE;
  return ENTRY_SHARE + clamp(progress) * (1 - ENTRY_SHARE);
}

/**
 * Manifest nosi tajminge poteza u staroj `progress` skali (0.105–0.90).
 * Umesto regenerisanja artwork-a, prozor se ovde preslikava u novi, kraći
 * `strokes` prozor — isti redosled i isti karakter, samo življi ulazak.
 */
const MANIFEST_STROKE_RANGE = [0.105, 0.9] as const;

export function remapStrokeWindow(start: number, end: number) {
  const [srcStart, srcEnd] = MANIFEST_STROKE_RANGE;
  const [dstStart, dstEnd] = TIMELINE.strokes;
  const span = srcEnd - srcStart;
  const scale = (dstEnd - dstStart) / span;
  return [
    dstStart + (start - srcStart) * scale,
    dstStart + (end - srcStart) * scale,
  ] as const;
}

export const paintTakeoverReviewModes: Array<{
  mode: FinalReviewMode;
  label: string;
}> = [
  { mode: "final", label: "FINAL" },
  { mode: "background", label: "BACKGROUND ONLY" },
  { mode: "hero-static", label: "HERO STATIC" },
  { mode: "hero-motion", label: "HERO MOTION" },
  { mode: "text-contrast", label: "TEXT CONTRAST" },
  { mode: "mask-debug", label: "MASK DEBUG" },
];

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function mapProgress(progress: number, start: number, end: number) {
  const normalized = clamp((progress - start) / Math.max(0.0001, end - start));
  return normalized * normalized * (3 - 2 * normalized);
}

/** Faze se čitaju u `timeline` skali (approach + sticky kadar). */
export function phaseFor(timeline: number) {
  if (timeline < 0.06) return "Approach";
  if (timeline < 0.18) return "Entry brush (prethodni blok)";
  if (timeline < 0.3) return "White to dark threshold";
  if (timeline < 0.45) return "Primary collision";
  if (timeline < 0.62) return "Secondary brush energy";
  if (timeline < 0.78) return "Spray, splatter and detail";
  if (timeline < 0.96) return "Controlled hold";
  return "Exit preparation";
}

export function clipForGroup(
  progress: number,
  origin: string,
  direction: string,
) {
  const remaining = ((1 - progress) * 100).toFixed(3);

  if (origin === "left" || direction.includes("left-to-right")) {
    return `inset(0 ${remaining}% 0 0)`;
  }
  if (origin === "right" || direction.includes("right-to-left")) {
    return `inset(0 0 0 ${remaining}%)`;
  }
  if (origin === "top" || direction.includes("top-right")) {
    return `inset(0 0 ${remaining}% 0)`;
  }
  if (origin === "bottom" || direction.includes("bottom-left")) {
    return `inset(${remaining}% 0 0 0)`;
  }

  const centered = ((1 - progress) * 46).toFixed(3);
  return `inset(${centered}% ${centered}% ${centered}% ${centered}%)`;
}
