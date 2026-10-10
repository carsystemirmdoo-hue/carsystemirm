import "server-only";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { notify } from "@/lib/notifications/notification-service";
import { applicationReason, evaluateArticle } from "@/lib/pricing/rebateApplication.mjs";
import { REBATE_CRITERIA } from "@/lib/pricing/rebateCriteria.mjs";
import { proposalEvidence } from "@/lib/pricing/rebateProposalEvidence.mjs";
import { proposePriceRule, transitionPriceRule } from "@/lib/pricing/rule-service";

/**
 * Pravila rabata kupac–artikal iz istorije faktura.
 *
 * Procena je čitanje (ekran „Za pregled" i plan primene). Primena je serija:
 * svako pravilo prolazi POSTOJEĆI tok (predlog → odobrenje), sa zajedničkim
 * `correlationId` i oznakom `source_batch`, kao „samo portal" — nije nalog za
 * BizniSoft. Opoziv serije dira isključivo pravila te serije koja su i dalje
 * u stanju u kome ih je serija ostavila.
 */

const APPROVED = ["approved_pending_biznisoft", "office_recorded", "confirmed"];
const PENDING = ["draft", "pending_approval"];

type Line = {
  customer_id: string; customer_name: string; article_id: string; article_code: string; article_name: string | null;
  invoice_id: string; label: string; issued_on: string; line_number: number | null; discount_percent: string;
};

function scopeSql(customerIds: string[] | null) {
  return (col: SQL): SQL =>
    customerIds === null
      ? sql`true`
      : customerIds.length === 0
        ? sql`false`
        : sql`${col} IN (${sql.join(customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

/**
 * Procena svih parova kupac–artikal u opsegu pozivaoca.
 * @param onlyCustomerId suziti na jednog kupca (stranica kupca)
 */
export async function evaluateRebateArticles(viewer: PortalUser, asOf: string, onlyCustomerId?: string) {
  const scope = await resolveLedgerScope(viewer);
  const inScope = scopeSql(scope.customerIds);
  const only = onlyCustomerId ? sql`ril.customer_id = ${onlyCustomerId}::uuid` : sql`true`;
  const db = getDb();
  const [lines, rules, reps] = await Promise.all([
    db.execute<Line>(sql`
      SELECT ril.customer_id, c.name AS customer_name, il.article_id, ril.article_code, ril.article_name,
             ril.invoice_id, i.number || '/' || i.year AS label, ril.issued_on::text AS issued_on, ril.line_number,
             il.discount_percent::text AS discount_percent
        FROM recommendation_input_lines ril
        JOIN invoice_lines il ON il.id = ril.invoice_line_id
        JOIN invoices i ON i.id = ril.invoice_id
        JOIN customers c ON c.id = ril.customer_id
       WHERE il.article_id IS NOT NULL AND ${inScope(sql`ril.customer_id`)} AND ${only}`),
    db.execute<{ customer_id: string; article_id: string; status: string; discount_percent: string }>(sql`
      SELECT customer_id, article_id, status::text AS status, discount_percent::text AS discount_percent
        FROM price_rules
       WHERE customer_scope = 'customer' AND product_scope = 'article' AND value_kind = 'discount_percent'
         AND status::text IN (${sql.join([...APPROVED, ...PENDING].map((s) => sql`${s}`), sql`, `)})
         AND (effective_to IS NULL OR effective_to >= ${asOf}::date)
         AND ${inScope(sql`customer_id`)}`),
    db.execute<{ customer_id: string; name: string }>(sql`
      SELECT ca.customer_id, u.name FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ${inScope(sql`ca.customer_id`)} ORDER BY u.name`),
  ]);

  const pairs = new Map<string, { customerId: string; customerName: string; articleId: string; articleCode: string; articleName: string | null; lines: Parameters<typeof evaluateArticle>[0] }>();
  for (const l of lines) {
    const key = `${l.customer_id}|${l.article_id}`;
    let p = pairs.get(key);
    if (!p) {
      p = { customerId: l.customer_id, customerName: l.customer_name, articleId: l.article_id, articleCode: l.article_code, articleName: l.article_name, lines: [] };
      pairs.set(key, p);
    }
    p.lines.push({ invoiceId: l.invoice_id, documentLabel: l.label, issuedOn: l.issued_on, lineNumber: l.line_number, discountPercent: Number(l.discount_percent) });
  }
  const existing = new Map<string, { status: string; discountPercent: number; approved: boolean }[]>();
  for (const r of rules) {
    const key = `${r.customer_id}|${r.article_id}`;
    existing.set(key, [...(existing.get(key) ?? []), { status: r.status, discountPercent: Number(r.discount_percent), approved: APPROVED.includes(r.status) }]);
  }
  const salespeople = new Map<string, string[]>();
  for (const r of reps) salespeople.set(r.customer_id, [...(salespeople.get(r.customer_id) ?? []), r.name]);

  return [...pairs.entries()].map(([key, p]) => {
    const ex = existing.get(key) ?? [];
    const result = evaluateArticle(p.lines, { asOf, existing: ex });
    const { lines: _lines, ...rest } = p;
    void _lines;
    return { ...rest, salespeople: salespeople.get(p.customerId) ?? [], existing: ex, result };
  });
}

export type RebateArticleEvaluation = Awaited<ReturnType<typeof evaluateRebateArticles>>[number];

/**
 * Primena serije. Traži da akter sme i da predloži i da odobri (gazda);
 * odobrava se kroz postojeći `transitionPriceRule`, ne mimo njega.
 */
export async function applyRebateBatch(input: {
  actor: PortalUser;
  asOf: string;
  authorization: string;
  batchId?: string;
  dryRun?: boolean;
}) {
  const { actor, asOf, authorization } = input;
  if (!can(actor, "prices:propose") || !can(actor, "prices:approve")) {
    throw new Error("Seriju sme da primeni samo onaj ko i predlaže i odobrava (vlasnik).");
  }
  const batchId = input.batchId ?? `rabati-istorija-${asOf}-${randomUUID().slice(0, 8)}`;
  const evaluations = await evaluateRebateArticles(actor, asOf);
  // „bez_rabata“ = dosledan 0 % po istim strogim merilima → izričito pravilo 0 %.
  const toApply = evaluations.filter((e) => e.result.outcome === "primeni" || e.result.outcome === "bez_rabata");
  const counts: Record<string, number> = {};
  for (const e of evaluations) counts[e.result.outcome] = (counts[e.result.outcome] ?? 0) + 1;
  const summary = {
    batchId,
    criteria: REBATE_CRITERIA.version,
    asOf,
    pairs: evaluations.length,
    counts,
    rules: toApply.length,
    customers: new Set(toApply.map((e) => e.customerId)).size,
  };
  if (input.dryRun) return { ...summary, applied: [] as { ruleId: string; customerId: string; articleId: string; percent: number }[], evaluations };

  const applied: { ruleId: string; customerId: string; articleId: string; percent: number }[] = [];
  for (const e of toApply) {
    const percent = e.result.percent as number;
    const created = await proposePriceRule(
      {
        customerScope: "customer",
        customerId: e.customerId,
        productScope: "article",
        articleId: e.articleId,
        valueKind: "discount_percent",
        discountPercent: percent,
        effectiveFrom: asOf,
        reason: applicationReason(e.result, { previousRule: null, authorization }),
        biznisoftEntryRequired: false,
        sourceBatch: batchId,
      },
      actor,
      { correlationId: batchId, notify: false },
    );
    await transitionPriceRule(
      { ruleId: created.id, to: "approved_pending_biznisoft", reason: `Primena serije ${batchId} po autorizaciji: ${authorization}`.slice(0, 500) },
      actor,
      { correlationId: batchId, notify: false },
    );
    applied.push({ ruleId: created.id, customerId: e.customerId, articleId: e.articleId, percent });
  }

  await getDb().transaction(async (tx) => {
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceRuleBatchApplied,
        entityType: "Serija pravila cene",
        entityId: batchId,
        entityLabel: batchId,
        before: null,
        after: { ...summary, applied: applied.length, samoPortal: true, unosUBizniSoft: false },
        reason: authorization,
        correlationId: batchId,
      },
      tx,
    );
    await notify(
      {
        kind: "price_rule_approved",
        severity: "info",
        requiredCapability: "prices:approve",
        title: "Primenjena pravila rabata iz istorije faktura (samo portal)",
        body: `${applied.length} pravila kupac–artikal za ${summary.customers} kupaca, kriterijum ${REBATE_CRITERIA.version}. Važe u portalu od ${asOf}; NISU upisana u BizniSoft.`,
        entityType: "Serija pravila cene",
        entityId: batchId,
        actionHref: "/portal/cene/rabati-iz-faktura/za-pregled",
        context: { serija: batchId, pravila: applied.length },
        correlationId: batchId,
      },
      tx,
    );
  });
  return { ...summary, applied, evaluations };
}

/**
 * Opoziv JEDNE serije. Dira samo pravila sa njenom oznakom koja su i dalje
 * `approved_pending_biznisoft` (stanje u kome ih je serija ostavila). Pravila
 * koja je neko u međuvremenu promenio, i sva pravila van serije, ostaju.
 */
export async function revokeRebateBatch(input: { actor: PortalUser; batchId: string; reason: string }) {
  const { actor, batchId, reason } = input;
  if (!can(actor, "prices:approve")) throw new Error("Seriju sme da opozove samo onaj ko odobrava (vlasnik).");
  const rows = await getDb().execute<{ id: string; status: string }>(sql`
    SELECT id, status::text AS status FROM price_rules WHERE source_batch = ${batchId} ORDER BY created_at`);
  const correlationId = randomUUID();
  let revoked = 0;
  const skipped: { id: string; status: string }[] = [];
  for (const r of rows) {
    if (r.status !== "approved_pending_biznisoft") {
      skipped.push(r);
      continue;
    }
    await transitionPriceRule({ ruleId: r.id, to: "revoked", reason: `Opoziv serije ${batchId}: ${reason}`.slice(0, 500) }, actor, { correlationId, notify: false });
    revoked += 1;
  }
  await recordAudit({
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: AUDIT_ACTIONS.priceRuleBatchRevoked,
    entityType: "Serija pravila cene",
    entityId: batchId,
    entityLabel: batchId,
    before: { pravila: rows.length },
    after: { opozvano: revoked, preskoceno: skipped.length },
    reason,
    correlationId,
  });
  return { total: rows.length, revoked, skipped };
}


/**
 * Predlozi sa dokazima za pregled nadležnog komercijaliste (10.10.2026).
 *
 * Parovi bez odobrenog pravila, sa rabatom na fakturi u poslednjih 6 meseci,
 * koji NISU ispunili stroga merila (premalo faktura, promenljivo, kratko), i
 * parovi gde se poslednja faktura razlikuje od ODOBRENOG pravila. Ništa se ne
 * primenjuje: predlog ide u postojeći tok odobravanja tek kada ga čovek pošalje.
 * Opseg je opseg pozivaoca (komercijalista vidi samo svoje kupce).
 */
export async function rebateProposals(viewer: PortalUser, asOf: string, onlyCustomerId?: string) {
  const evaluations = await evaluateRebateArticles(viewer, asOf, onlyCustomerId);
  const sixMonths = new Date(Date.parse(`${asOf}T00:00:00Z`) - 183 * 86400000).toISOString().slice(0, 10);
  const recent = new Date(Date.parse(`${asOf}T00:00:00Z`) - 45 * 86400000).toISOString().slice(0, 10);
  const byCustomer = new Map<string, typeof evaluations>();
  for (const e of evaluations) byCustomer.set(e.customerId, [...(byCustomer.get(e.customerId) ?? []), e]);
  const approvedOf = (e: (typeof evaluations)[number]) => {
    const a = e.existing.filter((x) => x.approved);
    return a.length === 1 ? a[0].discountPercent : null;
  };
  const out = [];
  for (const e of evaluations) {
    const inv = e.result.invoices;
    const last = inv[inv.length - 1];
    if (!last || last.issuedOn < sixMonths) continue;
    const approved = e.existing.filter((x) => x.approved);
    let kind: "bez_pravila" | "razlika_sa_odobrenim";
    if (approved.length === 0) {
      if (["primeni", "bez_rabata", "vec_vazi", "vec_predlozeno"].includes(e.result.outcome)) continue;
      // Predlog na čekanju (bilo kog procenta) je već u toku odobravanja.
      if (e.existing.some((x) => !x.approved)) continue;
      if (last.percent === 0) continue;
      kind = "bez_pravila";
    } else {
      if (last.issuedOn < recent || last.percent === null || approved.every((a) => Math.abs(a.discountPercent - (last.percent as number)) < 0.0005)) continue;
      kind = "razlika_sa_odobrenim";
    }
    const evidence = proposalEvidence({
      target: { articleId: e.articleId, name: e.articleName, invoices: inv },
      customerPairs: (byCustomer.get(e.customerId) ?? []).map((p) => ({ articleId: p.articleId, name: p.articleName, invoices: p.result.invoices, approvedPercent: approvedOf(p) })),
      asOf,
    });
    out.push({
      kind,
      customerId: e.customerId,
      customerName: e.customerName,
      articleId: e.articleId,
      articleCode: e.articleCode,
      articleName: e.articleName,
      salespeople: e.salespeople,
      outcome: e.result.outcome,
      outcomeReason: e.result.reason,
      approvedPercent: approved.length ? approved.map((a) => a.discountPercent) : null,
      // Razlika sa odobrenim pravilom: odobreno se NE prepisuje, odluka je na nadležnom.
      verdict: kind === "razlika_sa_odobrenim" ? ("odluka_nadleznog" as const) : evidence.verdict,
      evidence,
    });
  }
  return out;
}

/** Predlog JEDNOG para iz pregleda: dokaz se ponovo računa na serveru, pa ide na odobrenje. */
export async function proposeFromEvidence(viewer: PortalUser, customerId: string, articleId: string, asOf: string) {
  const list = await rebateProposals(viewer, asOf, customerId);
  const p = list.find((x) => x.articleId === articleId);
  if (!p) return { ok: false as const, message: "Par nije u opsegu ili više nije za predlog." };
  if (p.kind !== "bez_pravila") return { ok: false as const, message: "Postoji odobreno pravilo — o razlici odlučuje nadležni kroz izmenu pravila, ne nov predlog." };
  if (p.evidence.proposedPercent === null || p.evidence.proposedPercent <= 0) return { ok: false as const, message: "Poslednja faktura nema jedinstven rabat." };
  const docs = p.evidence.lastInvoices.map((i) => `${i.documentLabel} ${i.issuedOn} ${i.percent ?? "mešano"} %`).join(", ");
  const created = await proposePriceRule(
    {
      customerScope: "customer",
      customerId,
      productScope: "article",
      articleId,
      valueKind: "discount_percent",
      discountPercent: p.evidence.proposedPercent,
      effectiveFrom: asOf,
      reason: `Predlog iz pregleda dokaza (${p.evidence.verdict === "jak_dokaz" ? "jak dokaz" : "nedovoljan dokaz — odluka čoveka"}). Poslednje fakture: ${docs}. Porodica „${p.evidence.family}“: fakture 12 m ${Math.round(p.evidence.familyInvoices.share * 100)} % = ${p.evidence.familyInvoices.value} %, odobrena pravila ${Math.round(p.evidence.familyRules.share * 100)} % = ${p.evidence.familyRules.value} %.${p.evidence.reasons.length ? ` Napomene: ${p.evidence.reasons.join("; ")}.` : ""}`.slice(0, 2000),
      biznisoftEntryRequired: false,
    },
    viewer,
  );
  return { ok: true as const, ruleId: created.id };
}
