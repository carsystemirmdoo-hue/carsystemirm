import mixingBases from "@/data/rm-sync/mixing-bases.json";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import type { ProductVariantSection } from "@/types/product-detail";

/**
 * R-M mešne baze (toneri) kao redovi kartice sistema — odluka vlasnika 2026-10-12: vidljive u javnom
 * katalogu i poručive za prijavljene kupce.
 *
 * Red nosi OZNAKU sa etikete (ona je ključ `?varijanta=` i veza artikla), liniju i potvrđeno
 * pakovanje. Zvanični naziv samo kada ga izvor potvrđuje (CRYSTAL BASE). Kodovi bez zvaničnog
 * identiteta nisu ovde — ne dobijaju javni red, poručuju se kroz „Izbor robe”.
 */
type MixingBaseRow = { code: string; name: string | null; packs: string[]; status: string; source: string; sourceNote: string };
const data = mixingBases as {
  cards: Record<string, MixingBaseRow[]>;
  notes?: Record<string, string>;
  productImages?: Record<string, { code: string; pack: string } | string>;
};
const cards = data.cards;
const notes: Record<string, string> = data.notes ?? {};

export const RM_CRYSTAL_BASE_SLUG = "rm-diamont-crystal-base";
/** Paste iz naše ponude potvrđene po etiketi (odluka vlasnika 2026-10-13), bez potvrđene linije. */
export const RM_PASTE_SLUG = "rm-paste-za-mesanje";

export function rmMixingBaseSection(slug: string): ProductVariantSection | null {
  const rows = cards[slug];
  if (!rows?.length) return null;
  return {
    title: "Mešne baze u ponudi",
    description:
      "Baze koje vodimo, po oznaci sa etikete i potvrđenom pakovanju. Nijansa se meša po formuli; dostupnost potvrđujemo kroz upit.",
    // Ključ `shade`: oznaka baze je ono po čemu se varijanta bira (getPrimaryVariantColumn), a ne pakovanje.
    columns: [
      { key: "shade", label: "Baza" },
      { key: "pack", label: "Pakovanje" },
      { key: "status", label: "Javni status" },
    ],
    rows: rows.map((row) => ({
      id: row.code,
      values: {
        shade: row.name ? `${row.code} — ${row.name}` : row.code,
        pack: row.packs.join(" · "),
        status: "Na upit",
      },
      reviewStatus: "confirmed" as const,
    })),
    note:
      notes[slug] ??
      "Oznake sa etikete pakovanja; zvanični nazivi: rmpaint.com (Crystal bases) i BASF „Diamont Tinting Base Characteristics”.",
  };
}

/** Dodaje redove mešnih baza kartici sistema; postojeći odeljak varijanti se ne gazi. */
export function withRmMixingBases(product: CarsystemProduct): CarsystemProduct {
  const section = rmMixingBaseSection(product.slug);
  if (!section || product.detail?.variants) return product;
  return {
    ...product,
    detail: { reviewStatus: "confirmed", ...product.detail, variants: { reviewStatus: "confirmed", content: section } },
  };
}

/**
 * Zapremina koju prikazuje fotografija kartice (npr. „4 L“ za DIAMONT BC 100), kada je vidljiva
 * na samoj fotografiji. `null` znači da zapremina slike nije potvrđena (2026-10-20).
 */
export function rmProductImagePack(slug: string): string | null {
  const entry = data.productImages?.[slug];
  return entry && typeof entry === "object" ? entry.pack : null;
}
