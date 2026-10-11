/**
 * Koje ponude kupca važe za prikazani proizvod i varijantu, i šta tada piše u
 * oznaci statusa. Bez Reacta i bez baze — isto pravilo koriste panel kupovine
 * i oznaka statusa, pa ne smeju da se razilaze.
 *
 * @typedef {{ slug: string; variantKey: string | null; state: "orderable" | "no_price" | "no_pack" }} ViewOffer
 */

/** @param {string | null | undefined} a @param {string | null | undefined} b */
const same = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/**
 * Veza bez varijante važi za ceo proizvod, veza sa varijantom samo za tu varijantu.
 * @template {ViewOffer} T
 * @param {T[]} offers @param {string} slug @param {string[]} viewKeys
 * @returns {T[]}
 */
export function offersForView(offers, slug, viewKeys) {
  return offers.filter((o) => o.slug === slug && (o.variantKey === null || viewKeys.some((k) => same(k, o.variantKey))));
}

/**
 * Javni status (statičan, isti za sve) ostaje kada kupac nije prijavljen,
 * poručivanje nije uključeno ili za ovu varijantu nema potvrđenu vezu.
 * @param {ViewOffer[] | null} here @param {boolean} orderingEnabled @param {string} publicStatus
 */
export function customerStatusLabel(here, orderingEnabled, publicStatus) {
  if (!here || !orderingEnabled || here.length === 0) return publicStatus;
  return here.some((o) => o.state === "orderable") ? "Vaša cena potvrđena" : "Cena na upit";
}
