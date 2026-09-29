import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices } from "@/db/schema";

/**
 * Upiti u kupčevoj putanji.
 *
 * Svaka funkcija prima `customerId` kao PRVI, obavezan argument, i svaka ga
 * stavlja u `WHERE` — nikad u filtriranje posle učitavanja. Razlika nije u
 * performansama: upit koji povuče sve pa filtrira u JavaScriptu je upit koji
 * je već pročitao tuđe podatke, i dovoljna je jedna izostavljena linija da ih
 * i pošalje.
 *
 * Nijedna funkcija ovde ne čita `searchParams`, `params` ni telo zahteva.
 * Vrednost dolazi iz `requireCustomerSession()`, i to je jedini izvor.
 */

export type CustomerDocumentSummary = {
  totalDocuments: number;
  lastIssuedOn: string | null;
};

/** Broj dokumenata i datum poslednjeg — bez ijednog iznosa. */
export async function loadCustomerDocumentSummary(
  customerId: string,
): Promise<CustomerDocumentSummary> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const db = getDb();
  const rows = await db
    .select({
      total: count(),
      last: sql<string | null>`max(${invoices.issuedOn})`,
    })
    .from(invoices)
    .where(eq(invoices.customerId, customerId));

  return {
    totalDocuments: rows[0]?.total ?? 0,
    lastIssuedOn: rows[0]?.last ?? null,
  };
}

export type CustomerDocumentRow = {
  id: string;
  number: string;
  year: number;
  issuedOn: string;
  documentKind: string;
};

/**
 * Dokumenti jednog kupca.
 *
 * Iznosi se NAMERNO ne vraćaju u ovoj fazi. Cena koju bi kupac ovde video bila
 * bi istorijska, a istorijska cena prikazana bez ograde lako se pročita kao
 * obećanje buduće cene. Vidi `docs/b2b/01-target-architecture.md`, AD-3.
 */
export async function loadCustomerDocuments(
  customerId: string,
  limit = 50,
): Promise<CustomerDocumentRow[]> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const db = getDb();
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      year: invoices.year,
      issuedOn: invoices.issuedOn,
      documentKind: invoices.documentKind,
    })
    .from(invoices)
    .where(eq(invoices.customerId, customerId))
    .orderBy(desc(invoices.issuedOn))
    .limit(limit);
}

/* =========================================================================
 * F5 — kupčev nalog: fakture sa pretragom, detalj i pregled firme
 *
 * Svaka funkcija prima `customerId` kao OBAVEZAN prvi argument, i pozivalac
 * ga uzima isključivo iz kupčeve sesije. ID dokumenta iz adrese se uvek
 * proverava ZAJEDNO sa firmom (`id = $1 AND customer_id = $2`): tuđ i
 * nepostojeći dokument daju isti odgovor — `null`.
 * ====================================================================== */

export type CustomerInvoiceFilter = {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
};

export type CustomerInvoiceListRow = {
  id: string;
  number: string;
  year: number;
  issuedOn: string;
  documentKind: string;
  lineCount: number;
  totalAmount: string;
  currency: string | null;
  confirmed: boolean;
};

export const CUSTOMER_INVOICE_PAGE_SIZE = 25;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeInvoiceFilter(raw: {
  q?: string;
  od?: string;
  do?: string;
  strana?: string;
}): Required<CustomerInvoiceFilter> {
  const q = (raw.q ?? "").trim().slice(0, 80);
  const from = raw.od && ISO.test(raw.od) ? raw.od : null;
  const to = raw.do && ISO.test(raw.do) ? raw.do : null;
  const page = Math.max(1, Math.min(1000, Number.parseInt(raw.strana ?? "1", 10) || 1));
  return { q: q || null, from, to, page };
}

export async function loadCustomerInvoices(
  customerId: string,
  filter: CustomerInvoiceFilter,
): Promise<{ rows: CustomerInvoiceListRow[]; total: number; page: number; pageSize: number }> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const page = filter.page ?? 1;
  const conditions = [sql`i.customer_id = ${customerId}`];
  if (filter.from) conditions.push(sql`i.issued_on >= ${filter.from}::date`);
  if (filter.to) conditions.push(sql`i.issued_on <= ${filter.to}::date`);
  if (filter.q) {
    // Džokeri iz unosa se ne tumače kao obrazac.
    const term = `%${filter.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(sql`(
      i.number ILIKE ${term}
      OR (i.number || '/' || i.year) ILIKE ${term}
      OR EXISTS (SELECT 1 FROM invoice_lines l
                  WHERE l.invoice_id = i.id
                    AND (l.article_code ILIKE ${term} OR coalesce(l.description, '') ILIKE ${term}))
    )`);
  }
  const where = sql.join(conditions, sql` AND `);
  const db = getDb();
  const [countRows, rows] = await Promise.all([
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM invoices i WHERE ${where}`),
    db.execute<{
      id: string; number: string; year: number; issued_on: string; document_kind: string;
      line_count: number; total_amount: string; currency: string | null; confirmed: boolean;
    }>(sql`
      SELECT i.id, i.number, i.year, i.issued_on::text AS issued_on, i.document_kind::text AS document_kind,
             (SELECT count(*)::int FROM invoice_lines l WHERE l.invoice_id = i.id) AS line_count,
             i.total_amount::text AS total_amount, i.currency,
             EXISTS (SELECT 1 FROM source_documents sd
                      WHERE sd.invoice_id = i.id AND sd.validation_status = 'valid'
                        AND sd.revision_status = 'original') AS confirmed
        FROM invoices i
       WHERE ${where}
       ORDER BY i.issued_on DESC, i.number DESC
       LIMIT ${CUSTOMER_INVOICE_PAGE_SIZE} OFFSET ${(page - 1) * CUSTOMER_INVOICE_PAGE_SIZE}`),
  ]);
  return {
    total: [...countRows][0]?.n ?? 0,
    page,
    pageSize: CUSTOMER_INVOICE_PAGE_SIZE,
    rows: [...rows].map((r) => ({
      id: r.id,
      number: r.number,
      year: r.year,
      issuedOn: r.issued_on,
      documentKind: r.document_kind,
      lineCount: r.line_count,
      totalAmount: r.total_amount,
      currency: r.currency,
      confirmed: r.confirmed,
    })),
  };
}

export type CustomerInvoiceDetail = {
  id: string;
  number: string;
  year: number;
  issuedOn: string;
  documentKind: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string | null;
  origin: string;
  ingestedAt: Date | null;
  confirmed: boolean;
  lines: {
    lineNumber: number;
    articleCode: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    discountPercent: string | null;
    lineAmount: string;
  }[];
};

export async function loadCustomerInvoice(
  customerId: string,
  invoiceId: string,
): Promise<CustomerInvoiceDetail | null> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) return null;
  const db = getDb();
  const [head] = [
    ...(await db.execute<{
      id: string; number: string; year: number; issued_on: string; document_kind: string;
      net_amount: string; tax_amount: string; total_amount: string; currency: string | null;
      origin: string; ingested_at: Date | null; confirmed: boolean;
    }>(sql`
      SELECT i.id, i.number, i.year, i.issued_on::text AS issued_on, i.document_kind::text AS document_kind,
             i.net_amount::text AS net_amount, i.tax_amount::text AS tax_amount, i.total_amount::text AS total_amount,
             i.currency, i.origin::text AS origin,
             (SELECT max(sd.created_at) FROM source_documents sd WHERE sd.invoice_id = i.id) AS ingested_at,
             EXISTS (SELECT 1 FROM source_documents sd
                      WHERE sd.invoice_id = i.id AND sd.validation_status = 'valid'
                        AND sd.revision_status = 'original') AS confirmed
        FROM invoices i
       WHERE i.id = ${invoiceId}::uuid AND i.customer_id = ${customerId}`)),
  ];
  if (!head) return null;
  const lines = await db.execute<{
    line_number: number; article_code: string; description: string | null; quantity: string;
    unit_price: string; discount_percent: string | null; line_amount: string;
  }>(sql`
    SELECT l.line_number, l.article_code, l.description, l.quantity::text AS quantity,
           l.unit_price::text AS unit_price, l.discount_percent::text AS discount_percent,
           l.line_amount::text AS line_amount
      FROM invoice_lines l
      JOIN invoices i ON i.id = l.invoice_id
     WHERE l.invoice_id = ${invoiceId}::uuid AND i.customer_id = ${customerId}
     ORDER BY l.line_number`);
  return {
    id: head.id,
    number: head.number,
    year: head.year,
    issuedOn: head.issued_on,
    documentKind: head.document_kind,
    netAmount: head.net_amount,
    taxAmount: head.tax_amount,
    totalAmount: head.total_amount,
    currency: head.currency,
    origin: head.origin,
    ingestedAt: head.ingested_at ? new Date(head.ingested_at) : null,
    confirmed: head.confirmed,
    lines: [...lines].map((l) => ({
      lineNumber: l.line_number,
      articleCode: l.article_code,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discountPercent: l.discount_percent,
      lineAmount: l.line_amount,
    })),
  };
}

export async function loadCustomerOverview(customerId: string) {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const db = getDb();
  const [row] = [
    ...(await db.execute<{
      name: string; pib: string; city: string | null; invoices: number; last_issued_on: string | null;
      first_issued_on: string | null; last_ingested_at: Date | null; reps: string[] | null;
    }>(sql`
      SELECT c.name, c.pib, c.city,
             (SELECT count(*)::int FROM invoices i WHERE i.customer_id = c.id) AS invoices,
             (SELECT max(issued_on)::text FROM invoices i WHERE i.customer_id = c.id) AS last_issued_on,
             (SELECT min(issued_on)::text FROM invoices i WHERE i.customer_id = c.id) AS first_issued_on,
             (SELECT max(sd.created_at) FROM source_documents sd JOIN invoices i ON i.id = sd.invoice_id
               WHERE i.customer_id = c.id) AS last_ingested_at,
             (SELECT array_agg(u.name ORDER BY u.name) FROM customer_assignments ca
                JOIN users u ON u.id = ca.user_id AND u.active
               WHERE ca.customer_id = c.id) AS reps
        FROM customers c WHERE c.id = ${customerId}`)),
  ];
  return row
    ? {
        name: row.name,
        pib: row.pib,
        city: row.city,
        invoices: row.invoices,
        lastIssuedOn: row.last_issued_on,
        firstIssuedOn: row.first_issued_on,
        lastIngestedAt: row.last_ingested_at ? new Date(row.last_ingested_at) : null,
        reps: row.reps ?? [],
      }
    : null;
}

export type CustomerPurchasedArticle = {
  articleCode: string;
  /** Količina po kupovini (zbir po dokumentu) i jedinice mere sa tog dokumenta. */
  events: { issuedOn: string; quantity: number; units: (string | null)[] }[];
  mapping: {
    status: string;
    catalogProductSlug: string | null;
    catalogVariantId: string | null;
    note: string | null;
  } | null;
};

/**
 * Kupljeni artikli jednog kupca za „Poručite ponovo": količine po kupovini i
 * živa veza sa katalogom. Isti ulaz kao preporuke (`recommendation_input_lines`
 * — samo potvrđeni dokumenti). Cena se NE čita.
 */
export async function loadCustomerPurchasedArticles(
  customerId: string,
  today: string,
): Promise<CustomerPurchasedArticle[]> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const db = getDb();
  const [events, mappings] = await Promise.all([
    db.execute<{ article_code: string; issued_on: string; quantity: string; units: (string | null)[] }>(sql`
      SELECT ril.article_code, ril.issued_on::text AS issued_on,
             sum(il.quantity)::text AS quantity,
             array_agg(DISTINCT coalesce(btrim(a.unit), '')) AS units
        FROM recommendation_input_lines ril
        JOIN invoice_lines il ON il.id = ril.invoice_line_id
        LEFT JOIN articles a ON a.id = il.article_id
       WHERE ril.customer_id = ${customerId}
         AND ril.issued_on <= ${today}::date
       GROUP BY ril.article_code, ril.invoice_id, ril.issued_on
       ORDER BY ril.issued_on`),
    db.execute<{ code: string; status: string; slug: string | null; variant: string | null; note: string | null }>(sql`
      SELECT a.code, m.status::text AS status, m.catalog_product_slug AS slug,
             m.catalog_variant_id AS variant, m.note
        FROM article_catalog_mappings m
        JOIN articles a ON a.id = m.article_id
       WHERE m.status NOT IN ('rejected', 'revoked')
         AND a.code IN (
           SELECT DISTINCT article_code FROM recommendation_input_lines
            WHERE customer_id = ${customerId})`),
  ]);

  const byCode = new Map<string, CustomerPurchasedArticle>();
  for (const e of events) {
    const item = byCode.get(e.article_code) ?? { articleCode: e.article_code, events: [], mapping: null };
    item.events.push({ issuedOn: e.issued_on, quantity: Number(e.quantity), units: e.units ?? [] });
    byCode.set(e.article_code, item);
  }
  for (const m of mappings) {
    const item = byCode.get(m.code);
    if (!item) continue;
    // Dva artikla iste šifre sa različitim vezama: nijedna se ne prikazuje.
    item.mapping = item.mapping
      ? { status: "conflict", catalogProductSlug: null, catalogVariantId: null, note: null }
      : { status: m.status, catalogProductSlug: m.slug, catalogVariantId: m.variant, note: m.note };
  }
  return [...byCode.values()];
}
