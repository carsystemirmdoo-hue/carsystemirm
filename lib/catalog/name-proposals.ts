import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEntry.mjs";
import { getAllCarsystemProducts, getProductVariantSelector } from "@/lib/carsystem-data";
import { brandKey, buildIndex, confidenceOf, markSharedTargets, measureLabel, rankTargets } from "./nameMatch.mjs";

/**
 * Predlozi veza po nazivu za ekran „Povezivanje artikala“ (2026-11-11, odluka vlasnika).
 *
 * Predlog nije veza: artikal postaje povezan tek kada čovek klikne „Potvrdi“, i to kroz isti
 * `decideMapping` kao ručna potvrda (audit, obaveštenje). Provera unazad nad 666 ranije
 * potvrđenih veza: „sigurno“ 529/530 tačan proizvod.
 */

export type NameTarget = { key: string; slug: string; variant: string | null; brand: string; text: string; codes: string[]; label: string };

let cached: ReturnType<typeof buildIndex> | null = null;

function removedSlugs() {
  try {
    const file = path.join(process.cwd(), "data/catalog/removed-from-customer-catalog.json");
    return new Set((JSON.parse(readFileSync(file, "utf8")).records as { slug: string }[]).map((r) => r.slug));
  } catch {
    return new Set<string>();
  }
}

/** Kataloške mete: varijanta-red (granulacija, nijansa…) ili ceo proizvod kada redova nema. */
export function catalogNameTargets(): NameTarget[] {
  const removed = removedSlugs();
  const out: NameTarget[] = [];
  for (const p of getAllCarsystemProducts()) {
    if (removed.has(p.slug)) continue;
    const brand = brandKey(p.brandSlug);
    const base = [p.name, (p as { officialName?: string }).officialName ?? ""].join(" ");
    const rows = (getProductVariantSelector(p)?.variants ?? []).filter((v) => !v.slug);
    if (!rows.length) {
      out.push({ key: p.slug, slug: p.slug, variant: null, brand, text: `${base} ${p.sku ?? ""}`, codes: [p.sku].filter(Boolean) as string[], label: p.name });
      continue;
    }
    for (const v of rows) {
      const vk = (v.sku ?? v.id) as string;
      out.push({ key: `${p.slug}#${vk}`, slug: p.slug, variant: vk, brand, text: `${base} ${v.label ?? ""} ${vk}`, codes: [vk, v.sku, v.id].filter(Boolean) as string[], label: `${p.name} — ${v.label ?? vk}` });
    }
  }
  return out;
}

function index() {
  cached ??= buildIndex(catalogNameTargets());
  return cached;
}

export type NameProposal = {
  articleId: string;
  code: string;
  name: string;
  unit: string | null;
  brand: string | null;
  sold12m: number;
  confidence: "sigurno" | "verovatno" | "nejasno" | "nema" | "bez brenda";
  candidates: { slug: string; variant: string | null; label: string; score: number; doubts: string[] }[];
  /** Mera iz BizniSoft naziva („0,5 L“, „150 mm · P240“) — pakovanje nosi sam artikal. */
  pack: string;
  /** Isti predlog (ista mera i boja) dobio je još neki artikal — ne mogu oba biti tačna. */
  shared?: boolean;
  /** Poslednji opis vlasnika („koji je to artikal“), iz traga revizije. */
  ownerNote: { text: string; by: string; at: string } | null;
};

/** Poslednji opis po artiklu. Opis se čuva kao red u tragu revizije (bez nove tabele, sa istorijom). */
async function loadOwnerNotes(): Promise<Map<string, { text: string; by: string; at: string }>> {
  const rows = await getDb().execute<{ id: string; text: string | null; by: string; at: string }>(sql`
    SELECT DISTINCT ON (entity_id) entity_id AS id, value_after->>'text' AS text, actor_label AS by, created_at::text AS at
      FROM audit_log
     WHERE action = ${AUDIT_ACTIONS.articleOwnerDescription} AND entity_type = 'Artikal'
     ORDER BY entity_id, created_at DESC`);
  const out = new Map<string, { text: string; by: string; at: string }>();
  for (const r of rows) if (r.text) out.set(r.id, { text: r.text, by: r.by, at: r.at });
  return out;
}

/** Artikli bez potvrđene veze (bez onih van programa), sa predlogom po nazivu. */
export async function loadNameProposals(opts: { includeInactive: boolean }): Promise<NameProposal[]> {
  const rows = await getDb().execute<{ id: string; code: string; name: string; unit: string | null; sold: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.unit,
           (SELECT sum(abs(il.quantity)) FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
             WHERE il.article_id = a.id AND i.document_kind = 'faktura' AND i.issued_on > current_date - 365)::text AS sold
      FROM articles a
     WHERE NOT EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped')
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)`);
  const idx = index();
  const notes = await loadOwnerNotes();
  const out: NameProposal[] = [];
  for (const r of rows) {
    const sold = Number(r.sold ?? 0);
    if (!opts.includeInactive && sold <= 0) continue;
    const { brand, ranked } = rankTargets({ code: r.code, name: r.name }, idx);
    out.push({
      articleId: r.id,
      code: r.code,
      name: r.name,
      unit: r.unit,
      brand,
      sold12m: sold,
      confidence: !brand ? "bez brenda" : (confidenceOf(ranked) as NameProposal["confidence"]),
      candidates: ranked.map((c) => ({ slug: c.slug, variant: c.variant, label: c.label, score: c.score, doubts: c.doubts ?? [] })),
      pack: measureLabel(r.name),
      ownerNote: notes.get(r.id) ?? null,
    });
  }
  return markSharedTargets(out);
}

/** Server ponovo računa predlog: potvrditi se sme samo jedan od ponuđenih kandidata. */
export async function proposalFor(articleId: string) {
  const [a] = [...(await getDb().execute<{ code: string; name: string }>(sql`SELECT code, name FROM articles WHERE id = ${articleId}::uuid`))];
  if (!a) return null;
  const { ranked } = rankTargets(a, index());
  return { ranked, confidence: confidenceOf(ranked), article: a };
}
