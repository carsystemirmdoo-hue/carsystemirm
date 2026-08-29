import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { customers, customerUsers } from "@/db/schema";
import type { CustomerAccountStatus } from "@/db/schema/customer-accounts";
import {
  canCustomerSignIn,
  isCustomerSubject,
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
   * iz `searchParams`, `params` ni tela zahteva; `app/kupac/**` strane ne
   * primaju nijedan takav prop, pa ga ni ne mogu pročitati.
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

/*
 * `requireCustomerApiSession` i `assertCustomerScope` su UKLONJENI.
 *
 * Postojali su za kupčeve rute koje primaju `customerId` iz adrese — a takva
 * ruta ne postoji: `app/kupac/page.tsx` ne prima nijedan prop. Bili su dakle
 * bezbednosne kontrole koje se nigde ne izvršavaju, a bile su unit-testirane,
 * pa su stvarale utisak zaštite koja radi. Postflight audit, F-9.
 *
 * Kada kupčeva ruta sa ID-em u adresi bude postojala, kapija se dodaje ZAJEDNO
 * sa njom i sa IDOR testom nad tom rutom — ne unapred i ne bez potrošača.
 */
