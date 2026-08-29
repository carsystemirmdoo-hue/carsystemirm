import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";

/**
 * Jedini ulaz u promet.
 *
 * Sve što kasnije bude čitalo prodaju — preporuke, prognoza, analitika,
 * „poslednja fakturisana cena" — mora ići kroz ovaj modul. Drugi upit nad
 * `invoices` bi bio druga istina, i prvo neslaganje bi se otkrilo tek u
 * poređenju sa knjigovodstvom.
 *
 * Opseg je OBAVEZAN parametar. Bez njega bi svaki novi pozivalac nasledio
 * rupu — a upravo je to bio nalaz F-2 nad pricing ekranima.
 */

export type LedgerBucket =
  | "gross_sales"
  | "returns"
  | "cancellations"
  | "corrections"
  | "unclassified";

export type LedgerScope = {
  /** `null` znači bez ograničenja; prazan niz znači nijedan kupac. */
  customerIds: string[] | null;
};

/**
 * Razrešava opseg iz baze, po istom pravilu kao ostatak portala.
 *
 * Prazan niz i `null` NISU isto: komercijalista bez ijedne dodele mora dobiti
 * prazan rezultat, ne ceo promet firme.
 */
export async function resolveLedgerScope(user: PortalUser): Promise<LedgerScope> {
  if (seesAllCustomers(user)) return { customerIds: null };
  return { customerIds: await loadAssignedCustomerIds(user.id) };
}

/** Opseg kupca — kupac vidi isključivo svoju firmu. */
export function customerLedgerScope(customerId: string): LedgerScope {
  if (!customerId) {
    throw new Error("Ledger bez customer_id se ne sme izvršiti.");
  }
  return { customerIds: [customerId] };
}

function scopeCondition(scope: LedgerScope) {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) {
    // Izričito „nijedan red", umesto izostavljanja uslova.
    return sql`false`;
  }
  /*
   * Parametrizovano, ne `sql.raw`.
   *
   * ID-jevi danas dolaze iz baze, ali obrazac koji ih lepi u tekst upita je
   * obrazac koji sledeci pozivalac prekopira sa vrednoscu iz zahteva.
   */
  const list = sql.join(scope.customerIds.map((id) => sql`${id}`), sql`, `);
  return sql`customer_id IN (${list})`;
}

/**
 * Zbirke po kofama.
 *
 * `amount` je TEKST, ne broj.
 *
 * Zbir se računa u bazi nad `numeric` kolonama i egzaktan je. Pretvaranje u
 * JS broj bi ga vratilo u binarni float pre nego što ga iko vidi — a ovaj
 * modul je jedini ulaz u promet, pa bi svaki kasniji potrošač nasledio istu
 * grešku. Ko treba da prikaže iznos, formatira tekst; ko treba da računa,
 * računa u bazi.
 */
export type LedgerTotals = Record<LedgerBucket, { lines: number; amount: string }> & {
  net_effective_sales: { lines: number; amount: string };
};

const EMPTY: LedgerTotals = {
  gross_sales: { lines: 0, amount: "0" },
  returns: { lines: 0, amount: "0" },
  cancellations: { lines: 0, amount: "0" },
  corrections: { lines: 0, amount: "0" },
  unclassified: { lines: 0, amount: "0" },
  net_effective_sales: { lines: 0, amount: "0" },
};

/**
 * Zbirke po kofama, u opsegu korisnika.
 *
 * `net_effective_sales` NIJE zbir svih kofa. Sabira samo redove kojima pogled
 * kaže `enters_net` — dakle prodaju. Povrat, storno i korekcija se prikazuju
 * odvojeno i ne umanjuju neto dok veza sa originalom nije dokazana.
 *
 * Oba zbira računa baza. U JS-u se ništa ne sabira, pa se ni ne zaokružuje.
 */
export async function ledgerTotals(
  scope: LedgerScope,
  filter?: { from?: string; to?: string },
): Promise<LedgerTotals> {
  const db = getDb();
  const conditions = [scopeCondition(scope)];
  if (filter?.from) conditions.push(sql`issued_on >= ${filter.from}`);
  if (filter?.to) conditions.push(sql`issued_on <= ${filter.to}`);
  const where = sql.join(conditions, sql` AND `);

  const rows = await db.execute<{
    bucket: LedgerBucket | null;
    lines: number;
    amount: string;
  }>(sql`
    SELECT bucket, count(*)::int AS lines,
           coalesce(sum(line_amount), 0)::text AS amount
      FROM effective_sales_ledger
     WHERE ${where}
     GROUP BY bucket
     UNION ALL
    SELECT NULL, count(*)::int,
           coalesce(sum(line_amount), 0)::text
      FROM effective_sales_ledger
     WHERE ${where} AND enters_net
  `);

  const totals: LedgerTotals = structuredClone(EMPTY);
  for (const row of rows) {
    // `bucket IS NULL` je red sa neto zbirom iz drugog dela unije.
    const key = row.bucket ?? "net_effective_sales";
    const target = totals[key as keyof LedgerTotals] ?? totals.unclassified;
    target.lines = row.lines;
    target.amount = row.amount;
  }
  return totals;
}

export type LedgerLine = {
  invoiceId: string;
  customerId: string;
  issuedOn: string;
  documentKind: string;
  articleCode: string;
  quantity: string;
  lineAmount: string;
  bucket: LedgerBucket;
  entersNet: boolean;
};

/** Redovi prometa u opsegu korisnika. */
export async function ledgerLines(
  scope: LedgerScope,
  filter?: { articleCode?: string; limit?: number },
): Promise<LedgerLine[]> {
  const db = getDb();
  const conditions = [scopeCondition(scope)];
  if (filter?.articleCode) conditions.push(sql`article_code = ${filter.articleCode}`);
  const where = sql.join(conditions, sql` AND `);

  const rows = await db.execute<{
    invoice_id: string; customer_id: string; issued_on: string;
    document_kind: string; article_code: string; quantity: string;
    line_amount: string; bucket: LedgerBucket; enters_net: boolean;
  }>(sql`
    SELECT invoice_id, customer_id, issued_on, document_kind, article_code,
           quantity, line_amount, bucket, enters_net
      FROM effective_sales_ledger
     WHERE ${where}
     ORDER BY issued_on DESC, invoice_id, line_number
     LIMIT ${filter?.limit ?? 500}
  `);

  return rows.map((r) => ({
    invoiceId: r.invoice_id,
    customerId: r.customer_id,
    issuedOn: r.issued_on,
    documentKind: r.document_kind,
    articleCode: r.article_code,
    quantity: r.quantity,
    lineAmount: r.line_amount,
    bucket: r.bucket,
    entersNet: r.enters_net,
  }));
}

/**
 * Korektivni dokumenti bez dokazane veze sa originalom.
 *
 * Povrat, storno i knjižno odobrenje se PRIKAZUJU u svojim kofama, ali ne
 * umanjuju neto dok se ne poveže sa dokumentom koji ispravljaju. Veza traži
 * izričitu referencu u dokumentu, a nijedan stvaran uzorak je još ne pokazuje —
 * pa je danas ovaj red jednak spisku svih korektivnih dokumenata.
 *
 * Red postoji upravo zato: bez njega bi razlika između bruto i neto prometa
 * bila nevidljiva, i neko bi je pripisao grešci u računu.
 */
export async function unlinkedCorrectiveDocuments(
  scope: LedgerScope,
  filter?: { limit?: number },
): Promise<
  { invoiceId: string; issuedOn: string; documentKind: string; bucket: LedgerBucket; lines: number; amount: string }[]
> {
  const db = getDb();
  const rows = await db.execute<{
    invoice_id: string; issued_on: string; document_kind: string;
    bucket: LedgerBucket; lines: number; amount: string;
  }>(sql`
    SELECT invoice_id, issued_on, document_kind, bucket,
           count(*)::int AS lines,
           coalesce(sum(line_amount), 0)::text AS amount
      FROM effective_sales_ledger
     WHERE ${scopeCondition(scope)}
       AND NOT enters_net
       AND bucket <> 'unclassified'
     GROUP BY invoice_id, issued_on, document_kind, bucket
     ORDER BY issued_on DESC
     LIMIT ${filter?.limit ?? 200}
  `);
  return rows.map((r) => ({
    invoiceId: r.invoice_id,
    issuedOn: String(r.issued_on).slice(0, 10),
    documentKind: r.document_kind,
    bucket: r.bucket,
    lines: r.lines,
    amount: r.amount,
  }));
}

/**
 * Stavke fakture za par (kupac, artikal) — dokazni materijal usaglašavanja.
 *
 * Vraća i identitet stavke, jer je upravo ta stavka jedini dokaz koji se
 * kasnije može otvoriti. Ide kroz ledger, pa zamenjeni i sporni dokumenti ne
 * mogu potvrditi nijedno pravilo cene.
 */
export async function reconciliationEvidence(
  scope: LedgerScope,
  input: { customerId: string; articleCode: string },
): Promise<
  {
    invoiceId: string;
    invoiceLineId: string;
    issuedOn: string;
    unitPrice: number;
    discountPercent: number;
  }[]
> {
  const db = getDb();
  const rows = await db.execute<{
    invoice_id: string; invoice_line_id: string; issued_on: string;
    unit_price: string; discount_percent: string;
  }>(sql`
    SELECT invoice_id, invoice_line_id, issued_on, unit_price, discount_percent
      FROM effective_sales_ledger
     WHERE ${scopeCondition(scope)}
       AND customer_id = ${input.customerId}
       AND article_code = ${input.articleCode}
       AND enters_net
     ORDER BY issued_on, invoice_id, line_number
  `);
  return rows.map((r) => ({
    invoiceId: r.invoice_id,
    invoiceLineId: r.invoice_line_id,
    issuedOn: String(r.issued_on).slice(0, 10),
    unitPrice: Number(r.unit_price),
    discountPercent: Number(r.discount_percent),
  }));
}

/**
 * Poslednja FAKTURISANA cena za par (kupac, artikal).
 *
 * Vraća i datum, jer se bez njega ne sme prikazati: istorijska cena bez datuma
 * se čita kao obećanje buduće. Prikaz mora nositi ogradu — vidi
 * `lib/pricing/workflow.mjs:lastInvoicedPriceLabel`.
 *
 * Čita iz ledgera, ne iz `invoice_lines`, da bi zamenjeni i sporni dokumenti
 * bili isključeni na istom mestu kao i svuda drugde.
 */
export async function lastInvoicedPrice(
  scope: LedgerScope,
  input: { customerId: string; articleCode: string },
): Promise<{ unitPrice: string; discountPercent: string; issuedOn: string } | null> {
  const db = getDb();
  const rows = await db.execute<{
    unit_price: string; discount_percent: string; issued_on: string;
  }>(sql`
    SELECT unit_price, discount_percent, issued_on
      FROM effective_sales_ledger
     WHERE ${scopeCondition(scope)}
       AND customer_id = ${input.customerId}
       AND article_code = ${input.articleCode}
       AND enters_net
     ORDER BY issued_on DESC, invoice_id DESC
     LIMIT 1
  `);
  const row = rows[0];
  return row
    ? {
        unitPrice: row.unit_price,
        discountPercent: row.discount_percent,
        issuedOn: row.issued_on,
      }
    : null;
}
