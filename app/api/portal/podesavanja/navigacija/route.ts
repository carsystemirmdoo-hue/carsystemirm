import { z } from "zod";
import { SIDEBAR_PREFERENCE_KEY } from "@/components/portal/sidebarState.mjs";
import { getPortalUser } from "@/lib/authz/session";
import { writeUserPreference } from "@/lib/authz/user-repository";

export const runtime = "nodejs";

/** Odgovor je vezan za nalog; ne kešira se nigde. */
const NO_STORE = { "Cache-Control": "private, no-store" };

const bodySchema = z.object({
  key: z.literal(SIDEBAR_PREFERENCE_KEY),
  value: z.boolean(),
});

/**
 * Pamti stanje leve navigacije uz nalog, da izbor prati korisnika i na drugom
 * računaru. Kolačić je već upisan na klijentu, pa neuspeh ovde ne kvari prikaz.
 */
export async function POST(request: Request) {
  const user = await getPortalUser();
  if (!user) {
    return Response.json({ error: "Potrebna je prijava." }, { status: 401, headers: NO_STORE });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Neispravan zahtev." }, { status: 400, headers: NO_STORE });
  }

  await writeUserPreference(user.id, parsed.data.key, parsed.data.value);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
