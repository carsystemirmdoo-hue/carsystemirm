import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { outOfProgrammeArticles } from "@/lib/pricing/article-programme-service";
import { classifyCustomer, COVERAGE_RULES, segmentPair } from "@/lib/pricing/rebateCoverage.mjs";
import { proposePriceRule, transitionPriceRule } from "@/lib/pricing/rule-service";

const APPROVED = ["approved_pending_biznisoft", "office_recorded", "confirmed"];
const PENDING = ["draft", "pending_approval"];
export const UNASSIGNED = "Bez dodele — vlasnik";
/** Grupa „pojedinačno“: direktno potvrđeni artikli bez dokazane porodice. */
export const SINGLE_GROUP = "(pojedinačni artikli)";

export type CoveragePair = {
  articleId: string;
  articleName: string;
  lastOn: string;
  purchases: number;
  lastInvoices: { invoiceId: string; documentLabel: string | null; issuedOn: string; percent: number }[];
  outcome: "odobreno" | "ceka_odobrenje" | "direktno" | "izvedeno" | "nejasno" | "van_programa";
  percent: number | null;
  reason: string | null;
  family?: string | null;
  exception?: boolean;
  differsRecent?: boolean;
  segment: "aktuelno" | "retko" | "istorijsko";
};
type Pair = CoveragePair;

export type CoverageGroup = {
  key: string;
  percent: number | null;
  evidence: { articles: number; days: number; share: number; window: [string, string] | null; actions: number } | null;
  pairs: Pair[];
};

/**
 * Pokrivenost rabata za opseg pregledača (komercijalista: samo svoji kupci).
 * Ništa ne upisuje. Grupe = kupac × dokazana porodica; u grupi su parovi
 * „direktno“ i „izvedeno“ iz aktuelnog i retkog skupa. Istorijski skup
 * (neaktivan kupac, artikal van programa ili van prodaje) se samo broji.
 */
export async function rebateCoverage(viewer: PortalUser, asOf: string, onlyCustomerId?: string) {
  const scope = await resolveLedgerScope(viewer);
  const ids = scope.customerIds;
  const inScope = (col: ReturnType<typeof sql.raw>) => (ids === null ? sql`true` : ids.length ? sql`${col} IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})` : sql`false`);
  const only = onlyCustomerId ? sql`ril.customer_id = ${onlyCustomerId}::uuid` : sql`true`;
  const db = getDb();
  const [lines, rules, customers, reps, lastSold, out] = await Promise.all([
    db.execute<{ c: string; a: string; n: string; inv: string; lbl: string; d: string; p: string }>(sql`
      SELECT ril.customer_id AS c, il.article_id AS a, coalesce(a.name, ril.article_name) AS n, ril.invoice_id AS inv,
             i.number || '/' || i.year AS lbl, ril.issued_on::text AS d, il.discount_percent::text AS p
        FROM recommendation_input_lines ril
        JOIN invoice_lines il ON il.id = ril.invoice_line_id
        JOIN invoices i ON i.id = ril.invoice_id
        JOIN articles a ON a.id = il.article_id
       WHERE ${inScope(sql.raw("ril.customer_id"))} AND ${only} AND ril.issued_on <= ${asOf}::date`),
    db.execute<{ c: string; a: string; p: string; s: string }>(sql`
      SELECT customer_id AS c, article_id AS a, discount_percent::text AS p, status::text AS s
        FROM price_rules
       WHERE customer_scope = 'customer' AND product_scope = 'article' AND value_kind = 'discount_percent'
         AND status::text IN (${sql.join([...APPROVED, ...PENDING].map((s) => sql`${s}`), sql`, `)})
         AND (effective_to IS NULL OR effective_to >= ${asOf}::date)
         AND ${inScope(sql.raw("customer_id"))}`),
    db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM customers WHERE ${inScope(sql.raw("id"))}`),
    db.execute<{ customer_id: string; name: string }>(sql`
      SELECT ca.customer_id, u.name FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ${inScope(sql.raw("ca.customer_id"))} ORDER BY u.name`),
    // Prodaja artikla bilo kome (za „aktuelni artikal“) — samo datum, bez kupca.
    db.execute<{ a: string; d: string }>(sql`
      SELECT il.article_id AS a, max(ril.issued_on)::text AS d
        FROM recommendation_input_lines ril JOIN invoice_lines il ON il.id = ril.invoice_line_id
       WHERE il.article_id IS NOT NULL AND ril.issued_on <= ${asOf}::date GROUP BY 1`),
    outOfProgrammeArticles(),
  ]);

  const names = new Map(customers.map((c) => [c.id, c.name]));
  const repsOf = new Map<string, string[]>();
  for (const r of reps) repsOf.set(r.customer_id, [...(repsOf.get(r.customer_id) ?? []), r.name]);
  const soldOn = new Map(lastSold.map((r) => [r.a, r.d]));
  const byCustomer = new Map<string, Parameters<typeof classifyCustomer>[0]["lines"]>();
  for (const l of lines) {
    const list = byCustomer.get(l.c) ?? [];
    list.push({ articleId: l.a, articleName: l.n, invoiceId: l.inv, documentLabel: l.lbl, issuedOn: l.d, discountPercent: Number(l.p) } as never);
    byCustomer.set(l.c, list);
  }
  const rulesOf = new Map<string, { articleId: string; discountPercent: number; approved: boolean }[]>();
  for (const r of rules) rulesOf.set(r.c, [...(rulesOf.get(r.c) ?? []), { articleId: r.a, discountPercent: Number(r.p), approved: APPROVED.includes(r.s) }]);

  const result = [];
  for (const [customerId, ls] of byCustomer) {
    const res = classifyCustomer({ lines: ls, rules: rulesOf.get(customerId) ?? [], outOfProgramme: out.ids, asOf });
    const customerLastOn = ls.reduce((m, l) => (l.issuedOn > m ? l.issuedOn : m), "");
    const pairs: Pair[] = (res.pairs as unknown as Omit<Pair, "segment">[]).map((p) => ({
      ...p,
      segment: segmentPair({ customerLastOn, articleLastSoldOn: soldOn.get(p.articleId) ?? null, articleInStock: false, outOfProgramme: out.ids.has(p.articleId), pairLastOn: p.lastOn, asOf }) as Pair["segment"],
    }));
    const famByKey = new Map(res.families.filter((f) => f.ok).map((f) => [f.key, f]));
    const groups = new Map<string, CoverageGroup>();
    for (const p of pairs) {
      if (p.segment === "istorijsko" || (p.outcome !== "direktno" && p.outcome !== "izvedeno")) continue;
      const key = p.outcome === "izvedeno" || (p.family && !p.exception) ? (p.family as string) : SINGLE_GROUP;
      const fam = famByKey.get(key);
      const g: CoverageGroup = groups.get(key) ?? {
        key,
        percent: key === SINGLE_GROUP ? null : (fam?.percent ?? p.percent),
        evidence: fam ? { articles: fam.articles, days: fam.days, share: fam.share, window: fam.window as [string, string], actions: fam.actions.length } : null,
        pairs: [],
      };
      g.pairs.push(p);
      groups.set(key, g);
    }
    result.push({
      customerId,
      customerName: names.get(customerId) ?? "—",
      salespeople: repsOf.get(customerId) ?? [],
      lastOn: customerLastOn,
      pairs,
      groups: [...groups.values()].sort((a, b) => b.pairs.length - a.pairs.length),
    });
  }
  return { asOf, criteria: COVERAGE_RULES.version, customers: result };
}

export type RebateCoverage = Awaited<ReturnType<typeof rebateCoverage>>;

/**
 * Odobravanje (ili predlog) cele grupe kupac × porodica jednim potezom.
 * Server ponovo računa dokaz; prihvataju se samo artikli koji su i sada u grupi
 * sa istim procentom. Vlasnik (`prices:approve`) → odobrena pravila sa oznakom
 * serije (opoziv kroz `revokeRebateBatch`); predlagač → predlozi na čekanju.
 * Postojeća odobrena pravila se nikad ne prepisuju (takvi parovi nisu u grupi).
 */
export async function approveRebateGroup(
  actor: PortalUser,
  input: { customerId: string; groupKey: string; expected: { articleId: string; percent: number }[]; asOf: string },
) {
  const approve = can(actor, "prices:approve") && can(actor, "prices:propose");
  if (!approve && !can(actor, "prices:propose")) throw new Error("Nemate pravo da predlažete rabate.");
  const cov = await rebateCoverage(actor, input.asOf, input.customerId);
  const customer = cov.customers.find((c) => c.customerId === input.customerId);
  if (!customer) return { ok: false as const, message: "Kupac nije u Vašem opsegu ili nema istoriju." };
  const groups = input.groupKey === "*" ? customer.groups : customer.groups.filter((g) => g.key === input.groupKey);
  const now = new Map(groups.flatMap((g) => g.pairs.map((p) => [p.articleId, { p, g }] as const)));
  const changed = input.expected.filter((e) => now.get(e.articleId)?.p.percent !== e.percent);
  if (!input.expected.length || changed.length) {
    return { ok: false as const, message: `Stanje se promenilo za ${changed.length || "sve"} artikala; osvežite stranu i pogledajte ponovo.` };
  }
  const batchId = `rabati-v2-${input.asOf}-${randomUUID().slice(0, 8)}`;
  const created: string[] = [];
  for (const e of input.expected) {
    const { p, g } = now.get(e.articleId)!;
    const evidence = g.evidence
      ? `porodica „${g.key}“ ${g.percent} %: ${g.evidence.articles} artikala, ${g.evidence.days} dana, ${Math.round(g.evidence.share * 100)} % stavki (${g.evidence.window?.join(" – ")})`
      : "bez dokazane porodice";
    const docs = p.lastInvoices.map((i) => `${i.documentLabel ?? ""} ${i.issuedOn} ${i.percent} %`.trim()).join(", ");
    const rule = await proposePriceRule(
      {
        customerScope: "customer",
        customerId: input.customerId,
        productScope: "article",
        articleId: e.articleId,
        valueKind: "discount_percent",
        discountPercent: e.percent,
        effectiveFrom: input.asOf,
        reason: `${COVERAGE_RULES.version}: ${p.outcome === "direktno" ? "direktno potvrđeno istorijom artikla" : "izvedeno iz dokazane porodice"}. ${evidence}. Poslednje fakture: ${docs}.${p.reason ? ` Napomena: ${p.reason}.` : ""}`.slice(0, 2000),
        biznisoftEntryRequired: false,
        sourceBatch: batchId,
      },
      actor,
      { correlationId: batchId, notify: false },
    );
    if (approve) {
      await transitionPriceRule(
        { ruleId: rule.id, to: "approved_pending_biznisoft", reason: `Grupno odobrenje ${batchId} (${customer.customerName} · ${input.groupKey})`.slice(0, 500) },
        actor,
        { correlationId: batchId, notify: false },
      );
    }
    created.push(rule.id);
  }
  await recordAudit({
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: AUDIT_ACTIONS.rebateGroupApproved,
    entityType: "Serija pravila cene",
    entityId: batchId,
    entityLabel: `${customer.customerName} · ${input.groupKey}`,
    before: null,
    after: { kupac: input.customerId, grupa: input.groupKey, pravila: created.length, odobreno: approve, kriterijum: COVERAGE_RULES.version, samoPortal: true },
    reason: approve ? "Grupno odobrenje rabata iz istorije" : "Grupni predlog rabata iz istorije",
    correlationId: batchId,
  });
  return { ok: true as const, batchId, count: created.length, approved: approve };
}
