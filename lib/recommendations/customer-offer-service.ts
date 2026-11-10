import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { loadRequiredPairs } from "@/lib/ordering/required-pairs";
import { customerPrices } from "@/lib/pricing/customer-price-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { dismissReasonLabel, parseDismissal } from "@/lib/recommendations/customerOffer.mjs";
import { recommendationRows, type RecommendationRow } from "@/lib/recommendations/query";

/**
 * Tabela preporuka kupca i ponuda (2026-11-10).
 *
 * Jedan kupac, svi artikli koje kupuje u ritmu (aktivni obračun `cadence_v1`), uz:
 *   - cenu, rabat i količinu sa POSLEDNJE fakture (šta je bilo),
 *   - cenu i rabat koje bi kupac dobio DANAS (`customerPrices`, isti račun kao korpa),
 *   - poslednjih nekoliko kupovina za detalje,
 *   - oznaku „Ne uzima više“ (0060) sa razlogom.
 *
 * Opseg: komercijalista samo dodeljene kupce; vlasnik i kancelarija sa celim opsegom sve.
 */

export class CustomerOfferError extends Error {}

const HISTORY = 6;

async function assertCustomerInScope(viewer: PortalUser, customerId: string) {
  const scope = await resolveLedgerScope(viewer);
  if (scope.customerIds !== null && !scope.customerIds.includes(customerId)) {
    throw new CustomerOfferError("Kupac nije u Vašem opsegu.");
  }
}

type Price = { baseCents: number; discountPercent: number | null; netCents: number } | null;

export type OfferPurchase = { issuedOn: string; quantity: number; unitPrice: number; discountPercent: number; lineAmount: number };

export type OfferRow = {
  articleCode: string;
  articleId: string | null;
  articleName: string;
  brand: string | null;
  unit: string | null;
  rec: Pick<
    RecommendationRow,
    "status" | "confidence" | "eventCount" | "medianIntervalDays" | "expectedNextOn" | "daysUntilExpected" | "lastPurchaseOn" | "daysSinceLastPurchase" | "explanation"
  >;
  last: OfferPurchase | null;
  history: OfferPurchase[];
  today: Price;
  todayNote: string | null;
  /** Poklopac obaveznog para koji ide uz ovu posudu (0056). */
  lid: { code: string; name: string } | null;
  dismissal: {
    id: string;
    reason: string;
    reasonLabel: string;
    replacement: string | null;
    note: string | null;
    by: string;
    at: string;
  } | null;
};

export async function loadCustomerOffer(viewer: PortalUser, customerId: string, now: Date = new Date()) {
  await assertCustomerInScope(viewer, customerId);
  const db = getDb();
  const today = belgradeDate(now);
  const [customer] = [...(await db.execute<{ name: string }>(sql`SELECT name FROM customers WHERE id = ${customerId}::uuid`))];
  if (!customer) throw new CustomerOfferError("Kupac ne postoji.");

  const recs = await recommendationRows({ customerIds: [customerId] }, { customerStatus: "svi", includeDismissed: true, limit: 5000 });
  const codes = [...new Set(recs.map((r) => r.articleCode))];
  const codeList = codes.length ? sql.join(codes.map((c) => sql`${c}`), sql`, `) : sql`NULL`;

  const [articleRows, lines, dismissals] = await Promise.all([
    db.execute<{ id: string; code: string; name: string; brand: string | null; unit: string | null }>(sql`
      SELECT a.id, a.code, coalesce(sn.name, a.name) AS name, a.brand, a.unit
        FROM articles a LEFT JOIN article_sales_names sn ON sn.article_id = a.id
       WHERE a.code IN (${codeList})`),
    // Poslednjih HISTORY kupovina po šifri, iz istih potvrđenih stavki koje vidi obračun.
    db.execute<{ code: string; d: string; q: string; p: string; r: string; amt: string }>(sql`
      SELECT code, d, q, p, r, amt FROM (
        SELECT ril.article_code AS code, ril.issued_on::text AS d, il.quantity::text AS q, il.unit_price::text AS p,
               il.discount_percent::text AS r, il.line_amount::text AS amt,
               row_number() OVER (PARTITION BY ril.article_code ORDER BY ril.issued_on DESC, ril.line_number DESC) AS rb
          FROM recommendation_input_lines ril JOIN invoice_lines il ON il.id = ril.invoice_line_id
         WHERE ril.customer_id = ${customerId}::uuid AND ril.issued_on <= ${today}::date AND ril.article_code IN (${codeList})
      ) x WHERE rb <= ${HISTORY}
      ORDER BY code, d DESC`),
    db.execute<{ id: string; code: string; reason: string; note: string | null; repl: string | null; by: string; at: string }>(sql`
      SELECT d.id, d.article_code AS code, d.reason, d.note,
             CASE WHEN ra.id IS NULL THEN NULL ELSE ra.code || ' · ' || ra.name END AS repl,
             u.name AS by, to_char(d.created_at AT TIME ZONE 'Europe/Belgrade', 'YYYY-MM-DD') AS at
        FROM customer_article_dismissals d
        JOIN users u ON u.id = d.created_by
        LEFT JOIN articles ra ON ra.id = d.replacement_article_id
       WHERE d.customer_id = ${customerId}::uuid AND d.revoked_at IS NULL`),
  ]);

  const byCode = new Map([...articleRows].map((a) => [a.code, a]));
  const ids = [...articleRows].map((a) => a.id);
  const pairs = ids.length ? await loadRequiredPairs(db, ids) : [];
  const lidIds = [...new Set(pairs.map((p) => p.companionId))];
  const lidRows = lidIds.length
    ? [...(await db.execute<{ id: string; code: string }>(sql`SELECT id, code FROM articles WHERE id IN (${sql.join(lidIds.map((i) => sql`${i}::uuid`), sql`, `)})`))]
    : [];
  const lidCode = new Map(lidRows.map((l) => [l.id, l.code]));
  const { prices } = await customerPrices(customerId, [...new Set([...ids, ...lidIds])], today, null);
  const priceOf = (id: string | null): { price: Price; note: string | null } => {
    const p = id ? prices.get(id) : undefined;
    if (!p) return { price: null, note: "artikal nije u šifarniku" };
    if (p.status !== "cena") return { price: null, note: p.message.replace(/^Cena na upit:\s*/, "") };
    if (p.baseCents === null || p.netCents === null) return { price: null, note: "na upit" };
    return { price: { baseCents: p.baseCents, discountPercent: p.discountPercent, netCents: p.netCents }, note: null };
  };

  const hist = new Map<string, OfferPurchase[]>();
  for (const l of lines) {
    const list = hist.get(l.code) ?? [];
    list.push({ issuedOn: l.d, quantity: Number(l.q), unitPrice: Number(l.p), discountPercent: Number(l.r), lineAmount: Number(l.amt) });
    hist.set(l.code, list);
  }
  const dis = new Map([...dismissals].map((d) => [d.code, d]));

  const rows: OfferRow[] = recs.map((r) => {
    const a = byCode.get(r.articleCode) ?? null;
    const h = hist.get(r.articleCode) ?? [];
    const { price, note } = priceOf(a?.id ?? null);
    const pair = a ? pairs.find((p) => p.articleId === a.id) : undefined;
    const d = dis.get(r.articleCode);
    return {
      articleCode: r.articleCode,
      articleId: a?.id ?? null,
      articleName: a?.name ?? r.articleName ?? r.articleCode,
      brand: a?.brand ?? null,
      unit: a?.unit ?? null,
      rec: {
        status: r.status,
        confidence: r.confidence,
        eventCount: r.eventCount,
        medianIntervalDays: r.medianIntervalDays,
        expectedNextOn: r.expectedNextOn,
        daysUntilExpected: r.daysUntilExpected,
        lastPurchaseOn: r.lastPurchaseOn,
        daysSinceLastPurchase: r.daysSinceLastPurchase,
        explanation: r.explanation,
      },
      last: h[0] ?? null,
      history: h,
      today: price,
      todayNote: note,
      lid: pair ? { code: lidCode.get(pair.companionId) ?? "", name: pair.companionName } : null,
      dismissal: d
        ? { id: d.id, reason: d.reason, reasonLabel: dismissReasonLabel(d.reason), replacement: d.repl, note: d.note, by: d.by, at: d.at }
        : null,
    };
  });

  return {
    customer: { id: customerId, name: customer.name },
    today,
    asOfDate: recs[0]?.asOfDate ?? null,
    rows,
    /** Za ponudu: poklopci po šifri posude, sa cenom kupca. */
    lids: pairs.map((p) => {
      const { price } = priceOf(p.companionId);
      const container = [...articleRows].find((a) => a.id === p.articleId);
      return { containerCode: container?.code ?? "", code: lidCode.get(p.companionId) ?? "", name: p.companionName, price };
    }),
  };
}

export type CustomerOffer = Awaited<ReturnType<typeof loadCustomerOffer>>;

/** „Ne uzima više“: upis oznake. Dupla aktivna oznaka se odbija (jedinstveni indeks). */
export async function dismissArticle(
  viewer: PortalUser,
  input: { customerId: string; articleCode: unknown; reason: unknown; replacementCode?: unknown; note?: unknown },
) {
  await assertCustomerInScope(viewer, input.customerId);
  const parsed = parseDismissal(input);
  if (!parsed.ok) throw new CustomerOfferError(parsed.error);
  const v = parsed.value;
  const db = getDb();
  // Artikal mora biti među artiklima koje je ovaj kupac kupovao (ne može se „skinuti“ tuđi artikal).
  const [bought] = [
    ...(await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM recommendation_input_lines WHERE customer_id = ${input.customerId}::uuid AND article_code = ${v.articleCode}`)),
  ];
  if (!bought || bought.n === 0) throw new CustomerOfferError("Kupac ovaj artikal nije kupovao.");
  const [article] = [...(await db.execute<{ id: string }>(sql`SELECT id FROM articles WHERE code = ${v.articleCode} LIMIT 1`))];
  let replacementId: string | null = null;
  if (v.replacementCode) {
    const [r] = [...(await db.execute<{ id: string }>(sql`SELECT id FROM articles WHERE code = ${v.replacementCode} LIMIT 1`))];
    if (!r) throw new CustomerOfferError("Artikal za zamenu ne postoji u šifarniku.");
    replacementId = r.id;
  }
  try {
    await db.execute(sql`
      INSERT INTO customer_article_dismissals (customer_id, article_code, article_id, reason, replacement_article_id, note, created_by)
      VALUES (${input.customerId}::uuid, ${v.articleCode}, ${article?.id ?? null}, ${v.reason}, ${replacementId}, ${v.note}, ${viewer.id}::uuid)`);
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new CustomerOfferError("Artikal je već označen kao „ne uzima više“.");
    throw error;
  }
}

/** „Vrati u preporuke“: jednokratno zatvaranje oznake (zapis ostaje). */
export async function restoreArticle(viewer: PortalUser, input: { customerId: string; dismissalId: string }) {
  await assertCustomerInScope(viewer, input.customerId);
  const db = getDb();
  const done = await db.execute<{ id: string }>(sql`
    UPDATE customer_article_dismissals SET revoked_at = now(), revoked_by = ${viewer.id}::uuid
     WHERE id = ${input.dismissalId}::uuid AND customer_id = ${input.customerId}::uuid AND revoked_at IS NULL
     RETURNING id`);
  if (![...done].length) throw new CustomerOfferError("Oznaka je već vraćena ili ne postoji. Osvežite stranicu.");
}
