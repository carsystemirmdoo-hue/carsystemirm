/**
 * Demo rabati TEST kupca (ordering.trial): jedan rabat po opciji plaćanja za SVE proizvode,
 * kroz isti mehanizam pravila cena kao stvarni kupci — kartice kataloga, „Za Vas“ i korpa
 * zato računaju istu cenu.
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-demo-rebates.mts --pib <PIB> --osnovni <pct> --avans <pct> \
 *     [--potvrdio <email> --upis [--production-odobreno]]
 *
 * Svaki rabat se računa ZASEBNO od iste osnovne (VP) cene — ne sabiraju se:
 * osnovni uslov (važi i za odloženo plaćanje) = osnovna × (1 − osnovni), avans = osnovna × (1 − avans).
 * Postojeća pravila tog kupca se opozivaju (samo tog kupca; cenovnik i drugi kupci se ne diraju).
 * Pravila važe samo u portalu (`biznisoft_entry_required = false`). Bez `--upis` samo proverava
 * (sesija samo za čitanje). Isto stanje → bez upisa (idempotentno); upis i audit u transakciji.
 */
import { sql } from "drizzle-orm";
import { precedenceLevelFor, scopeKeyFor } from "@/lib/pricing/precedence.mjs";

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const write = args.includes("--upis");
const by = arg("--potvrdio");
const pib = arg("--pib");
const base = Number(arg("--osnovni"));
const advance = Number(arg("--avans"));
const BATCH = "demo-rabati";
if (!pib || !(base > 0 && base < 100) || !(advance > 0 && advance < 100) || (write && !by)) {
  console.error("Upotreba: --pib <PIB> --osnovni <pct> --avans <pct> [--potvrdio <email> --upis]");
  process.exit(1);
}
if (write && /neon\.tech|neon\.build/.test(process.env.DATABASE_URL ?? "") && !args.includes("--production-odobreno")) {
  console.error("Production baza: upis traži --production-odobreno. Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";
const { getDb } = await import("@/db/client");
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") { console.error("Sesija nije samo za čitanje — prekinuto."); process.exit(1); }
}

const [customer] = [...(await db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM customers WHERE pib = ${pib}`))];
if (!customer) { console.error(`Kupac ${pib} ne postoji.`); process.exit(1); }
const [trial] = [...(await db.execute<{ value: { customerIds?: string[] } }>(sql`SELECT value FROM system_settings WHERE key = 'ordering.trial'`))];
if (!(trial?.value?.customerIds ?? []).includes(customer.id)) {
  console.error("Kupac nije izdvojeni test kupac (ordering.trial) — demo rabati se ne upisuju stvarnoj firmi.");
  process.exit(1);
}
const options = [...(await db.execute<{ option_code: string }>(sql`
  SELECT option_code FROM customer_payment_options
   WHERE customer_id = ${customer.id}::uuid AND status = 'odobreno' AND effective_from <= current_date
     AND (effective_to IS NULL OR effective_to >= current_date)`))].map((o) => o.option_code);
const existing = [...(await db.execute<{ id: string; product_scope: string; brand: string | null; discount_percent: string | null; payment_condition: string | null; source_batch: string | null }>(sql`
  SELECT id, product_scope::text, brand, discount_percent::text, payment_condition, source_batch FROM price_rules
   WHERE customer_id = ${customer.id}::uuid
     AND status::text IN ('approved_pending_biznisoft', 'office_recorded', 'confirmed')
     AND (effective_to IS NULL OR effective_to >= current_date)`))];

const wanted = [
  { cond: null as string | null, pct: base },
  ...(options.includes("avans") ? [{ cond: "avans", pct: advance }] : []),
];
const same =
  existing.length === wanted.length &&
  wanted.every((w) => existing.some((e) => e.product_scope === "all" && e.source_batch === BATCH && e.payment_condition === w.cond && Number(e.discount_percent) === w.pct));

const [cover] = [...(await db.execute<{ n: string }>(sql`
  SELECT count(*)::text AS n FROM articles a
   WHERE EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped')
     AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
     AND EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id AND b.valid_from <= current_date)
     AND EXISTS (SELECT 1 FROM article_pack_sizes ps WHERE ps.article_id = a.id)`))];

console.log(`Kupac: ${customer.name}`);
console.log(`Opcije plaćanja: ${options.join(", ") || "—"}`);
console.log(`Postojeća pravila (opozivaju se): ${existing.map((e) => `${e.product_scope}${e.brand ? ` ${e.brand}` : ""} ${e.discount_percent}%${e.payment_condition ? ` (${e.payment_condition})` : ""}`).join("; ") || "—"}`);
console.log(`Nova pravila: ${wanted.map((w) => `svi proizvodi ${w.pct}%${w.cond ? ` (${w.cond})` : " (osnovni uslov, važi i za odloženo)"}`).join("; ")}`);
console.log(`Artikala sa potvrđenom vezom, osnovnom cenom i pakovanjem: ${cover?.n}`);
if (!options.includes("avans")) console.log("Napomena: kupac nema odobrenu opciju avans — avansni rabat se ne upisuje.");
console.log(same ? "Već upisano (isto stanje)." : `Spremno${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}.`);

/*
 * Simulacija bez upisa: isti izbor pravila (evaluatePricing) i obračun (resolveCustomerPrice)
 * kao korpa, nad PREDLOŽENIM pravilima — uzorak artikala po brendu.
 */
if (!write) {
  const { evaluatePricing } = await import("@/lib/pricing/precedence.mjs");
  const { resolveCustomerPrice } = await import("@/lib/pricing/customerPrice.mjs");
  const { effectiveBasePriceCents } = await import("@/lib/pricing/price-list-service");
  const today = new Date().toISOString().slice(0, 10);
  const baseCents = await effectiveBasePriceCents(today, db);
  const sample = [...(await db.execute<{ id: string; code: string; name: string; brand: string | null; product_group: string | null; unit: string | null }>(sql`
    SELECT DISTINCT ON (coalesce(a.brand, a.product_group)) a.id, a.code, a.name, a.brand, a.product_group, a.unit FROM articles a
     WHERE EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped')
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       AND EXISTS (SELECT 1 FROM article_pack_sizes ps WHERE ps.article_id = a.id)
     ORDER BY coalesce(a.brand, a.product_group), a.code LIMIT 8`))];
  const rules = wanted.map((w) => ({
    customerScope: "customer", customerId: customer.id, productScope: "all", valueKind: "discount_percent",
    discountPercent: String(w.pct), effectiveFrom: today, effectiveTo: null, status: "approved_pending_biznisoft", paymentCondition: w.cond,
  }));
  console.log("Simulacija (bez upisa), cena po JM bez PDV-a:");
  for (const a of sample) {
    const at = (cond: string | null) => {
      const d = evaluatePricing(rules, { customerId: customer.id, customerGroupIds: [], articleId: a.id, productGroup: a.product_group, brand: a.brand, onDate: today, paymentCondition: cond });
      const p = resolveCustomerPrice(d, baseCents.get(a.id) ?? null);
      return p.status === "cena" ? (p.netCents / 100).toFixed(2) : p.status;
    };
    const b = baseCents.get(a.id);
    console.log(`  ${a.code} ${a.unit ?? ""} · osnovna ${b !== undefined ? (b / 100).toFixed(2) : "—"} · odloženo ${at("odlozeno_30")} · avans ${at("avans")}`);
  }
}

if (write && !same) {
  const [actor] = [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))];
  if (!actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }
  const reason = `Demo rabati test kupca: osnovni uslov ${base} %, avans ${advance} %, svaki od iste osnovne cene; samo portal.`;
  await db.transaction(async (tx) => {
    for (const e of existing) {
      await tx.execute(sql`
        UPDATE price_rules SET status = 'revoked', decided_by = ${actor.id}::uuid, decided_at = now(),
               decision_reason = ${"Zamenjeno demo rabatima test kupca."}
         WHERE id = ${e.id}::uuid`);
    }
    for (const w of wanted) {
      const scope = { customerScope: "customer", customerId: customer.id, productScope: "all", paymentCondition: w.cond };
      await tx.execute(sql`
        INSERT INTO price_rules (customer_scope, customer_id, product_scope, precedence_level, scope_key, value_kind, discount_percent,
                                 effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at,
                                 biznisoft_entry_required, source_batch, payment_condition)
        VALUES ('customer', ${customer.id}::uuid, 'all', ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', ${w.pct},
                current_date, 'approved_pending_biznisoft', ${reason}, ${actor.id}::uuid, now(), ${actor.id}::uuid, now(),
                false, ${BATCH}, ${w.cond})`);
    }
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role as never },
        action: AUDIT_ACTIONS.priceRuleBatchApplied,
        entityType: "Kupac",
        entityId: customer.id,
        entityLabel: customer.name.slice(0, 200),
        before: { pravila: existing.map((e) => ({ opseg: e.product_scope, brend: e.brand, rabat: e.discount_percent, uslov: e.payment_condition })) },
        after: { pravila: wanted.map((w) => ({ opseg: "all", rabat: w.pct, uslov: w.cond })) },
        reason,
      },
      tx as never,
    );
  });
  console.log("Upisano.");
}
process.exit(0);
