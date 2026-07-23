export const CATALOG_BATCH_SIZE = 48;
export const CATALOG_PRELOAD_ROWS = 3;

/**
 * Counts the tracks from the resolved grid-template-columns value. Browsers
 * normally expose pixel tracks here; the repeat() fallback keeps the helper
 * predictable in tests and older engines.
 *
 * @param {string} gridTemplateColumns
 * @returns {number}
 */
export function getCatalogGridColumnCount(gridTemplateColumns) {
  const value = gridTemplateColumns.trim();
  if (!value || value === "none") return 1;

  const repeatMatch = value.match(/^repeat\(\s*(\d+)\s*,/);
  if (repeatMatch) return Math.max(1, Number.parseInt(repeatMatch[1], 10));

  let depth = 0;
  let columns = 0;
  let tokenOpen = false;

  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);

    if (/\s/.test(character) && depth === 0) {
      if (tokenOpen) columns += 1;
      tokenOpen = false;
      continue;
    }

    tokenOpen = true;
  }

  if (tokenOpen) columns += 1;
  return Math.max(1, columns);
}

/**
 * Zero-based product index observed by IntersectionObserver.
 *
 * @param {number} visibleCount
 * @param {number} columnCount
 * @returns {number}
 */
export function getCatalogPreloadTriggerIndex(visibleCount, columnCount) {
  if (visibleCount <= 0) return -1;

  const safeColumnCount = Math.max(1, Math.floor(columnCount));
  return Math.max(0, visibleCount - CATALOG_PRELOAD_ROWS * safeColumnCount);
}

/**
 * Clamps each append to the filtered result size so the final batch can be
 * smaller than 48 without scheduling an empty follow-up render.
 *
 * @param {number} visibleCount
 * @param {number} resultCount
 * @returns {number}
 */
export function getCatalogNextVisibleCount(visibleCount, resultCount) {
  const safeResultCount = Math.max(0, Math.floor(resultCount));
  const safeVisibleCount = Math.max(0, Math.floor(visibleCount));
  return Math.min(safeVisibleCount + CATALOG_BATCH_SIZE, safeResultCount);
}
