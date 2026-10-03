/**
 * Aktivan / neaktivan kupac — pravila bez baze.
 *
 * Neaktivan kupac je poslovna odluka („više ne radi sa nama"): istorijske
 * fakture, veze šifara i kartica ostaju, ali se kupac podrazumevano izostavlja
 * sa „Za razgovor", iz predloga i iz poziva za nalog. Pregled je moguć kroz
 * poseban filter. Status ne briše ništa i vraća se istom radnjom.
 */

/** Filter liste po statusu kupca. */
export const CUSTOMER_STATUS_FILTERS = /** @type {const} */ (["aktivni", "neaktivni", "svi"]);

/**
 * @param {unknown} value  vrednost iz adrese
 * @param {"aktivni" | "neaktivni" | "svi"} [podrazumevano]
 * @returns {"aktivni" | "neaktivni" | "svi"}
 */
export function parseCustomerStatusFilter(value, podrazumevano = "aktivni") {
  return CUSTOMER_STATUS_FILTERS.includes(/** @type {any} */ (value)) ? /** @type {any} */ (value) : podrazumevano;
}

/**
 * Da li kupac sa datim `active` prolazi filter.
 * @param {boolean} active
 * @param {"aktivni" | "neaktivni" | "svi"} filter
 */
export function matchesStatusFilter(active, filter) {
  return filter === "svi" || (filter === "aktivni" ? active : !active);
}

export const STATUS_CHANGE_ERRORS = Object.freeze({
  reason_short: "Upišite razlog (najmanje 3 znaka).",
  no_change: "Kupac je već u tom stanju.",
});

/**
 * @param {{ currentActive: boolean, nextActive: boolean, reason: unknown }} input
 * @returns {{ ok: true, reason: string } | { ok: false, code: keyof typeof STATUS_CHANGE_ERRORS }}
 */
export function validateStatusChange({ currentActive, nextActive, reason }) {
  const r = typeof reason === "string" ? reason.trim() : "";
  if (r.length < 3) return { ok: false, code: "reason_short" };
  if (currentActive === nextActive) return { ok: false, code: "no_change" };
  return { ok: true, reason: r };
}
