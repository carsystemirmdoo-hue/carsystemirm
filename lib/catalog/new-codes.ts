import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { internalStockQuantities } from "@/lib/stock/stock-import-service";

/**
 * „Nove šifre“ na Mapiranju (odluka vlasnika 2026-11-13): na jednom mestu sve što je novo i treba
 * razvrstati — artikli koji su se prvi put pojavili u šifarniku portala (faktura ili uvoz) u
 * poslednjih N dana, i šifre iz važećeg lagera kojih u šifarniku još nema.
 */
export type NewCodeRow = {
  key: string;
  articleId: string | null;
  code: string;
  name: string;
  firstSeen: string | null;
  source: "sifarnik" | "lager";
  mapping: string | null;
  outOfProgramme: boolean;
  stock: number | null;
};

export async function loadNewCodes(days = 60): Promise<NewCodeRow[]> {
  const db = getDb();
  const [articles, stock] = await Promise.all([
    db.execute<{ id: string; code: string; name: string; first_seen: string; mapping: string | null; out: boolean }>(sql`
      SELECT a.id, a.code, a.name, a.created_at::date::text AS first_seen,
             (SELECT m.status::text FROM article_catalog_mappings m WHERE m.article_id = a.id ORDER BY m.updated_at DESC LIMIT 1) AS mapping,
             EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out
        FROM articles a
       WHERE a.created_at > now() - make_interval(days => ${days})
       ORDER BY a.created_at DESC, a.code`),
    internalStockQuantities().catch(() => null),
  ]);
  const rows: NewCodeRow[] = [...articles].map((a) => ({
    key: a.id,
    articleId: a.id,
    code: a.code,
    name: a.name,
    firstSeen: a.first_seen,
    source: "sifarnik",
    mapping: a.mapping,
    outOfProgramme: a.out,
    stock: stock?.byArticle.get(a.id) ?? null,
  }));
  for (const u of stock?.unlinked ?? []) {
    rows.push({ key: `lager:${u.code}`, articleId: null, code: u.code, name: u.name, firstSeen: null, source: "lager", mapping: null, outOfProgramme: false, stock: u.quantity });
  }
  return rows;
}
