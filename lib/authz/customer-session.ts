import "server-only";
import { forbidden, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { customers, customerUsers } from "@/db/schema";
import type { CustomerAccountStatus } from "@/db/schema/customer-accounts";
import {
  canCustomerSignIn,
  isCustomerSubject,
  resolveCustomerScope,
} from "@/lib/authz/customer-scope.mjs";
import { isSessionVersionCurrent } from "@/lib/authz/user-repository";

/** Ruta prijave za kupce; odvojena od interne. */
export const CUSTOMER_LOGIN_ROUTE = "/prijava/kupac";

export interface CustomerSession {
  /** ID naloga u `customer_users`, ne u `users`. */
  accountId: string;
  /**
   * Kupac kome nalog pripada.
   *
   * Uvek iz baze, po ID-u iz sesije. Nijedan handler ne sme čitati ovu vrednost
   * iz `searchParams`, `params` ni tela zahteva — vidi `assertCustomerScope`.
   */
  customerId: string;
  customerName: string;
  email: string;
  name: string;
  status: CustomerAccountStatus;
}

/**
 * Učitava kupčev nalog iz sesije, ili `null`.
 *
 * Tri nezavisna uslova, svaki sposoban sam da odbije:
 *   1. token mora IZRIČITO tvrditi da je kupčev (`subject === "customer"`);
 *   2. nalog mora postojati u `customer_users` — interni ID ovde ne postoji;
 *   3. stanje naloga mora dozvoljavati prijavu, a verzija sesije mora biti tekuća.
 *
 * Interni `getPortalUser()` ostaje nepromenjen i za ovaj token vraća `null`,
 * jer `loadPortalUser()` gleda tabelu `users` u kojoj takvog reda nema.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) return null;

  // Odsustvo claim-a nije kupac. Vidi `lib/authz/customer-scope.mjs`.
  if (!isCustomerSubject(session.user)) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: customerUsers.id,
      customerId: customerUsers.customerId,
      customerName: customers.name,
      email: customerUsers.email,
      name: customerUsers.name,
      status: customerUsers.status,
      sessionVersion: customerUsers.sessionVersion,
    })
    .from(customerUsers)
    .innerJoin(customers, eq(customers.id, customerUsers.customerId))
    .where(eq(customerUsers.id, accountId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!canCustomerSignIn(row.status)) return null;
  if (!isSessionVersionCurrent(session.user.sessionVersion, row.sessionVersion)) {
    return null;
  }

  return {
    accountId: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    email: row.email,
    name: row.name,
    status: row.status,
  };
}

/**
 * Jedini ulaz u kupčeve podatke.
 *
 * Pravilo bez izuzetka: svaki upit u kupčevoj putanji uzima `customerId`
 * odavde. Nema parametra kojim bi pozivalac mogao da traži drugog kupca — ne
 * zato što bi bio odbijen, nego zato što takav parametar ne postoji.
 */
export async function requireCustomerSession(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect(CUSTOMER_LOGIN_ROUTE);
  return session;
}

/**
 * Kapija za rute koje nose `customerId` u adresi.
 *
 * Postoji zato što će takve rute postojati (deljivi linkovi, bookmark-ovi), a
 * ne sme se desiti da promena ID-a u adresi tiho vrati kupcu njegove podatke —
 * to bi značilo da opseg izgleda kao da radi, a nikad nije bio proveren.
 * Neslaganje je 403, ne preusmeravanje.
 */
export async function assertCustomerScope(
  requestedCustomerId: string | null | undefined,
): Promise<CustomerSession> {
  const session = await requireCustomerSession();
  const { refused } = resolveCustomerScope({
    sessionCustomerId: session.customerId,
    requestedCustomerId,
  });
  if (refused) forbidden();
  return session;
}

export class CustomerApiError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "CustomerApiError";
  }
}

/** Varijanta za route handler-e: status umesto preusmeravanja. */
export async function requireCustomerApiSession(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) throw new CustomerApiError(401, "Potrebna je prijava.");
  return session;
}
