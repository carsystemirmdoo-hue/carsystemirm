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
export async function trialCustomerIds(): Promise<string[]> {
  const [row] = [...(await getDb().execute<{ value: { customerIds?: unknown } }>(sql`SELECT value FROM system_settings WHERE key = 'ordering.trial'`))];
  const ids = row?.value?.customerIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
}

export async function isTrialCustomer(customerId: string): Promise<boolean> {
  return (await trialCustomerIds()).includes(customerId);
}

/** Zahtev uključen za ovog kupca: svi (CUSTOMER_ORDERING=cenovnik) ili izdvojeni test kupac. */
export async function orderingEnabledFor(customerId: string): Promise<boolean> {
  if (process.env.CUSTOMER_ORDERING === "cenovnik") return true;
  return isTrialCustomer(customerId);
}
