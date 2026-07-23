export const BOTTOM_REVEAL_PROBABILITY = 0.24;
export const SAME_PRODUCT_BOTTOM_COOLDOWN = 2;
export const MAX_CONSECUTIVE_BOTTOM_REVEALS = 2;

const REVEAL_BAG_SIZE = 25;
const BOTTOM_REVEALS_PER_BAG = 6;

/**
 * Pure threshold helper kept separate from the shuffle bag so the exact
 * 24 percent boundary remains deterministic and directly testable.
 *
 * @param {number} randomValue
 * @returns {"top" | "bottom"}
 */
export function getRevealDirection(randomValue) {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) {
    throw new RangeError("randomValue must be a finite number between 0 and 1.");
  }

  return randomValue < BOTTOM_REVEAL_PROBABILITY ? "bottom" : "top";
}

/**
 * @param {() => number} random
 * @returns {Array<"top" | "bottom">}
 */
export function createRevealDirectionBag(random = Math.random) {
  const bag = [
    ...Array.from({ length: BOTTOM_REVEALS_PER_BAG }, () => /** @type {const} */ ("bottom")),
    ...Array.from(
      { length: REVEAL_BAG_SIZE - BOTTOM_REVEALS_PER_BAG },
      () => /** @type {const} */ ("top"),
    ),
  ];

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
    const swapIndex = Math.floor(randomValue * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }

  return bag;
}

/**
 * @param {{
 *   random?: () => number;
 *   bagFactory?: (random: () => number) => Array<"top" | "bottom">;
 * }} [options]
 */
export function createRevealDirectionSelector({
  random = Math.random,
  bagFactory = createRevealDirectionBag,
} = {}) {
  /** @type {Array<"top" | "bottom">} */
  let bag = [];
  let consecutiveBottomReveals = 0;
  /** @type {Map<string, number>} */
  const productBottomCooldowns = new Map();

  function takeNextCandidate() {
    if (bag.length === 0) bag = bagFactory(random);
    return bag.shift() ?? "top";
  }

  return {
    /**
     * Consumes exactly one shared bag entry for each completed new activation.
     * Cooldown and consecutive-bottom guards may safely downgrade a bottom
     * candidate to top, but never reroll or delay the activation.
     *
     * @param {string} productId
     * @returns {"top" | "bottom"}
     */
    next(productId) {
      const candidate = takeNextCandidate();
      const cooldown = productBottomCooldowns.get(productId) ?? 0;

      if (cooldown > 0) {
        const nextCooldown = cooldown - 1;
        if (nextCooldown > 0) productBottomCooldowns.set(productId, nextCooldown);
        else productBottomCooldowns.delete(productId);
      }

      const bottomIsBlocked =
        candidate === "bottom" &&
        (cooldown > 0 || consecutiveBottomReveals >= MAX_CONSECUTIVE_BOTTOM_REVEALS);
      const direction = bottomIsBlocked ? "top" : candidate;

      if (direction === "bottom") {
        productBottomCooldowns.set(productId, SAME_PRODUCT_BOTTOM_COOLDOWN);
        consecutiveBottomReveals += 1;
      } else {
        consecutiveBottomReveals = 0;
      }

      return direction;
    },
  };
}

const sharedRevealDirectionSelector = createRevealDirectionSelector();

/**
 * Shared by every product card in the current browser bundle. Product identity
 * is used only for the short bottom cooldown, never to derive a stable pattern.
 *
 * @param {string} productId
 * @returns {"top" | "bottom"}
 */
export function nextRevealDirection(productId) {
  return sharedRevealDirectionSelector.next(productId);
}
