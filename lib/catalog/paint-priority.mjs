/**
 * Redosled „Preporučeno“ u kategoriji „Boje i lakovi“ (2026-10-20).
 *
 * Na početku su ključni sistemi, ostalo zadržava kurirani redosled podataka:
 *   1. R-M boje — tri izvedbe iz našeg programa (ONYX HD, DIAMONT, UNO HD; vidi
 *      components/rm-brand/rmBrandData.ts, sistemi boja),
 *   2. R-M kristal baze (DIAMONT CRYSTAL BASE),
 *   3. Baslac sistemi i baze (Basecoat 35/45, Topcoat 30/30 CV),
 *   4. bezbojni lakovi,
 *   5. sve ostalo iz grupe.
 *
 * Primenjuje se samo za podrazumevano sortiranje bez pretrage; izabrano
 * sortiranje korisnika se poštuje.
 */

export const PAINT_SYSTEM_PRIORITY = [
  ["rm-onyx-hd", "rm-diamont", "rm-uno-hd"],
  ["rm-diamont-crystal-base"],
  ["baslac-line-35", "baslac-line-45", "baslac-line-30", "baslac-line-30-cv"],
];

const priorityBySlug = new Map(
  PAINT_SYSTEM_PRIORITY.flatMap((group, groupIndex) =>
    group.map((slug, index) => [slug, groupIndex * 100 + index]),
  ),
);

const LACQUER_GROUP = PAINT_SYSTEM_PRIORITY.length * 100;
const REST_GROUP = LACQUER_GROUP + 100;

/** Ključ entiteta bez prefiksa porodice („family:baslac-line-35“ → „baslac-line-35“). */
function entityKey(entity) {
  const raw = entity.slug ?? entity.id ?? "";
  return String(raw).replace(/^family:/, "");
}

/** Bezbojni lak: R-M kategorija `clearcoat` ili naziv laka, bez učvršćivača i razređivača. */
export function isLacquer(entity) {
  if (entity.rmMetadata?.category === "clearcoat") return true;
  const name = String(entity.name ?? "");
  if (/harden|härter|thinn|reducer|razre|učvrš|activator|aktivator/i.test(name)) return false;
  return /\bclear\b|clearcoat|klarlack|bezbojni lak|\bklar\b/i.test(name);
}

export function paintPriority(entity) {
  const key = entityKey(entity);
  if (priorityBySlug.has(key)) return priorityBySlug.get(key);
  return isLacquer(entity) ? LACQUER_GROUP : REST_GROUP;
}

/** Stabilno sortiranje: unutar iste grupe ostaje postojeći redosled. */
export function orderPaintCategory(entities) {
  return entities
    .map((entity, index) => ({ entity, index, rank: paintPriority(entity) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entity }) => entity);
}
