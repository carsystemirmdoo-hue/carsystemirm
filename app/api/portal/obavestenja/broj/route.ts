import { apiAuthResponse, requireApiCapability } from "@/lib/authz/session";
import { countUnreadFor } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/** Broj nepročitanih obaveštenja koja pozivalac sme da vidi — za zvonce u gornjoj traci. */
export async function GET() {
  try {
    const user = await requireApiCapability("view:obavestenja");
    return Response.json({ unread: await countUnreadFor(user) }, { headers: NO_STORE });
  } catch (error) {
    const r = apiAuthResponse(error);
    if (r) return r;
    throw error;
  }
}
