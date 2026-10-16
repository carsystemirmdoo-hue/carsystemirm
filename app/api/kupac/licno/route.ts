import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadForYou } from "@/lib/customers/for-you";

/**
 * „Za Vas“ (kartice i lični redosled kataloga) za prijavljenog kupca.
 * Kupac se određuje ISKLJUČIVO iz sesije; ruta ne čita parametre. Bez sesije: 401 bez podataka.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const session = await getCustomerSession().catch(() => null);
  if (!session) return Response.json({ signedIn: false }, { status: 401, headers: NO_STORE });
  return Response.json({ signedIn: true, ...(await loadForYou(session.customerId)) }, { headers: NO_STORE });
}
