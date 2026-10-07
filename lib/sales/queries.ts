import "server-only";
import { SALES_LINES_LIMIT } from "@/lib/sales/limits";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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

export interface SalesFilter {
  from?: string | null;
  to?: string | null;
  customerId?: string | null;
  salespersonId?: string | null;
  articleId?: string | null;
  productGroup?: string | null;
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
  if (scope !== null) conditions.push(inArray(invoices.customerId, scope));
  if (filter.from) conditions.push(gte(invoices.issuedOn, filter.from));
  if (filter.to) conditions.push(lte(invoices.issuedOn, filter.to));
  if (filter.customerId) conditions.push(eq(invoices.customerId, filter.customerId));
  if (filter.salespersonId)
    conditions.push(eq(invoices.salespersonId, filter.salespersonId));
  if (filter.articleId) conditions.push(eq(invoiceLines.articleId, filter.articleId));
  if (filter.productGroup)
    conditions.push(eq(articles.productGroup, filter.productGroup));

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
