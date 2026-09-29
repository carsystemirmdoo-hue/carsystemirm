import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadReorderList } from "@/lib/customers/reorder";

/**
 * „Poručite ponovo" za prijavljenog kupca.
 *
 * Kupac se određuje ISKLJUČIVO iz sesije; ruta ne čita nijedan parametar
 * zahteva. Bez kupčeve sesije odgovor je 401 bez ikakvih podataka — i za
 * anonimnog posetioca i za interni nalog. Nikad se ne kešira.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const session = await getCustomerSession().catch(() => null);
  if (!session) {
    return Response.json({ signedIn: false }, { status: 401, headers: NO_STORE });
  }
  const list = await loadReorderList(session.customerId);
  return Response.json({ signedIn: true, ...list }, { headers: NO_STORE });
}
