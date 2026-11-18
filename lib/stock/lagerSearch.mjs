/**
 * Pretraga lager liste (2026-11-16): komercijalista kuca šifru, deo naziva ili brend.
 *
 *  - bez razlike velikih/malih slova i kvačica („cetka“ nalazi „Četka“, „dj“ nalazi „đ“);
 *  - više reči = sve moraju da se nađu, bilo gde (šifra, naziv, brend, grupa);
 *  - šifra se poredi i bez vodećih nula („91“ nalazi „091“);
 *  - red čija šifra počinje upitom ide na vrh.
 */

/** @param {string} s */
export function foldText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} code */
const codeVariants = (code) => {
  const c = foldText(code);
  const bare = c.replace(/^0+(?=[0-9])/, "");
  return bare === c ? c : `${c} ${bare}`;
};

/**
 * Tekst po kome se red traži (računa se jednom, ne na svaki taster).
 * @param {{ code: string, name: string, brand?: string | null, group?: string | null }} row
 */
export function searchHaystack(row) {
  return `${codeVariants(row.code)} ${foldText(row.name)} ${foldText(row.brand ?? "")} ${foldText(row.group ?? "")}`;
}

/**
 * @template {{ code: string, hay: string }} T
 * @param {readonly T[]} rows
 * @param {string} query
 * @returns {T[]}
 */
export function searchLager(rows, query) {
  const q = foldText(query);
  if (!q) return [...rows];
  const words = q.split(" ");
  const bareQ = q.replace(/^0+(?=[0-9])/, "");
  const hits = rows.filter((r) => words.every((w) => r.hay.includes(w)));
  const codeFirst = (/** @type {T} */ r) => {
    const c = foldText(r.code);
    const bare = c.replace(/^0+(?=[0-9])/, "");
    return c === q || bare === bareQ ? 0 : c.startsWith(q) || bare.startsWith(bareQ) ? 1 : 2;
  };
  return hits
    .map((r, i) => ({ r, i, k: codeFirst(r) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Brendovi van programa — ne prikazuju se na Lager listi ni kada ih ima na lageru:
 * 3M (odluka vlasnika 2026-11-16) i sia (2026-11-18). Šifre sa lagera kojih nema u šifarniku
 * nemaju zapis „van programa“, pa se prepoznaju po nazivu („3M …“, „SIA …“) ili brendu.
 * „3MM“, „33M“, „SIAJ…“ i slično se ne računaju.
 * @param {{ name: string, brand?: string | null }} row
 */
export function isOutOfProgrammeBrand(row) {
  const re = /^\s*(3m|sia)(?![a-z0-9])/i;
  return re.test(row.name ?? "") || /^\s*(3m|sia)\s*$/i.test(row.brand ?? "");
}
