/**
 * Pakovanja varijanti jedne porodice (2026-10-20).
 *
 * Kada varijante (npr. R-M baze) postoje u više zapremina, izbor prvo poštuje
 * zapreminu: podrazumevano se vide samo varijante te zapremine, a „Sva
 * pakovanja“ ih prikazuje u grupama po zapremini. Grupe nastaju iz stvarnih
 * podataka o pakovanju svake varijante — ništa se ne pretpostavlja.
 */

const QUANTITY = /(\d+(?:[.,]\d+)?)\s*(ml|l|kg|g)(?![\p{L}\d])/giu;
const UNIT_LABEL = { ml: "ml", l: "L", kg: "kg", g: "g" };
const TO_BASE = { ml: 1, l: 1000, g: 1, kg: 1000 };

/** Sva pakovanja iz teksta („kanta 4 L“, „1 L · 4 L“) kao oznake „4 L“, „1 L“. */
export function packLabelsOf(text) {
  const labels = [];
  for (const match of String(text ?? "").matchAll(QUANTITY)) {
    const unit = match[2].toLowerCase();
    const value = match[1].replace(".", ",").replace(/,0+$/, "");
    const label = `${value} ${UNIT_LABEL[unit]}`;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

/** Količina u ml/g, za redosled od najvećeg pakovanja ka najmanjem. */
export function packAmount(label) {
  const match = /^(\d+(?:,\d+)?) (ml|L|kg|g)$/.exec(String(label ?? ""));
  if (!match) return 0;
  return Number(match[1].replace(",", ".")) * TO_BASE[match[2].toLowerCase()];
}

/** URL vrednost: „4 L“ → „4-l“, „0,5 L“ → „0-5-l“, „125 ml“ → „125-ml“. */
export function packSlug(label) {
  return String(label).toLowerCase().replace(/[ ,]+/g, "-");
}

/**
 * @param {readonly { id: string, package?: string | null, label?: string }[]} variants
 * @returns {{ packs: { label: string, slug: string, count: number }[], packsByVariant: Map<string, string[]> }}
 */
export function buildPackIndex(variants) {
  const packsByVariant = new Map();
  const counts = new Map();
  for (const variant of variants ?? []) {
    const labels = packLabelsOf(variant.package);
    packsByVariant.set(variant.id, labels);
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const packs = [...counts.entries()]
    .map(([label, count]) => ({ label, slug: packSlug(label), count }))
    .sort((a, b) => packAmount(b.label) - packAmount(a.label));
  return { packs, packsByVariant };
}

export const ALL_PACKS = "sva";
export const PACK_QUERY_PARAM = "pakovanje";
