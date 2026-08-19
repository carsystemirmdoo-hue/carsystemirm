/**
 * Composition study for the EXISTING spray/paint animation — INTERNAL.
 *
 * Nothing here changes the animation. The paths, keyframes, durations, easing,
 * stroke order, trigger, colour and reduced-motion behaviour all stay in
 * `ProductHeroSprayBackdrop`, which the study imports unmodified. The only
 * things this file describes are the two spatial relationships the review asked
 * about: how large the product is drawn, and how large the art layer is drawn.
 *
 * Measured starting point (production, 1440 px, stage 537x645)
 * ----------------------------------------------------------
 *   art band          291 x 355 px, spanning x 97..388
 *   art centre        x 242.5 — twenty-six px LEFT of the product centre
 *   product           130..310 px wide depending on the product
 *
 * Visible stroke either side of the silhouette, as a share of the stroke's own
 * length — the number the review is judging:
 *
 *   Effect Gold 451   left 33%  right 15%
 *   Flame Booster     left 37%  right 18%
 *   Molotow Burner    left 37%  right 18%
 *   R-M Diamont       left  2%  right  0%   (art narrower than the tin)
 *
 * So the complaint is precise: the right-hand side is starved, because the art
 * is offset to the left while the product sits on the stage centre. Widening
 * the art without also re-centring it would make the left side worse and leave
 * the right side short.
 */

/** The production values, so "Current" is reproduced rather than approximated. */
export const PRODUCTION = {
  /** `.stickyStage[data-product-stage-spray="true"]` in ProductDetailExperience. */
  sprayScale: 1.12,
  /** clamp(-12px, -0.8vw, -5px) — -11.5px at 1440. */
  sprayOffsetX: -11.5,
  sprayOffsetY: 4,
};

/**
 * The three compositions under review.
 *
 * `productScale` and `artScale` are MULTIPLIERS on the production values, not
 * absolute sizes: the study must not silently redefine the content-fit system,
 * only the relationship between the two layers.
 *
 * `artCentreX` cancels the production offset and re-centres the band on the
 * product. Without it the extra width lands almost entirely on the left, which
 * is the side that already had enough.
 */
export const COMPOSITIONS = {
  current: {
    label: "A — Current",
    note: "Produkcijsko stanje, bez ijedne promene.",
    productScale: 1,
    artScale: 1,
    artCentreX: 0,
  },
  balanced: {
    label: "B — Balanced",
    note: "Proizvod −5%, art +12%, art centriran na proizvod.",
    productScale: 0.95,
    artScale: 1.12,
    artCentreX: 26,
  },
  artForward: {
    label: "C — Art-forward",
    note: "Proizvod −8%, art +18%, art centriran na proizvod.",
    productScale: 0.92,
    artScale: 1.18,
    artCentreX: 26,
  },
};

export const COMPOSITION_ORDER = ["current", "balanced", "artForward"];

/**
 * The tokens a composition contributes. All three already exist as hooks in the
 * production stylesheet (`--product-stage-spray-scale`,
 * `--product-stage-spray-offset-x`), so the study drives the same knobs a
 * future production change would — it does not invent a parallel mechanism.
 *
 * `--study-product-scale` is lab-only and multiplies the size-class envelope;
 * it deliberately does NOT touch the alpha bounding-box content fit, so the
 * product is measured the same way in all three columns.
 */
export function compositionTokens(key) {
  const composition = COMPOSITIONS[key] ?? COMPOSITIONS.current;

  return {
    "--product-stage-spray-scale": PRODUCTION.sprayScale * composition.artScale,
    "--product-stage-spray-offset-x": `${PRODUCTION.sprayOffsetX + composition.artCentreX}px`,
    "--product-stage-spray-offset-y": `${PRODUCTION.sprayOffsetY}px`,
    "--study-product-scale": composition.productScale,
  };
}

/**
 * Visible stroke either side of the product, as a share of the stroke's own
 * length. The review's target is 25–35% on BOTH sides.
 */
export function strokeExposure({ artLeft, artRight, productLeft, productRight }) {
  const artWidth = artRight - artLeft;
  if (artWidth <= 0) return { left: 0, right: 0, artWidth: 0 };
  return {
    left: Math.round(((productLeft - artLeft) / artWidth) * 1000) / 10,
    right: Math.round(((artRight - productRight) / artWidth) * 1000) / 10,
    artWidth: Math.round(artWidth),
  };
}

export function isWithinTarget(exposure, min = 25, max = 35) {
  return (
    exposure.left >= min &&
    exposure.left <= max &&
    exposure.right >= min &&
    exposure.right <= max
  );
}
