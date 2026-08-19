/**
 * Icon rain → pile, V2 geometry — INTERNAL, non-production.
 *
 * V1 (`iconRainPile.mjs`) is untouched and still runs; this is a parallel
 * implementation so the two can be judged side by side and V2 can be dropped by
 * deleting its own files.
 *
 * What V2 changes, and why
 * -----------------------
 *   fewer, larger glyphs  — V1 drew 28–34 marks at 3.8–6.4 cqw, which read as
 *                           dust rather than as a disc, a tape roll or a
 *                           spatula. V2 draws exactly 24 at 6.2–9.4 cqw.
 *   a pile with a base    — V1 stacked rows that narrowed by one slot, so the
 *                           heap drifted upward into a mound. V2 tapers by two
 *                           and overlaps rows, so the bottom row visibly carries
 *                           the ones above it.
 *   a floor that fits     — the contact shadow is emitted with the plan and is
 *                           as wide as the pile actually is, instead of a fixed
 *                           blur under everything.
 *   calmer motion         — less rotation, a smaller bounce, and for the cascade
 *                           variant four genuinely fixed release columns.
 *
 * Still true from V1: pure functions, seeded, no DOM, no physics engine. The
 * server and the browser compute identical coordinates, so there is nothing to
 * reconcile on hydration.
 *
 * Coordinates are container-query units of the scene: `x` in `cqw`, `y` in
 * `cqh`.
 */

/** Mulberry32 — same generator as V1, so a shared seed is comparable. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value) => Math.round(value * 100) / 100;

/**
 * Two directions only. `spill` is deliberately absent: V1 keeps it as the
 * record of a rejected alternative, and it is not developed further.
 */
export const V2_VARIANTS = {
  cascade: {
    count: 24,
    sizeRange: [6.6, 8.8],
    /** Four genuinely fixed release columns. */
    columns: 4,
    columnSpread: 62,
    columnJitter: 1.4,
    jitterX: 0.6,
    jitterY: 0.3,
    /** Release rotation deviates this much from the resting angle. */
    rotationRange: 10,
    restRotationRange: 5,
    pileWidth: 80,
    baseSlots: 9,
    rowTaper: 2,
    /** Row spacing as a fraction of a glyph's own height. See `rowStep()`. */
    rowStepFactor: 0.58,
    /* The base row's CENTRE. A glyph is ~10 cqh tall on a 4:3 frame, so 90 put
       half of the bottom row outside the scene and the pile read as cropped. */
    floorY: 86,
    bounce: 1,
    /** Distinct glyph shapes drawn from the category set. */
    glyphVariety: 4,
  },
  precise: {
    count: 24,
    sizeRange: [6.2, 9.4],
    columns: 0,
    columnSpread: 46,
    columnJitter: 0,
    jitterX: 1.6,
    jitterY: 0.6,
    rotationRange: 24,
    restRotationRange: 12,
    pileWidth: 62,
    baseSlots: 7,
    rowTaper: 1,
    rowStepFactor: 0.62,
    floorY: 86,
    bounce: 1.7,
    glyphVariety: 3,
  },
};

/**
 * The scene frame's own proportions, used only to convert a glyph's size from
 * `cqw` into `cqh`.
 *
 * This conversion is the whole reason rows stack at all. Sizes are horizontal
 * units and row spacing is vertical, so a step written directly in `cqh` is not
 * comparable to a glyph's height: at 4.4 cqh on a 4:3 frame the rows overlapped
 * by more than 80% and the "pile" rendered as a single line of icons.
 *
 * The lab frames are 4:3. A frame with different proportions would need this
 * value changed with it.
 */
export const V2_FRAME_ASPECT = 4 / 3;

/** Vertical distance between pile rows, in `cqh`. */
export function rowStep(variant, frameAspect = V2_FRAME_ASPECT) {
  const meanSize = (variant.sizeRange[0] + variant.sizeRange[1]) / 2;
  return round(meanSize * frameAspect * variant.rowStepFactor);
}

export const V2_TIMING = {
  durationRange: [620, 740],
  maxStagger: 300,
  contactAt: 0.6,
  bounceAt: 0.78,
};

/** Total wall-clock length of the sequence, in ms. */
export function totalDurationV2() {
  return V2_TIMING.maxStagger + V2_TIMING.durationRange[1];
}

/**
 * Rows from the floor up, tapering fast so the result is low and wide rather
 * than a spire. Rows overlap vertically by design: a row sitting exactly on top
 * of the one below looks stacked, while a row sunk slightly into the gaps looks
 * carried.
 *
 * Any pieces left after the last full row go into a short top row, centred —
 * never a new column beside the pile, which is what made V1's overflow read as
 * scattered debris.
 */
export function buildPileSlotsV2(variant, frameAspect = V2_FRAME_ASPECT) {
  const slots = [];
  const slotWidth = variant.pileWidth / variant.baseSlots;
  const step = rowStep(variant, frameAspect);

  let row = 0;
  let slotsInRow = variant.baseSlots;
  while (slots.length < variant.count && slotsInRow > 0) {
    const remaining = variant.count - slots.length;
    const take = Math.min(slotsInRow, remaining);
    const rowWidth = take * slotWidth;
    const rowLeft = 50 - rowWidth / 2;
    const y = variant.floorY - row * step;

    for (let index = 0; index < take; index += 1) {
      slots.push({
        x: rowLeft + slotWidth * (index + 0.5),
        y,
        row,
        /** Bottom row carries the pile and gets the contact shadow. */
        isBase: row === 0,
      });
    }

    row += 1;
    slotsInRow -= variant.rowTaper;
  }

  // A taper that runs out before the count does would silently drop pieces.
  // Widen the base instead, keeping everything on the floor line.
  let overflow = 0;
  while (slots.length < variant.count) {
    const side = overflow % 2 === 0 ? -1 : 1;
    const outward = Math.floor(overflow / 2) + 1;
    slots.push({
      x: 50 + side * (variant.pileWidth / 2 + (outward - 0.5) * slotWidth),
      y: variant.floorY,
      row: 0,
      isBase: true,
    });
    overflow += 1;
  }

  return slots;
}

/**
 * Where the pile's contact shadow goes. It follows the base row rather than the
 * whole frame, so the heap sits on something instead of floating over a blur.
 */
export function pileFootprint(variant, slots) {
  const base = slots.filter((slot) => slot.isBase);
  const xs = base.map((slot) => slot.x);
  const slotWidth = variant.pileWidth / variant.baseSlots;
  const left = Math.min(...xs) - slotWidth / 2;
  const right = Math.max(...xs) + slotWidth / 2;

  return {
    centerX: round((left + right) / 2),
    width: round(right - left),
    /** A narrow, darker core directly under the base row. */
    coreWidth: round((right - left) * 0.62),
    y: variant.floorY,
  };
}

/**
 * Full per-glyph plan. Same four-waypoint shape as V1 — release, first contact
 * (overshooting the resting line), rebound, rest — so the two versions are
 * measured the same way.
 *
 * `glyphIds` is the caller's category set. V2 uses at most `glyphVariety` of
 * them: with only 24 marks on screen, cycling through every shape in a category
 * turns the pile into noise, while three or four repeated shapes read as a
 * material.
 */
export function planIconRainV2({ seed, variant: variantName, glyphIds }) {
  const variant = V2_VARIANTS[variantName] ?? V2_VARIANTS.cascade;
  const random = createRandom(seed);
  const slots = buildPileSlotsV2(variant);
  const shapes = glyphIds.slice(0, Math.max(1, variant.glyphVariety));

  // Bottom rows are released first: nothing may land on a piece that has not
  // arrived. Within a row the order is shuffled deterministically so the fall
  // does not read as a left-to-right sweep.
  const order = slots
    .map((slot, index) => ({ index, row: slot.row, key: random() }))
    .sort((a, b) => a.row - b.row || a.key - b.key);

  const [minSize, maxSize] = variant.sizeRange;
  const [minDuration, maxDuration] = V2_TIMING.durationRange;

  return order.map((entry, sequence) => {
    const slot = slots[entry.index];
    const size = round(minSize + random() * (maxSize - minSize));

    const restX = round(slot.x + (random() - 0.5) * 2 * variant.jitterX);
    const restY = round(slot.y + (random() - 0.5) * 2 * variant.jitterY);

    const releaseX = round(
      variant.columns > 0
        ? 50 +
            ((Math.floor(random() * variant.columns) + 0.5) / variant.columns - 0.5) *
              variant.columnSpread +
            (random() - 0.5) * 2 * variant.columnJitter
        : restX + (random() - 0.5) * variant.columnSpread * 0.5,
    );

    const restRotation = round((random() - 0.5) * 2 * variant.restRotationRange);
    const releaseRotation = round(
      restRotation + (random() - 0.5) * 2 * variant.rotationRange,
    );

    const contactY = round(restY + variant.bounce * 0.7);
    const contactX = round(releaseX + (restX - releaseX) * 0.95);
    const bounceY = round(restY - variant.bounce);
    const bounceX = round(restX + (restX - contactX) * 0.2);

    return {
      glyphId: shapes[sequence % shapes.length],
      size,
      isBase: slot.isBase,
      row: slot.row,
      release: { x: releaseX, y: round(-14 - random() * 22), r: releaseRotation },
      contact: {
        x: contactX,
        y: contactY,
        r: round(restRotation + (releaseRotation - restRotation) * 0.15),
      },
      bounce: { x: bounceX, y: bounceY, r: round(restRotation * 1.08) },
      rest: { x: restX, y: restY, r: restRotation },
      delay: Math.round((sequence / Math.max(order.length - 1, 1)) * V2_TIMING.maxStagger),
      duration: Math.round(minDuration + random() * (maxDuration - minDuration)),
      /*
       * Depth cue rather than decoration: pieces at the front of the pile are
       * drawn more strongly than the ones behind. The absolute range is set by
       * the theme tokens in the stylesheet; this is the per-piece multiplier.
       */
      weight: round(0.72 + (slot.isBase ? 0.28 : Math.max(0, 0.2 - slot.row * 0.06))),
    };
  });
}

/** Everything the scene needs in one call. */
export function planSceneV2({ seed, variant: variantName, glyphIds }) {
  const variant = V2_VARIANTS[variantName] ?? V2_VARIANTS.cascade;
  const slots = buildPileSlotsV2(variant);

  return {
    glyphs: planIconRainV2({ seed, variant: variantName, glyphIds }),
    footprint: pileFootprint(variant, slots),
    /** Top edge of the pile, so the product can sit just above it. */
    pileTopY: round(Math.min(...slots.map((slot) => slot.y))),
    totalDuration: totalDurationV2(),
  };
}
