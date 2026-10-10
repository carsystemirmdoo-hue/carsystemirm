import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { proposedTerms, reviewCustomer, summarizeCustomer, type ReviewLine } from "@/lib/pricing/rebateReview.mjs";

/**
 * Pregled rabata po kupcu — samo čitanje.
 *
 * Ulaz je isti kao kod „Rabati po grupama iz faktura": `recommendation_input_lines`
 * (potvrđen izvorni PDF, originalna revizija, potvrđen kupac, pozitivna
 * prodajna stavka). Opseg kupaca je opseg prometa pozivaoca — komercijalista
 * bez `customers:view_all` dobija samo dodeljene kupce, i to u SAMOM upitu.
 *
 * Ovaj modul ne upisuje ništa: ni pravila, ni cenovnik, ni fakture.
 */

type RawLine = {
  customer_id: string;
  invoice_id: string;
  label: string;
  issued_on: string;
  line_number: number | null;
  article_code: string;
  article_name: string | null;
  discount_percent: string;
};

async function scopeFor(viewer: PortalUser) {
  const scope = await resolveLedgerScope(viewer);
  return (col: SQL): SQL =>
    scope.customerIds === null
      ? sql`true`
      : scope.customerIds.length === 0
        ? sql`false`
        : sql`${col} IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

function toLine(l: RawLine): ReviewLine {
  return {
    invoiceId: l.invoice_id,
    documentLabel: l.label,
    issuedOn: l.issued_on,
    lineNumber: l.line_number,
    articleCode: l.article_code,
    articleName: l.article_name,
    discountPercent: Number(l.discount_percent),
  };
}

function linesQuery(where: SQL) {
  return getDb().execute<RawLine>(sql`
    SELECT ril.customer_id, ril.invoice_id, i.number || '/' || i.year AS label,
           ril.issued_on::text AS issued_on, ril.line_number, ril.article_code,
           coalesce(nullif(btrim(ril.article_name), ''), a.name) AS article_name,
           il.discount_percent::text AS discount_percent
      FROM recommendation_input_lines ril
      JOIN invoice_lines il ON il.id = ril.invoice_line_id
      JOIN invoices i ON i.id = ril.invoice_id
      LEFT JOIN articles a ON a.id = il.article_id
     WHERE ${where}`);
}

/** Komercijalisti zaduženi za kupce (trenutne dodele, ne istorija sa faktura). */
async function assignedReps(where: SQL) {
  const rows = await getDb().execute<{ customer_id: string; name: string }>(sql`
    SELECT ca.customer_id, u.name
      FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
     WHERE ${where}
     ORDER BY u.name`);
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.customer_id, [...(m.get(r.customer_id) ?? []), r.name]);
  return m;
}

export async function loadRebateReviewList(viewer: PortalUser) {
  const inScope = await scopeFor(viewer);
  const db = getDb();
  const [lines, customers, reps, rules] = await Promise.all([
    linesQuery(inScope(sql`ril.customer_id`)),
    db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM customers WHERE ${inScope(sql`id`)}`),
    assignedReps(inScope(sql`ca.customer_id`)),
    db.execute<{ customer_id: string; approved: number; pending: number }>(sql`
      SELECT customer_id,
             count(*) FILTER (WHERE status IN ('approved_pending_biznisoft', 'office_recorded', 'confirmed'))::int AS approved,
             count(*) FILTER (WHERE status IN ('draft', 'pending_approval'))::int AS pending
        FROM price_rules
       WHERE customer_scope = 'customer' AND ${inScope(sql`customer_id`)}
       GROUP BY customer_id`),
  ]);

  const byCustomer = new Map<string, ReviewLine[]>();
  for (const l of lines) {
    const list = byCustomer.get(l.customer_id) ?? [];
    list.push(toLine(l));
    byCustomer.set(l.customer_id, list);
  }
  const names = new Map([...customers].map((c) => [c.id, c.name]));
  const ruleCounts = new Map([...rules].map((r) => [r.customer_id, r]));

  const rows = [...byCustomer.entries()].map(([customerId, list]) => ({
    customerId,
    customerName: names.get(customerId) ?? "—",
    salespeople: reps.get(customerId) ?? [],
    rules: { approved: ruleCounts.get(customerId)?.approved ?? 0, pending: ruleCounts.get(customerId)?.pending ?? 0 },
    ...summarizeCustomer(list),
  }));
  rows.sort((a, b) => a.customerName.localeCompare(b.customerName, "sr-Latn"));
  return { rows, lineCount: lines.length };
}

export type RebateReviewRow = Awaited<ReturnType<typeof loadRebateReviewList>>["rows"][number];

const APPROVED = ["approved_pending_biznisoft", "office_recorded", "confirmed"];
const PENDING = ["draft", "pending_approval"];

/**
 * Detalj jednog kupca. Vraća `null` kada kupac nije u opsegu pozivaoca —
 * stranica to pretvara u 403, ne u prazan ekran.
 */
export async function loadRebateReview(viewer: PortalUser, customerId: string) {
  const inScope = await scopeFor(viewer);
  const db = getDb();
  const [customer] = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM customers WHERE id = ${customerId}::uuid AND ${inScope(sql`id`)}`);
  if (!customer) return null;

  const [lines, reps, rules, corrections] = await Promise.all([
    linesQuery(sql`ril.customer_id = ${customerId}::uuid`),
    assignedReps(sql`ca.customer_id = ${customerId}::uuid`),
    db.execute<{
      id: string; status: string; product_scope: string; product_group: string | null; brand: string | null;
      article_code: string | null; value_kind: string; discount_percent: string | null; net_price: string | null;
      effective_from: string; effective_to: string | null; group_name: string | null;
      article_id: string | null; portal_only: boolean; source_batch: string | null;
    }>(sql`
      SELECT r.id, r.status::text AS status, r.product_scope::text AS product_scope, r.product_group, r.brand,
             a.code AS article_code, r.value_kind::text AS value_kind, r.discount_percent::text AS discount_percent,
             r.net_price::text AS net_price, r.effective_from::text AS effective_from, r.effective_to::text AS effective_to,
             g.name AS group_name, r.article_id, NOT r.biznisoft_entry_required AS portal_only, r.source_batch
        FROM price_rules r
        LEFT JOIN articles a ON a.id = r.article_id
        LEFT JOIN customer_groups g ON g.id = r.customer_group_id
       WHERE r.status::text IN (${sql.join([...APPROVED, ...PENDING].map((s) => sql`${s}`), sql`, `)})
         -- Zatvoreno pravilo (zamenjeno promenom, 0041) je istorija, ne važeći uslov.
         AND (r.effective_to IS NULL OR r.effective_to >= (now() AT TIME ZONE 'Europe/Belgrade')::date)
         AND (r.customer_id = ${customerId}::uuid
              OR r.customer_group_id IN (SELECT group_id FROM customer_group_members WHERE customer_id = ${customerId}::uuid))
       ORDER BY r.effective_from DESC`),
    db.execute<{ document_kind: string; n: number }>(sql`
      SELECT document_kind::text AS document_kind, count(*)::int AS n
        FROM invoices
       WHERE customer_id = ${customerId}::uuid
         AND document_kind IN ('korekcija_popusta', 'korekcija_cene', 'knjizno_odobrenje', 'storno', 'povrat_robe')
       GROUP BY document_kind`),
  ]);

  const review = reviewCustomer([...lines].map(toLine));
  const ruleRows = [...rules].map((r) => ({
    id: r.id,
    status: r.status,
    target:
      r.product_scope === "article" ? `artikal ${r.article_code ?? "—"}`
      : r.product_scope === "product_group" ? `grupa ${r.product_group ?? "—"}`
      : r.product_scope === "brand" ? `brend ${r.brand ?? "—"}`
      : r.product_scope,
    via: r.group_name ? `preko grupe kupaca ${r.group_name}` : null,
    value: r.value_kind === "discount_percent" ? `${Number(r.discount_percent)} %` : `${r.net_price} RSD`,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    articleId: r.article_id,
    portalOnly: r.portal_only,
    sourceBatch: r.source_batch,
  }));

  return {
    customer,
    salespeople: reps.get(customerId) ?? [],
    review,
    proposals: proposedTerms(review),
    approvedRules: ruleRows.filter((r) => APPROVED.includes(r.status)),
    pendingRules: ruleRows.filter((r) => PENDING.includes(r.status)),
    corrections: [...corrections],
  };
}

export type RebateReviewDetail = NonNullable<Awaited<ReturnType<typeof loadRebateReview>>>;
