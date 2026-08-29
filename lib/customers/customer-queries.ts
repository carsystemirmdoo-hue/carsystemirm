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
