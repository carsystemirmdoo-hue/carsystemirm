/**
 * V6 fit + shadow model — čista logika aktivacije (bez manifesta, bez Reacta).
 *
 * Zašto `.mjs`: isto kao `lib/productPaintRule.mjs` — pravilo mora moći da se
 * izvrši u `node --test` bez transpajlera, a server-only adapter
 * (`lib/product-fit-model.ts`) ga samo spaja sa izmerenim manifestom.
 *
 * V6 je aktivan SAMO kada su sva četiri uslova ispunjena:
 *   1. proizvod je brenda `carsystem`;
 *   2. slug nije na listi izuzetaka;
 *   3. generator je za tu sliku upisao V6 polja (`subjectBox`, …);
 *   4. polja prolaze sanity proveru ispod.
 * U svakom drugom slučaju funkcija vraća `null`, površina ne dobija nijedan V6
 * atribut i važi zatečeni (legacy) fit i zatečeni model senki.
 */

export const V6_FIT_MODEL_VERSION = 1;
export const V6_FIT_BRAND_SLUG = "carsystem";

/**
 * Privremeno izuzeti od V6 (odluka vlasnika posle pred-implementacione provere):
 *   - multi-flow            rep zvanične senke bi prešao ivicu kartice;
 *   - paint-system-cps-3-0  kraj refleksije prelazi ivicu kartice;
 *   - h2o-cleaner           7,1 px do ivice PDP stage-a.
 * Za njih ostaje zatečeno ponašanje u celini — i fit i senke.
 */
export const V6_FIT_EXCLUDED_SLUGS = Object.freeze([
  "carsystem-multi-flow",
  "carsystem-paint-system-cps-3-0",
  "carsystem-h2o-cleaner",
]);

/** @typedef {"strong" | "thin" | "none" | "unknown"} OfficialShadow */

/** @type {readonly OfficialShadow[]} */
export const OFFICIAL_SHADOW_VALUES = Object.freeze(["strong", "thin", "none", "unknown"]);

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Da li su V6 polja jedne slike upotrebljiva. Namerno strogo: sumnjiva metrika
 * znači legacy fit, nikad „pokušaj pa vidi".
 *
 * @param {unknown} metrics zapis iz `data/product-image-metrics.generated.json`
 * @returns {boolean}
 */
export function isSaneSubjectMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return false;
  const record = /** @type {Record<string, unknown>} */ (metrics);
  if (record.fitModelVersion !== V6_FIT_MODEL_VERSION) return false;
  if (!OFFICIAL_SHADOW_VALUES.includes(/** @type {OfficialShadow} */ (record.officialShadow))) return false;

  const { w, h, box, subjectBox, subjectAspect, subjectCenter } = record;
  if (!isFiniteNumber(w) || !isFiniteNumber(h) || w <= 0 || h <= 0) return false;
  if (!Array.isArray(box) || box.length !== 4 || !box.every(isFiniteNumber)) return false;
  if (!Array.isArray(subjectBox) || subjectBox.length !== 4 || !subjectBox.every(isFiniteNumber)) return false;

  const [x, y, sw, sh] = subjectBox;
  const [bx, by, bw, bh] = box;
  if (sw < 8 || sh < 8) return false;
  // Subjekt je uvek UNUTAR zatečenog boxa (zatečeni box = sve sa alfom > 24).
  if (x < bx || y < by || x + sw > bx + bw || y + sh > by + bh) return false;
  if (x < 0 || y < 0 || x + sw > w || y + sh > h) return false;
  // Najveće dopušteno povećanje prikaza; iznad toga nešto nije u redu sa merenjem.
  if (Math.min(bw / sw, bh / sh) > 1.4) return false;
  if (sw * sh < 0.25 * bw * bh) return false;

  if (!isFiniteNumber(subjectAspect) || Math.abs(subjectAspect - sw / sh) > 0.01) return false;
  if (!Array.isArray(subjectCenter) || subjectCenter.length !== 2 || !subjectCenter.every(isFiniteNumber)) return false;
  return true;
}

/**
 * @param {{ slug: string, brandSlug: string }} product
 * @param {unknown} metrics
 * @returns {OfficialShadow | null} model senke kada je V6 aktivan, inače `null` (legacy)
 */
export function resolveOfficialShadowV6(product, metrics) {
  if (!product || product.brandSlug !== V6_FIT_BRAND_SLUG) return null;
  if (V6_FIT_EXCLUDED_SLUGS.includes(product.slug)) return null;
  if (!isSaneSubjectMetrics(metrics)) return null;
  return /** @type {OfficialShadow} */ (/** @type {Record<string, unknown>} */ (metrics).officialShadow);
}
