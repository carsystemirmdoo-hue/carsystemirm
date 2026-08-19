/**
 * Deterministic geometry for the icon-rain → pile scene.
 *
 * Pure functions, no DOM, no randomness at call time: everything derives from a
 * product or group seed, so the server and the browser compute byte-identical
 * coordinates and there is no hydration mismatch to reconcile. It also means a
 * given group always animates the same way, which is what makes the end state
 * safe to ship as a static composition.
 *
 * Coordinates are in container-query units of the scene: `x` in `cqw`, `y` in
 * `cqh`. That keeps a 390 px phone and a 1440 px desktop showing the same
 * composition rather than the same pixel offsets.
 *
 * There is no physics engine and no per-frame JavaScript. Each glyph gets four
 * pre-computed waypoints — release, first contact, bounce apex, rest — and CSS
 * interpolates between them.
 */

/** Mulberry32. Small, fast, and identical across runtimes. */
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
 * The three review variants.
 *
 * They differ in what the pile is trying to say, not just in numbers:
 *
 *   precise   — a measured technical field. Small glyphs, narrow release band,
 *               low rotation, a tightly packed heap. For group pages.
 *   spill     — material that landed on a bench. Mixed sizes, wider spread,
 *               more rotation, a few pieces that came to rest outside the heap.
 *   cascade   — the calmest, most B2B reading. Glyphs fall through four fixed
 *               columns and settle into a broad, low plinth under the product.
 */
export const RAIN_VARIANTS = {
  precise: {
    count: 30,
    sizeRange: [4.4, 6.2],
    columns: 0,
    releaseSpread: 0.82,
    jitterX: 1.1,
    jitterY: 0.5,
    rotationRange: 26,
    restRotationRange: 16,
    pileWidth: 62,
    baseSlots: 9,
    rowStep: 0.62,
    strays: 0,
    bounce: 1.5,
  },
  spill: {
    count: 34,
    sizeRange: [3.8, 8.2],
    columns: 0,
    releaseSpread: 1,
    jitterX: 3.4,
    jitterY: 1.6,
    rotationRange: 62,
    restRotationRange: 48,
    pileWidth: 78,
    baseSlots: 8,
    rowStep: 0.55,
    strays: 4,
    bounce: 2.6,
  },
  cascade: {
    count: 28,
    sizeRange: [4.6, 6.4],
    columns: 4,
    releaseSpread: 0.9,
    jitterX: 0.7,
    jitterY: 0.35,
    rotationRange: 14,
    restRotationRange: 8,
    pileWidth: 84,
    baseSlots: 12,
    rowStep: 0.5,
    strays: 0,
    bounce: 1,
  },
};

export const RAIN_TIMING = {
  /** Longest an individual glyph is in the air. */
  durationRange: [640, 760],
  /** Window over which releases are staggered. */
  maxStagger: 280,
  /** Fraction of each glyph's own timeline spent falling. */
  contactAt: 0.62,
  bounceAt: 0.78,
};

/** Total wall-clock length of the sequence, in ms. */
export function totalDuration() {
  return RAIN_TIMING.maxStagger + RAIN_TIMING.durationRange[1];
}

/**
 * Builds the pile: a bottom-up stack of slots that narrows as it rises, with
 * every other row offset by half a slot so pieces sit in the gaps below rather
 * than in a grid. Slots are returned bottom row first, which is also the order
 * they must land in — a piece cannot come to rest on top of one that has not
 * arrived yet.
 */
export function buildPileSlots(variant, floorY) {
  const slots = [];
  const slotWidth = variant.pileWidth / variant.baseSlots;
  const left = 50 - variant.pileWidth / 2;

  let row = 0;
  while (slots.length < variant.count && row < variant.baseSlots) {
    const slotsInRow = Math.max(variant.baseSlots - row, 1);
    const rowWidth = slotsInRow * slotWidth;
    const rowLeft = 50 - rowWidth / 2;
    const y = floorY - row * variant.rowStep * slotWidth;

    for (let index = 0; index < slotsInRow && slots.length < variant.count; index += 1) {
      slots.push({ x: rowLeft + slotWidth * (index + 0.5), y, row });
    }
    row += 1;
  }

  // A pile taller than its base has run out of rows before it ran out of
  // pieces; the remainder widens the floor instead of stacking into a spire.
  let overflow = 0;
  while (slots.length < variant.count) {
    const side = overflow % 2 === 0 ? -1 : 1;
    const step = Math.floor(overflow / 2) + 1;
    slots.push({
      x: left + variant.pileWidth / 2 + side * (variant.pileWidth / 2 + step * slotWidth),
      y: floorY,
      row: 0,
    });
    overflow += 1;
  }

  return slots;
}

/**
 * Full per-glyph plan: which glyph, how big, where it is released, where it
 * touches down, how far it bounces, where it comes to rest, and when.
 *
 * `glyphIds` is the caller's category glyph set; the plan cycles through it so
 * a scene only ever shows objects that belong to its own product group.
 */
export function planIconRain({ seed, variant: variantName, glyphIds, floorY = 88 }) {
  const variant = RAIN_VARIANTS[variantName] ?? RAIN_VARIANTS.precise;
  const random = createRandom(seed);
  const slots = buildPileSlots(variant, floorY);

  // Bottom rows land first. Within a row the order is shuffled deterministically
  // so the fall does not read as a left-to-right sweep.
  const order = slots
    .map((slot, index) => ({ index, row: slot.row, key: random() }))
    .sort((a, b) => a.row - b.row || a.key - b.key);

  const [minSize, maxSize] = variant.sizeRange;
  const [minDuration, maxDuration] = RAIN_TIMING.durationRange;

  return order.map((entry, sequence) => {
    const slot = slots[entry.index];
    const size = round(minSize + random() * (maxSize - minSize));
    const stray =
      variant.strays > 0 && sequence >= order.length - variant.strays;

    const restX = round(
      stray
        ? slot.x + (random() < 0.5 ? -1 : 1) * (variant.pileWidth / 2 + 4 + random() * 9)
        : slot.x + (random() - 0.5) * 2 * variant.jitterX,
    );
    const restY = round(
      (stray ? floorY + 1.5 : slot.y) + (random() - 0.5) * 2 * variant.jitterY,
    );

    // Release point. With columns the horizontal band is quantised, which is
    // what gives the cascade variant its readable structure.
    const releaseX = round(
      variant.columns > 0
        ? 50 +
            ((Math.floor(random() * variant.columns) + 0.5) / variant.columns - 0.5) *
              variant.pileWidth *
              variant.releaseSpread +
            (random() - 0.5) * 2
        : restX + (random() - 0.5) * 2 * (variant.pileWidth * 0.28 * variant.releaseSpread),
    );

    const restRotation = round((random() - 0.5) * 2 * variant.restRotationRange);
    const releaseRotation = round(
      restRotation + (random() - 0.5) * 2 * variant.rotationRange,
    );

    // First contact overshoots slightly, then the piece rebounds and settles.
    const contactY = round(restY + variant.bounce * 0.7);
    const contactX = round(releaseX + (restX - releaseX) * 0.94);
    const bounceY = round(restY - variant.bounce);
    const bounceX = round(restX + (restX - contactX) * 0.25);

    return {
      glyphId: glyphIds[sequence % glyphIds.length],
      size,
      stray,
      release: { x: releaseX, y: round(-12 - random() * 26), r: releaseRotation },
      contact: { x: contactX, y: contactY, r: round(restRotation + (releaseRotation - restRotation) * 0.18) },
      bounce: { x: bounceX, y: bounceY, r: round(restRotation * 1.12) },
      rest: { x: restX, y: restY, r: restRotation },
      delay: Math.round((sequence / Math.max(order.length - 1, 1)) * RAIN_TIMING.maxStagger),
      duration: Math.round(minDuration + random() * (maxDuration - minDuration)),
      opacity: round(0.16 + random() * 0.14),
    };
  });
}
