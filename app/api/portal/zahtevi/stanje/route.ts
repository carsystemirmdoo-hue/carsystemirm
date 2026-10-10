import { apiAuthResponse, requireApiCapability } from "@/lib/authz/session";
import { staffOrderStamp } from "@/lib/ordering/live-stamp";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/** Otisak liste zahteva (bez `id`) ili lanca verzija jednog zahteva, u opsegu korisnika. */
export async function GET(request: Request) {
  try {
    const user = await requireApiCapability("view:zahtevi");
    const id = new URL(request.url).searchParams.get("id");
    const stamp = await staffOrderStamp(user, id);
    if (id && stamp === null) return Response.json({ error: "Zahtev ne postoji." }, { status: 404, headers: NO_STORE });
    return Response.json({ stamp }, { headers: NO_STORE });
  } catch (error) {
    const r = apiAuthResponse(error);
    if (r) return r;
    throw error;
  }
}
