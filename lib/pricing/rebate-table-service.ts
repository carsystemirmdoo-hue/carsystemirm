import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { can } from "@/lib/authz/permissions.mjs";
import { canDecidePricesFor } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { customerPrices } from "@/lib/pricing/customer-price-service";
import { approvedPaymentOptions } from "@/lib/pricing/payment-option-service";
import { assertPricingCustomerAccess } from "@/lib/pricing/pricing-scope";
import { previewRebateChange, RebateChangeError, submitRebateChange } from "@/lib/pricing/rebate-change-service";
import { groupKeysFor, MAX_ITEMS_PER_SAVE, planChanges, type TableRow } from "@/lib/pricing/rebateTable.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * Tabela rabata kupca (2026-11-09): svi artikli u ponudi, koje kupac uzima i
 * koje ne, važeći rabat i neto cena — i izmena po brendu, grupi, artiklu,
 * izboru ili neto ceni.
 *
 * Čitanje: važeći rabat i neto cena dolaze iz `customerPrices` — istog računa
 * koji vidi kupac — a ne iz posebne formule ekrana.
 * Upis: svaka izmena postaje pravilo po ARTIKLU kroz `submitRebateChange`
 * (pregled, zamena starog pravila, odobrenje, dnevni zbir vlasniku).
 */

const ACTIVE = ["approved_pending_biznisoft", "office_recorded", "confirmed"];
const PENDING = ["draft", "pending_approval"];

export type RebateTableRow = TableRow & {
  code: string;
  name: string;
  unit: string | null;
  netCents: number | null;
  priceNote: string | null;
  ownFrom: string | null;
  /** Poklopac obaveznog para: šifre posuda uz koje ide (za prikaz). */
  pairCodes: string[];
  purchaseDays: number;
  lastPurchaseOn: string | null;
  buysNow: boolean;
};

export async function loadRebateTable(viewer: PortalUser, customerId: string, now: Date = new Date()) {
  await assertPricingCustomerAccess(viewer, customerId);
  const today = belgradeDate(now);
  const db = getDb();
  const [customerRows, articleRows, purchases, rules, options, pairRows] = await Promise.all([
    db.execute<{ name: string }>(sql`SELECT name FROM customers WHERE id = ${customerId}::uuid`),
    // U ponudi: ima važeću osnovnu cenu i nije van programa.
    db.execute<{ id: string; code: string; name: string; brand: string | null; unit: string | null }>(sql`
      SELECT a.id, a.code, a.name, a.brand, a.unit
        FROM articles a
       WHERE EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id AND b.valid_from <= ${today}::date)
         AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       ORDER BY a.name`),
    db.execute<{ article_id: string; days: number; last: string }>(sql`
      SELECT il.article_id, count(DISTINCT ril.issued_on)::int AS days, max(ril.issued_on)::text AS last
        FROM recommendation_input_lines ril JOIN invoice_lines il ON il.id = ril.invoice_line_id
       WHERE ril.customer_id = ${customerId}::uuid AND ril.issued_on <= ${today}::date AND il.article_id IS NOT NULL
       GROUP BY il.article_id`),
    // Pravila ARTIKLA ovog kupca (osnovni uslov, bez opcije plaćanja) — isti kriterijum kao „Promena rabata“.
    db.execute<{ id: string; article_id: string; p: string; status: string; f: string }>(sql`
      SELECT id, article_id, discount_percent::text AS p, status::text AS status, effective_from::text AS f
        FROM price_rules
       WHERE customer_scope = 'customer' AND customer_id = ${customerId}::uuid AND product_scope = 'article'
         AND value_kind = 'discount_percent' AND payment_condition IS NULL
         AND status::text IN (${sql.join([...ACTIVE, ...PENDING].map((s) => sql`${s}`), sql`, `)})
         AND (effective_to IS NULL OR effective_to >= ${today}::date)`),
    approvedPaymentOptions(customerId, today),
    // Obavezni parovi posuda → poklopac (0056): poklopac nema svoj rabat, ide uz posudu.
    db.execute<{ article_id: string; companion_article_id: string }>(sql`
      SELECT article_id, companion_article_id FROM article_required_pairs WHERE revoked_at IS NULL`),
  ]);
  const customer = [...customerRows][0];
  if (!customer) throw new RebateChangeError("Kupac ne postoji.");

  const ids = [...articleRows].map((a) => a.id);
  const { prices } = await customerPrices(customerId, ids, today, null);
  const bought = new Map([...purchases].map((p) => [p.article_id, p]));
  const rulesBy = new Map<string, { id: string; p: number; status: string; f: string }[]>();
  for (const r of rules) rulesBy.set(r.article_id, [...(rulesBy.get(r.article_id) ?? []), { id: r.id, p: Number(r.p), status: r.status, f: r.f }]);
  const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);

  const lidOf = new Map<string, string[]>();
  for (const p of pairRows) lidOf.set(p.companion_article_id, [...(lidOf.get(p.companion_article_id) ?? []), p.article_id]);
  const articleById = new Map([...articleRows].map((a) => [a.id, a]));

  const rows: RebateTableRow[] = [...articleRows].map((a) => {
    // Poklopac stoji u brendu i grupi svoje posude, da se ne bi menjao odvojeno.
    // Ako poklopac zatvara više posuda (stara i nova šifra), grupa je uvek ona sa najvećom
    // šifrom (nova šifra) — redosled iz baze ne sme da pomera poklopac iz grupe u grupu.
    const pairOf = (lidOf.get(a.id) ?? [])
      .filter((id) => articleById.has(id))
      .sort((x, y) => articleById.get(y)!.code.localeCompare(articleById.get(x)!.code));
    const container = pairOf.length ? articleById.get(pairOf[0])! : a;
    const keys = groupKeysFor({ name: container.name, brand: container.brand });
    const price = prices.get(a.id);
    const list = rulesBy.get(a.id) ?? [];
    const active = list.filter((r) => ACTIVE.includes(r.status) && r.f <= today);
    const pending = list.find((r) => PENDING.includes(r.status));
    const scheduled = list.find((r) => ACTIVE.includes(r.status) && r.f > today);
    const own = active.length === 1 ? active[0] : null;
    const blocked = pending
      ? `već čeka predlog ${pending.p} %`
      : scheduled
        ? `već zakazana promena ${scheduled.p} % od ${scheduled.f}`
        : active.length > 1
          ? "više važećih pravila — prvo razrešiti sukob"
          : null;
    const p = bought.get(a.id);
    const priced = price && price.status === "cena" ? price : null;
    return {
      articleId: a.id,
      code: a.code,
      name: a.name,
      unit: a.unit,
      brand: keys.brand,
      group: keys.group,
      baseCents: priced?.baseCents ?? null,
      currentPercent: priced && priced.discountPercent !== null ? priced.discountPercent : null,
      netCents: priced?.netCents ?? null,
      priceNote: price && price.status !== "cena" ? price.message : null,
      source: own && priced ? "artikal" : priced ? "sire" : null,
      ownRuleId: own?.id ?? null,
      ownFrom: own?.f ?? null,
      pairOf,
      pairCodes: pairOf.map((id) => articleById.get(id)!.code),
      blocked,
      purchaseDays: p?.days ?? 0,
      lastPurchaseOn: p?.last ?? null,
      buysNow: Boolean(p && p.last >= yearAgo),
    };
  });
  // Osnovna cena za artikle „na upit“ (bez rabata) — da bi se neto cena mogla upisati.
  const missingBase = rows.filter((r) => r.baseCents === null).map((r) => r.articleId);
  if (missingBase.length) {
    const base = await db.execute<{ article_id: string; c: number }>(sql`
      SELECT DISTINCT ON (article_id) article_id, round(net_price * 100)::int AS c
        FROM article_base_prices WHERE valid_from <= ${today}::date
         AND article_id IN (${sql.join(missingBase.map((id) => sql`${id}::uuid`), sql`, `)})
       ORDER BY article_id, valid_from DESC, created_at DESC`);
    const m = new Map([...base].map((b) => [b.article_id, Number(b.c)]));
    for (const r of rows) if (r.baseCents === null) r.baseCents = m.get(r.articleId) ?? null;
  }

  const assigned = await loadAssignedCustomerIds(viewer.id);
  const own = canDecidePricesFor(viewer, assigned, customerId);
  return {
    customer: { id: customerId, name: customer.name },
    today,
    rows,
    paymentOptions: options,
    canPropose: can(viewer, "prices:propose") && own,
    canApprove: can(viewer, "prices:approve") && own,
  };
}

export type RebateTableEdits = {
  brands?: Record<string, number>;
  groups?: Record<string, number>;
  articles?: Record<string, number>;
  nets?: Record<string, number>;
  includeOwn?: boolean;
};

/**
 * Čuvanje izmena. Plan se ponovo računa na serveru iz SVEŽEG stanja (ulaz iz
 * pregledača se ne veruje), a `expected` (artikal → pravilo koje je korisnik
 * video) mora da se poklopi — inače se ništa ne upisuje.
 */
export async function applyRebateTable(
  viewer: PortalUser,
  input: { customerId: string; edits: RebateTableEdits; effectiveFrom: string; reason: string; approveNow: boolean; expected: Record<string, string | null> },
) {
  const table = await loadRebateTable(viewer, input.customerId);
  if (!table.canPropose) throw new RebateChangeError("Rabate ovog kupca ne možete da menjate.");
  if (input.approveNow && !table.canApprove) throw new RebateChangeError("Nemate pravo da direktno odobrite promenu.");
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 800) throw new RebateChangeError("Obrazloženje: 10–800 znakova.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom) || input.effectiveFrom < table.today) throw new RebateChangeError("Početak važenja ne sme biti u prošlosti.");

  // Postojeće pravilo artikla koje počinje na izabrani dan ili kasnije ne može se zameniti tim danom.
  const rows = table.rows.map((r) =>
    !r.blocked && r.ownFrom && r.ownFrom >= input.effectiveFrom ? { ...r, blocked: `postojeće pravilo počinje ${r.ownFrom} — izaberite kasniji datum` } : r,
  );
  const plan = planChanges(rows, input.edits);
  if (!plan.items.length) throw new RebateChangeError(plan.skipped.length ? `Nijedan artikal ne može da se promeni: ${plan.skipped[0].reason}.` : "Nema promena za čuvanje.");
  if (plan.tooMany) throw new RebateChangeError(`Najviše ${MAX_ITEMS_PER_SAVE} artikala u jednom čuvanju (sada ${plan.items.length}). Sačuvajte u delovima, npr. po grupi.`);
  for (const it of plan.items) {
    if ((input.expected[it.articleId] ?? null) !== it.replacesRuleId) {
      throw new RebateChangeError("Stanje se promenilo od otvaranja tabele (pravila ili predlozi). Osvežite stranicu.");
    }
  }

  // Jedna serija po rabatu i vrsti unosa; sve se proverava PRE prvog upisa.
  const batches = new Map<string, { percent: number; net: boolean; ids: string[]; nets: number[] }>();
  for (const it of plan.items) {
    const net = it.netCents !== null;
    const k = `${it.percent}|${net}`;
    const b = batches.get(k) ?? { percent: it.percent, net, ids: [], nets: [] };
    b.ids.push(it.articleId);
    if (it.netCents !== null) b.nets.push(it.netCents);
    batches.set(k, b);
  }
  for (const b of batches.values()) {
    const preview = await previewRebateChange(viewer, { customerId: input.customerId, mode: "artikli", articleIds: b.ids, newPercent: b.percent, effectiveFrom: input.effectiveFrom });
    const bad = preview.rows.find((r) => !r.included);
    if (bad) throw new RebateChangeError(`${bad.articleCode} ${bad.articleName}: ${bad.note ?? "ne može se promeniti"}. Ništa nije sačuvano.`);
  }

  let count = 0;
  for (const b of batches.values()) {
    const netNote = b.net
      ? ` Upisana neto cena ${b.nets.map((c) => (c / 100).toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 })).join(", ")}; rabat ${String(b.percent).replace(".", ",")} % izračunat obrnuto (kao na fakturi).`
      : "";
    const r = await submitRebateChange(viewer, {
      customerId: input.customerId,
      mode: "artikli",
      articleIds: b.ids,
      newPercent: b.percent,
      effectiveFrom: input.effectiveFrom,
      reason: `${reason}${netNote}`.slice(0, 800),
      approveNow: input.approveNow,
      expected: b.ids.map((id) => ({ articleId: id, replacesRuleId: input.expected[id] ?? null })),
    });
    count += r.count;
  }
  return { count, batches: batches.size, kept: plan.kept.length, skipped: plan.skipped, approved: input.approveNow };
}
