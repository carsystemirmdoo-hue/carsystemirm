import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { analyzeRebates, conflictWithExisting, proposalReason } from "@/lib/pricing/rebateEvidence.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { proposePriceRule } from "@/lib/pricing/rule-service";

/**
 * Rabati po grupama iz faktura — ulaz, dokazi i poređenje sa postojećim uslovima.
 *
 * Ulaz su SAMO potvrđeni dokumenti (`recommendation_input_lines`: validan
 * izvorni PDF, originalna revizija, potvrđen kupac, pozitivna prodajna stavka).
 * Korekcije popusta, storna i povrati se ne mešaju u rabat — broje se posebno,
 * jer mogu promeniti stvarni uslov i traže ručnu proveru.
 */

type EvidenceLine = {
  customerId: string; customerName: string; productGroup: string | null; articleCode: string;
  invoiceId: string; documentLabel: string; issuedOn: string; discountPercent: number;
};

export async function loadRebateEvidence(viewer: PortalUser) {
  const scope = await resolveLedgerScope(viewer);
  const inScope = (col: SQL): SQL =>
    scope.customerIds === null
      ? sql`true`
      : scope.customerIds.length === 0
        ? sql`false`
        : sql`${col} IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
  const db = getDb();

  const [lines, corrections, rules, terms] = await Promise.all([
    db.execute<{
      customer_id: string; customer_name: string; product_group: string | null; article_code: string;
      invoice_id: string; number: string; year: number; issued_on: string; discount_percent: string;
    }>(sql`
      SELECT ril.customer_id, c.name AS customer_name, nullif(btrim(a.product_group), '') AS product_group,
             ril.article_code, i.id AS invoice_id, i.number, i.year, ril.issued_on::text AS issued_on,
             il.discount_percent::text AS discount_percent
        FROM recommendation_input_lines ril
        JOIN invoice_lines il ON il.id = ril.invoice_line_id
        JOIN invoices i ON i.id = ril.invoice_id
        JOIN customers c ON c.id = ril.customer_id
        LEFT JOIN articles a ON a.id = il.article_id
       WHERE ${inScope(sql`ril.customer_id`)}`),
    db.execute<{ customer_id: string; kinds: string[]; n: number }>(sql`
      SELECT customer_id, array_agg(DISTINCT document_kind::text) AS kinds, count(*)::int AS n
        FROM invoices
       WHERE document_kind IN ('korekcija_popusta', 'korekcija_cene', 'knjizno_odobrenje', 'storno', 'povrat_robe')
         AND ${inScope(sql`customer_id`)}
       GROUP BY customer_id`),
    db.execute<{ customer_id: string; product_group: string; discount_percent: string; status: string }>(sql`
      SELECT customer_id, product_group, discount_percent::text AS discount_percent, status::text AS status
        FROM price_rules
       WHERE customer_scope = 'customer' AND product_scope = 'product_group' AND value_kind = 'discount_percent' AND payment_condition IS NULL
         AND status NOT IN ('rejected', 'revoked', 'expired') AND ${inScope(sql`customer_id`)}`),
    db.execute<{ customer_id: string; product_group: string; discount_percent: string; code: string; kind: string }>(sql`
      SELECT t.customer_id, t.product_group, t.discount_percent::text AS discount_percent, pl.code, pl.kind::text AS kind
        FROM price_list_customer_terms t JOIN price_lists pl ON pl.id = t.price_list_id AND pl.status = 'active'
       WHERE t.product_scope = 'product_group' AND ${inScope(sql`t.customer_id`)}`),
  ]);

  const evidence: EvidenceLine[] = [...lines].map((l) => ({
    customerId: l.customer_id, customerName: l.customer_name, productGroup: l.product_group, articleCode: l.article_code,
    invoiceId: l.invoice_id, documentLabel: `${l.number}/${l.year}`, issuedOn: l.issued_on, discountPercent: Number(l.discount_percent),
  }));
  const existing = new Map<string, { source: string; discountPercent: number }[]>();
  const push = (k: string, v: { source: string; discountPercent: number }) => existing.set(k, [...(existing.get(k) ?? []), v]);
  for (const r of rules) push(`${r.customer_id}|${r.product_group}`, { source: `pravilo u portalu (${r.status})`, discountPercent: Number(r.discount_percent) });
  for (const t of terms) push(`${t.customer_id}|${t.product_group}`, { source: `${t.kind === "demo" ? "DEMO " : ""}cenovnik ${t.code}`, discountPercent: Number(t.discount_percent) });
  const corr = new Map([...corrections].map((c) => [c.customer_id, { kinds: c.kinds, count: c.n }]));

  const items = analyzeRebates(evidence).map((item) => {
    const ex = existing.get(`${item.customerId}|${item.productGroup ?? ""}`) ?? [];
    return {
      ...item,
      existing: ex,
      conflict: conflictWithExisting(item.candidatePercent, ex),
      corrections: corr.get(item.customerId) ?? null,
      alreadyProposed: ex.some((e) => e.source.startsWith("pravilo") && Math.abs(e.discountPercent - (item.candidatePercent ?? -1)) < 0.001),
    };
  });
  return { items, lineCount: evidence.length, missingGroupLines: evidence.filter((e) => !e.productGroup).length };
}

export type RebateEvidenceItem = Awaited<ReturnType<typeof loadRebateEvidence>>["items"][number];

/**
 * Pretvara dosledan kandidat u PREDLOG pravila (postojeći tok: „čeka odobrenje").
 * Ne menja cenovnik i ne utiče na korpu. Kandidat se ponovo računa ovde, iz
 * baze — ne veruje se procentu iz pregledača.
 */
export async function proposeRebateFromEvidence(viewer: PortalUser, customerId: string, productGroup: string) {
  const { items } = await loadRebateEvidence(viewer);
  const item = items.find((i) => i.customerId === customerId && i.productGroup === productGroup);
  if (!item) return { ok: false as const, message: "Kupac ili grupa nisu u Vašem opsegu." };
  if (item.status !== "consistent" || item.candidatePercent === null) {
    return { ok: false as const, message: "Samo dosledan rabat može postati predlog; ostalo zahteva ručnu odluku." };
  }
  if (item.alreadyProposed) return { ok: false as const, message: "Isti predlog već postoji." };
  const created = await proposePriceRule(
    {
      customerScope: "customer",
      customerId,
      productScope: "product_group",
      productGroup,
      valueKind: "discount_percent",
      discountPercent: item.candidatePercent,
      effectiveFrom: belgradeDate(new Date()),
      reason: proposalReason(item),
    },
    viewer,
  );
  return { ok: true as const, id: created.id, status: created.status };
}
