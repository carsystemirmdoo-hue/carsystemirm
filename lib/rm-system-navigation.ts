import catalog from "@/data/rm-catalog-products.generated.json";
import mixingBases from "@/data/rm-sync/mixing-bases.json";
import { RM_CRYSTAL_BASE_SLUG, RM_PASTE_SLUG } from "@/lib/rm-mixing-bases";

/**
 * Navigacija R-M linije (2026-10-20): prezentacija sistema i kartice za IZBOR artikala
 * moraju biti povezane u oba smera, da korisnik iz kataloga lako stigne do baza.
 *
 * Članstvo u liniji se čita iz zvaničnog polja `line` (info.rmpaint.com), ne iz sličnosti
 * naziva. Kartice izbora (redovi baza iz `data/rm-sync/mixing-bases.json`) su naše i
 * navode se izričito, sa stvarnim brojem baza po zapremini.
 */

type CatalogEntry = {
  slug: string;
  name: string;
  code: string | null;
  line: string | null;
  kind: string;
  content: { productType: string };
};
type MixingRow = { code: string; packs: string[] };

const entries = (catalog as unknown as { products: CatalogEntry[] }).products;
const cards = (mixingBases as unknown as { cards: Record<string, MixingRow[]> }).cards;

export type RmSystemLink = {
  slug: string;
  href: string;
  label: string;
  /** Namena ili izvedba (npr. „za komercijalna vozila“), da slične kartice ne budu iste. */
  note: string;
  /** Kartica sa izborom baza po zapremini. */
  selection?: boolean;
};

export type RmSystemNavigation = {
  line: string;
  title: string;
  note?: string;
  links: RmSystemLink[];
};

/** Isti prikazni nazivi kao u `lib/rm-catalog-products.ts`. */
const DISPLAY_NAMES: Record<string, string> = { "rm-diamont": "R-M DIAMONT var CV" };

function packVolume(pack: string) {
  return pack.match(/\d+(?:,\d+)?\s*(?:L|ml)\b/)?.[0] ?? pack;
}

/** „4 L: 6 · 1 L: 15 · 0,5 L: 14“ — broj baza po zapremini, od najveće. */
export function rmSelectionPackSummary(slug: string) {
  const counts = new Map<string, number>();
  for (const row of cards[slug] ?? []) {
    for (const pack of row.packs) {
      const volume = packVolume(pack);
      counts.set(volume, (counts.get(volume) ?? 0) + 1);
    }
  }
  const litres = (volume: string) => Number(volume.replace(",", ".").replace(/\s*(L|ml)$/, "")) / (volume.endsWith("ml") ? 1000 : 1);
  return [...counts.entries()]
    .sort(([a], [b]) => litres(b) - litres(a))
    .map(([volume, count]) => `${volume}: ${count}`)
    .join(" · ");
}

function lineLinks(line: string): RmSystemLink[] {
  return entries
    .filter((entry) => entry.line === line)
    .sort((a, b) => Number(b.kind === "system") - Number(a.kind === "system"))
    .map((entry) => {
      const kindNote = entry.kind === "system" ? "prezentacija sistema" : entry.content.productType;
      return {
        slug: entry.slug,
        href: `/proizvodi/${entry.slug}`,
        label: DISPLAY_NAMES[entry.slug] ?? entry.name,
        note: entry.code && entry.kind !== "system" ? `${entry.code} · ${kindNote}` : kindNote,
      };
    });
}

function selectionLink(slug: string, label: string, note: string): RmSystemLink {
  const summary = rmSelectionPackSummary(slug);
  return { slug, href: `/proizvodi/${slug}`, label, note: summary ? `${note} · ${summary}` : note, selection: true };
}

function buildNavigations(): RmSystemNavigation[] {
  return [
    {
      line: "DIAMONT",
      title: "R-M DIAMONT u katalogu",
      note: "Izbor baza je na kartici „DIAMONT bazna boja“; ostale kartice su posebni proizvodi linije.",
      links: [
        selectionLink("rm-diamont-bazna-boja", "R-M DIAMONT bazna boja", "izbor baza po zapremini"),
        selectionLink(RM_CRYSTAL_BASE_SLUG, "R-M DIAMONT CRYSTAL BASE", "efektne baze"),
        selectionLink(RM_PASTE_SLUG, "R-M paste za mešanje", "po oznaci sa etikete, linija nije potvrđena"),
        ...lineLinks("DIAMONT"),
      ],
    },
    {
      line: "ONYX HD",
      title: "R-M ONYX HD u katalogu",
      note: "Mešne baze ONYX HD nisu u katalogu za izbor po šifri; baze i recepturu potvrđujemo kroz upit.",
      links: lineLinks("ONYX HD"),
    },
    {
      line: "UNO HD",
      title: "R-M UNO HD u katalogu",
      note: "Na kartici sistema UNO HD je SC 10 (bezbojna osnova za mešanje, kanta 4 L); ostale paste potvrđujemo kroz upit.",
      links: lineLinks("UNO HD"),
    },
  ];
}

let cached: RmSystemNavigation[] | null = null;

/** Navigacija linije kojoj kartica pripada, ili `null` za kartice van ovih linija. */
export function getRmSystemNavigation(slug: string): RmSystemNavigation | null {
  cached ??= buildNavigations();
  return cached.find((navigation) => navigation.links.some((link) => link.slug === slug)) ?? null;
}
