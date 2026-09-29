import { getCustomerSession } from "@/lib/authz/customer-session";

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
  const session = await getCustomerSession().catch(() => null);
  const body = session
    ? { signedIn: true, company: session.customerName, name: session.name }
    : { signedIn: false, loginLink: process.env.NEXT_PUBLIC_CUSTOMER_LOGIN_LINK === "1" };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
  });
}
