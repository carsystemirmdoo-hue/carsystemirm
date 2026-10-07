import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadResumedCustomerHeader, tryResumeCustomerSession } from "@/lib/auth/remember-session";
import { loadCartCount } from "@/lib/ordering/ordering-service";

/**
 * Stanje kupčeve prijave za javno zaglavlje.
 *
 * Javne strane su statične; zaglavlje ovo pita posle učitavanja, pa prijava
 * ne pretvara katalog u dinamičke strane. Vraća samo ono što zaglavlje
 * prikazuje — naziv firme i ime — i nikad se ne kešira.
 *
 * `loginLink`: da li neprijavljen posetilac vidi „Prijava za kupce". Podrazumevano
 * NE (`NEXT_PUBLIC_CUSTOMER_LOGIN_LINK`, build podešavanje), dok kupčevi nalozi
 * ne budu pušteni.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let session: { customerId: string; customerName: string; name: string } | null = await getCustomerSession().catch(() => null);
  // Zapamćen uređaj: sesija je istekla, pa se obnavlja ovde, pre ostalih poziva sa strane.
  if (!session) {
    const accountId = await tryResumeCustomerSession().catch(() => null);
    if (accountId) session = await loadResumedCustomerHeader(accountId);
  }
  // Broj stavki u korpi SOPSTVENE firme; bez korpe (ili bez tabele) nula.
  const cartCount = session ? await loadCartCount(session.customerId).catch(() => 0) : 0;
  const body = session
    ? { signedIn: true, company: session.customerName, name: session.name, cartCount }
    : { signedIn: false, loginLink: process.env.NEXT_PUBLIC_CUSTOMER_LOGIN_LINK === "1" };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
  });
}
