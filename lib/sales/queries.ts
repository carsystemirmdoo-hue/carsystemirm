import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  articles,
  customers,
  invoiceLines,
  invoices,
  salespeople,
} from "@/db/schema";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { loadAssignedCustomerIds } from "@/lib/authz/user-repository";
import type { PortalUser } from "@/lib/authz/session";
import { effectiveInvoiceCondition } from "@/lib/ledger/effective-invoice";
import { SALES_LINES_LIMIT } from "@/lib/sales/limits";
import {
  PHYSICAL_RETURN_KINDS,
  VALUE_CORRECTION_KINDS,
} from "@/lib/sales/totals.mjs";

export interface SalesFilter {
  from?: string | null;
  to?: string | null;
  customerId?: string | null;
  salespersonId?: string | null;
  articleId?: string | null;
  productGroup?: string | null;
  /** Samo negativne stavke (povrati, korekcije, nerazvrstano) — za listu na ekranu Povrati. */
  onlyNegative?: boolean;
}

export interface SalesLine {
  invoiceId: string;
  invoiceNumber: string;
  issuedOn: string;
  documentKind: string;
  sourceDocumentType: string | null;
  customerId: string;
  customerName: string;
  salespersonId: string | null;
  salespersonName: string | null;
  articleId: string | null;
  articleCode: string;
  articleName: string | null;
  productGroup: string | null;
  quantity: number;
  lineAmount: number;
}

/**
 * Opseg kupaca koji korisnik sme da vidi.
 *
 * Vraća `null` kada nema ograničenja. Prazan niz znači „nijedan kupac“ i mora
 * da da prazan rezultat — nikada ceo promet firme.
 */
export async function customerScope(user: PortalUser): Promise<string[] | null> {
  if (seesAllCustomers(user)) return null;
  return loadAssignedCustomerIds(user.id);
}

/**
 * Stavke prometa u opsegu korisnika.
 *
 * Ograničenje se primenjuje u samom upitu, a ne posle učitavanja — tako podaci
 * izvan opsega nikada ne napuste bazu.
 */
export async function loadSalesLines(
  user: PortalUser,
  filter: SalesFilter = {},
  limit = SALES_LINES_LIMIT,
): Promise<SalesLine[]> {
  const scope = await customerScope(user);
  if (scope !== null && scope.length === 0) return [];

  // Samo dokumenti koji važe za promet — isto pravilo kao `effective_sales_ledger`.
  const conditions = [effectiveInvoiceCondition()];
  conditions.push(...filterConditions(scope, filter));

  const rows = await getDb()
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
      issuedOn: invoices.issuedOn,
      documentKind: invoices.documentKind,
      sourceDocumentType: invoices.sourceDocumentType,
      customerId: invoices.customerId,
      customerName: customers.name,
      salespersonId: invoices.salespersonId,
      salespersonName: salespeople.name,
      articleId: invoiceLines.articleId,
      articleCode: invoiceLines.articleCode,
      articleName: articles.name,
      productGroup: articles.productGroup,
      quantity: invoiceLines.quantity,
      lineAmount: invoiceLines.lineAmount,
    })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .leftJoin(salespeople, eq(salespeople.id, invoices.salespersonId))
    .leftJoin(articles, eq(articles.id, invoiceLines.articleId))
    .where(and(...conditions))
    .orderBy(desc(invoices.issuedOn), asc(invoices.number))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    lineAmount: Number(row.lineAmount),
  }));
}

/**
 * Uslovi filtera i opsega — ISTI za stavke i za agregate, da zbir na ekranu
 * uvek odgovara skupu iz kog su izvučeni redovi.
 */
function filterConditions(scope: string[] | null, filter: SalesFilter): SQL[] {
  const conditions: SQL[] = [];
  if (scope !== null) conditions.push(inArray(invoices.customerId, scope));
  if (filter.from) conditions.push(gte(invoices.issuedOn, filter.from));
  if (filter.to) conditions.push(lte(invoices.issuedOn, filter.to));
  if (filter.customerId) conditions.push(eq(invoices.customerId, filter.customerId));
  if (filter.salespersonId)
    conditions.push(eq(invoices.salespersonId, filter.salespersonId));
  if (filter.articleId) conditions.push(eq(invoiceLines.articleId, filter.articleId));
  if (filter.productGroup)
    conditions.push(eq(articles.productGroup, filter.productGroup));
  if (filter.onlyNegative) conditions.push(lt(invoiceLines.lineAmount, "0"));
  return conditions;
}

/** Zbirovi u istom obliku kao `summarize()` iz `totals.mjs`, plus brojači. */
export interface SalesSummary {
  gross: number;
  returnValue: number;
  returnedQuantity: number;
  correctionValue: number;
  unknownNegativeValue: number;
  unknownNegativeCount: number;
  net: number;
  invoiceCount: number;
  lineCount: number;
  negativeLineCount: number;
  /** Stavke sa upisanim komercijalistom (PDF uvoz ga ne nosi). */
  linesWithSalesperson: number;
  firstIssuedOn: string | null;
  lastIssuedOn: string | null;
}

export interface SalesBreakdownRow extends SalesSummary {
  key: string;
  label: string;
  /** Za prikaz po kupcu: ID za drill-down. */
  customerId: string | null;
}

export type SalesBreakdownView = "kupci" | "komercijalisti" | "artikli" | "grupe";

const listaVrsta = (vrste: readonly string[]) =>
  sql.join(vrste.map((v) => sql`${v}`), sql`, `);

/**
 * Agregati nad CELIM filtriranim skupom, u bazi — bez granice broja stavki.
 *
 * Razvrstavanje je isto kao u `summarize()`: pozitivan iznos je bruto;
 * negativan je povrat (fizički povrat), korekcija ili nerazvrstan, isključivo
 * po vrsti dokumenta. Sume su `numeric` u bazi, zaokruživanje na 2 decimale
 * tek na kraju.
 */
function agregatPolja() {
  const iznos = sql`${invoiceLines.lineAmount}`;
  const vrsta = sql`${invoices.documentKind}::text`;
  const povrat = sql`(${iznos} < 0 AND ${vrsta} IN (${listaVrsta(PHYSICAL_RETURN_KINDS)}))`;
  const korekcija = sql`(${iznos} < 0 AND ${vrsta} IN (${listaVrsta(VALUE_CORRECTION_KINDS)}))`;
  const nerazvrstano = sql`(${iznos} < 0 AND NOT ${povrat} AND NOT ${korekcija})`;
  return {
    gross: sql<string>`round(coalesce(sum(${iznos}) FILTER (WHERE ${iznos} >= 0), 0), 2)`,
    returnValue: sql<string>`round(coalesce(sum(${iznos}) FILTER (WHERE ${povrat}), 0), 2)`,
    returnedQuantity: sql<string>`round(coalesce(sum(${invoiceLines.quantity}) FILTER (WHERE ${povrat}), 0), 3)`,
    correctionValue: sql<string>`round(coalesce(sum(${iznos}) FILTER (WHERE ${korekcija}), 0), 2)`,
    unknownNegativeValue: sql<string>`round(coalesce(sum(${iznos}) FILTER (WHERE ${nerazvrstano}), 0), 2)`,
    unknownNegativeCount: sql<number>`(count(*) FILTER (WHERE ${nerazvrstano}))::int`,
    net: sql<string>`round(coalesce(sum(${iznos}), 0), 2)`,
    invoiceCount: sql<number>`count(DISTINCT ${invoices.id})::int`,
    lineCount: sql<number>`count(*)::int`,
    negativeLineCount: sql<number>`(count(*) FILTER (WHERE ${iznos} < 0))::int`,
    linesWithSalesperson: sql<number>`(count(*) FILTER (WHERE ${invoices.salespersonId} IS NOT NULL))::int`,
    firstIssuedOn: sql<string | null>`min(${invoices.issuedOn})::text`,
    lastIssuedOn: sql<string | null>`max(${invoices.issuedOn})::text`,
  };
}

function uBrojeve<T extends Record<string, unknown>>(row: T): SalesSummary {
  return {
    gross: Number(row.gross),
    returnValue: Number(row.returnValue),
    returnedQuantity: Number(row.returnedQuantity),
    correctionValue: Number(row.correctionValue),
    unknownNegativeValue: Number(row.unknownNegativeValue),
    unknownNegativeCount: Number(row.unknownNegativeCount),
    net: Number(row.net),
    invoiceCount: Number(row.invoiceCount),
    lineCount: Number(row.lineCount),
    negativeLineCount: Number(row.negativeLineCount),
    linesWithSalesperson: Number(row.linesWithSalesperson),
    firstIssuedOn: (row.firstIssuedOn as string | null) ?? null,
    lastIssuedOn: (row.lastIssuedOn as string | null) ?? null,
  };
}

const PRAZAN_ZBIR: SalesSummary = {
  gross: 0, returnValue: 0, returnedQuantity: 0, correctionValue: 0,
  unknownNegativeValue: 0, unknownNegativeCount: 0, net: 0, invoiceCount: 0,
  lineCount: 0, negativeLineCount: 0, linesWithSalesperson: 0,
  firstIssuedOn: null, lastIssuedOn: null,
};

/** Ukupni zbirovi filtriranog skupa — nezavisni od granice prikaza stavki. */
export async function loadSalesSummary(
  user: PortalUser,
  filter: SalesFilter = {},
): Promise<SalesSummary> {
  const scope = await customerScope(user);
  if (scope !== null && scope.length === 0) return { ...PRAZAN_ZBIR };

  // Samo dokumenti koji važe za promet — isto pravilo kao `effective_sales_ledger`.
  const conditions = [effectiveInvoiceCondition()];
  conditions.push(...filterConditions(scope, filter));

  const [row] = await getDb()
    .select(agregatPolja())
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .leftJoin(salespeople, eq(salespeople.id, invoices.salespersonId))
    .leftJoin(articles, eq(articles.id, invoiceLines.articleId))
    .where(and(...conditions));
  return row ? uBrojeve(row) : { ...PRAZAN_ZBIR };
}

/**
 * Zbirovi po kupcu, komercijalisti, artiklu ili grupi — nad celim skupom.
 * Redosled: neto opadajuće (kao `summarizeBy`), pa naziv.
 */
export async function loadSalesBreakdown(
  user: PortalUser,
  filter: SalesFilter,
  view: SalesBreakdownView,
): Promise<SalesBreakdownRow[]> {
  const scope = await customerScope(user);
  if (scope !== null && scope.length === 0) return [];

  // Samo dokumenti koji važe za promet — isto pravilo kao `effective_sales_ledger`.
  const conditions = [effectiveInvoiceCondition()];
  conditions.push(...filterConditions(scope, filter));

  const kljuc: Record<SalesBreakdownView, { key: SQL<string>; label: SQL<string>; customerId: SQL<string | null> }> = {
    kupci: {
      key: sql<string>`${customers.id}::text`,
      label: sql<string>`${customers.name}`,
      customerId: sql<string | null>`${customers.id}::text`,
    },
    komercijalisti: {
      key: sql<string>`coalesce(${salespeople.id}::text, '—')`,
      label: sql<string>`coalesce(${salespeople.name}, 'Bez komercijaliste')`,
      customerId: sql<string | null>`NULL::text`,
    },
    artikli: {
      key: sql<string>`${invoiceLines.articleCode} || ' · ' || coalesce(${articles.name}, '')`,
      label: sql<string>`trim(${invoiceLines.articleCode} || ' · ' || coalesce(${articles.name}, ''))`,
      customerId: sql<string | null>`NULL::text`,
    },
    grupe: {
      key: sql<string>`coalesce(${articles.productGroup}, 'Bez grupe')`,
      label: sql<string>`coalesce(${articles.productGroup}, 'Bez grupe')`,
      customerId: sql<string | null>`NULL::text`,
    },
  };
  const k = kljuc[view];

  const rows = await getDb()
    .select({ key: k.key, label: k.label, customerId: k.customerId, ...agregatPolja() })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .leftJoin(salespeople, eq(salespeople.id, invoices.salespersonId))
    .leftJoin(articles, eq(articles.id, invoiceLines.articleId))
    .where(and(...conditions))
    .groupBy(sql`1, 2, 3`)
    .orderBy(sql`round(coalesce(sum(${invoiceLines.lineAmount}), 0), 2) DESC`, sql`2`);

  return rows.map((row) => ({
    key: String(row.key),
    label: String(row.label),
    customerId: (row.customerId as string | null) ?? null,
    ...uBrojeve(row),
  }));
}

/** Da li uopšte postoji ijedna uvezena faktura — razlikuje „prazno“ od „nije povezano“. */
export async function hasImportedInvoices(): Promise<boolean> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .limit(1);
  return (row?.count ?? 0) > 0;
}

/** Kupci u opsegu korisnika, za filtere i liste. */
export async function loadScopedCustomers(user: PortalUser) {
  const scope = await customerScope(user);
  if (scope !== null && scope.length === 0) return [];
  return getDb()
    .select({
      id: customers.id,
      pib: customers.pib,
      name: customers.name,
      city: customers.city,
      active: customers.active,
    })
    .from(customers)
    .where(scope !== null ? inArray(customers.id, scope) : undefined)
    .orderBy(asc(customers.name));
}

export async function loadSalespeople() {
  return getDb()
    .select({ id: salespeople.id, name: salespeople.name })
    .from(salespeople)
    .orderBy(asc(salespeople.name));
}

export async function loadProductGroups() {
  const rows = await getDb()
    .selectDistinct({ productGroup: articles.productGroup })
    .from(articles);
  return rows
    .map((row) => row.productGroup)
    .filter((group): group is string => Boolean(group))
    .sort((a, b) => a.localeCompare(b, "sr-Latn"));
}

/** Stavke jedne fakture — poslednji nivo drill-down-a. */
export async function loadInvoiceDetail(user: PortalUser, invoiceId: string) {
  const scope = await customerScope(user);

  const [invoice] = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      year: invoices.year,
      issuedOn: invoices.issuedOn,
      documentKind: invoices.documentKind,
      sourceDocumentType: invoices.sourceDocumentType,
      customerId: invoices.customerId,
      customerName: customers.name,
      customerPib: customers.pib,
      salespersonName: salespeople.name,
      netAmount: invoices.netAmount,
      totalAmount: invoices.totalAmount,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .leftJoin(salespeople, eq(salespeople.id, invoices.salespersonId))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) return null;
  // Ista provera opsega kao i svuda: tuđa faktura se ne otvara ni direktnim ID-om.
  if (scope !== null && !scope.includes(invoice.customerId)) return null;

  const lines = await getDb()
    .select({
      lineNumber: invoiceLines.lineNumber,
      articleCode: invoiceLines.articleCode,
      description: invoiceLines.description,
      quantity: invoiceLines.quantity,
      unitPrice: invoiceLines.unitPrice,
      discountPercent: invoiceLines.discountPercent,
      lineAmount: invoiceLines.lineAmount,
    })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.lineNumber));

  return { invoice, lines };
}
