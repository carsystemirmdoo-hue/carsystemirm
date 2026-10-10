import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { resolveCustomerPrice } from "@/lib/pricing/customerPrice.mjs";
import { ACTIVE_RULE_STATUSES } from "@/lib/pricing/evaluation-service";
import { effectiveBasePriceCents } from "@/lib/pricing/price-list-service";
import { evaluatePricing } from "@/lib/pricing/precedence.mjs";

/**
 * Stvarna cena kupca na dan: osnovna cena (`article_base_prices`) + odobreno
 * pravilo (`price_rules`, isti statusi kao pregled cena). Svaki budući prikaz
 * stvarne cene kupcu MORA ići kroz ovo — vidi `resolveCustomerPrice`.
 *
 * `naUpit` stavke nose primaoce zahteva: komercijaliste dodeljene kupcu.
 */
export async function customerPrices(customerId: string, articleIds: string[], onDate: string) {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const db = getDb();
  const statuses = sql.join(ACTIVE_RULE_STATUSES.map((s) => sql`${s}`), sql`, `);
  const [base, ruleRows, groupRows, articleRows, reps] = await Promise.all([
    effectiveBasePriceCents(onDate),
    db.execute<Record<string, unknown>>(sql`
      SELECT id, customer_scope::text AS "customerScope", product_scope::text AS "productScope", value_kind::text AS "valueKind",
             customer_id AS "customerId", customer_group_id AS "customerGroupId", article_id AS "articleId", product_group AS "productGroup", brand,
             discount_percent::text AS "discountPercent", net_price::text AS "netPrice", effective_from::text AS "effectiveFrom",
             effective_to::text AS "effectiveTo", status::text AS status
        FROM price_rules WHERE status::text IN (${statuses})
         AND (customer_scope::text <> 'customer' OR customer_id = ${customerId}::uuid)`),
    db.execute<{ group_id: string }>(sql`SELECT group_id FROM customer_group_members WHERE customer_id = ${customerId}::uuid`),
    db.execute<{ id: string; product_group: string | null; brand: string | null }>(sql`
      SELECT id, product_group, brand FROM articles
       WHERE ${articleIds.length ? sql`id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`false`}`),
    db.execute<{ name: string; email: string }>(sql`
      SELECT u.name, u.email FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ca.customer_id = ${customerId}::uuid AND u.active ORDER BY u.name`),
  ]);
  type Rule = { valueKind: string; discountPercent?: string | null; netPrice?: string | null } & Record<string, unknown>;
  const rules = [...ruleRows] as Rule[];
  const groups = [...groupRows].map((g) => g.group_id);
  const out = new Map<string, ReturnType<typeof resolveCustomerPrice>>();
  for (const a of articleRows) {
    const decision = evaluatePricing(rules, { customerId, customerGroupIds: groups, articleId: a.id, productGroup: a.product_group, brand: a.brand, onDate });
    out.set(a.id, resolveCustomerPrice(decision, base.get(a.id) ?? null));
  }
  return { prices: out, routeTo: [...reps] };
}
