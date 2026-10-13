import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/**
 * Kontrolisana proba zahteva za porudžbinu.
 *
 * `system_settings['ordering.trial'] = { customerIds: [...] }` — izdvojeni TEST
 * kupci (bez faktura, nisu stvarne firme) kojima je zahtev uključen i kada je
 * poručivanje za sve ostale isključeno. `CUSTOMER_ORDERING=cenovnik` uključuje
 * za sve (posle pregleda vlasnika).
 */
export async function trialCustomerIds(q: Pick<ReturnType<typeof getDb>, "execute"> = getDb()): Promise<string[]> {
  const [row] = [...(await q.execute<{ value: { customerIds?: unknown } }>(sql`SELECT value FROM system_settings WHERE key = 'ordering.trial'`))];
  const ids = row?.value?.customerIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
}

export async function isTrialCustomer(customerId: string, q: Pick<ReturnType<typeof getDb>, "execute"> = getDb()): Promise<boolean> {
  return (await trialCustomerIds(q)).includes(customerId);
}

/** Zahtev uključen za ovog kupca: svi (CUSTOMER_ORDERING=cenovnik) ili izdvojeni test kupac. */
export async function orderingEnabledFor(customerId: string, q: Pick<ReturnType<typeof getDb>, "execute"> = getDb()): Promise<boolean> {
  if (process.env.CUSTOMER_ORDERING === "cenovnik") return true;
  return isTrialCustomer(customerId, q);
}
