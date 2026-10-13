import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  companionDecision,
  companionStockPolicy,
  suggestCompanionPacks,
} from "@/lib/ordering/companionRule.mjs";
import { loadArticleRequestPrices } from "@/lib/ordering/request-service";
import { isUuid } from "@/lib/sales/filterInput.mjs";

export type CompanionSuggestion = {
  /** `dodaj` = potvrđena ponuda i prodajna jedinica; `upit` = samo upit (nabavka/cena), bez dodavanja. */
  mode: "dodaj" | "upit";
  /** Kartica pribora za upit (kada je pribor povezan sa katalogom). */
  inquiryHref: string | null;
  articleId: string;
  articleCode: string;
  articleName: string;
  /** `poklopac` | `herter` | `kompatibilno` (npr. FPS čvrsta posuda ↔ ulošci iste zapremine) */
  kind: string;
  packLabel: string;
  /** Cena jednog pakovanja bez PDV-a za prvu odobrenu opciju plaćanja (isti obračun kao korpa). */
  packNet: number | null;
  optionLabel: string | null;
  /** Herter: razlika među opcijama iz zvaničnih podataka (npr. „50-415 · brzi, VOC“). */
  choiceLabel: string | null;
  /** Herter: „100 : 50 po zapremini“; null kad izvor ne daje odnos. */
  ratioText: string | null;
  sourceUrl: string | null;
  /** Predlog broja pakovanja (samo uz potvrđen odnos, osnovu i pakovanja); null = kupac sam određuje. */
  suggestedPacks: number | null;
  suggestionText: string | null;
};

const num = (v: string | null) => (v === null ? null : Number(v));
const fmt = (n: number) =>
  String(Math.round(n * 1000) / 1000).replace(".", ",");
const BASIS_TEXT: Record<string, string> = {
  zapremina: "po zapremini",
  masa: "po masi",
};
/** Artikal koji već sadrži učvršćivač (set A+B, „sa herterom“): herter se ne nudi kao da nedostaje. */
const CONTAINS_HARDENER =
  /A\s*\+\s*B|SA\s+HERTER|sa\s+u[čc]vr[šs][ćc]iva[čc]em|\bset\b|komplet/i;

/**
 * Odgovarajući pribor (poklopac, herter) za artikal koji je kupac upravo izabrao, uz broj
 * pakovanja tog artikla. Kupac isključivo iz sesije pozivaoca. Stanje zaliha nema izvor
 * („nepoznato“); da li se tada predlaže, odlučuje `ORDERING_COMPANION_STOCK` (podrazumevano: ne).
 */
export async function loadCompanionSuggestions(
  customerId: string,
  articleId: string,
  basePacks = 1,
): Promise<{ suggestions: CompanionSuggestion[]; stockKnown: false }> {
  if (!customerId)
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!isUuid(articleId)) return { suggestions: [], stockKnown: false };
  const rows = [
    ...(await getDb().execute<{
      id: string;
      kind: string;
      out: boolean;
      option_label: string | null;
      source_url: string | null;
      ratio_base: string | null;
      ratio_companion: string | null;
      ratio_basis: string | null;
      slug: string | null;
      variant: string | null;
    }>(sql`
      SELECT c.companion_article_id AS id, c.kind, c.option_label, c.source_url,
             m.catalog_product_slug AS slug, m.catalog_variant_id AS variant,
             c.ratio_base::text AS ratio_base, c.ratio_companion::text AS ratio_companion, c.ratio_basis,
             EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = c.companion_article_id) AS out
        FROM article_companions c
        LEFT JOIN article_catalog_mappings m ON m.article_id = c.companion_article_id AND m.status = 'mapped'
       WHERE c.article_id = ${articleId}::uuid AND c.revoked_at IS NULL
       ORDER BY c.kind DESC, c.option_label NULLS LAST, c.confirmed_at, c.id`)),
  ];
  if (!rows.length) return { suggestions: [], stockKnown: false };
  const priced = await loadArticleRequestPrices(customerId, [
    articleId,
    ...rows.map((r) => r.id),
  ]);
  if (!priced.enabled) return { suggestions: [], stockKnown: false };
  const base = priced.lines.get(articleId);
  const baseHasHardener = base
    ? CONTAINS_HARDENER.test(`${base.articleName} ${base.pack?.label ?? ""}`)
    : false;
  const policy = companionStockPolicy(process.env.ORDERING_COMPANION_STOCK);
  const packs = Number.isInteger(basePacks) && basePacks > 0 ? basePacks : 1;
  const suggestions: CompanionSuggestion[] = [];
  for (const r of rows) {
    if (r.kind === "herter" && baseHasHardener) continue;
    const line = priced.lines.get(r.id);
    if (!line) continue;
    const firstPriced = priced.options
      .map((o) => ({ o, p: line.byOption[o.key] }))
      .find((x) => x.p?.status === "cena");
    const orderable =
      Boolean(line.pack) && Boolean(firstPriced) && !line.procurementOnly;
    const decision = companionDecision({
      orderable,
      outOfProgramme: r.out,
      stock: "nepoznato",
      policy,
    });
    if (!decision.show) continue;
    const ratio =
      r.ratio_base && r.ratio_companion
        ? {
            base: num(r.ratio_base)!,
            companion: num(r.ratio_companion)!,
            basis: r.ratio_basis as "zapremina" | "masa" | null,
          }
        : null;
    const s =
      r.kind === "herter"
        ? suggestCompanionPacks({
            basePacks: packs,
            basePack: base?.pack ?? null,
            companionPack: line.pack,
            ratio,
          })
        : null;
    const p = firstPriced?.p;
    suggestions.push({
      mode: decision.mode ?? "upit",
      inquiryHref: r.slug
        ? `/proizvodi/${r.slug}${r.variant ? `?varijanta=${encodeURIComponent(r.variant)}` : ""}`
        : null,
      articleId: line.articleId,
      articleCode: line.articleCode,
      articleName: line.articleName,
      kind: r.kind,
      packLabel: line.packLabel,
      packNet:
        p && p.status === "cena" && p.packAmounts ? p.packAmounts.net : null,
      optionLabel:
        firstPriced && priced.options.length > 1 ? firstPriced.o.label : null,
      choiceLabel: r.option_label,
      ratioText: ratio
        ? `${fmt(ratio.base)} : ${fmt(ratio.companion)}${ratio.basis ? ` ${BASIS_TEXT[ratio.basis]}` : " (osnova odnosa nije navedena)"}`
        : null,
      sourceUrl: r.source_url,
      // Predlog broja: poklopac = isti broj kao posuda; herter samo uz potvrđen odnos; „kompatibilno“ nikad
      // (odnos posuda : paket uložaka nije potvrđen) — kupac sam upisuje broj.
      suggestedPacks:
        decision.mode !== "dodaj"
          ? null
          : r.kind === "herter"
            ? (s?.packs ?? null)
            : r.kind === "poklopac"
              ? packs
              : null,
      suggestionText:
        r.kind === "herter"
          ? s?.packs
            ? `Za ${packs} × ${base?.packLabel} potrebno je ${fmt(s.needed!)} ${s.unit === "LIT" ? "L" : "kg"} hertera.`
            : `Količinu odredite prema tehničkom listu (${s?.reason ?? "odnos nije potvrđen"}).`
          : null,
    });
  }
  return { suggestions, stockKnown: false };
}
