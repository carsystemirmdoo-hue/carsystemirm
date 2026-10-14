/**
 * Količine pakovanja koje izvor navodi dvosmisleno i koje kupac ne sme da vidi kao potvrđeno
 * pakovanje dok ih ne proverimo. Interna evidencija: docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md
 * (GAP-015). Kada stavka bude potvrđena, vrednost ide u lib/verified-thousands.ts (sa dokazom),
 * a unos ovde se briše.
 *
 * Zamena je tačna (ceo zapis iz izvora), pa nepoznat zapis ostaje netaknut i test to hvata.
 */
export type UnverifiedQuantity = {
  article: string;
  raw: string;
  status: "otvoreno";
  replace: ReadonlyArray<readonly [from: string, to: string]>;
};

const NOTE = "veličina pakovanja se potvrđuje na upit";

export const unverifiedQuantities: Record<string, UnverifiedQuantity> = {
  // Carsystem fini kit, art. 124.126: izvor „1,000 g tin incl. hardener”, atribut „1.000 g”;
  // nema fotografije ni stavke u katalogu 2026/27 (provera 2026-10-14).
  "carsystem-fine-putty": {
    article: "124.126",
    raw: "1,000 g",
    status: "otvoreno",
    replace: [["Limenka 1,000 g sa učvršćivačem", `Limenka sa učvršćivačem (${NOTE})`]],
  },
};

/** Zamena dvosmislene količine neutralnim tekstom za prikaz kupcu. */
export function maskUnverifiedQuantity(slug: string, text: string): string {
  const item = unverifiedQuantities[slug];
  if (!item || typeof text !== "string" || !text.includes(item.raw)) return text;
  return item.replace.reduce((value, [from, to]) => value.split(from).join(to), text);
}
