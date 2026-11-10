/**
 * Sortiranje redova tabele po koloni (2026-11-10) — isto pravilo za sve tabele:
 *   - prazne vrednosti (null/undefined) uvek idu na kraj, u oba smera;
 *   - tekst po srpskom redosledu (č, ć, đ, š, ž);
 *   - jednake vrednosti zadržavaju zatečeni redosled (stabilno).
 *
 * @template T
 * @param {readonly T[]} rows
 * @param {(row: T) => string | number | null | undefined} value
 * @param {"asc" | "desc"} dir
 * @returns {T[]}
 */
export function sortRows(rows, value, dir) {
  const sign = dir === "desc" ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined || a.v === "";
      const bn = b.v === null || b.v === undefined || b.v === "";
      if (an || bn) return an === bn ? a.i - b.i : an ? 1 : -1;
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), "sr-Latn", { sensitivity: "base", numeric: true });
      return c === 0 ? a.i - b.i : sign * c;
    })
    .map((x) => x.row);
}

/**
 * Sledeće stanje posle klika na kolonu: ista kolona menja smer, nova kolona
 * počinje svojim prirodnim smerom (npr. „Kasni“ od najvećeg).
 *
 * @param {{ key: string, dir: "asc" | "desc" }} current
 * @param {string} key
 * @param {"asc" | "desc"} [firstDir]
 */
export function nextSort(current, key, firstDir = "asc") {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: firstDir };
}
