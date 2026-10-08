"use server";

import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import { registerAttempt } from "@/lib/auth/rate-limit-service";
import { CustomerAccountError } from "@/lib/customers/account-service";
import {
  activateWithInvitation,
  CUSTOMER_PASSWORD_MIN,
} from "@/lib/customers/invitation-service";

export type ActivationState = { error: string | null; ok: string | null };

/**
 * Ista poruka za svaki neuspeh tokena.
 *
 * Istekao, već iskorišćen i nepostojeći token spolja izgledaju identično.
 * Razlika bi rekla napadaču da je pogodio oblik tokena ili da je nalog
 * postojao.
 */
const GENERIC_TOKEN_ERROR =
  "Link nije važeći ili je istekao. Zatražite nov od kancelarije.";

const schema = z.object({
  token: z.string().trim().min(8).max(200),
  password: z.string().min(CUSTOMER_PASSWORD_MIN).max(200),
  confirm: z.string().min(1).max(200),
});

function parse(formData: FormData) {
  return schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
}

export async function activateAccountAction(
  _previous: ActivationState,
  formData: FormData,
): Promise<ActivationState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      error: `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      ok: null,
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Lozinke se ne poklapaju.", ok: null };
  }

  /*
   * Brojač se povećava PRE provere tokena, kao kod promene lozinke kodom:
   * pogodak ne sme proći bez traga u brojaču.
   */
  const decision = await registerAttempt({
    scope: "customer_activation",
    accountIdentifier: parsed.data.token,
    clientIp: await clientIpFromRequest(),
  });
  if (!decision.allowed) {
    await recordAudit({
      actor: { id: null, name: "Neprijavljen", role: "anon" },
      action: AUDIT_ACTIONS.rateLimitBlocked,
      entityType: "Aktivacija kupčevog naloga",
      // Ni token ni lozinka ne ulaze u trag.
      reason: "Previše pokušaja aktivacije naloga",
    });
    return {
      error: "Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.",
      ok: null,
    };
  }

  try {
    const { ok } = await activateWithInvitation(parsed.data);
    return ok
      ? { error: null, ok: "Nalog je aktiviran. Možete se prijaviti." }
      : { error: GENERIC_TOKEN_ERROR, ok: null };
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }
}

/*
 * Samostalna promena zaboravljene lozinke je ISKLJUČENA (odluka 2026-10-01).
 *
 * Bez slanja e-pošte token za reset nije imao kuda da ode: servis ga je
 * pravio i odbacivao, a kancelarija nije mogla da ga preda. Dok ne postoji
 * bezbedno slanje pošte, oporavak ide novom pozivnicom iz
 * /portal/kupci/nalozi. Akcije `requestResetAction` i `completeResetAction`
 * su zato uklonjene (ne samo sakrivene): server akcija je dostupna i bez
 * dugmeta. Servisne funkcije u `lib/customers/invitation-service.ts` ostaju
 * za trenutak kada se uključi pošta.
 */
