import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getCarsystemProductBySlug, getProductCompatibleProducts } from "@/lib/carsystem-data";
import { loadArticleIdentities, type ArticleIdentity } from "@/lib/ordering/ordering-service";
import { dataSufficiency, suggestFromCatalog, suggestFromPeers } from "@/lib/recommendations/crossSell.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * Predlozi dodatnih proizvoda za karticu kupca i „Za razgovor" (interno).
 *
 * Ulaz su potvrđene kupovine iz poslednjih 365 dana (`recommendation_input_lines`).
 * Poređenje koristi kupovine SVIH firmi, ali izlaz nosi samo broj sličnih
 * firmi — nikad njihova imena. Pozivalac mora pre ovoga proveriti opseg
 * (koje kupce korisnik sme da vidi).
 */

export type CrossSellSuggestion = {
  articleCode: string;
  identity: ArticleIdentity | null;
  peer: { support: number; peers: number; strength: "strong" | "weak"; because: string[] } | null;
  catalog: { viaCode: string; viaName: string } | null;
};

export type CrossSell = {
  ok: boolean;
  reason: string | null;
  customersWithHistory: number;
  peers: number;
  suggestions: CrossSellSuggestion[];
};

export async function loadCrossSell(customerIds: string[], now = new Date()): Promise<Map<string, CrossSell>> {
  const out = new Map<string, CrossSell>();
  if (customerIds.length === 0) return out;
  const db = getDb();
  const since = belgradeDate(new Date(now.getTime() - 365 * 86400000));
  const [basketRows, mappedRows] = await Promise.all([
    db.execute<{ customer_id: string; codes: string[] }>(sql`
      SELECT customer_id, array_agg(DISTINCT article_code) AS codes
        FROM recommendation_input_lines WHERE issued_on >= ${since}::date GROUP BY customer_id`),
    db.execute<{ code: string; slug: string }>(sql`
      SELECT a.code, m.catalog_product_slug AS slug
        FROM article_catalog_mappings m JOIN articles a ON a.id = m.article_id
       WHERE m.status = 'mapped' AND m.catalog_product_slug IS NOT NULL`),
  ]);
  const baskets = new Map([...basketRows].map((r) => [r.customer_id, new Set(r.codes)]));
  const slugByCode = new Map([...mappedRows].map((r) => [r.code, r.slug]));
  const codesBySlug = new Map<string, string[]>();
  for (const r of mappedRows) codesBySlug.set(r.slug, [...(codesBySlug.get(r.slug) ?? []), r.code]);
  const compatCache = new Map<string, string[]>();
  const compatible = (slug: string) => {
    if (!compatCache.has(slug)) {
      const p = getCarsystemProductBySlug(slug);
      compatCache.set(slug, p ? getProductCompatibleProducts(p, 12).map((x) => x.slug) : []);
    }
    return compatCache.get(slug)!;
  };

  const raw = new Map<string, { peers: number; bySource: Map<string, CrossSellSuggestion> }>();
  const allCodes = new Set<string>();
  for (const id of customerIds) {
    const mine = baskets.get(id) ?? new Set<string>();
    const peer = suggestFromPeers(id, baskets);
    const cat = suggestFromCatalog(
      mine,
      [...mine].filter((c) => slugByCode.has(c)).map((c) => ({ code: c, slug: slugByCode.get(c)! })),
      compatible,
      codesBySlug,
    );
    const bySource = new Map<string, CrossSellSuggestion>();
    for (const s of peer.suggestions) {
      bySource.set(s.articleCode, { articleCode: s.articleCode, identity: null, peer: { support: s.support, peers: s.peers, strength: s.strength as "strong" | "weak", because: s.because }, catalog: null });
    }
    for (const c of cat) {
      const e = bySource.get(c.articleCode) ?? { articleCode: c.articleCode, identity: null, peer: null, catalog: null };
      e.catalog = { viaCode: c.viaCode, viaName: getCarsystemProductBySlug(c.viaSlug)?.name ?? c.viaSlug };
      bySource.set(c.articleCode, e);
    }
    for (const code of bySource.keys()) allCodes.add(code);
    raw.set(id, { peers: peer.peers, bySource });
  }
  const identities = await loadArticleIdentities([...allCodes]);
  const rank = (s: CrossSellSuggestion) => (s.peer?.strength === "strong" ? 0 : s.catalog ? 1 : 2);
  for (const id of customerIds) {
    const r = raw.get(id)!;
    const suff = dataSufficiency({ customersWithHistory: baskets.size, peers: r.peers, myArticles: baskets.get(id)?.size ?? 0 });
    const suggestions = [...r.bySource.values()]
      .map((s) => ({ ...s, identity: identities.get(s.articleCode) ?? null }))
      .sort((a, b) => rank(a) - rank(b) || (b.peer?.support ?? 0) - (a.peer?.support ?? 0) || a.articleCode.localeCompare(b.articleCode));
    out.set(id, {
      ok: suff.ok,
      reason: suff.reason,
      customersWithHistory: baskets.size,
      peers: r.peers,
      // Kataloški predlog važi i kad poređenja nema; predlozi iz poređenja samo uz dovoljno podataka.
      suggestions: suff.ok ? suggestions : suggestions.filter((s) => s.catalog).map((s) => ({ ...s, peer: null })),
    });
  }
  return out;
}
