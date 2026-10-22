import mixingBases from "@/data/rm-sync/mixing-bases.json";
import baseSwatches from "@/data/rm-sync/base-swatches.json";
import familyPackshots from "@/data/catalog/family-packshots.json";
import { rmBaseSwatch, RM_CRYSTAL_BASE_SLUG, RM_PASTE_SLUG } from "@/lib/rm-mixing-bases";
import type { FamilyBase, FamilyPackshot } from "@/components/product/family/familyBaseTypes";

/**
 * R-M porodice baza u zajedničkom izboru (2026-10-21), po Baslac modelu.
 *
 * Baza je RED kartice (`data/rm-sync/mixing-bases.json`), pa se bira kroz kontekst varijante
 * (`contextKey` = šifra reda) i panel kupovine dobija tačan red i pakovanje. Naziv i
 * kvadratić su iz zvanične R-M tabele baza (`base-swatches.json`) za tačnu šifru; bez
 * podatka naziv se ne izmišlja, a kvadratić je neutralan.
 */

type MixingRow = { code: string; name: string | null; packs: string[] };
type SwatchCode = { name?: string; finish: string };
type Packshot = { brand: string; system: string; volume: string; src: string; shownCode: string | null; portalAssetId: number };

const cards = (mixingBases as unknown as { cards: Record<string, MixingRow[]> }).cards;
const swatchCodes = (baseSwatches as unknown as { codes: Record<string, SwatchCode> }).codes;
const packshots = (familyPackshots as unknown as { packshots: Packshot[] }).packshots;

export type RmFamilyConfig = {
  slug: string;
  /** Sistem za fotografije ambalaže (`family-packshots.json`); `null` = sistem nije potvrđen. */
  system: string | null;
  familyName: string;
  /** Naziv serije na karticama zapremine u katalogu („R-M DIAMONT — 1 L“). */
  seriesName: string;
  systemName: string;
  eyebrow: string;
  intro: string;
};

export const RM_FAMILY_CONFIGS: RmFamilyConfig[] = [
  {
    slug: "rm-diamont-bazna-boja",
    system: "DIAMONT",
    familyName: "R-M DIAMONT bazna boja",
    seriesName: "R-M DIAMONT",
    systemName: "R-M DIAMONT",
    eyebrow: "R-M sistem boja",
    intro:
      "Solventni bazni sistem za usklađivanje nijanse. Baze se mešaju po formuli; izaberite pakovanje i bazu, dostupnost potvrđujemo kroz upit.",
  },
  {
    slug: RM_CRYSTAL_BASE_SLUG,
    system: "CRYSTAL BASE",
    familyName: "R-M DIAMONT CRYSTAL BASE",
    seriesName: "R-M DIAMONT CRYSTAL BASE",
    systemName: "R-M DIAMONT CRYSTAL BASE",
    eyebrow: "R-M sistem boja",
    intro:
      "Koncentrovane baze za specijalne efektne pigmente, uz DIAMONT sistem, u bočicama od 125 ml. Nijansa se meša po formuli.",
  },
  {
    slug: RM_PASTE_SLUG,
    system: null,
    familyName: "R-M paste za mešanje",
    seriesName: "R-M paste za mešanje",
    systemName: "R-M paste — linija nije potvrđena",
    eyebrow: "R-M paste iz naše ponude",
    intro:
      "Paste koje vodimo, po oznaci sa etikete i potvrđenom pakovanju. Zvanični izvori proizvođača ne potvrđuju liniju ni naziv za ove oznake, pa ih ne pripisujemo sistemu; za izbor se obratite kancelariji.",
  },
];

export function getRmFamilyConfig(slug: string) {
  return RM_FAMILY_CONFIGS.find((config) => config.slug === slug) ?? null;
}

const FINISH_LABELS: Record<string, string> = {
  solid: "Solid",
  transparent: "Transparent",
  metallic: "Metallic",
  pearl: "Pearl",
  crystal: "Crystal",
  clear: "Bezbojna",
  neutral: "Bez podatka",
};

/** „kanta 4 L“ → 4; „bočica 125 ml“ → 0.125. */
export function packLitres(pack: string): number | null {
  const match = pack.match(/(\d+(?:,\d+)?)\s*(L|ml)\b/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return match[2] === "ml" ? value / 1000 : value;
}

export function volumeLabelOf(litres: number) {
  return litres < 0.5 ? `${Math.round(litres * 1000)} ml` : `${String(litres).replace(".", ",")} L`;
}

export function rmFamilyBases(config: RmFamilyConfig): FamilyBase[] {
  return (cards[config.slug] ?? []).map((row) => {
    const litres = packLitres(row.packs[0] ?? "");
    const swatch = rmBaseSwatch(config.slug, row.code);
    const officialName = row.name ?? swatchCodes[row.code]?.name ?? null;
    return {
      code: row.code,
      name: officialName,
      volumeL: litres,
      volumeKey: litres === null ? "upit" : String(litres),
      volumeLabel: litres === null ? "Na upit" : volumeLabelOf(litres),
      // Kao Baslac: samo zapremina („1 L“); vrsta ambalaže (kanta, bočica) je u izabranoj stavci.
      packLabel: row.packs.map((pack) => { const l = packLitres(pack); return l === null ? pack : volumeLabelOf(l); }).join(" / "),
      finish: swatch.swatchFinish,
      finishLabel: FINISH_LABELS[swatch.swatchFinish] ?? swatch.swatchFinish,
      ...(swatch.swatch ? { swatch: swatch.swatch } : {}),
      swatchPattern: swatch.swatchFinish,
      queryValue: row.code,
      contextKey: row.code,
      buySlug: config.slug,
      buyName: `${config.familyName} · ${row.code}`,
      searchTerms: [row.code, officialName ?? "", ...row.packs].filter(Boolean),
    };
  });
}

/** Fotografije ambalaže po zapremini za sistem kartice; bez potvrđenog sistema nema fotografije. */
export function rmFamilyPackshots(config: RmFamilyConfig): Record<string, FamilyPackshot> {
  const result: Record<string, FamilyPackshot> = {};
  if (!config.system) return result;
  for (const packshot of packshots) {
    if (packshot.brand !== "rm" || packshot.system !== config.system) continue;
    const litres = packLitres(packshot.volume);
    if (litres === null) continue;
    result[String(litres)] = {
      src: packshot.src,
      alt: `R-M ${config.system} ambalaža ${packshot.volume}, generička limenka sistema bez šifre nijanse`,
    };
  }
  return result;
}

/** Zapremine porodice sa brojem baza (za kartice u katalogu), od najmanje. */
export function rmFamilyVolumes(config: RmFamilyConfig) {
  const counts = new Map<number, number>();
  for (const row of cards[config.slug] ?? []) {
    const litres = packLitres(row.packs[0] ?? "");
    if (litres !== null) counts.set(litres, (counts.get(litres) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => a[0] - b[0]).map(([litres, count]) => ({ litres, label: volumeLabelOf(litres), count }));
}
