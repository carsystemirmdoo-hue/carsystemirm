/**
 * Filter liste kupaca (revizija 2026-10-11, B5): pretraga po nazivu, PIB-u i
 * gradu bez obzira na kvačice i veličinu slova, i komercijalista po DODELI
 * (`customer_assignments`) — ne po komercijalisti sa fakture.
 *
 * `rep`: UUID komercijaliste, `"bez"` (bez dodele) ili prazno (svi).
 */

/** @param {string} value */
export function fold(value) {
  return String(value ?? "").replace(/đ/g, "dj").replace(/Đ/g, "DJ").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {{ q?: unknown, komercijalista?: unknown }} raw */
export function parseCustomerListFilter(raw) {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const r = typeof raw.komercijalista === "string" ? raw.komercijalista : "";
  return { q, rep: r === "bez" ? "bez" : UUID.test(r) ? r : "" };
}

/**
 * @template {{ id: string, name: string, pib?: string | null, city?: string | null }} C
 * @param {C[]} customers
 * @param {{ q: string, rep: string }} filter
 * @param {Map<string, { id: string, name: string }[]>} assignees
 * @returns {C[]}
 */
export function filterCustomerList(customers, filter, assignees) {
  const words = fold(filter.q).split(/\s+/).filter(Boolean);
  return customers.filter((c) => {
    if (words.length) {
      const hay = fold(`${c.name} ${c.pib ?? ""} ${c.city ?? ""}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    const reps = assignees.get(c.id) ?? [];
    if (filter.rep === "bez") return reps.length === 0;
    if (filter.rep) return reps.some((r) => r.id === filter.rep);
    return true;
  });
}

/**
 * Abecedni redosled kakav kancelarija traži u spisku: vodeći navodnici,
 * crtice i razmaci iz BizniSoft naziva (`"DELTA DOO"`, `" GAMA…`) se
 * preskaču, pa kupac stoji pod svojim slovom, a ne na vrhu liste.
 *
 * @template {{ name: string }} C
 * @param {C[]} customers
 * @returns {C[]}
 */
export function sortCustomersByName(customers) {
  return [...customers].sort((a, b) => compareCustomerNames(a.name, b.name));
}

/** Poređenje dva naziva kupca po istom pravilu kao `sortCustomersByName`. */
export function compareCustomerNames(a, b) {
  const key = (name) => String(name ?? "").replace(/^[^\p{L}\p{N}]+/u, "");
  return key(a).localeCompare(key(b), "sr-Latn", { sensitivity: "base", numeric: true });
}
