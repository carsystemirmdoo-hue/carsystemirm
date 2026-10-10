import { getCustomerSession } from "@/lib/authz/customer-session";
import { customerCartStamp, customerOrderStamp } from "@/lib/ordering/live-stamp";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/** Otisak kupčeve liste zahteva, lanca verzija jednog zahteva (`id`) ili korpe (`korpa=1`). Samo sopstvena firma. */
export async function GET(request: Request) {
  const session = await getCustomerSession().catch(() => null);
  if (!session) return Response.json({ error: "Potrebna je prijava." }, { status: 401, headers: NO_STORE });
  const params = new URL(request.url).searchParams;
  if (params.get("korpa") === "1") return Response.json({ stamp: await customerCartStamp(session.customerId) }, { headers: NO_STORE });
  const id = params.get("id");
  const stamp = await customerOrderStamp(session.customerId, id);
  if (id && stamp === null) return Response.json({ error: "Zahtev ne postoji." }, { status: 404, headers: NO_STORE });
  return Response.json({ stamp }, { headers: NO_STORE });
}
