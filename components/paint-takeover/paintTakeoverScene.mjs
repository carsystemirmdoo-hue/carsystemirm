/**
 * Kadar takeovera kao čista funkcija timeline-a.
 *
 * Vrednosti koje sekcija ispisuje u CSS varijable su ranije bile računate
 * inline u `usePaintTakeoverMotion`, pa se ponašanje moglo proveriti samo
 * skrolovanjem kroz stranicu. Zbog toga je i regresija koja se ovde popravlja
 * dugo živela neprimećena: prozor `outro` je posle završene animacije gasio
 * potez (`--hero-global-opacity` → 0), obarao tekst na 0.55 i podlogu na 0.22,
 * pa se scena "sama zatamnila" dok korisnik nastavlja kroz sekciju.
 *
 * Sada je kadar jedna funkcija bez stanja: isti timeline daje isti kadar, a
 * `node --test` može da tvrdi da završno stanje (timeline = 1) jeste terminalno
 * i puno — bez ijedne faze koja posle vrhunca smanjuje vidljivost.
 *
 * Prozori (`windows`) ostaju u `paintTakeoverMotionConfig.ts` kao jedini izvor
 * tajminga i predaju se ovamo, da ne postoje dve tabele istih brojeva.
 *
 * Plain JS (ne TS) iz istog razloga kao ostali lifecycle moduli u repou:
 * jedna implementacija koju voze i aplikacija i testovi.
 */

export function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function normalize(progress, start, end) {
  return clamp((progress - start) / Math.max(0.0001, end - start));
}

export function mapProgress(progress, start, end) {
  const normalized = normalize(progress, start, end);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * Potez četke ne kreće mekano — kontakt je trenutan, a rep se smiruje.
 */
export function easeBrushStroke(progress) {
  const normalized = clamp(progress);
  return 1 - Math.pow(1 - normalized, 2.2);
}

/**
 * Approach faza (prethodni blok) i pinovani kadar u jednom monotonom
 * timeline-u sa konstantnom brzinom po pikselu skrola.
 */
export function toTimeline(approach, progress, share) {
  if (progress <= 0) return clamp(approach) * share;
  return share + clamp(progress) * (1 - share);
}

/**
 * @param {{
 *   timeline: number,
 *   windows: Record<string, readonly number[]>,
 * } & Record<string, unknown>} input
 */
export function resolveTakeoverScene(input) {
  const {
    timeline,
    windows,
    mode = "final",
    reducedMotion = false,
    mobile = false,
    washDisabled = false,
    hasArtwork = true,
  } = input;

  const isFinal = mode === "final";
  const forceStatic =
    reducedMotion ||
    mode === "hero-static" ||
    mode === "mask-debug" ||
    mode === "text-contrast";
  const showBackground =
    isFinal ||
    mode === "background" ||
    mode === "text-contrast" ||
    mode === "mask-debug";
  const showMotion = isFinal || mode === "hero-motion";

  const surface = isFinal
    ? reducedMotion
      ? 1
      : mapProgress(timeline, ...windows.surface)
    : 1;

  const backgroundProgress = showBackground
    ? isFinal
      ? reducedMotion
        ? 1
        : mapProgress(timeline, ...windows.background)
      : 1
    : 0;

  const contentWindow = mobile ? windows.contentMobile : windows.content;
  const content =
    mode === "text-contrast"
      ? 1
      : isFinal
        ? reducedMotion
          ? 1
          : mapProgress(timeline, ...contentWindow)
        : 0;

  const heroOpacity = hasArtwork
    ? 1
    : forceStatic
      ? 1
      : showMotion
        ? mapProgress(timeline, windows.strokes[0], windows.strokes[0] + 0.17)
        : 0;

  const holdDrift =
    reducedMotion || !isFinal ? 0 : mapProgress(timeline, ...windows.hold) * -1.6;

  const contrastProgress =
    washDisabled || !isFinal
      ? mode === "text-contrast"
        ? 1
        : 0
      : reducedMotion
        ? 1
        : mapProgress(timeline, ...windows.contrast);

  const lineworkProgress = forceStatic
    ? 1
    : showMotion
      ? mapProgress(timeline, ...windows.strokes)
      : 0;

  return {
    surface,
    /*
     * Wipe ide naniže: -32svh drži tamno tačno iznad gornje ivice kadra, a
     * +102svh ga spušta ispod donje.
     */
    surfaceOffsetSvh: -32 + surface * 134,
    artworkOffsetSvh: (1 - surface) * 18,
    backgroundProgress,
    backgroundOpacity: backgroundProgress,
    backgroundScale: reducedMotion ? 1 : 1 + (1 - backgroundProgress) * 0.015,
    backgroundXVw: reducedMotion ? 0 : (1 - backgroundProgress) * -0.55,
    backgroundYPx: reducedMotion ? 0 : (1 - backgroundProgress) * 8 + holdDrift,
    content,
    contentOpacity: content,
    contentOffsetPx: (1 - content) * 26,
    contrastOpacity: washDisabled
      ? 0
      : Math.max(contrastProgress * 0.92, backgroundProgress * 0.4),
    colorWashOpacity: washDisabled
      ? 0
      : reducedMotion
        ? 1
        : mapProgress(timeline, ...windows.background),
    heroOpacity,
    lineworkProgress,
    holdDrift,
  };
}
