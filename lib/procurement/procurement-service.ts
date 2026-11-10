import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { internalStockQuantities } from "@/lib/stock/stock-import-service";
import { brandOf, suggestQuantity, trendOf } from "./suggest.mjs";

/**
 * Nabavka (2026-11-10): prodaja po artiklu iz faktura + važeći lager → predlog količine.
 *
 * Prodaja je NETO količina iz faktura, povrata robe i storna (iznos < 0 → količina se oduzima);
 * knjižna odobrenja i korekcije cene/popusta ne menjaju količinu i ne ulaze. Artikli van
 * programa (0040) se ne nude. Šifre iz lagera kojih nema u portalu idu u poseban spisak.
 */

export const HISTORY_DAYS = 180;
export const COVER_CHOICES = [30, 45, 60, 90, 120, 180] as const;

export type ProcurementRow = {
  key: string;
  articleId: string | null;
  code: string;
  name: string;
  unit: string | null;
  brand: string;
  sold30: number;
  sold180: number;
  sold365: number;
  customers180: number;
  lastSaleOn: string | null;
  trend: "raste" | "pada" | "novo" | null;
  stock: number | null;
  pack: { quantity: number; unit: string; label: string } | null;
  suggested: number;
  packs: number | null;
  /** Nova šifra iz lagera — nema je u šifarniku portala ni u fakturama. */
  isNew: boolean;
};

export type ProcurementData = {
  today: string;
  coverDays: number;
  stockDate: string | null;
  brands: { name: string; count: number }[];
  rows: ProcurementRow[];
};

const num = (v: string | number | null) => (v === null ? 0 : Number(v));

export async function loadProcurement(opts: { coverDays: number; now?: Date }): Promise<ProcurementData> {
  const today = belgradeDate(opts.now ?? new Date());
  const db = getDb();
  const signed = sql`CASE WHEN il.line_amount < 0 THEN -abs(il.quantity) ELSE abs(il.quantity) END`;
  const [sales, packs, stock] = await Promise.all([
    db.execute<{
      id: string; code: string; name: string; unit: string | null; brand: string | null;
      s30: string; s90: string; p90: string; s180: string; s365: string; c180: number; last: string | null;
    }>(sql`
      SELECT a.id, a.code, a.name, a.unit, a.brand,
             coalesce(sum(${signed}) FILTER (WHERE i.issued_on > ${today}::date - 30), 0)::text AS s30,
             coalesce(sum(${signed}) FILTER (WHERE i.issued_on > ${today}::date - 90), 0)::text AS s90,
             coalesce(sum(${signed}) FILTER (WHERE i.issued_on <= ${today}::date - 90 AND i.issued_on > ${today}::date - 180), 0)::text AS p90,
             coalesce(sum(${signed}) FILTER (WHERE i.issued_on > ${today}::date - ${HISTORY_DAYS}::int), 0)::text AS s180,
             coalesce(sum(${signed}), 0)::text AS s365,
             (count(DISTINCT i.customer_id) FILTER (WHERE i.issued_on > ${today}::date - ${HISTORY_DAYS}::int AND il.line_amount >= 0))::int AS c180,
             max(i.issued_on) FILTER (WHERE il.line_amount >= 0)::text AS last
        FROM invoice_lines il
        JOIN invoices i ON i.id = il.invoice_id
        JOIN articles a ON a.id = il.article_id
       WHERE i.issued_on > ${today}::date - 365 AND i.issued_on <= ${today}::date
         AND i.document_kind::text IN ('faktura', 'povrat_robe', 'storno')
         AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       GROUP BY a.id`),
    db.execute<{ article_id: string; pack_quantity: string; unit: string; label: string }>(sql`
      SELECT article_id, pack_quantity::text, unit, label FROM article_pack_sizes`),
    internalStockQuantities(),
  ]);
  const packOf = new Map([...packs].map((p) => [p.article_id, { quantity: Number(p.pack_quantity), unit: p.unit, label: p.label }]));

  const rows: ProcurementRow[] = [];
  const seen = new Set<string>();
  const build = (a: { id: string; code: string; name: string; unit: string | null; brand: string | null }, s: { s30: number; s90: number; p90: number; s180: number; s365: number; c180: number; last: string | null }) => {
    const pack = packOf.get(a.id) ?? null;
    // Šifra koje nema u izvozu nije nula (pravilo lagera) — lager je tada nepoznat.
    const st = stock.byArticle.get(a.id) ?? null;
    const sg = suggestQuantity({ sold: s.s180, windowDays: HISTORY_DAYS, coverDays: opts.coverDays, stock: st, unit: a.unit, pack });
    rows.push({
      key: a.id,
      articleId: a.id,
      code: a.code,
      name: a.name,
      unit: a.unit,
      brand: brandOf(a.name, a.brand),
      sold30: s.s30,
      sold180: s.s180,
      sold365: s.s365,
      customers180: s.c180,
      lastSaleOn: s.last,
      trend: trendOf(s.s90, s.p90) as ProcurementRow["trend"],
      stock: st,
      pack,
      suggested: sg.suggested,
      packs: sg.packs,
      isNew: false,
    });
    seen.add(a.id);
  };
  for (const r of sales) {
    build(r, { s30: num(r.s30), s90: num(r.s90), p90: num(r.p90), s180: num(r.s180), s365: num(r.s365), c180: r.c180, last: r.last });
  }

  // Artikli na lageru koji se godinu dana nisu prodavali: vidljivi (predlog 0), da vlasnik zna šta leži.
  const idle = [...stock.byArticle.keys()].filter((id) => !seen.has(id));
  if (idle.length) {
    const arts = await db.execute<{ id: string; code: string; name: string; unit: string | null; brand: string | null }>(sql`
      SELECT a.id, a.code, a.name, a.unit, a.brand FROM articles a
       WHERE a.id IN (${sql.join(idle.map((i) => sql`${i}::uuid`), sql`, `)})
         AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)`);
    for (const a of arts) build(a, { s30: 0, s90: 0, p90: 0, s180: 0, s365: 0, c180: 0, last: null });
  }

  for (const u of stock.unlinked) {
    rows.push({
      key: `novo:${u.code}`,
      articleId: null,
      code: u.code,
      name: u.name,
      unit: null,
      brand: brandOf(u.name),
      sold30: 0,
      sold180: 0,
      sold365: 0,
      customers180: 0,
      lastSaleOn: null,
      trend: null,
      stock: u.quantity,
      pack: null,
      suggested: 0,
      packs: null,
      isNew: true,
    });
  }

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
  const brands = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => (a.name === "Ostalo" ? 1 : b.name === "Ostalo" ? -1 : b.count - a.count));
  return { today, coverDays: opts.coverDays, stockDate: stock.snapshot?.stockDate ?? null, brands, rows };
}

/**
 * Stavke za fajl porudžbine: šifra se proverava na serveru (šifarnik ili nova šifra iz važećeg
 * lagera); naziv i JM uzimaju se iz baze, nikad iz pregledača.
 */
export async function resolveOrderLines(lines: { code: string; quantity: number }[]) {
  const codes = [...new Set(lines.map((l) => l.code))];
  if (!codes.length) return [];
  const db = getDb();
  const [arts, stock] = await Promise.all([
    db.execute<{ id: string; code: string; name: string; unit: string | null }>(sql`
      SELECT id, code, name, unit FROM articles WHERE code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`),
    internalStockQuantities(),
  ]);
  const byCode = new Map([...arts].map((a) => [a.code, a]));
  const newByCode = new Map(stock.unlinked.map((u) => [u.code, u]));
  const out: { code: string; name: string; unit: string; quantity: number; articleId: string | null }[] = [];
  for (const l of lines) {
    const a = byCode.get(l.code);
    if (a) out.push({ code: a.code, name: a.name, unit: a.unit ?? "", quantity: l.quantity, articleId: a.id });
    else {
      const n = newByCode.get(l.code);
      if (n) out.push({ code: n.code, name: n.name, unit: "", quantity: l.quantity, articleId: null });
    }
  }
  return out;
}
