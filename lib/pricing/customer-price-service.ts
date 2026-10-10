import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { resolveCustomerPrice } from "@/lib/pricing/customerPrice.mjs";
import { packPrice } from "@/lib/pricing/packPrice.mjs";
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
    db.execute<{ id: string; name: string; unit: string | null; product_group: string | null; brand: string | null; mapped: boolean; fractional: boolean }>(sql`
      SELECT a.id, a.name, a.unit, a.product_group, a.brand,
             EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped') AS mapped,
             EXISTS (SELECT 1 FROM invoice_lines l WHERE l.article_id = a.id AND l.quantity <> trunc(l.quantity)) AS fractional
        FROM articles a
       WHERE ${articleIds.length ? sql`a.id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`false`}`),
    db.execute<{ name: string; email: string }>(sql`
      SELECT u.name, u.email FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ca.customer_id = ${customerId}::uuid AND u.active ORDER BY u.name`),
  ]);
  type Rule = { valueKind: string; discountPercent?: string | null; netPrice?: string | null } & Record<string, unknown>;
  const rules = [...ruleRows] as Rule[];
  const groups = [...groupRows].map((g) => g.group_id);
  const out = new Map<string, ReturnType<typeof resolveCustomerPrice> & { unit: string | null; pack: ReturnType<typeof packPrice> | null }>();
  for (const a of articleRows) {
    const decision = evaluatePricing(rules, { customerId, customerGroupIds: groups, articleId: a.id, productGroup: a.product_group, brand: a.brand, onDate });
    const price = resolveCustomerPrice(decision, base.get(a.id) ?? null);
    // Cena po JM iz BizniSofta; cena PAKOVANJA samo uz dokaz (veza, količina pakovanja).
    const pack =
      price.status === "cena" && price.baseCents !== null
        ? packPrice({
            unit: a.unit,
            name: a.name,
            basePrice: (price.baseCents / 100).toFixed(2),
            discountPercent: price.discountPercent ?? 0,
            mappingConfirmed: a.mapped,
            fractionalSales: a.fractional,
          })
        : null;
    out.set(a.id, { ...price, unit: a.unit, pack });
  }
  return { prices: out, routeTo: [...reps] };
}
